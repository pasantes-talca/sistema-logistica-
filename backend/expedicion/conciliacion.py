"""Diagnóstico sin escrituras; correcciones explícitas, serializadas y auditadas.

Un stock importado es una instantánea, no un saldo inicial cero. Nunca se
reconstruyen salidas ni se calibra usando una fecha/base de otra instalación.
"""
import hashlib
import json
from collections import defaultdict
from decimal import Decimal
from django.db.models import Max
from rest_framework.exceptions import ValidationError, PermissionDenied
from core.permissions import es_administrador
from .models import (AuditoriaExpedicion, ConfiguracionProducto, MovimientoStock,
                     OrdenCarga, StockProducto, RespaldoExpedicion)


def huella(datos):
    def normalizar(value):
        # JSON.parse/stringify de JavaScript convierte 6.0 a 6: no es un cambio.
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, dict):
            return {k: normalizar(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [normalizar(v) for v in value]
        return value
    return hashlib.sha256(json.dumps(normalizar(datos), sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest()


def firma_movimientos(hasta):
    return huella(list(MovimientoStock.objects.filter(pk__lte=hasta).order_by("pk").values(
        "id", "producto_id", "cantidad", "direccion", "sin_impacto", "sin_codificar")))


def diagnosticar():
    base = AuditoriaExpedicion.objects.filter(accion="Base de conciliación").order_by("-id").first()
    datos_base = base.despues if base else {}
    maximo = datos_base.get("movimiento_max", 0)
    base_valida = bool(base and datos_base.get("firma_movimientos") == firma_movimientos(maximo))
    cantidades = {p["producto"]: p for p in datos_base.get("productos", [])} if base_valida else {}
    netos = defaultdict(Decimal)
    sin_codificar = defaultdict(Decimal)
    movimientos = defaultdict(lambda: defaultdict(Decimal))
    for m in MovimientoStock.objects.order_by("pk"):
        if m.sin_impacto:
            continue
        delta = m.cantidad if m.direccion == "ENTRADA" else -m.cantidad
        if m.pk > maximo:
            netos[m.producto_id] += delta
            if m.sin_codificar:
                sin_codificar[m.producto_id] += delta
        if m.orden_id:
            movimientos[m.orden_id][m.producto_id] -= delta
    configs = {c.producto_id: c for c in ConfiguracionProducto.objects.all()}
    productos = []
    for s in StockProducto.objects.select_related("producto").order_by("producto__codigo"):
        c = configs.get(s.producto_id)
        b = cantidades.get(s.producto_id)
        esperado = Decimal(str(b["stock"])) + netos[s.producto_id] if b else None
        uncoded = Decimal(str(b["sin_codificar"])) + sin_codificar[s.producto_id] if b else None
        bloqueado = c.sin_codificar if c else Decimal(0)
        productos.append(dict(producto=s.producto_id, codigo=s.producto.codigo, nombre=s.producto.nombre,
            actual=str(s.cantidad_unidades), esperado=str(esperado) if esperado is not None else None,
            diferencia=str(s.cantidad_unidades - esperado) if esperado is not None else None,
            sin_codificar=str(bloqueado), sin_codificar_esperado=str(uncoded) if uncoded is not None else None,
            inconsistente=s.cantidad_unidades < 0 or bloqueado < 0 or bloqueado > s.cantidad_unidades,
            calibrable=bool(c and esperado is not None and uncoded is not None and
                esperado >= uncoded >= 0 and (esperado != s.cantidad_unidades or uncoded != bloqueado))))
    ordenes = []
    productos_ambiguos = set()
    for o in OrdenCarga.objects.prefetch_related("detalles__producto", "entregas__detalles__producto").select_related("fletero", "creado_por"):
        resueltos = defaultdict(Decimal)
        for e in o.entregas.all():
            for l in e.detalles.all():
                if l.producto_solicitado_id in (None, l.producto_id):
                    resueltos[l.producto_id] += l.cantidad_entregada
        completo = all(resueltos[l.producto_id] >= l.cantidad_solicitada for l in o.detalles.all())
        esperado = "COMPLETA" if completo else "PARCIAL" if o.entregas.all() else "RECIBIDA"
        entregado = defaultdict(Decimal)
        if not o.anulada:
            for e in o.entregas.all():
                for l in e.detalles.all():
                    entregado[l.producto_id] += l.cantidad_entregada
        diferencias = {str(pid): str(entregado[pid] - movimientos[o.pk][pid])
            for pid in sorted(set(entregado) | set(movimientos[o.pk]))
            if entregado[pid] != movimientos[o.pk][pid]}
        estado_incorrecto = not o.anulada and o.estado != esperado
        productos_ambiguos.update(int(pid) for pid in diferencias)
        if diferencias or estado_incorrecto:
            ordenes.append(dict(id=o.pk, numero=o.numero, estado=o.estado, esperado=esperado,
                estado_incorrecto=estado_incorrecto, diferencias=diferencias,
                reparable=estado_incorrecto and not diferencias))
    for p in productos:
        p["ordenes_inconsistentes"] = p["producto"] in productos_ambiguos
        if p["ordenes_inconsistentes"]:
            p["calibrable"] = False
    informe = dict(base=base.pk if base else None, base_fecha=base.fecha.isoformat() if base else None,
        base_valida=base_valida, productos=productos, ordenes=ordenes,
        aviso="Los pendientes de órdenes se calculan en vivo. Los pendientes manuales son adicionales; no se eliminan como reservas fantasma.")
    informe["huella"] = huella(informe)
    return informe


def conciliar(data, user, turno):
    """Se invoca únicamente dentro del bloqueo/idempotencia de comando()."""
    from .operativa import auditoria, texto
    if not es_administrador(user):
        raise PermissionDenied("La conciliación requiere un administrador.")
    motivo = texto(data, "motivo", obligatorio=True)
    if data.get("confirmacion") != "CONCILIAR":
        raise ValidationError("Escribí CONCILIAR para confirmar.")
    informe = diagnosticar()
    if data.get("huella") != informe["huella"]:
        raise ValidationError("Los datos cambiaron. Actualizá el diagnóstico antes de confirmar.")
    accion = data.get("accion")
    if accion == "base_conciliacion":
        if data.get("fisico_verificado") is not True:
            raise ValidationError("Confirmá que contrastaste el stock con el conteo físico.")
        if any(p["inconsistente"] for p in informe["productos"]) or not informe["productos"]:
            raise ValidationError("No se puede establecer una base vacía o con saldos inconsistentes.")
        maximo = MovimientoStock.objects.aggregate(n=Max("pk"))["n"] or 0
        auditoria(user, turno, "Base de conciliación", motivo=motivo, despues={
            "movimiento_max": maximo, "firma_movimientos": firma_movimientos(maximo),
            "productos": [{"producto": p["producto"], "stock": p["actual"], "sin_codificar": p["sin_codificar"]} for p in informe["productos"]]})
        return {"base_establecida": True}
    ids = data.get("seleccion")
    if not isinstance(ids, list) or not ids or any(type(i) is not int for i in ids) or len(set(ids)) != len(ids):
        raise ValidationError("Seleccioná los registros a conciliar.")
    if accion == "conciliar_estados":
        permitidas = {o["id"]: o for o in informe["ordenes"] if o["reparable"]}
        if not set(ids) <= permitidas.keys():
            raise ValidationError("Hay órdenes sin evidencia consistente. Revisalas individualmente.")
        for o in OrdenCarga.objects.select_for_update().filter(pk__in=ids):
            antes = {"estado": o.estado, "version": o.version}
            o.estado = permitidas[o.pk]["esperado"]
            o.version += 1
            o.save(update_fields=["estado", "version", "actualizado_en"])
            auditoria(user, turno, "Conciliar estado", o.numero, motivo, antes, {"estado": o.estado, "version": o.version})
        return {"estados_conciliados": len(ids)}
    if accion != "calibrar_stock":
        raise ValidationError("Acción de conciliación no admitida.")
    permitidos = {p["producto"]: p for p in informe["productos"] if p["calibrable"]}
    if not set(ids) <= permitidos.keys():
        raise ValidationError("La calibración necesita una base válida y cantidades no negativas.")
    from .respaldos import exportar
    RespaldoExpedicion.objects.create(usuario=user, motivo="Antes de calibrar stock", datos=exportar())
    for s in StockProducto.objects.select_for_update().filter(producto_id__in=ids):
        p = permitidos[s.producto_id]
        s.cantidad_unidades = Decimal(p["esperado"])
        s.save(update_fields=["cantidad_unidades", "actualizado_en"])
        ConfiguracionProducto.objects.filter(producto_id=s.producto_id).update(sin_codificar=Decimal(p["sin_codificar_esperado"]))
        auditoria(user, turno, "Calibrar stock", p["codigo"], motivo,
            {"stock": p["actual"], "sin_codificar": p["sin_codificar"]},
            {"stock": p["esperado"], "sin_codificar": p["sin_codificar_esperado"], "base": informe["base"]})
    return {"productos_calibrados": len(ids)}
