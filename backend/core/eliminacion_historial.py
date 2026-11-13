"""Eliminación explícita, limitada a los historiales habilitados y auditada atómicamente."""
from collections.abc import Mapping

from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .auditoria import registrar
from .permissions import puede_administrar


class EliminacionHistorialMixin:
    eliminacion_administrador = True

    def finalize_response(self, request, response, *args, **kwargs):
        self.auditoria_explicita = request.method == "DELETE"
        return super().finalize_response(request, response, *args, **kwargs)


def eliminar_registro(request, modelo, serializer, pk, modulo):
    if not puede_administrar(request.user):
        raise PermissionDenied("Solo el administrador puede eliminar estos registros.")
    datos = request.data
    if not isinstance(datos, Mapping):
        raise ValidationError("Enviá un objeto válido.")
    motivo = datos.get("motivo", "")
    if datos.get("confirmar") is not True or not isinstance(motivo, str) or not 1 <= len(motivo.strip()) <= 2000:
        raise ValidationError("Confirmá la eliminación e indicá un motivo (hasta 2000 caracteres).")
    obj = modelo.objects.select_for_update().filter(pk=pk).first()
    if obj is None:
        return Response({"error": "El registro no existe o ya fue eliminado."}, status=404)
    sello = datos.get("actualizado_en")
    try:
        actualizado = parse_datetime(sello) if isinstance(sello, str) else None
    except ValueError:
        actualizado = None
    if actualizado is None:
        raise ValidationError("Actualizá el historial antes de eliminar el registro.")
    if actualizado != obj.actualizado_en or (hasattr(obj, "version") and datos.get("version") != obj.version):
        return Response({"error": "El registro cambió desde que abriste el historial. Actualizalo y revisá sus datos antes de eliminar."}, status=409)
    if getattr(obj, "envio_estado", "") == "ENVIANDO":
        return Response({"error": "Hay un envío de correo en curso o pendiente de verificar. No se puede eliminar la planilla hasta resolverlo."}, status=409)
    antes = dict(serializer(obj).data)
    if getattr(obj, "origen_id", None):
        antes["origen_id"] = obj.origen_id
        antes["origen"] = getattr(obj, "origen", "")
    referencia = obj.pk
    # La API base ya abrió una transacción: un fallo de auditoría revierte el borrado.
    obj.delete()
    registrar(request.user, modulo, "Eliminar", referencia, motivo.strip(), antes=antes,
              despues={"eliminado": True, "nota": "El borrado no retira archivos descargados ni correos enviados."})
    return Response(status=204)
