"""Reabrir una orden conserva el ciclo revertido y comienza otro sin mover stock.

El límite de entregas queda en la auditoría inmutable, incluida en los respaldos.
No se eliminan entregas ni se requieren cambios de esquema en bases existentes.
"""
from collections import defaultdict
from decimal import Decimal

from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from .models import AuditoriaExpedicion, OrdenCarga


def limites_reapertura():
    limites = {}
    for datos in AuditoriaExpedicion.objects.filter(accion="Reabrir orden").order_by("id").values_list("despues", flat=True):
        if isinstance(datos, dict) and type(datos.get("orden_id")) is int:
            limites[datos["orden_id"]] = datos
    return limites


def limite_reapertura(orden):
    if (not hasattr(orden, "_limite_reapertura") or
            getattr(orden, "_limite_reapertura_version", None) != orden.version):
        evento = AuditoriaExpedicion.objects.filter(
            accion="Reabrir orden", despues__orden_id=orden.pk,
        ).order_by("-pk").first()
        orden._limite_reapertura = evento.despues if evento else {}
        orden._limite_reapertura_version = orden.version
    return orden._limite_reapertura


def entregas_vigentes(orden):
    limite = limite_reapertura(orden).get("entrega_hasta", 0)
    return [e for e in orden.entregas.all() if e.pk > limite]


def reabrir_orden(data, user, turno):
    # Se llama dentro de la transacción y el bloqueo global de comando().
    from .operativa import CIRCUITOS, auditoria, detalle_orden, texto
    orden = get_object_or_404(OrdenCarga.objects.select_for_update(), pk=data.get("id"))
    if not orden.anulada:
        raise ValidationError("La orden no está anulada. No se puede reabrir una segunda vez.")
    if data.get("version") != orden.version:
        raise ValidationError("La orden cambió. Actualizá la pantalla antes de reabrirla.")
    if data.get("confirmar") is not True:
        raise ValidationError("Confirmá que la mercadería todavía debe salir y la orden volverá a quedar pendiente.")
    motivo = texto(data, "motivo", 2000, True)
    circuito = data.get("circuito", orden.circuito)
    if circuito not in CIRCUITOS or circuito in {"immediate", "cancelled"}:
        raise ValidationError("Seleccioná un circuito pendiente de despacho; no puede ser salida inmediata ni anulada.")
    if not orden.detalles.exists() or orden.detalles.filter(cantidad_solicitada__lte=0).exists():
        raise ValidationError("La orden no conserva un pedido válido. Revisá sus datos antes de reabrirla.")
    if not AuditoriaExpedicion.objects.filter(accion="Anular orden", despues__id=orden.pk, despues__anulada=True).exists():
        raise ValidationError("Esta orden antigua no conserva una anulación verificable. Requiere revisión antes de reabrirla.")
    stock = defaultdict(Decimal)
    for m in orden.movimientos_stock.all():
        if not m.sin_impacto:
            stock[m.producto_id] += m.cantidad if m.direccion == "SALIDA" else -m.cantidad
    materiales = defaultdict(Decimal)
    for m in orden.movimientos_materiales.all():
        materiales[(m.fletero_id, "pallets")] += m.pallets_salida - m.pallets_entrada
        materiales[(m.fletero_id, "chapadur")] += m.chapadur_salida - m.chapadur_entrada
    if any(stock.values()) or any(materiales.values()):
        raise ValidationError("La reversión de stock o materiales no está completa. No se puede reabrir automáticamente.")
    antes = detalle_orden(orden)
    limites = {
        "orden_id": orden.pk,
        "entrega_hasta": orden.entregas.aggregate(n=Max("pk"))["n"] or 0,
        "movimiento_hasta": orden.movimientos_stock.aggregate(n=Max("pk"))["n"] or 0,
        "material_hasta": orden.movimientos_materiales.aggregate(n=Max("pk"))["n"] or 0,
    }
    orden.anulada = False
    orden.circuito = circuito
    orden.estado = OrdenCarga.Estado.RECIBIDA
    orden.version += 1
    orden.save(update_fields=["anulada", "circuito", "estado", "version", "actualizado_en"])
    auditoria(user, turno, "Reabrir orden", orden.numero, motivo, antes, {
        **limites, "id": orden.pk, "anulada": False, "estado": "RECIBIDA",
        "circuito": circuito, "version": orden.version,
        "nota": "Pedido pendiente completo. Reabrir no modifica stock ni materiales.",
    })
    return {"id": orden.pk, "reabierta": True, "version": orden.version}
