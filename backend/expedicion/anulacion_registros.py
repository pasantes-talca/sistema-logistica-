"""Anulaciones administrativas: compensación verificable, nunca borrado de trazabilidad."""
from collections import defaultdict
from decimal import Decimal
import hashlib
import json

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from core.permissions import puede_administrar
from .models import AuditoriaExpedicion, ComprobanteEmpleado, ConteoExpedicion, MovimientoMaterial, MovimientoStock, OperacionExpedicion, EmpleadoExpedicion


def huella(valor):
    return hashlib.sha256(json.dumps(valor, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def referencias_anuladas():
    return set(AuditoriaExpedicion.objects.filter(accion="Anular registro").values_list("referencia", flat=True))


def decorar(datos):
    from .reapertura import limites_reapertura
    limites = limites_reapertura()
    anuladas = referencias_anuladas()
    ordenes_anuladas = {o['id'] for o in datos['ordenes'] if o['anulada']}
    grupos = defaultdict(list)
    for m in datos["movimientos"]:
        grupos[m["operacion"]].append(dict(m))
    firmas = {k: huella(sorted(v, key=lambda x:x["id"])) for k,v in grupos.items()}
    for m in datos["movimientos"]:
        reversion = m['tipo']=='ANULACION'
        revertido = m['id'] <= limites.get(m.get('orden'), {}).get('movimiento_hasta', 0)
        m.update(huella=firmas[m["operacion"]], anulado=not reversion and (revertido or f'movimiento:{m["operacion"]}' in anuladas or m.get('orden') in ordenes_anuladas), reversion=reversion)
    for lista, tipo in [("materiales","material"),("comprobantes","comprobante"),("conteos","conteo")]:
        for fila in datos[lista]:
            firma = huella(fila)
            fila.update(huella=firma, anulado=f'{tipo}:{fila["id"]}' in anuladas)
            if tipo == "material":
                fila["reversion"] = fila["origen"].startswith("Anulación")
                revertido = fila['id'] <= limites.get(fila.get('orden'), {}).get('material_hasta', 0)
                if not fila['reversion'] and (revertido or fila.get('orden') in ordenes_anuladas):
                    fila['anulado'] = True
    return datos


def _material_inverso(m, data, user, turno):
    from .operativa import fecha
    return MovimientoMaterial.objects.create(fletero=m.fletero, orden=m.orden, creado_por=user, turno=turno,
        fecha_operativa=fecha(data), referencia=m.referencia, origen="Anulación administrativa", observaciones=data["motivo"],
        pallets_salida=m.pallets_entrada, pallets_entrada=m.pallets_salida,
        chapadur_salida=m.chapadur_entrada, chapadur_entrada=m.chapadur_salida)


def _revertir(movimientos, data, user, turno, op):
    from .operativa import mover, configuracion
    nuevos = []
    for m in movimientos:
        if m.cantidad <= 0:
            raise ValidationError("El registro antiguo contiene cantidades no positivas. Revisalo antes de revertir.")
        if m.sin_codificar and not m.sin_impacto:
            c = configuracion(m.producto)
            if c.sin_codificar < m.cantidad:
                raise ValidationError("Parte de esta producción ya fue codificada. Primero hay que resolver esa codificación.")
            c.sin_codificar -= m.cantidad
            c.save(update_fields=["sin_codificar"])
        nuevo = mover(m.producto, m.cantidad, "SALIDA" if m.direccion == "ENTRADA" else "ENTRADA", "ANULACION",
            {**data,"referencia": m.referencia, "justificacion": data["motivo"]}, user, turno, op, orden=m.orden, neutral=m.sin_impacto)
        nuevos.append(nuevo.pk)
    return nuevos


def anular_registro(data, user, turno, op):
    from .operativa import snapshot, auditoria
    if not puede_administrar(user):
        raise PermissionDenied("Solo el administrador puede anular estos registros.")
    tipo, ident = data.get("tipo_registro"), str(data.get("registro", ""))
    if tipo not in {"movimiento", "material", "comprobante", "conteo"}:
        raise ValidationError("Tipo de registro inválido.")
    motivo = data.get("motivo")
    if data.get("confirmar") is not True or not isinstance(motivo,str) or not 1 <= len(motivo.strip()) <= 2000:
        raise ValidationError("Confirmá la anulación e indicá un motivo (hasta 2000 caracteres).")
    data = {**data, "motivo": motivo.strip()}
    referencia = f"{tipo}:{ident}"
    if referencia in referencias_anuladas():
        raise ValidationError("Este registro ya fue anulado. No se revertirá una segunda vez.")
    actual = snapshot(user)
    coleccion = {"movimiento":"movimientos","material":"materiales","comprobante":"comprobantes","conteo":"conteos"}[tipo]
    filas = [f for f in actual[coleccion] if str(f["operacion"] if tipo=="movimiento" else f["id"])==ident]
    if not filas: raise ValidationError("El registro ya no existe.")
    if data.get("huella") != filas[0]["huella"]:
        raise ValidationError("El registro cambió. Actualizá la pantalla antes de anularlo.")
    if any(f.get("reversion") for f in filas):
        raise ValidationError("Las reversiones no se vuelven a anular. Registrá una nueva operación si corresponde.")
    resultado = {"registro_anulado": referencia, "reversiones_stock": [], "reversiones_materiales": []}
    if tipo=="movimiento":
        ms = list(MovimientoStock.objects.select_for_update().filter(operacion=ident).select_related("producto").order_by("producto_id","pk"))
        if any(m.orden_id for m in ms): raise ValidationError("Anulá la orden completa para revertir también sus materiales y pendientes.")
        if any(m.tipo in {"CONSUMO_EMPLEADO","ANTICIPO_EMPLEADO"} for m in ms):
            raise ValidationError("Anulá el comprobante del empleado para devolver también su saldo de beneficio.")
        materiales = []
        if any(m.tipo=="TRANSFERENCIA" for m in ms):
            operacion = OperacionExpedicion.objects.filter(pk=ident).first()
            vinculados = operacion.resultado.get("materiales_vinculados") if operacion else None
            if vinculados is None:
                raise ValidationError("Esta transferencia antigua no identifica sus materiales asociados. Requiere revisar esos vínculos antes de una reversión automática.")
            materiales = list(MovimientoMaterial.objects.select_for_update().filter(pk__in=vinculados))
            if len(materiales)!=len(vinculados): raise ValidationError("Faltan materiales vinculados a la transferencia.")
            if any(f"material:{m.pk}" in referencias_anuladas() for m in materiales): raise ValidationError("Ya se anularon materiales asociados. Revisá la transferencia.")
        resultado["reversiones_stock"] = _revertir(ms, data,user,turno,op)
        for m in materiales:
            resultado["reversiones_materiales"].append(_material_inverso(m,data,user,turno).pk)
            auditoria(user,turno,"Anular registro",f"material:{m.pk}",data["motivo"],despues={"transferencia":ident})
    elif tipo=="material":
        m = get_object_or_404(MovimientoMaterial.objects.select_for_update(),pk=ident)
        if m.orden_id: raise ValidationError("Anulá la orden completa para revertir el conjunto de la operación.")
        if m.origen.startswith(("Recepción desde ", "Envío a ")):
            raise ValidationError("Este material corresponde a una transferencia. Anulá la transferencia completa desde Movimientos; si es antigua, revisá primero sus vínculos.")
        # Un material vinculado a transferencia se revierte junto a esa transferencia.
        if any(m.pk in r.get("materiales_vinculados",[]) for r in OperacionExpedicion.objects.values_list("resultado",flat=True)):
            raise ValidationError("Este material pertenece a una transferencia: anulá la transferencia completa desde Movimientos.")
        resultado["reversiones_materiales"] = [_material_inverso(m,data,user,turno).pk]
    elif tipo=="comprobante":
        c = get_object_or_404(ComprobanteEmpleado.objects.select_for_update(),pk=ident)
        e = get_object_or_404(EmpleadoExpedicion.objects.select_for_update(),pk=c.empleado_id)
        ms = list(MovimientoStock.objects.select_for_update().filter(referencia=filas[0]["numero"],tipo="CONSUMO_EMPLEADO" if c.tipo=="CONSUMO" else "ANTICIPO_EMPLEADO").select_related("producto").order_by("producto_id","pk"))
        esperado, encontrado = defaultdict(Decimal), defaultdict(Decimal)
        beneficio = Decimal(0)
        for l in c.lineas:
            esperado[int(l["producto"])] += Decimal(str(l["unidades"]))
            if c.tipo=="CONSUMO":
                pack = Decimal(str(l.get("pack",0)))
                if pack<=0: raise ValidationError("El comprobante antiguo no conserva la equivalencia del beneficio.")
                beneficio += Decimal(str(l["unidades"]))/pack
        for m in ms: encontrado[m.producto_id] += m.cantidad if m.direccion=="SALIDA" else -m.cantidad
        if not esperado or esperado!=encontrado or beneficio!=int(beneficio):
            raise ValidationError("Los movimientos no coinciden con el comprobante. Revisá el registro antes de revertir.")
        resultado["reversiones_stock"] = _revertir(ms,data,user,turno,op)
        e.saldo_fardos += int(beneficio)
        e.save(update_fields=["saldo_fardos"])
        resultado["beneficio_devuelto"] = int(beneficio)
        for operacion in set(str(m.operacion) for m in ms):
            auditoria(user,turno,"Anular registro",f"movimiento:{operacion}",data["motivo"],despues={"comprobante":c.pk})
    else:
        get_object_or_404(ConteoExpedicion.objects.select_for_update(),pk=ident)
        resultado["nota"] = "El conteo es informativo; no modificó el stock. No se alteran otros relevos."
    auditoria(user,turno,"Anular registro",referencia,data["motivo"],{"registros":filas},resultado)
    return resultado
