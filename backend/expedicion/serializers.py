from rest_framework import serializers

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


# ============================================================
# FLETEROS
# ============================================================

class FleteroSerializer(serializers.ModelSerializer):

    class Meta:
        model = Fletero
        fields = [
            "id",
            "nombre",
            "apellido",
            "empresa",
            "activo",
        ]


# ============================================================
# STOCK
# ============================================================

class StockProductoSerializer(serializers.ModelSerializer):

    producto_id = serializers.IntegerField(
        source="producto.id",
        read_only=True,
    )

    codigo = serializers.CharField(
        source="producto.codigo",
        read_only=True,
    )

    producto = serializers.CharField(
        source="producto.nombre",
        read_only=True,
    )

    class Meta:
        model = StockProducto
        fields = [
            "id",
            "producto_id",
            "codigo",
            "producto",
            "cantidad_unidades",
            "stock_minimo",
            "stock_critico",
            "actualizado_en",
        ]


# ============================================================
# DETALLE DE ORDEN
# ============================================================

class DetalleOrdenCargaSerializer(
    serializers.ModelSerializer
):

    codigo = serializers.CharField(
        source="producto.codigo",
        read_only=True,
    )

    producto_nombre = serializers.CharField(
        source="producto.nombre",
        read_only=True,
    )

    class Meta:
        model = DetalleOrdenCarga
        fields = [
            "id",
            "producto",
            "codigo",
            "producto_nombre",
            "cantidad_solicitada",
        ]


# ============================================================
# DETALLE DE ENTREGA
# ============================================================

class DetalleEntregaOrdenCargaSerializer(
    serializers.ModelSerializer
):

    codigo = serializers.CharField(
        source="producto.codigo",
        read_only=True,
    )

    producto_nombre = serializers.CharField(
        source="producto.nombre",
        read_only=True,
    )

    class Meta:
        model = DetalleEntregaOrdenCarga
        fields = [
            "id",
            "producto",
            "codigo",
            "producto_nombre",
            "cantidad_entregada",
        ]


# ============================================================
# ENTREGA
# ============================================================

class EntregaOrdenCargaSerializer(
    serializers.ModelSerializer
):

    detalles = (
        DetalleEntregaOrdenCargaSerializer(
            many=True,
            read_only=True,
        )
    )

    creado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = EntregaOrdenCarga
        fields = [
            "id",
            "orden",
            "fecha",
            "inicio_carga",
            "fin_carga",
            "pallets_salida",
            "pallets_entrada",
            "chapadur_salida",
            "chapadur_entrada",
            "observaciones",
            "justificacion_stock",
            "creado_por",
            "creado_por_nombre",
            "detalles",
        ]

    def get_creado_por_nombre(
        self,
        obj,
    ):
        if not obj.creado_por:
            return ""

        return (
            obj.creado_por.get_full_name()
            or obj.creado_por.username
        )


# ============================================================
# ORDEN
# ============================================================

class OrdenCargaSerializer(
    serializers.ModelSerializer
):

    fletero_nombre = serializers.SerializerMethodField()

    detalles = (
        DetalleOrdenCargaSerializer(
            many=True,
            read_only=True,
        )
    )

    entregas = (
        EntregaOrdenCargaSerializer(
            many=True,
            read_only=True,
        )
    )

    creado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = OrdenCarga
        fields = [
            "id",
            "numero",
            "fecha",
            "fletero",
            "fletero_nombre",
            "estado",
            "facturacion",
            "observaciones",
            "creado_por",
            "creado_por_nombre",
            "creado_en",
            "actualizado_en",
            "detalles",
            "entregas",
        ]

    def get_fletero_nombre(
        self,
        obj,
    ):
        nombre = (
            f"{obj.fletero.nombre} "
            f"{obj.fletero.apellido}"
        ).strip()

        if obj.fletero.empresa:
            return (
                f"{nombre} - "
                f"{obj.fletero.empresa}"
            )

        return nombre

    def get_creado_por_nombre(
        self,
        obj,
    ):
        if not obj.creado_por:
            return ""

        return (
            obj.creado_por.get_full_name()
            or obj.creado_por.username
        )


