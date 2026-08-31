from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Rechazo

from .serializers import (
    RechazoSerializer,
    RechazoCreateUpdateSerializer,
)


class RechazoListCreateAPIView(APIView):
    """
    GET
        Lista todos los rechazos.

    POST
        Crea un rechazo nuevo.
    """

    def get(self, request):

        rechazos = (
            Rechazo.objects
            .select_related(
                "asignacion",
                "motivo",
                "creado_por",
            )
            .all()
            .order_by(
                "-fecha",
                "-id",
            )
        )

        serializer = RechazoSerializer(
            rechazos,
            many=True,
        )

        return Response(
            serializer.data
        )


    def post(self, request):

        serializer = (
            RechazoCreateUpdateSerializer(
                data=request.data,
                context={
                    "request": request
                },
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        rechazo = serializer.save()

        respuesta = RechazoSerializer(
            rechazo
        )

        return Response(
            respuesta.data,
            status=status.HTTP_201_CREATED,
        )


class RechazoDetailAPIView(APIView):
    """
    GET
        Consulta un rechazo.

    PUT
        Edita un rechazo existente.
    """

    def get_object(self, pk):

        queryset = (
            Rechazo.objects
            .select_related(
                "asignacion",
                "motivo",
                "creado_por",
            )
        )

        return get_object_or_404(
            queryset,
            pk=pk,
        )


    def get(self, request, pk):

        rechazo = self.get_object(
            pk
        )

        serializer = RechazoSerializer(
            rechazo
        )

        return Response(
            serializer.data
        )


    def put(self, request, pk):

        rechazo = self.get_object(
            pk
        )

        serializer = (
            RechazoCreateUpdateSerializer(
                rechazo,
                data=request.data,
                context={
                    "request": request
                },
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        rechazo_actualizado = (
            serializer.save()
        )

        respuesta = RechazoSerializer(
            rechazo_actualizado
        )

        return Response(
            respuesta.data,
            status=status.HTTP_200_OK,
        )


class EstadisticasRechazosAPIView(APIView):
    """
    Estadísticas de rechazos por rango de fechas.

    Permite filtrar opcionalmente por asignación.

    Devuelve:
    - total de rechazos
    - cantidad por motivo
    - porcentaje por motivo
    - cantidad por asignación
    """

    def get(self, request):

        desde_str = request.query_params.get(
            "desde"
        )

        hasta_str = request.query_params.get(
            "hasta"
        )

        asignacion_id_str = (
            request.query_params.get(
                "asignacion_id"
            )
        )


        # =========================================
        # VALIDAR FECHAS
        # =========================================

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


        desde = parse_date(
            desde_str
        )

        hasta = parse_date(
            hasta_str
        )


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


        # =========================================
        # FILTRO BASE
        # =========================================

        rechazos = Rechazo.objects.filter(
            fecha__range=(
                desde,
                hasta,
            )
        )


        # =========================================
        # FILTRO OPCIONAL POR ASIGNACIÓN
        # =========================================

        asignacion_id = None

        if asignacion_id_str:

            try:
                asignacion_id = int(
                    asignacion_id_str
                )

            except ValueError:

                return Response(
                    {
                        "error": (
                            "La asignación indicada "
                            "no es válida."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )


            rechazos = rechazos.filter(
                asignacion_id=asignacion_id
            )


        # =========================================
        # TOTAL
        # =========================================

        total_rechazos = (
            rechazos.count()
        )


        # =========================================
        # AGRUPACIÓN POR MOTIVO
        # =========================================

        motivos_consulta = (
            rechazos
            .values(
                "motivo_id",
                "motivo__nombre",
            )
            .annotate(
                cantidad=Count("id")
            )
            .order_by(
                "-cantidad",
                "motivo__nombre",
            )
        )


        por_motivo = []

        for item in motivos_consulta:

            cantidad = item[
                "cantidad"
            ]

            if total_rechazos > 0:

                porcentaje = round(
                    (
                        cantidad
                        / total_rechazos
                    )
                    * 100,
                    2,
                )

            else:

                porcentaje = 0


            por_motivo.append(
                {
                    "motivo_id":
                        item["motivo_id"],

                    "motivo":
                        item["motivo__nombre"],

                    "cantidad":
                        cantidad,

                    "porcentaje":
                        porcentaje,
                }
            )


        # =========================================
        # AGRUPACIÓN POR ASIGNACIÓN
        # =========================================

        asignaciones_consulta = (
            rechazos
            .values(
                "asignacion_id",
                "asignacion__codigo",
            )
            .annotate(
                cantidad=Count("id")
            )
            .order_by(
                "-cantidad"
            )
        )


        por_asignacion = []

        for item in asignaciones_consulta:

            codigo = (
                item[
                    "asignacion__codigo"
                ]
                or "Sin asignación"
            )

            por_asignacion.append(
                {
                    "asignacion_id":
                        item["asignacion_id"],

                    "asignacion":
                        codigo,

                    "cantidad":
                        item["cantidad"],
                }
            )


        # =========================================
        # RESPUESTA
        # =========================================

        return Response(
            {
                "desde": desde,
                "hasta": hasta,

                "asignacion_id":
                    asignacion_id,

                "total_rechazos":
                    total_rechazos,

                "por_motivo":
                    por_motivo,

                "por_asignacion":
                    por_asignacion,
            }
        )