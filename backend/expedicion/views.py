from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)

from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from maestros.models import Producto

from .models import (
    DetalleEntregaOrdenCarga,
    DetalleOrdenCarga,
    EntregaOrdenCarga,
    Fletero,
    MovimientoMaterial,
    MovimientoStock,
    OrdenCarga,
    StockProducto,
)

from .serializers import (
    CrearEntregaOrdenSerializer,
    CrearMovimientoStockSerializer,
    CrearOrdenCargaSerializer,
    FleteroSerializer,
    MovimientoMaterialSerializer,
    MovimientoStockSerializer,
    OrdenCargaSerializer,
    StockProductoSerializer,
)

from .services import (
    confirmar_entrega_orden,
    registrar_movimiento_stock,
)


# ============================================================
# UTILIDADES
# ============================================================


def respuesta_error_validacion(error):

    if hasattr(
        error,
        "message_dict",
    ):
        return error.message_dict

    if hasattr(
        error,
        "messages",
    ):
        return {
            "error": error.messages
        }

    return {
        "error": str(error)
    }


# ============================================================
# FLETEROS
# ============================================================


class FleteroListCreateAPIView(APIView):

    permission_classes = [
        IsAuthenticated
    ]


    def get(
        self,
        request,
    ):

        fleteros = (
            Fletero.objects
            .all()
            .order_by(
                "nombre",
                "apellido",
            )
        )

        serializer = FleteroSerializer(
            fleteros,
            many=True,
        )

        return Response(
            serializer.data
        )


    def post(
        self,
        request,
    ):

        serializer = FleteroSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        fletero = serializer.save()

        return Response(
            FleteroSerializer(
                fletero
            ).data,
            status=
                status.HTTP_201_CREATED,
        )


# ============================================================
# STOCK ACTUAL
# ============================================================


class StockProductoListAPIView(APIView):

    permission_classes = [
        IsAuthenticated
    ]


    def get(
        self,
        request,
    ):

        stock = (
            StockProducto.objects
            .select_related(
                "producto"
            )
            .all()
            .order_by(
                "producto__codigo"
            )
        )

        serializer = (
            StockProductoSerializer(
                stock,
                many=True,
            )
        )

        return Response(
            serializer.data
        )


# ============================================================
# MOVIMIENTOS DE STOCK
# ============================================================


class MovimientoStockListCreateAPIView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]


    def get(
        self,
        request,
    ):

        movimientos = (
            MovimientoStock.objects
            .select_related(
                "producto",
                "orden",
                "creado_por",
            )
            .all()
            .order_by(
                "-creado_en"
            )
        )

        serializer = (
            MovimientoStockSerializer(
                movimientos,
                many=True,
            )
        )

        return Response(
            serializer.data
        )


    @transaction.atomic
    def post(
        self,
        request,
    ):

        entrada = (
            CrearMovimientoStockSerializer(
                data=request.data
            )
        )

        entrada.is_valid(
            raise_exception=True
        )

        datos = (
            entrada.validated_data
        )

        producto = get_object_or_404(
            Producto,
            id=datos["producto_id"],
            activo=True,
        )

        try:

            movimiento = (
                registrar_movimiento_stock(

                    producto=producto,

                    tipo=
                        datos["tipo"],

                    direccion=
                        datos["direccion"],

                    cantidad=
                        datos["cantidad"],

                    referencia=
                        datos.get(
                            "referencia",
                            "",
                        ),

                    observaciones=
                        datos.get(
                            "observaciones",
                            "",
                        ),

                    creado_por=
                        request.user,
                )
            )

        except DjangoValidationError as error:

            return Response(
                respuesta_error_validacion(
                    error
                ),
                status=
                    status.HTTP_400_BAD_REQUEST,
            )

        movimiento = (
            MovimientoStock.objects
            .select_related(
                "producto",
                "orden",
                "creado_por",
            )
            .get(
                pk=movimiento.pk
            )
        )

        return Response(
            MovimientoStockSerializer(
                movimiento
            ).data,
            status=
                status.HTTP_201_CREATED,
        )


