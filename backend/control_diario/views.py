from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from decimal import Decimal

from control_diario.models import (
    ControlDiario,
    MovimientoControlDiario,
    ProductoControlDiario,
    UbicacionControlDiario,
)

from control_diario.serializers import (
    ControlDiarioSerializer,
    CrearControlDiarioSerializer,
    ProductoControlDiarioSerializer,
    UbicacionControlDiarioSerializer,
)

from control_diario.services import (
    crear_control_diario,
    obtener_resumen_control,
)


from django.db.models import Sum

class ProductosControlDiarioAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):

        productos = (
            ProductoControlDiario.objects
            .filter(
                activo=True
            )
            .order_by(
                "orden",
                "nombre",
            )
        )

        serializer = (
            ProductoControlDiarioSerializer(
                productos,
                many=True,
            )
        )

        return Response(
            serializer.data
        )


class UbicacionesControlDiarioAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):

        ubicaciones = (
            UbicacionControlDiario.objects
            .filter(
                activo=True
            )
            .order_by(
                "tipo",
                "orden",
                "nombre",
            )
        )

        serializer = (
            UbicacionControlDiarioSerializer(
                ubicaciones,
                many=True,
            )
        )

        return Response(
            serializer.data
        )


class ControlesDiariosAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):

        controles = (
            ControlDiario.objects
            .select_related(
                "creado_por"
            )
            .prefetch_related(
                "movimientos__producto",
                "movimientos__ubicacion",
            )
            .all()
        )


        fecha_desde = (
            request.query_params.get(
                "desde"
            )
        )

        fecha_hasta = (
            request.query_params.get(
                "hasta"
            )
        )


        if fecha_desde:

            controles = (
                controles.filter(
                    fecha__gte=fecha_desde
                )
            )


        if fecha_hasta:

            controles = (
                controles.filter(
                    fecha__lte=fecha_hasta
                )
            )


        controles = (
            controles.order_by(
                "-fecha"
            )
        )


        serializer = (
            ControlDiarioSerializer(
                controles,
                many=True,
            )
        )


        return Response(
            serializer.data
        )


    def post(self, request):

        serializer = (
            CrearControlDiarioSerializer(
                data=request.data
            )
        )


        serializer.is_valid(
            raise_exception=True
        )


        control = crear_control_diario(
            fecha=(
                serializer.validated_data[
                    "fecha"
                ]
            ),

            observaciones=(
                serializer.validated_data.get(
                    "observaciones",
                    "",
                )
            ),

            movimientos=(
                serializer.validated_data.get(
                    "movimientos",
                    [],
                )
            ),

            usuario=(
                request.user
                if request.user.is_authenticated
                else None
            ),
        )


        salida = (
            ControlDiarioSerializer(
                control
            )
        )


        return Response(
            salida.data,
            status=status.HTTP_201_CREATED,
        )


class ControlDiarioDetalleAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request, pk):

        control = get_object_or_404(
            ControlDiario.objects
            .select_related(
                "creado_por"
            )
            .prefetch_related(
                "movimientos__producto",
                "movimientos__ubicacion",
            ),
            pk=pk,
        )


        serializer = (
            ControlDiarioSerializer(
                control
            )
        )


        return Response(
            serializer.data
        )


    def delete(self, request, pk):

        control = get_object_or_404(
            ControlDiario,
            pk=pk,
        )


        control.delete()


        return Response(
            status=status.HTTP_204_NO_CONTENT
        )


class ControlDiarioResumenAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request, pk):

        control = get_object_or_404(
            ControlDiario.objects
            .prefetch_related(
                "movimientos__producto",
                "movimientos__ubicacion",
            ),
            pk=pk,
        )


        resumen = obtener_resumen_control(
            control
        )


        return Response(
            {
                "control_id":
                    control.id,

                "fecha":
                    control.fecha,

                "resumen":
                    resumen,
            }
        )
