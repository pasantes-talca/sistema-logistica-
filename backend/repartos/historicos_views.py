from django.shortcuts import get_object_or_404
from django.http import Http404
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .historicos import registros_originales, resumenes_originales
from .models import ImportacionRepartosHistoricos


class AccesoHistoricoRepartos(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.user.is_superuser or request.user.groups.filter(name='REPARTOS').exists())


class ImportacionesHistoricasAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoHistoricoRepartos]

    def get(self, request):
        return Response(list(ImportacionRepartosHistoricos.objects.values('id', 'nombre', 'origen_id', 'creado_en', 'huella', 'revision')))


class HistoricoRepartosAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoHistoricoRepartos]

    def get(self, request, pk, contenido):
        if contenido not in {'registros', 'resumenes', 'padron', 'respaldo'}:
            raise Http404
        obj = get_object_or_404(ImportacionRepartosHistoricos, pk=pk)
        if contenido == 'registros':
            return Response(registros_originales(obj.fuente))
        if contenido == 'resumenes':
            return Response(resumenes_originales(obj.fuente))
        if contenido == 'padron':
            from .historicos import pestana
            p = pestana(obj.fuente, 'Datos Empleados')
            return Response(p['filas'] if p else [])
        return Response(obj.fuente)
