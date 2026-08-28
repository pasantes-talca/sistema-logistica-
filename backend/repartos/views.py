from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Reparto
from .serializers import (
    RepartoSerializer,
    RepartoCreateSerializer,
)
from django.utils.dateparse import parse_date

class RepartoListCreateAPIView(APIView):
    """
    GET:
        Devuelve todos los repartos.

    POST:
        Crea un reparto nuevo.
    """

    def get(self, request):
        repartos = (
            Reparto.objects
            .select_related(
                "vehiculo",
                "asignacion",
                "creado_por",
            )
            .prefetch_related(
                "personal__empleado"
            )
            .all()
        )

        serializer = RepartoSerializer(
            repartos,
            many=True,
        )

        return Response(
            serializer.data
        )

    def post(self, request):
        serializer = RepartoCreateSerializer(
            data=request.data,
            context={
                "request": request
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        reparto = serializer.save()

        respuesta = RepartoSerializer(
            reparto
        )

        return Response(
            respuesta.data,
            status=status.HTTP_201_CREATED,
        )


class RepartoDetailAPIView(APIView):
    """
    GET:
        Devuelve un reparto específico.

    PUT:
        Actualiza completamente un reparto existente.

        Al editar:
        - vuelve a validar chofer y ayudantes;
        - vuelve a calcular las recargas;
        - actualiza el personal del reparto.
    """

    def get_object(self, pk):
        queryset = (
            Reparto.objects
            .select_related(
                "vehiculo",
                "asignacion",
                "creado_por",
            )
            .prefetch_related(
                "personal__empleado"
            )
        )

        return get_object_or_404(
            queryset,
            pk=pk,
        )

    def get(self, request, pk):
        reparto = self.get_object(pk)

        serializer = RepartoSerializer(
            reparto
        )

        return Response(
            serializer.data
        )

    def put(self, request, pk):
        reparto = self.get_object(pk)

        serializer = RepartoCreateSerializer(
            reparto,
            data=request.data,
            context={
                "request": request
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        reparto_actualizado = serializer.save()

        respuesta = RepartoSerializer(
            reparto_actualizado
        )

        return Response(
            respuesta.data,
            status=status.HTTP_200_OK,
        )

class ReporteRecargasAPIView(APIView):
    """
    Genera el reporte de recargas por empleado
    dentro de un rango de fechas.

    Replica la lógica del reporte de Recargas 2026.
    """

    def get(self, request):
        desde_str = request.query_params.get("desde")
        hasta_str = request.query_params.get("hasta")

        if not desde_str or not hasta_str:
            return Response(
                {
                    "error": (
                        "Debe indicar las fechas "
                        "'desde' y 'hasta'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        desde = parse_date(desde_str)
        hasta = parse_date(hasta_str)

        if not desde or not hasta:
            return Response(
                {
                    "error": (
                        "Las fechas deben tener formato "
                        "YYYY-MM-DD."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if desde > hasta:
            return Response(
                {
                    "error": (
                        "La fecha desde no puede ser "
                        "posterior a la fecha hasta."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        repartos = (
            Reparto.objects
            .filter(
                fecha__range=(desde, hasta),
                recargas__gt=0,
            )
            .prefetch_related(
                "personal__empleado"
            )
            .order_by("fecha")
        )

        acumulado = {}

        for reparto in repartos:

            for participante in reparto.personal.all():

                empleado = participante.empleado

                if empleado.id not in acumulado:
                    acumulado[empleado.id] = {
                        "empleado_id": empleado.id,
                        "legajo": empleado.legajo,
                        "nombre": empleado.nombre,
                        "recargas": 0,
                    }

                acumulado[empleado.id]["recargas"] += (
                    reparto.recargas
                )

        empleados = sorted(
            acumulado.values(),
            key=lambda item: item["nombre"].lower(),
        )

        total_general = sum(
            empleado["recargas"]
            for empleado in empleados
        )

        return Response(
            {
                "desde": desde,
                "hasta": hasta,
                "cantidad_repartos": repartos.count(),
                "empleados": empleados,
                "total_general": total_general,
            }
        )