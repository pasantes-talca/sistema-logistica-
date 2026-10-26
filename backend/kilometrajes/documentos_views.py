import logging

from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView as DRFAPIView

from core.api import APIView
from core.auditoria import registrar
from .models import ControlKilometraje
from .planilla import excel, pdf, columnas_control
from .serializers import ControlKilometrajeSerializer

logger = logging.getLogger(__name__)
DESTINATARIO = "pasantes@talca.com.ar"


class ExportarPlanillaAPIView(APIView):
    def get(self, request, pk, formato):
        if formato not in {"xlsx", "pdf"}:
            return Response({"error": "Formato no disponible."}, status=400)
        control = ControlKilometraje.objects.select_related("chofer").prefetch_related("registros__destino").filter(pk=pk).first()
        if not control:
            return Response({"error": "Planilla no encontrada."}, status=404)
        if not columnas_control(control) or (control.fecha_hasta - control.fecha_desde).days >= 366:
            return Response({"error": "Revisá el período y los destinos de la planilla antes de exportar."}, status=400)
        generar, mime = (excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") if formato == "xlsx" else (pdf, "application/pdf")
        respuesta = HttpResponse(generar(control), content_type=mime)
        respuesta["Content-Disposition"] = f'attachment; filename="kilometraje-{control.pk}-{control.fecha_desde}.{formato}"'
        respuesta["Cache-Control"] = "no-store"
        return respuesta


class FinalizarPlanillaAPIView(APIView):
    auditoria_explicita = True

    def dispatch(self, request, *args, **kwargs):
        # SMTP no participa en una transacción SQL. Persistir el reclamo antes de enviar
        # evita correos duplicados por doble clic o solicitudes concurrentes.
        return DRFAPIView.dispatch(self, request, *args, **kwargs)

    def post(self, request, pk):
        with transaction.atomic():
            control = ControlKilometraje.objects.select_for_update().select_related("chofer").filter(pk=pk).first()
            if not control:
                return Response({"error": "Planilla no encontrada."}, status=404)
            if request.data.get("version") != control.version:
                return Response({"error": "La planilla cambió. Volvé a abrirla antes de enviarla."}, status=409)
            if control.envio_estado == "ENVIADO":
                return Response(ControlKilometrajeSerializer(control).data)
            if control.envio_estado == "ENVIANDO":
                return Response({"error": "El envío ya está en curso o pendiente de verificar. No vuelvas a enviarlo; consultá al administrador."}, status=409)
            if request.data.get("confirmar") is not True:
                return Response({"error": "Confirmá el envío de la planilla guardada."}, status=400)
            if not columnas_control(control):
                return Response({"error": "La planilla no tiene destinos."}, status=400)
            if (control.fecha_hasta - control.fecha_desde).days >= 366:
                return Response({"error": "El período supera 366 días."}, status=400)
            control.estado = "FINALIZADA"
            control.envio_estado = "ENVIANDO"
            control.error_envio = ""
            control.save(update_fields=["estado", "envio_estado", "error_envio", "actualizado_en"])
            registrar(request.user, "KILOMETRAJES", "Finalizar y enviar", pk,
                      despues={"version": control.version, "destino": DESTINATARIO})
        try:
            mensaje = EmailMessage(
                subject=f"Control de kilometraje - {control.chofer.nombre} - {control.fecha_desde:%d/%m/%Y} al {control.fecha_hasta:%d/%m/%Y}",
                body=f"Se adjunta la planilla finalizada N.º {control.pk}, versión {control.version}, en Excel y PDF.\nTotal: {control.total_km} km.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[DESTINATARIO],
                connection=get_connection(timeout=30),
            )
            mensaje.attach(f"kilometraje-{pk}.xlsx", excel(control), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            mensaje.attach(f"kilometraje-{pk}.pdf", pdf(control), "application/pdf")
            if mensaje.send(fail_silently=False) != 1:
                raise RuntimeError("El servidor de correo no aceptó el mensaje.")
        except Exception:
            logger.exception("No se pudo confirmar el envío de la planilla de kilometraje %s", pk)
            # Un timeout SMTP puede ocurrir después de aceptar el correo: nunca reintentar automáticamente.
            ControlKilometraje.objects.filter(pk=pk).update(envio_estado="ERROR", error_envio="No se pudo confirmar el envío. Verificá el correo recibido antes de reintentar.")
            control.refresh_from_db()
            return Response({"error": control.error_envio, "control": ControlKilometrajeSerializer(control).data}, status=502)
        with transaction.atomic():
            ControlKilometraje.objects.filter(pk=pk).update(envio_estado="ENVIADO", enviado_en=timezone.now())
            registrar(request.user, "KILOMETRAJES", "Correo aceptado por servidor", pk, despues={"version": control.version, "destino": DESTINATARIO})
        control.refresh_from_db()
        return Response(ControlKilometrajeSerializer(control).data)
