"""Fusión conservadora: solo agregar, nunca resolver conflictos por fecha ni sumar stocks."""
from copy import deepcopy
from django.core import serializers
from django.core.management.color import no_style
from django.db import transaction, connection
from rest_framework.exceptions import ValidationError, PermissionDenied
from .respaldos import exportar, MODELOS, origen_respaldo
from .conciliacion import huella
from .models import ControlOperativa, AuditoriaExpedicion, RespaldoExpedicion


def insertar_nuevos(nuevos):
    from django.db.models import JSONField
    for model in MODELOS:
        batch = [r for r in nuevos if r["model"] == model._meta.label_lower]
        for entry in serializers.deserialize("python", deepcopy(batch)):
            obj = entry.object
            json_fields = [f.name for f in obj._meta.fields if isinstance(f, JSONField)]
            nullable = [f.name for f in obj._meta.fields if f.null and getattr(obj, f.attname) is None]
            obj.full_clean(exclude=["tipo", "direccion", "estado", "facturacion", "turno", *json_fields, *nullable],
                validate_unique=False, validate_constraints=False)
            obj.save_base(raw=True, force_insert=True)


def plan_fusion(archivo):
    if not isinstance(archivo, dict) or archivo.get("formato") != "talca-expedicion-django" or archivo.get("version") != 1:
        raise ValidationError("La fusión admite respaldos nativos de Logística Talca. Los de Firebase requieren importación asistida.")
    if archivo.get("origen") != origen_respaldo():
        raise ValidationError("El respaldo es de otra instalación o no identifica su origen. No es seguro fusionar sus identificadores automáticamente.")
    registros = archivo.get("registros")
    if not isinstance(registros, list) or len(registros) > 200000:
        raise ValidationError("Lista de registros inválida.")
    actual = exportar()
    # Las identidades compartidas no se adivinan ni se modifican desde una fusión.
    for clave, identidad in (("productos", "codigo"), ("usuarios", "username")):
        if not isinstance(archivo.get(clave), list):
            raise ValidationError("Falta el catálogo de identidades del respaldo.")
        locales = {p["id"]: p[identidad] for p in actual[clave]}
        vistos = set()
        for p in archivo[clave]:
            if not isinstance(p, dict) or type(p.get("id")) is not int or p["id"] in vistos or locales.get(p["id"]) != p.get(identidad):
                raise ValidationError("El respaldo contiene identidades compartidas distintas o inexistentes. Requiere revisión asistida.")
            vistos.add(p["id"])
    modelos = {m._meta.label_lower: m for m in MODELOS}
    presentes = {(r["model"], r["pk"]): r for r in actual["registros"]}
    vistos = set()
    nuevos, conflictos = [], []
    for r in registros:
        if not isinstance(r, dict) or r.get("model") not in modelos or type(r.get("pk")) is not int or r["pk"] <= 0 or not isinstance(r.get("fields"), dict):
            raise ValidationError("El respaldo contiene registros no admitidos.")
        campos = {f.name for f in modelos[r["model"]]._meta.fields if not f.primary_key}
        if set(r["fields"]) != campos:
            raise ValidationError("El respaldo no tiene el esquema completo de esta versión.")
        key = (r["model"], r["pk"])
        if key in vistos:
            raise ValidationError("Identificadores duplicados en el respaldo.")
        vistos.add(key)
        if key in presentes:
            if huella(r) != huella(presentes[key]):
                conflictos.append({"tabla": r["model"], "id": r["pk"], "campos": [
                    k for k in r["fields"] if huella(r["fields"][k]) != huella(presentes[key]["fields"][k])]})
        else:
            nuevos.append(deepcopy(r))
    combinado = deepcopy(actual)
    combinado["registros"].extend(nuevos)
    contadores = archivo.get("contadores", {})
    if not isinstance(contadores, dict) or any(type(contadores.get(k, 0)) is not int or contadores.get(k, 0) < 0 for k in ("CE", "AE")):
        raise ValidationError("Contadores inválidos.")
    combinado["contadores"] = {k: max(actual["contadores"][k], contadores.get(k, 0)) for k in ("CE", "AE")}
    return combinado, nuevos, conflictos


@transaction.atomic
def fusionar(archivo, user, revision=None, firma=None, confirmacion=None):
    if not user.is_superuser:
        raise PermissionDenied("La fusión requiere un superusuario.")
    control, _ = ControlOperativa.objects.select_for_update().get_or_create(pk=1)
    combinado, nuevos, conflictos = plan_fusion(archivo)
    resumen = {m._meta.label_lower: sum(r["model"] == m._meta.label_lower for r in nuevos) for m in MODELOS}
    token = huella({"archivo": archivo, "actual": exportar()})
    if confirmacion is None:
        if not conflictos and nuevos:
            # Validar inserciones con rollback, sin borrar ni sobrescribir filas
            # y sin tocar secuencias PostgreSQL (no son transaccionales).
            with transaction.atomic():
                insertar_nuevos(nuevos)
                transaction.get_connection().check_constraints()
                transaction.set_rollback(True)
        return {"revision": control.revision, "huella": token, "nuevos": resumen,
            "conflictos": conflictos[:100], "total_conflictos": len(conflictos), "aplicable": not conflictos and bool(nuevos)}
    if confirmacion != "FUSIONAR" or revision != control.revision or firma != token:
        raise ValidationError("La confirmación venció o los datos cambiaron. Revisá nuevamente el archivo.")
    if conflictos:
        raise ValidationError("Hay conflictos. No se sobrescribió ningún dato.")
    if not nuevos:
        raise ValidationError("El archivo no contiene registros nuevos.")
    with transaction.atomic():
        insertar_nuevos(nuevos)
        connection.check_constraints()
        transaction.set_rollback(True)
    RespaldoExpedicion.objects.create(usuario=user, motivo="Antes de fusionar respaldo", datos=exportar())
    # Insertar exclusivamente los nuevos: ni DELETE ni UPDATE de datos existentes.
    insertar_nuevos(nuevos)
    connection.check_constraints()
    with connection.cursor() as cursor:
        for sql in connection.ops.sequence_reset_sql(no_style(), MODELOS):
            cursor.execute(sql)
    control.revision += 1
    control.contador_consumo = combinado["contadores"]["CE"]
    control.contador_anticipo = combinado["contadores"]["AE"]
    control.save()
    AuditoriaExpedicion.objects.create(usuario=user, turno="", accion="Fusionar respaldo",
        motivo="Fusión aditiva confirmada; sin reemplazar registros existentes", despues={"nuevos": resumen, "archivo_sha256": huella(archivo)})
    from core.auditoria import registrar
    registrar(user, "EXPEDICION", "Fusionar respaldo", motivo="Fusión aditiva confirmada",
        despues={"nuevos": resumen, "archivo_sha256": huella(archivo)})
    return {"fusionado": True, "nuevos": resumen}
