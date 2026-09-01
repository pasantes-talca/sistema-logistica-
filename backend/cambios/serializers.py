from rest_framework import serializers

from .models import (
    DetalleReciboCambio,
    ReciboCambio,
)


# =========================================================
# LECTURA DE DETALLES
# =========================================================

class DetalleReciboCambioSerializer(
    serializers.ModelSerializer
):

    producto_id = serializers.IntegerField(
        source="producto.id",
        read_only=True,
    )

    producto_codigo = serializers.CharField(
        source="producto.codigo",
        read_only=True,
    )

    producto_nombre = serializers.CharField(
        source="producto.nombre",
        read_only=True,
    )

    producto_familia = serializers.CharField(
        source="producto.familia",
        read_only=True,
    )

    motivo_id = serializers.IntegerField(
        source="motivo.id",
        read_only=True,
        allow_null=True,
    )

    motivo_nombre = serializers.CharField(
        source="motivo.nombre",
        read_only=True,
        allow_null=True,
    )


    class Meta:

        model = DetalleReciboCambio

        fields = [
            "id",

            "producto_id",
            "producto_codigo",
            "producto_nombre",
            "producto_familia",

            "cantidad",
            "observacion",

            "motivo_id",
            "motivo_nombre",

            "creado_en",
            "actualizado_en",
        ]


# =========================================================
# LECTURA DE RECIBO
# =========================================================

class ReciboCambioSerializer(
    serializers.ModelSerializer
):

    concesionario_id = serializers.IntegerField(
        source="concesionario.id",
        read_only=True,
    )

    concesionario_nombre = serializers.CharField(
        source="concesionario.nombre",
        read_only=True,
    )

    detalles = DetalleReciboCambioSerializer(
        many=True,
        read_only=True,
    )


    class Meta:

        model = ReciboCambio

        fields = [
            "id",

            "fecha",

            "concesionario_id",
            "concesionario_nombre",

            "pallets",
            "pallets_observacion",

            "pallets_descargados",
            "pallets_descargados_observacion",

            "prensados",
            "prensados_observacion",

            "detalles",

            "creado_en",
            "actualizado_en",
        ]


# =========================================================
# ENTRADA DE CADA PRODUCTO
# =========================================================

class DetalleReciboCambioCargaSerializer(
    serializers.Serializer
):

    producto_id = serializers.IntegerField()

    cantidad = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
    )

    motivo_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )

    observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


# =========================================================
# ENTRADA DE UN RECIBO
# =========================================================

class ReciboCambioCargaSerializer(
    serializers.Serializer
):

    fecha = serializers.DateField()

    concesionario_id = serializers.IntegerField()


    pallets = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        required=False,
        default=0,
    )

    pallets_observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


    pallets_descargados = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        required=False,
        default=0,
    )

    pallets_descargados_observacion = (
        serializers.CharField(
            required=False,
            allow_blank=True,
            default="",
        )
    )


    prensados = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
        required=False,
        default=0,
    )

    prensados_observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


    detalles = DetalleReciboCambioCargaSerializer(
        many=True,
        required=False,
        default=list,
    )