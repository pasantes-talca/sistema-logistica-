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
