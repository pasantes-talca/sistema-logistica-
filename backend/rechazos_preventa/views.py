import hmac
import json
from datetime import date

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.response import Response

from core.api import APIView

from .dominio import departamentos_geojson
from .persat import obtener_entrega
from .servicios import MOVILES, guardar_entregas, resumen, revision

MAX_BODY = 2_000_000


def _fecha(value, default):
    return date.fromisoformat(value) if value else default


class ResumenAPIView(APIView):
    def get(self, request):
        today = timezone.localdate()
        movil = request.query_params.get("movil", "")
        try:
            desde = _fecha(request.query_params.get("desde"), today.replace(day=1))
            hasta = _fecha(request.query_params.get("hasta"), today)
            if desde > hasta:
                raise ValueError("Rango invertido")
            if movil and movil not in MOVILES:
                raise ValueError("Móvil inválido")
        except ValueError:
            return Response({"detail": "Revisá las fechas (AAAA-MM-DD) y el móvil."}, status=400)
        return Response(resumen(desde, hasta, movil))


class RevisionAPIView(APIView):
    def get(self, request):
        return Response({"revision": revision()})


class MapaAPIView(APIView):
    def get(self, request):
        return Response(departamentos_geojson())


@csrf_exempt
@require_POST
def webhook_persat(request, token):
    secret = getattr(settings, "PERSAT_WEBHOOK_TOKEN", "")
    if len(secret) < 32 or not hmac.compare_digest(token.encode(), secret.encode()):
        return JsonResponse({"error": "No autorizado"}, status=403)
    if len(request.body) > MAX_BODY:
        return JsonResponse({"error": "Tamaño inválido"}, status=413)
    try:
        event = json.loads(request.body)
    except (ValueError, UnicodeError):
        return JsonResponse({"error": "Evento inválido"}, status=400)
    if not isinstance(event, dict) or event.get("eventType") != "delivery.finished":
        return JsonResponse({"estado": "ignorado"})
    identifier = (event.get("payload") or {}).get("_id")
    if not isinstance(identifier, str) or not identifier.strip():
        return JsonResponse({"error": "Falta ID de entrega"}, status=400)
    try:
        # Fetch the current delivery: payloads can be partial and corrected rejections must update.
        guardar_entregas([obtener_entrega(identifier)])
    except (RuntimeError, ValueError):
        return JsonResponse({"error": "No se pudo actualizar la entrega. Reintentar el evento."}, status=503)
    return JsonResponse({"estado": "actualizado", "id_entrega": identifier})
