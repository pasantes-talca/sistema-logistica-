from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from core.api import APIView
from core.permissions import tiene_modulo

from .historicos import recibos
from .models import ImportacionCambiosHistoricos


class AccesoHistoricoCambios(BasePermission):
    def has_permission(self, request, view):
        return tiene_modulo(request.user, "CAMBIOS")


class ImportacionesHistoricasAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoHistoricoCambios]

    def get(self, request):
        return Response(list(ImportacionCambiosHistoricos.objects.values('id','nombre','origen_id','huella','creado_en','revision')))


class HistoricoCambiosAPIView(APIView):
    permission_classes = [IsAuthenticated, AccesoHistoricoCambios]

    def get(self, request, pk, contenido):
        if contenido not in {'recibos','resumenes','anexos','respaldo'}:
            raise Http404
        obj = get_object_or_404(ImportacionCambiosHistoricos,pk=pk)
        if contenido == 'recibos':
            return Response(recibos(obj.fuente))
        if contenido == 'resumenes':
            return Response([s for s in obj.fuente['pestanas'] if s['nombre'].startswith('Resumen ')])
        if contenido == 'anexos':
            return Response([s for s in obj.fuente['pestanas'] if not s['nombre'].startswith(('Recibo ','Resumen '))])
        return Response(obj.fuente)
