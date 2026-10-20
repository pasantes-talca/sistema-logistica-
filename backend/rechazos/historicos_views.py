from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from core.api import APIView
from core.permissions import tiene_modulo
from .historicos import registros, HOJA
from .models import ImportacionRechazosHistoricos


class AccesoHistoricoRechazos(BasePermission):
    def has_permission(self, request, view):
        return tiene_modulo(request.user, "RECHAZOS")


class ImportacionesHistoricasAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoHistoricoRechazos]

    def get(self, request):
        return Response(list(ImportacionRechazosHistoricos.objects.values('id', 'nombre', 'origen_id', 'creado_en', 'huella', 'revision')))


class HistoricoRechazosAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoHistoricoRechazos]

    def get(self, request, pk, contenido):
        if contenido not in {'registros', 'anexos', 'respaldo'}:
            raise Http404
        obj = get_object_or_404(ImportacionRechazosHistoricos, pk=pk)
        if contenido == 'registros':
            return Response(registros(obj.fuente))
        if contenido == 'anexos':
            return Response([s for s in obj.fuente['pestanas'] if s['nombre'] != HOJA])
        return Response(obj.fuente)
