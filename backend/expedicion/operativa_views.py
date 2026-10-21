from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.response import Response
from core.api import APIView
from .operativa import comando, snapshot
from .respaldos import exportar, restaurar
from .models import RespaldoExpedicion, ControlOperativa
from django.db import transaction
from rest_framework.exceptions import ValidationError, PermissionDenied
from core.permissions import tiene_modulo


class AccesoExpedicion(BasePermission):
    def has_permission(self, request, view):
        return tiene_modulo(request.user, "EXPEDICION")


class OperativaAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoExpedicion]

    def get(self, request):
        return Response(snapshot(request.user))

    def post(self, request):
        return Response(comando(request.data, request.user))


class DiagnosticoAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoExpedicion]

    def get(self, request):
        from .conciliacion import diagnosticar
        with transaction.atomic():
            ControlOperativa.objects.select_for_update().filter(pk=1).first()
            return Response(diagnosticar())


class FusionRespaldoAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoExpedicion]
    auditoria_explicita = True

    def check_permissions(self, request):
        super().check_permissions(request)
        if not request.user.is_superuser:
            raise PermissionDenied("La fusión requiere un superusuario.")

    def get_parsers(self):
        from io import BytesIO
        from rest_framework.parsers import JSONParser

        class RespaldoJSONParser(JSONParser):
            def parse(self, stream, media_type=None, parser_context=None):
                # Límite exclusivo de este endpoint; no ampliar límites globales.
                contenido = stream.read(26_000_001)
                if len(contenido) > 26_000_000:
                    raise ValidationError("La solicitud supera el límite de 26 MB.")
                return super().parse(BytesIO(contenido), media_type, parser_context)

        return [RespaldoJSONParser()]

    def post(self, request):
        from .fusion import fusionar
        from django.core.serializers.base import DeserializationError
        from django.core.exceptions import ValidationError as ModelValidationError
        from django.db import IntegrityError
        try:
            return Response(fusionar(request.data.get("archivo"), request.user,
                request.data.get("revision"), request.data.get("huella"), request.data.get("confirmacion")))
        except (DeserializationError, ModelValidationError, IntegrityError, ValueError, TypeError, OverflowError):
            raise ValidationError("El respaldo contiene datos o relaciones inconsistentes. No se modificó el sistema.")


class RespaldosAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoExpedicion]

    def get(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied("Solo un superusuario puede exportar respaldos completos.")
        if request.query_params.get("listar"):
            return Response(list(RespaldoExpedicion.objects.order_by("-pk").values("id", "fecha", "motivo")))
        if request.query_params.get("id"):
            from django.shortcuts import get_object_or_404
            return Response(get_object_or_404(RespaldoExpedicion, pk=request.query_params["id"]).datos)
        with transaction.atomic():
            ControlOperativa.objects.select_for_update().get_or_create(pk=1)
            return Response(exportar())

    def post(self, request):
        with transaction.atomic():
            ctrl, _ = ControlOperativa.objects.select_for_update().get_or_create(pk=1)
            if request.data.get("confirmacion") != "RESTAURAR":
                return Response(restaurar(request.data.get("archivo"), request.user, preview=True))
            if request.data.get("revision") != ctrl.revision:
                raise ValidationError("Hubo operaciones desde la vista previa. Volvé a revisar el respaldo.")
            return Response(restaurar(request.data.get("archivo"), request.user))
