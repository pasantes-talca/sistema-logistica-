"""Respaldos del módulo: sin credenciales, restauración atómica y copia previa."""
import json
from copy import deepcopy
from django.core import serializers
from django.core.exceptions import ValidationError as ModelValidationError
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import (Fletero, ConfiguracionProducto, StockProducto, OrdenCarga, DetalleOrdenCarga,
    EntregaOrdenCarga, DetalleEntregaOrdenCarga, MovimientoStock, MovimientoMaterial,
    EmpleadoExpedicion, ComprobanteEmpleado, ConteoExpedicion, AuditoriaExpedicion,
    RespaldoExpedicion, ControlOperativa)
from maestros.models import Producto

MODELOS = [Fletero, ConfiguracionProducto, StockProducto, EmpleadoExpedicion, OrdenCarga,
    DetalleOrdenCarga, EntregaOrdenCarga, DetalleEntregaOrdenCarga, MovimientoStock,
    MovimientoMaterial, ComprobanteEmpleado, ConteoExpedicion, AuditoriaExpedicion]


def origen_respaldo():
    # Identifica esta instalación sin exportar host, nombre de BD ni secretos.
    from django.db import connection
    from django.utils.crypto import salted_hmac
    cfg = connection.settings_dict
    identidad = {k: cfg.get(k) for k in ("ENGINE", "HOST", "PORT", "NAME", "OPTIONS")}
    return salted_hmac("expedicion.origen", json.dumps(identidad, sort_keys=True, default=str)).hexdigest()


def exportar():
    rows = []
    for model in MODELOS:
        rows.extend(serializers.serialize("python", model.objects.order_by("pk")))
    # DjangoJSONEncoder serializa fechas y Decimal sin pérdida de precisión.
    from django.core.serializers.json import DjangoJSONEncoder
    control = ControlOperativa.objects.filter(pk=1).first()
    return json.loads(json.dumps({"formato": "talca-expedicion-django", "version": 1, "origen": origen_respaldo(),
        "contadores": {"CE": control.contador_consumo if control else 0, "AE": control.contador_anticipo if control else 0},
        "productos": list(Producto.objects.values("id", "codigo", "nombre", "familia", "presentacion", "sabor", "activo")),
        "usuarios": list(get_user_model().objects.values("id", "username")), "registros": rows}, cls=DjangoJSONEncoder))


@transaction.atomic
def restaurar(payload, user, preview=False):
    if not user.is_superuser:
        raise PermissionDenied("La restauración requiere un superusuario.")
    if isinstance(payload, dict) and payload.get("formato") != "talca-expedicion-django":
        from .firebase_import import convertir
        try:
            payload = convertir(payload)
        except (KeyError, TypeError, ValueError, AttributeError) as exc:
            raise ValidationError(f"Respaldo Firebase incompleto: {exc}")
    if not isinstance(payload, dict) or payload.get("formato") != "talca-expedicion-django" or payload.get("version") != 1:
        raise ValidationError("Usá un respaldo de este sistema o uno exportado por Talca Expedición.")
    models = {m._meta.label_lower: m for m in MODELOS}
    rows = payload.get("registros")
    if not isinstance(rows, list) or len(rows) > 200000:
        raise ValidationError("El respaldo no contiene registros válidos.")
    seen = set()
    for r in rows:
        if not isinstance(r, dict) or r.get("model") not in models or not isinstance(r.get("pk"), int) or not isinstance(r.get("fields"), dict):
            raise ValidationError("El respaldo contiene tablas o registros no admitidos.")
        pair = (r["model"], r["pk"])
        if pair in seen:
            raise ValidationError("El respaldo contiene identificadores duplicados.")
        seen.add(pair)
    ctrl, _ = ControlOperativa.objects.select_for_update().get_or_create(pk=1)
    if preview:
        return {"revision": ctrl.revision, "cantidades": {m: sum(r["model"] == m for r in rows) for m in models}}
    before = exportar()
    # Las tablas compartidas (usuarios/productos) no se eliminan ni se sobrescriben.
    products = {}
    for p in payload.get("productos", []):
        if not isinstance(p, dict) or not p.get("codigo") or not isinstance(p.get("id"), int):
            raise ValidationError("Catálogo de respaldo inválido.")
        obj, _ = Producto.objects.get_or_create(codigo=p["codigo"], defaults={**{k: p.get(k, "") for k in ("nombre", "familia", "presentacion", "sabor")}, "activo": p.get("activo", True)})
        products[p["id"]] = obj.pk
    names = {u["id"]: u["username"] for u in payload.get("usuarios", [])}
    users = dict(get_user_model().objects.values_list("username", "pk"))
    # Orden inverso de dependencias. Se conserva el archivo íntegro antes del reemplazo.
    RespaldoExpedicion.objects.create(usuario=user, motivo="Antes de restaurar", datos=before)
    for model in reversed(MODELOS):
        if model != Fletero:
            model.objects.all().delete()
    try:
        for model in MODELOS:
            batch = [r for r in rows if r["model"] == model._meta.label_lower]
            for entry in serializers.deserialize("python", deepcopy(batch)):
                obj = entry.object
                for field in obj._meta.fields:
                    if not field.is_relation:
                        continue
                    old = getattr(obj, field.attname)
                    if field.related_model == Producto:
                        if old not in products and old is not None:
                            raise ValidationError("Falta un producto referenciado por el respaldo.")
                        setattr(obj, field.attname, products.get(old))
                    elif field.related_model == get_user_model():
                        setattr(obj, field.attname, users.get(names.get(old)))
                # Los tipos operativos extendidos son compatibles con las columnas históricas.
                from django.db.models import JSONField
                json_fields = [f.name for f in obj._meta.fields if isinstance(f, JSONField)]
                nullable = [f.name for f in obj._meta.fields if f.null and getattr(obj, f.attname) is None]
                if hasattr(obj, "lineas"):
                    for line in obj.lineas:
                        if "producto" in line:
                            line["producto"] = products.get(line["producto"], line["producto"])
                obj.full_clean(exclude=["tipo", "direccion", "estado", "facturacion", "turno", *json_fields, *nullable], validate_unique=False, validate_constraints=False)
                obj.save_base(raw=True)
        # Restablecer secuencias después de importar IDs explícitos (PostgreSQL).
        from django.db import connection
        from django.core.management.color import no_style
        with connection.cursor() as cursor:
            for sql in connection.ops.sequence_reset_sql(no_style(), MODELOS):
                cursor.execute(sql)
    except (ModelValidationError, IntegrityError, ValueError, KeyError, TypeError) as exc:
        raise ValidationError(f"El respaldo no es consistente: {exc}")
    ctrl.revision += 1
    from .operativa import numero
    ctrl.contador_consumo = int(numero(payload.get("contadores", {}).get("CE", 0), entero=True))
    ctrl.contador_anticipo = int(numero(payload.get("contadores", {}).get("AE", 0), entero=True))
    ctrl.save()
    AuditoriaExpedicion.objects.create(usuario=user, turno="", accion="Restaurar respaldo", motivo="Restauración confirmada por superusuario")
    return {"restaurado": True}