# ============================================================
# ÓRDENES DE CARGA
# ============================================================


class OrdenCargaListCreateAPIView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]


    def get(
        self,
        request,
    ):

        ordenes = (
            OrdenCarga.objects
            .select_related(
                "fletero",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto",
                "entregas__detalles__producto",
            )
            .all()
            .order_by(
                "-fecha",
                "-id",
            )
        )

        serializer = OrdenCargaSerializer(
            ordenes,
            many=True,
        )

        return Response(
            serializer.data
        )


    @transaction.atomic
    def post(
        self,
        request,
    ):

        entrada = CrearOrdenCargaSerializer(
            data=request.data
        )

        entrada.is_valid(
            raise_exception=True
        )

        datos = entrada.validated_data

        numero = (
            datos["numero"]
            .strip()
        )

        if OrdenCarga.objects.filter(
            numero=numero
        ).exists():

            return Response(
                {
                    "numero":
                        (
                            "Ya existe una orden "
                            "con ese número."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )

        fletero = get_object_or_404(
            Fletero,
            id=datos["fletero_id"],
            activo=True,
        )

        detalles = (
            datos.get(
                "detalles",
                []
            )
        )

        if not detalles:

            return Response(
                {
                    "detalles":
                        (
                            "La orden debe contener "
                            "al menos un producto."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )

        productos_utilizados = set()

        for detalle in detalles:

            producto_id = (
                detalle["producto_id"]
            )

            if (
                producto_id
                in productos_utilizados
            ):

                return Response(
                    {
                        "detalles":
                            (
                                "Un mismo producto "
                                "no puede aparecer "
                                "dos veces en la orden."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )

            productos_utilizados.add(
                producto_id
            )

            if (
                detalle[
                    "cantidad_solicitada"
                ]
                <= 0
            ):

                return Response(
                    {
                        "cantidad_solicitada":
                            (
                                "La cantidad solicitada "
                                "debe ser mayor a cero."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )

        orden = OrdenCarga.objects.create(

            numero=numero,

            fecha=
                datos["fecha"],

            fletero=
                fletero,

            estado=
                OrdenCarga.Estado.RECIBIDA,

            observaciones=
                datos.get(
                    "observaciones",
                    "",
                ),

            creado_por=
                request.user,
        )

        for detalle in detalles:

            producto = get_object_or_404(
                Producto,

                id=
                    detalle[
                        "producto_id"
                    ],

                activo=True,
            )

            DetalleOrdenCarga.objects.create(

                orden=
                    orden,

                producto=
                    producto,

                cantidad_solicitada=
                    detalle[
                        "cantidad_solicitada"
                    ],
            )

        orden = (
            OrdenCarga.objects
            .select_related(
                "fletero",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto",
                "entregas__detalles__producto",
            )
            .get(
                pk=orden.pk
            )
        )

        return Response(
            OrdenCargaSerializer(
                orden
            ).data,
            status=
                status.HTTP_201_CREATED,
        )


# ============================================================
# DETALLE DE UNA ORDEN
# ============================================================


class OrdenCargaDetailAPIView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]


    def get(
        self,
        request,
        pk,
    ):

        orden = get_object_or_404(

            OrdenCarga.objects
            .select_related(
                "fletero",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto",
                "entregas__detalles__producto",
                "entregas__creado_por",
            ),

            pk=pk,
        )

        return Response(
            OrdenCargaSerializer(
                orden
            ).data
        )


# ============================================================
# REGISTRAR ENTREGA DE UNA ORDEN
# ============================================================


class CrearEntregaOrdenAPIView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]


    @transaction.atomic
    def post(
        self,
        request,
        pk,
    ):

        # ----------------------------------------------------
        # BLOQUEAR ORDEN DURANTE LA OPERACIÓN
        # ----------------------------------------------------

        orden = get_object_or_404(

            OrdenCarga.objects
            .select_for_update()
            .select_related(
                "fletero"
            )
            .prefetch_related(
                "detalles__producto"
            ),

            pk=pk,
        )


        # ----------------------------------------------------
        # NO PERMITIR ENTREGAS SOBRE ÓRDENES COMPLETAS
        # ----------------------------------------------------

        if orden.estado in [
            OrdenCarga.Estado.COMPLETA,
            OrdenCarga.Estado.COMPLETA_CON_CAMBIO,
        ]:

            return Response(
                {
                    "orden":
                        (
                            "La orden ya está completa "
                            "y no admite nuevas entregas."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        entrada = CrearEntregaOrdenSerializer(
            data=request.data
        )

        entrada.is_valid(
            raise_exception=True
        )

        datos = entrada.validated_data

        detalles = (
            datos.get(
                "detalles",
                []
            )
        )


        # ----------------------------------------------------
        # LA ENTREGA DEBE TENER PRODUCTOS
        # ----------------------------------------------------

        if not detalles:

            return Response(
                {
                    "detalles":
                        (
                            "La entrega debe contener "
                            "al menos un producto."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        # ----------------------------------------------------
        # PRODUCTOS QUE PERTENECEN A LA ORDEN
        # ----------------------------------------------------

        productos_orden = {

            detalle.producto_id:
                detalle

            for detalle
            in orden.detalles.all()
        }


        productos_entrega = set()


        # ====================================================
        # VALIDAR PRODUCTOS Y CANTIDADES
        # ====================================================

        for detalle in detalles:

            producto_id = (
                detalle["producto_id"]
            )

            cantidad = (
                detalle[
                    "cantidad_entregada"
                ]
            )


            # ------------------------------------------------
            # CANTIDAD MAYOR A CERO
            # ------------------------------------------------

            if cantidad <= 0:

                return Response(
                    {
                        "cantidad_entregada":
                            (
                                "La cantidad entregada "
                                "debe ser mayor a cero."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )


            # ------------------------------------------------
            # EVITAR PRODUCTO DUPLICADO
            # ------------------------------------------------

            if (
                producto_id
                in productos_entrega
            ):

                return Response(
                    {
                        "detalles":
                            (
                                "Un mismo producto "
                                "no puede aparecer "
                                "dos veces en una entrega."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )


            productos_entrega.add(
                producto_id
            )


            # ------------------------------------------------
            # VERIFICAR QUE PERTENEZCA A LA ORDEN
            # ------------------------------------------------

            if (
                producto_id
                not in productos_orden
            ):

                return Response(
                    {
                        "detalles":
                            (
                                "Uno de los productos "
                                "no pertenece a la orden."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )


            detalle_orden = (
                productos_orden[
                    producto_id
                ]
            )


            # ------------------------------------------------
            # CALCULAR LO YA ENTREGADO
            # ------------------------------------------------

            cantidad_ya_entregada = (

                DetalleEntregaOrdenCarga.objects
                .filter(
                    entrega__orden=
                        orden,

                    producto_id=
                        producto_id,
                )
                .aggregate(
                    total=Sum(
                        "cantidad_entregada"
                    )
                )["total"]
                or 0
            )


            # ------------------------------------------------
            # CALCULAR PENDIENTE
            # ------------------------------------------------

            cantidad_pendiente = (

                detalle_orden
                .cantidad_solicitada

                -

                cantidad_ya_entregada
            )


            # ------------------------------------------------
            # EVITAR ENTREGAR PRODUCTO YA COMPLETADO
            # ------------------------------------------------

            if cantidad_pendiente <= 0:

                return Response(
                    {
                        "cantidad_entregada":
                            (
                                "El producto "
                                f"{detalle_orden.producto} "
                                "ya fue entregado "
                                "completamente."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )


            # ------------------------------------------------
            # EVITAR SOBREENREGA
            # ------------------------------------------------

            if (
                cantidad
                >
                cantidad_pendiente
            ):

                return Response(
                    {
                        "cantidad_entregada":
                            (
                                "La cantidad entregada "
                                "del producto "
                                f"{detalle_orden.producto} "
                                "supera la cantidad "
                                "pendiente. "
                                "Pendiente: "
                                f"{cantidad_pendiente}."
                            )
                    },
                    status=
                        status.HTTP_400_BAD_REQUEST,
                )


        # ====================================================
        # COMPROBAR STOCK
        # ====================================================

        productos_sin_stock = []


        for detalle in detalles:

            producto = (
                productos_orden[
                    detalle[
                        "producto_id"
                    ]
                ]
                .producto
            )


            stock = (
                StockProducto.objects
                .filter(
                    producto=producto
                )
                .first()
            )


            disponible = (
                stock.cantidad_unidades
                if stock
                else 0
            )


            if (
                detalle[
                    "cantidad_entregada"
                ]
                >
                disponible
            ):

                productos_sin_stock.append(
                    producto.nombre
                )


        justificacion = (
            datos.get(
                "justificacion_stock",
                "",
            )
            or ""
        ).strip()


        if (
            productos_sin_stock
            and not justificacion
        ):

            return Response(
                {
                    "justificacion_stock":
                        (
                            "Hay stock insuficiente "
                            "para los siguientes "
                            "productos: "
                            +
                            ", ".join(
                                productos_sin_stock
                            )
                            +
                            ". Debe ingresar una "
                            "justificación para continuar."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        # ====================================================
        # CREAR ENTREGA
        # ====================================================

        entrega = (
            EntregaOrdenCarga.objects.create(

                orden=
                    orden,

                inicio_carga=
                    datos.get(
                        "inicio_carga"
                    ),

                fin_carga=
                    datos.get(
                        "fin_carga"
                    ),

                pallets_salida=
                    datos.get(
                        "pallets_salida",
                        0,
                    ),

                pallets_entrada=
                    datos.get(
                        "pallets_entrada",
                        0,
                    ),

                chapadur_salida=
                    datos.get(
                        "chapadur_salida",
                        0,
                    ),

                chapadur_entrada=
                    datos.get(
                        "chapadur_entrada",
                        0,
                    ),

                observaciones=
                    datos.get(
                        "observaciones",
                        "",
                    ),

                justificacion_stock=
                    justificacion,

                creado_por=
                    request.user,
            )
        )


        # ====================================================
        # CREAR DETALLES DE ENTREGA
        # ====================================================

        for detalle in detalles:

            producto = (
                productos_orden[
                    detalle[
                        "producto_id"
                    ]
                ]
                .producto
            )


            DetalleEntregaOrdenCarga.objects.create(

                entrega=
                    entrega,

                producto=
                    producto,

                cantidad_entregada=
                    detalle[
                        "cantidad_entregada"
                    ],
            )


        # ====================================================
        # DESCONTAR STOCK + MATERIALES + ESTADO
        # ====================================================

        try:

            confirmar_entrega_orden(
                entrega=entrega,
                creado_por=request.user,
            )

        except DjangoValidationError as error:

            # Al estar dentro de transaction.atomic,
            # marcamos la transacción para rollback.
            transaction.set_rollback(
                True
            )

            return Response(
                respuesta_error_validacion(
                    error
                ),
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        # ====================================================
        # RECARGAR ENTREGA
        # ====================================================

        entrega = (
            EntregaOrdenCarga.objects
            .select_related(
                "orden",
                "creado_por",
            )
            .prefetch_related(
                "detalles__producto"
            )
            .get(
                pk=entrega.pk
            )
        )


        return Response(
            {
                "mensaje":
                    (
                        "Entrega registrada "
                        "correctamente."
                    ),

                "entrega":
                    {
                        "id":
                            entrega.id,

                        "orden_id":
                            entrega.orden_id,

                        "estado_orden":
                            entrega.orden.estado,
                    },
            },
            status=
                status.HTTP_201_CREATED,
        )


# ============================================================
# MOVIMIENTOS DE MATERIALES
# ============================================================


class MovimientoMaterialListAPIView(
    APIView
):

    permission_classes = [
        IsAuthenticated
    ]


    def get(
        self,
        request,
    ):

        movimientos = (
            MovimientoMaterial.objects
            .select_related(
                "fletero",
                "orden",
                "creado_por",
            )
            .all()
            .order_by(
                "-creado_en"
            )
        )


        return Response(
            MovimientoMaterialSerializer(
                movimientos,
                many=True,
            ).data
        )