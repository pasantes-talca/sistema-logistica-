from decimal import Decimal

from django.db.models import (
    DecimalField,
    ExpressionWrapper,
    F,
    Sum,
)

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Viatico

from .serializers import (
    CrearActualizarViaticoSerializer,
    ViaticoSerializer,
)


class ViaticosAPIView(APIView):

    def get(
        self,
        request,
    ):
        queryset = (
            Viatico.objects
            .select_related(
                "chofer"
            )
            .all()
        )

        anio = request.query_params.get(
            "anio"
        )

        mes = request.query_params.get(
            "mes"
        )

        chofer = request.query_params.get(
            "chofer"
        )

        tipo_reparto = (
            request.query_params.get(
                "tipo_reparto"
            )
        )

        if anio:
            queryset = queryset.filter(
                fecha__year=anio
            )

        if mes:
            queryset = queryset.filter(
                fecha__month=mes
            )

        if chofer:
            queryset = queryset.filter(
                chofer_id=chofer
            )

        if tipo_reparto:
            queryset = queryset.filter(
                tipo_reparto=tipo_reparto
            )

        serializer = ViaticoSerializer(
            queryset,
            many=True,
        )

        return Response(
            serializer.data
        )


    def post(
        self,
        request,
    ):
        serializer = (
            CrearActualizarViaticoSerializer(
                data=request.data,
                context={
                    "request":
                        request
                },
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        viatico = serializer.save()

        viatico = (
            Viatico.objects
            .select_related(
                "chofer"
            )
            .get(
                pk=viatico.pk
            )
        )

        return Response(
            ViaticoSerializer(
                viatico
            ).data,
            status=
                status.HTTP_201_CREATED,
        )


class ViaticoDetalleAPIView(
    APIView
):

    def get_object(
        self,
        pk,
    ):
        try:
            return (
                Viatico.objects
                .select_related(
                    "chofer"
                )
                .get(
                    pk=pk
                )
            )

        except Viatico.DoesNotExist:
            return None


    def get(
        self,
        request,
        pk,
    ):
        viatico = self.get_object(
            pk
        )

        if viatico is None:
            return Response(
                {
                    "error":
                        "Viático no encontrado."
                },
                status=
                    status.HTTP_404_NOT_FOUND,
            )

        return Response(
            ViaticoSerializer(
                viatico
            ).data
        )


    def put(
        self,
        request,
        pk,
    ):
        viatico = self.get_object(
            pk
        )

        if viatico is None:
            return Response(
                {
                    "error":
                        "Viático no encontrado."
                },
                status=
                    status.HTTP_404_NOT_FOUND,
            )

        serializer = (
            CrearActualizarViaticoSerializer(
                viatico,
                data=request.data,
                context={
                    "request":
                        request
                },
            )
        )

        serializer.is_valid(
            raise_exception=True
        )

        viatico = serializer.save()

        viatico = (
            Viatico.objects
            .select_related(
                "chofer"
            )
            .get(
                pk=viatico.pk
            )
        )

        return Response(
            ViaticoSerializer(
                viatico
            ).data
        )


    def delete(
        self,
        request,
        pk,
    ):
        viatico = self.get_object(
            pk
        )

        if viatico is None:
            return Response(
                {
                    "error":
                        "Viático no encontrado."
                },
                status=
                    status.HTTP_404_NOT_FOUND,
            )

        viatico.delete()

        return Response(
            status=
                status.HTTP_204_NO_CONTENT
        )


class ResumenAnualViaticosAPIView(
    APIView
):

    def get(
        self,
        request,
    ):
        anio = request.query_params.get(
            "anio"
        )

        if not anio:
            return Response(
                {
                    "error":
                        (
                            "Debe indicar el año. "
                            "Ejemplo: ?anio=2026"
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )

        try:
            anio = int(
                anio
            )

        except (
            TypeError,
            ValueError,
        ):
            return Response(
                {
                    "error":
                        "El año es inválido."
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )

        monto_expression = (
            ExpressionWrapper(
                F("valor_viatico")
                *
                F("cantidad_viaticos"),
                output_field=
                    DecimalField(
                        max_digits=16,
                        decimal_places=2,
                    ),
            )
        )

        registros = (
            Viatico.objects
            .filter(
                fecha__year=anio
            )
            .annotate(
                monto_calculado=
                    monto_expression
            )
        )

        meses = {
            1: "ENERO",
            2: "FEBRERO",
            3: "MARZO",
            4: "ABRIL",
            5: "MAYO",
            6: "JUNIO",
            7: "JULIO",
            8: "AGOSTO",
            9: "SEPTIEMBRE",
            10: "OCTUBRE",
            11: "NOVIEMBRE",
            12: "DICIEMBRE",
        }

        resumen_mensual = []

        total_local_cantidad = 0
        total_local_monto = Decimal(
            "0"
        )

        total_larga_cantidad = 0
        total_larga_monto = Decimal(
            "0"
        )

        for numero_mes in range(
            1,
            13,
        ):
            registros_mes = (
                registros.filter(
                    fecha__month=
                        numero_mes
                )
            )

            local = (
                registros_mes
                .filter(
                    tipo_reparto=
                        Viatico
                        .TipoReparto
                        .LOCAL
                )
                .aggregate(
                    cantidad=Sum(
                        "cantidad_viaticos"
                    ),
                    monto=Sum(
                        "monto_calculado"
                    ),
                )
            )

            larga = (
                registros_mes
                .filter(
                    tipo_reparto=
                        Viatico
                        .TipoReparto
                        .LARGA_DISTANCIA
                )
                .aggregate(
                    cantidad=Sum(
                        "cantidad_viaticos"
                    ),
                    monto=Sum(
                        "monto_calculado"
                    ),
                )
            )

            cantidad_local = (
                local["cantidad"]
                or 0
            )

            monto_local = (
                local["monto"]
                or Decimal("0")
            )

            cantidad_larga = (
                larga["cantidad"]
                or 0
            )

            monto_larga = (
                larga["monto"]
                or Decimal("0")
            )

            total_mes = (
                monto_local
                +
                monto_larga
            )

            total_local_cantidad += (
                cantidad_local
            )

            total_local_monto += (
                monto_local
            )

            total_larga_cantidad += (
                cantidad_larga
            )

            total_larga_monto += (
                monto_larga
            )

            resumen_mensual.append(
                {
                    "numero_mes":
                        numero_mes,

                    "mes":
                        meses[
                            numero_mes
                        ],

                    "local": {
                        "cantidad":
                            cantidad_local,

                        "monto":
                            monto_local,
                    },

                    "larga_distancia": {
                        "cantidad":
                            cantidad_larga,

                        "monto":
                            monto_larga,
                    },

                    "total_mes":
                        total_mes,
                }
            )

        return Response(
            {
                "anio":
                    anio,

                "meses":
                    resumen_mensual,

                "totales": {
                    "local": {
                        "cantidad":
                            total_local_cantidad,

                        "monto":
                            total_local_monto,
                    },

                    "larga_distancia": {
                        "cantidad":
                            total_larga_cantidad,

                        "monto":
                            total_larga_monto,
                    },

                    "cantidad_total":
                        (
                            total_local_cantidad
                            +
                            total_larga_cantidad
                        ),

                    "monto_total":
                        (
                            total_local_monto
                            +
                            total_larga_monto
                        ),
                },
            }
        )