# ============================================================
# MOVIMIENTO DE STOCK
# ============================================================

class MovimientoStockSerializer(
    serializers.ModelSerializer
):

    codigo = serializers.CharField(
        source="producto.codigo",
        read_only=True,
    )

    producto_nombre = serializers.CharField(
        source="producto.nombre",
        read_only=True,
    )

    creado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoStock
        fields = [
            "id",
            "producto",
            "codigo",
            "producto_nombre",
            "tipo",
            "direccion",
            "cantidad",
            "referencia",
            "observaciones",
            "orden",
            "creado_por",
            "creado_por_nombre",
            "creado_en",
        ]

    def get_creado_por_nombre(
        self,
        obj,
    ):
        if not obj.creado_por:
            return ""

        return (
            obj.creado_por.get_full_name()
            or obj.creado_por.username
        )


# ============================================================
# MOVIMIENTO DE MATERIALES
# ============================================================

class MovimientoMaterialSerializer(
    serializers.ModelSerializer
):

    fletero_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoMaterial
        fields = [
            "id",
            "fletero",
            "fletero_nombre",
            "orden",
            "referencia",
            "origen",
            "pallets_salida",
            "pallets_entrada",
            "chapadur_salida",
            "chapadur_entrada",
            "creado_por",
            "creado_en",
        ]

    def get_fletero_nombre(
        self,
        obj,
    ):
        nombre = (
            f"{obj.fletero.nombre} "
            f"{obj.fletero.apellido}"
        ).strip()

        if obj.fletero.empresa:
            return (
                f"{nombre} - "
                f"{obj.fletero.empresa}"
            )

        return nombre


# ============================================================
# PAYLOAD PARA CREAR ORDEN
# ============================================================

class CrearDetalleOrdenSerializer(
    serializers.Serializer
):

    producto_id = serializers.IntegerField()

    cantidad_solicitada = (
        serializers.DecimalField(
            max_digits=14,
            decimal_places=2,
        )
    )


class CrearOrdenCargaSerializer(
    serializers.Serializer
):

    numero = serializers.CharField(
        max_length=60
    )

    fecha = serializers.DateField()

    fletero_id = serializers.IntegerField()

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    detalles = CrearDetalleOrdenSerializer(
        many=True
    )


# ============================================================
# PAYLOAD PARA CREAR ENTREGA
# ============================================================

class CrearDetalleEntregaSerializer(
    serializers.Serializer
):

    producto_id = serializers.IntegerField()

    cantidad_entregada = (
        serializers.DecimalField(
            max_digits=14,
            decimal_places=2,
        )
    )


class CrearEntregaOrdenSerializer(
    serializers.Serializer
):

    inicio_carga = serializers.DateTimeField(
        required=False,
        allow_null=True,
    )

    fin_carga = serializers.DateTimeField(
        required=False,
        allow_null=True,
    )

    pallets_salida = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=0,
    )

    pallets_entrada = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=0,
    )

    chapadur_salida = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=0,
    )

    chapadur_entrada = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        default=0,
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    justificacion_stock = (
        serializers.CharField(
            required=False,
            allow_blank=True,
            default="",
        )
    )

    detalles = CrearDetalleEntregaSerializer(
        many=True
    )


# ============================================================
# PAYLOAD PARA MOVIMIENTO MANUAL DE STOCK
# ============================================================

class CrearMovimientoStockSerializer(
    serializers.Serializer
):

    producto_id = serializers.IntegerField()

    tipo = serializers.ChoiceField(
        choices=MovimientoStock.Tipo.choices
    )

    direccion = serializers.ChoiceField(
        choices=(
            MovimientoStock.Direccion.choices
        )
    )

    cantidad = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
    )

    referencia = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )