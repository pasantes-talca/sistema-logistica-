from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    DetalleReciboCambio,
    ReciboCambio,
)

from .serializers import (
    ReciboCambioCargaSerializer,
    ReciboCambioSerializer,
)

from .services import (
    actualizar_recibo_cambio,
    guardar_recibo_cambio,
)


class ReciboCambioListCreateAPIView(APIView):
    """
    GET
        Lista todos los recibos de cambios.

    POST
        Crea un recibo nuevo.

        Si ya existe un recibo para la misma
        FECHA + CONCESIONARIO,
        acumula la información sobre ese recibo.
    """

    def get(self, request):

        recibos = (
            ReciboCambio.objects
            .select_related(
                "concesionario",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto",
                "detalles__motivo",
            )
            .all()
        )

        serializer = ReciboCambioSerializer(
            recibos,
            many=True,
        )

        return Response(
            serializer.data
        )


    def post(self, request):

        entrada = ReciboCambioCargaSerializer(
            data=request.data
        )

        entrada.is_valid(
            raise_exception=True
        )

        datos = entrada.validated_data


        # =========================================
        # USUARIO
        # =========================================

        creado_por = None

        if (
            request.user
            and request.user.is_authenticated
        ):
            creado_por = request.user


        # =========================================
        # GUARDAR / ACUMULAR
        # =========================================

        try:

            resultado = guardar_recibo_cambio(

                fecha=datos["fecha"],

                concesionario=
                    datos["concesionario_id"],

                detalles=
                    datos.get(
                        "detalles",
                        [],
                    ),

                pallets=
                    datos.get(
                        "pallets",
                        0,
                    ),

                pallets_observacion=
                    datos.get(
                        "pallets_observacion",
                        "",
                    ),

                pallets_descargados=
                    datos.get(
                        "pallets_descargados",
                        0,
                    ),

                pallets_descargados_observacion=
                    datos.get(
                        "pallets_descargados_observacion",
                        "",
                    ),

                prensados=
                    datos.get(
                        "prensados",
                        0,
                    ),

                prensados_observacion=
                    datos.get(
                        "prensados_observacion",
                        "",
                    ),

                creado_por=creado_por,
            )

        except DjangoValidationError as error:

            if hasattr(
                error,
                "message_dict",
            ):
                detalle_error = (
                    error.message_dict
                )

            else:
                detalle_error = {
                    "error":
                        error.messages
                }

            return Response(
                detalle_error,
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        # =========================================
        # RECARGAR RECIBO COMPLETO
        # =========================================

        recibo = resultado["recibo"]

        recibo = (
            ReciboCambio.objects
            .select_related(
                "concesionario",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto",
                "detalles__motivo",
            )
            .get(
                id=recibo.id
            )
        )


        respuesta_recibo = (
            ReciboCambioSerializer(
                recibo
            ).data
        )


        respuesta = {
            "creado":
                resultado["creado"],

            "recibo":
                respuesta_recibo,
        }


        if resultado["creado"]:
            codigo_estado = (
                status.HTTP_201_CREATED
            )

        else:
            codigo_estado = (
                status.HTTP_200_OK
            )


        return Response(
            respuesta,
            status=codigo_estado,
        )


class ReciboCambioDetailAPIView(APIView):
    """
    GET
        Consulta un recibo completo.

    PUT
        Edita un recibo existente.

        IMPORTANTE:
        PUT reemplaza los valores.
        NO acumula.
    """

    def get_object(
        self,
        pk,
    ):

        queryset = (
            ReciboCambio.objects
            .select_related(
                "concesionario",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto",
                "detalles__motivo",
            )
        )

        return get_object_or_404(
            queryset,
            pk=pk,
        )


    # =============================================
    # CONSULTAR
    # =============================================

    def get(
        self,
        request,
        pk,
    ):

        recibo = self.get_object(
            pk
        )

        serializer = ReciboCambioSerializer(
            recibo
        )

        return Response(
            serializer.data
        )


    # =============================================
    # EDITAR
    # =============================================

    def put(
        self,
        request,
        pk,
    ):

        recibo = self.get_object(
            pk
        )


        entrada = ReciboCambioCargaSerializer(
            data=request.data
        )

        entrada.is_valid(
            raise_exception=True
        )

        datos = entrada.validated_data


        try:

            recibo = actualizar_recibo_cambio(

                recibo=recibo,

                fecha=
                    datos["fecha"],

                concesionario=
                    datos["concesionario_id"],

                detalles=
                    datos.get(
                        "detalles",
                        [],
                    ),

                pallets=
                    datos.get(
                        "pallets",
                        0,
                    ),

                pallets_observacion=
                    datos.get(
                        "pallets_observacion",
                        "",
                    ),

                pallets_descargados=
                    datos.get(
                        "pallets_descargados",
                        0,
                    ),

                pallets_descargados_observacion=
                    datos.get(
                        "pallets_descargados_observacion",
                        "",
                    ),

                prensados=
                    datos.get(
                        "prensados",
                        0,
                    ),

                prensados_observacion=
                    datos.get(
                        "prensados_observacion",
                        "",
                    ),
            )

        except DjangoValidationError as error:

            if hasattr(
                error,
                "message_dict",
            ):
                detalle_error = (
                    error.message_dict
                )

            else:
                detalle_error = {
                    "error":
                        error.messages
                }

            return Response(
                detalle_error,
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        # =========================================
        # RECARGAR RELACIONES
        # =========================================

        recibo = (
            ReciboCambio.objects
            .select_related(
                "concesionario",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto",
                "detalles__motivo",
            )
            .get(
                id=recibo.id
            )
        )


        serializer = ReciboCambioSerializer(
            recibo
        )


        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

class EstadisticasCambiosAPIView(APIView):
    """
    Estadísticas de cambios por rango de fechas.

    Si no se indica concesionario:
        agrupa por producto + concesionario.

    Si se indica concesionario:
        agrupa solamente por producto.
    """

    def get(self, request):

        desde_str = request.query_params.get(
            "desde"
        )

        hasta_str = request.query_params.get(
            "hasta"
        )

        concesionario_id_str = (
            request.query_params.get(
                "concesionario_id"
            )
        )


        # =====================================================
        # VALIDAR FECHAS
        # =====================================================

        if not desde_str or not hasta_str:

            return Response(
                {
                    "error":
                        (
                            "Debe indicar las fechas "
                            "'desde' y 'hasta'."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
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
                    "error":
                        (
                            "Las fechas deben tener formato "
                            "YYYY-MM-DD."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        if desde > hasta:

            return Response(
                {
                    "error":
                        (
                            "La fecha desde no puede ser "
                            "posterior a la fecha hasta."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        # =====================================================
        # DETALLES DEL PERÍODO
        # =====================================================

        detalles = (
            ReciboCambio.objects
            .filter(
                fecha__range=(
                    desde,
                    hasta,
                )
            )
        )


        concesionario_id = None


        # =====================================================
        # FILTRO OPCIONAL POR CONCESIONARIO
        # =====================================================

        if concesionario_id_str:

            try:

                concesionario_id = int(
                    concesionario_id_str
                )

            except ValueError:

                return Response(
                    {
                        "error":
                            (
                                "El concesionario indicado "
                                "no es válido."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )


            detalles = detalles.filter(
                concesionario_id=
                    concesionario_id
            )


        # =====================================================
        # RECIBOS DEL PERÍODO
        # =====================================================

        cantidad_recibos = (
            detalles.count()
        )


        # Pasamos ahora de recibos a sus productos.
        productos = (
            DetalleReciboCambio.objects
            .filter(
                recibo__in=
                    detalles
            )
        )


        total_resultado = (
            productos.aggregate(
                total=Sum(
                    "cantidad"
                )
            )["total"]
            or 0
        )


        total_cantidad = float(
            total_resultado
        )


        # =====================================================
        # UN CONCESIONARIO
        # =====================================================

        if concesionario_id is not None:

            consulta = (
                productos
                .values(
                    "producto_id",
                    "producto__codigo",
                    "producto__nombre",
                    "producto__familia",
                )
                .annotate(
                    cantidad=Sum(
                        "cantidad"
                    )
                )
                .order_by(
                    "-cantidad",
                    "producto__codigo",
                )
            )


            por_producto = []


            for item in consulta:

                cantidad = float(
                    item["cantidad"]
                )


                if total_cantidad > 0:

                    porcentaje = round(
                        (
                            cantidad
                            / total_cantidad
                        )
                        * 100,
                        2,
                    )

                else:

                    porcentaje = 0


                por_producto.append(
                    {
                        "producto_id":
                            item[
                                "producto_id"
                            ],

                        "codigo":
                            item[
                                "producto__codigo"
                            ],

                        "producto":
                            item[
                                "producto__nombre"
                            ],

                        "familia":
                            item[
                                "producto__familia"
                            ],

                        "cantidad":
                            cantidad,

                        "porcentaje":
                            porcentaje,
                    }
                )


            return Response(
                {
                    "desde":
                        desde,

                    "hasta":
                        hasta,

                    "concesionario_id":
                        concesionario_id,

                    "modo":
                        "concesionario",

                    "cantidad_recibos":
                        cantidad_recibos,

                    "total_cantidad":
                        total_cantidad,

                    "por_producto":
                        por_producto,

                    "por_producto_concesionario":
                        [],
                }
            )


        # =====================================================
        # TODOS LOS CONCESIONARIOS
        # =====================================================

        consulta = (
            productos
            .values(
                "producto_id",
                "producto__codigo",
                "producto__nombre",
                "producto__familia",

                "recibo__concesionario_id",
                "recibo__concesionario__nombre",
            )
            .annotate(
                cantidad=Sum(
                    "cantidad"
                )
            )
            .order_by(
                "-cantidad",
                "producto__codigo",
            )
        )


        por_producto_concesionario = []


        for item in consulta:

            cantidad = float(
                item["cantidad"]
            )


            if total_cantidad > 0:

                porcentaje = round(
                    (
                        cantidad
                        / total_cantidad
                    )
                    * 100,
                    2,
                )

            else:

                porcentaje = 0


            por_producto_concesionario.append(
                {
                    "producto_id":
                        item[
                            "producto_id"
                        ],

                    "codigo":
                        item[
                            "producto__codigo"
                        ],

                    "producto":
                        item[
                            "producto__nombre"
                        ],

                    "familia":
                        item[
                            "producto__familia"
                        ],

                    "concesionario_id":
                        item[
                            "recibo__concesionario_id"
                        ],

                    "concesionario":
                        item[
                            "recibo__concesionario__nombre"
                        ],

                    "cantidad":
                        cantidad,

                    "porcentaje":
                        porcentaje,
                }
            )


        return Response(
            {
                "desde":
                    desde,

                "hasta":
                    hasta,

                "concesionario_id":
                    None,

                "modo":
                    "todos",

                "cantidad_recibos":
                    cantidad_recibos,

                "total_cantidad":
                    total_cantidad,

                "por_producto":
                    [],

                "por_producto_concesionario":
                    por_producto_concesionario,
            }
        )