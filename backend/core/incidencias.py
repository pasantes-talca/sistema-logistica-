"""No registra cuerpos, cookies, tokens, SQL, contraseñas ni mensajes de excepción."""
import logging
from django.db import transaction
from django.utils import timezone
from .models import IncidenciaSistema
from .panel_servicios import preferencias

logger = logging.getLogger(__name__)


class ControlSistemaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def process_exception(self, request, exception):
        request.talca_error_clase = type(exception).__name__[:50]

    def __call__(self, request):
        user = getattr(request, "user", None)
        # Límite absoluto para sesiones iniciadas con esta versión, además de la cookie.
        if user and user.is_authenticated and request.session.get("talca_inicio"):
            if timezone.now().timestamp() - request.session["talca_inicio"] > preferencias()["sesion_horas"] * 3600:
                from django.contrib.auth import logout
                logout(request)
        response = self.get_response(request)
        if request.path.startswith("/api/") and response.status_code >= 400:
            match = getattr(request, "resolver_match", None)
            route = str(getattr(match, "route", "") or "Ruta API no encontrada")[:200]
            category = ("Error de servidor" if response.status_code >= 500 else
                "Autenticación rechazada" if request.path == "/api/auth/login/" else
                "Acceso denegado" if response.status_code in {401, 403} else "Solicitud rechazada")
            if response.status_code >= 500 and getattr(request, "talca_error_clase", None):
                category = f"Error de servidor: {request.talca_error_clase}"[:80]
            try:
                # Transacción separada del negocio: una operación rechazada queda registrada.
                with transaction.atomic():
                    IncidenciaSistema.objects.create(ruta=route, metodo=request.method[:10], estado=response.status_code,
                        categoria=category, usuario=user.username[:150] if user and user.is_authenticated else "")
            except Exception:
                # No reemplaza el error original ni expone detalles de conexión en la respuesta.
                logger.warning("No se pudo registrar una incidencia del sistema.")
        return response
