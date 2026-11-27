"""Operación local. Nunca escribe en SQL Server ni en Persat."""
from decimal import Decimal
from django.db.models import Max, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import EventoERP, CobroERP


def evento(reparto, actor, accion, datos):
    EventoERP.objects.create(reparto=reparto, actor=actor, accion=accion, datos=datos)
    reparto.version_operativa += 1
    reparto.save(update_fields=["version_operativa"])


def cobrado(parada):
    return parada.cobros.filter(anulado_en__isnull=True).aggregate(total=Sum("importe"))["total"] or Decimal("0")


def cambiar_estado(reparto, parada, datos, actor):
    antes = parada.estado or "pendiente"
    parada.estado = datos["estado"]
    parada.observaciones_entrega = datos.get("observaciones", "")
    if parada.estado != "pendiente" and parada.orden_real is None:
        parada.orden_real = (reparto.paradas.aggregate(n=Max("orden_real"))["n"] or 0) + 1
    parada.entregado_en = timezone.now() if parada.estado == "entregado" else None
    parada.save()
    evento(reparto, actor, "estado_entrega", {"parada": parada.id, "antes": antes,
        "estado": parada.estado, "observaciones": parada.observaciones_entrega})


def mover(reparto, parada, direccion, actor):
    paradas = list(reparto.paradas.order_by("orden", "id"))
    indice = next(i for i, p in enumerate(paradas) if p.id == parada.id)
    otro = indice + (-1 if direccion == "arriba" else 1)
    if not 0 <= otro < len(paradas):
        return
    antes = [p.id for p in paradas]
    paradas[indice], paradas[otro] = paradas[otro], paradas[indice]
    for i, p in enumerate(paradas, 1):
        p.orden = i
        p.save(update_fields=["orden", "actualizado_en"])
    evento(reparto, actor, "orden_paradas", {"antes": antes, "despues": [p.id for p in paradas]})


def ajustar_importe(reparto, parada, importe, actor):
    if importe < cobrado(parada):
        raise ValidationError("El importe a cobrar no puede ser menor que lo ya cobrado.")
    antes = str(parada.importe_a_cobrar)
    parada.importe_a_cobrar = importe
    parada.importe_editado = parada.saldo_inicializado = True
    parada.save()
    evento(reparto, actor, "importe_a_cobrar", {"parada": parada.id, "antes": antes, "despues": str(importe)})


def registrar_cobro(reparto, parada, datos, actor):
    medios = datos["medios"]
    total = sum((m["importe"] for m in medios), Decimal("0"))
    serializados = [{k: str(v) if isinstance(v, Decimal) or k == "fecha_pago" and v else v
                    for k, v in m.items()} for m in medios]
    existente = CobroERP.objects.filter(solicitud=datos["solicitud"]).first()
    if existente:
        if existente.parada_id != parada.id or existente.actor_id != actor.id or existente.medios != serializados:
            raise ValidationError("La solicitud ya fue utilizada con otros datos. Recargá el reparto.")
        return existente
    if total > parada.importe_a_cobrar - cobrado(parada):
        raise ValidationError("El cobro supera el saldo TALCA de esta parada.")
    cobro = CobroERP.objects.create(parada=parada, solicitud=datos["solicitud"], importe=total,
        medios=serializados, actor=actor)
    evento(reparto, actor, "cobro", {"parada": parada.id, "cobro": cobro.id,
        "importe": str(total), "medios": serializados})
    return cobro
