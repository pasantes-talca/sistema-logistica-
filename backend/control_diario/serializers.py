from rest_framework import serializers

from control_diario.models import (
    ControlDiario,
    MovimientoControlDiario,
    ProductoControlDiario,
    UbicacionControlDiario,
)


class ProductoControlDiarioSerializer(serializers.ModelSerializer):

    class Meta:
        model = ProductoControlDiario

        fields = [
            "id",
            "familia",
            "sabor",
            "presentacion",
            "nombre",
            "orden",
            "activo",
        ]


class UbicacionControlDiarioSerializer(serializers.ModelSerializer):

    tipo_nombre = serializers.CharField(
        source="get_tipo_display",
        read_only=True,
    )

    class Meta:
        model = UbicacionControlDiario

        fields = [
            "id",
            "nombre",
            "tipo",
            "tipo_nombre",
            "orden",
            "activo",
        ]


class MovimientoControlDiarioSerializer(serializers.ModelSerializer):

    producto_nombre = serializers.CharField(
        source="producto.nombre",
        read_only=True,
    )

    ubicacion_nombre = serializers.CharField(
        source="ubicacion.nombre",
        read_only=True,
    )

    tipo_movimiento_nombre = serializers.CharField(
        source="get_tipo_movimiento_display",
        read_only=True,
    )

    class Meta:
        model = MovimientoControlDiario

        fields = [
            "id",
            "producto",
            "producto_nombre",
            "ubicacion",
            "ubicacion_nombre",
            "tipo_movimiento",
            "tipo_movimiento_nombre",
            "cantidad",
            "observaciones",
            "creado_en",
            "actualizado_en",
        ]


class ControlDiarioSerializer(serializers.ModelSerializer):

    movimientos = MovimientoControlDiarioSerializer(
        many=True,
        read_only=True,
    )

    creado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ControlDiario

        fields = [
            "id",
            "fecha",
            "observaciones",
            "creado_por",
            "creado_por_nombre",
            "creado_en",
            "actualizado_en",
            "movimientos",
        ]


    def get_creado_por_nombre(self, obj):

        if not obj.creado_por:
            return None

        nombre_completo = (
            obj.creado_por.get_full_name()
        )

        if nombre_completo:
            return nombre_completo

        return obj.creado_por.username


class MovimientoControlDiarioEntradaSerializer(
    serializers.Serializer
):

    producto = serializers.PrimaryKeyRelatedField(
        queryset=ProductoControlDiario.objects.filter(
            activo=True
        )
    )

    ubicacion = serializers.PrimaryKeyRelatedField(
        queryset=UbicacionControlDiario.objects.filter(
            activo=True
        )
    )

    tipo_movimiento = serializers.ChoiceField(
        choices=MovimientoControlDiario.TipoMovimiento.choices
    )

    cantidad = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=0,
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class CrearControlDiarioSerializer(serializers.Serializer):

    fecha = serializers.DateField()

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    movimientos = (
        MovimientoControlDiarioEntradaSerializer(
            many=True,
            required=False,
            default=list,
        )
    )


    def validate_fecha(self, fecha):

        if ControlDiario.objects.filter(
            fecha=fecha
        ).exists():

            raise serializers.ValidationError(
                "Ya existe un control diario para esta fecha."
            )

        return fecha


    def validate_movimientos(
        self,
        movimientos,
    ):

        combinaciones = set()

        for movimiento in movimientos:

            clave = (
                movimiento["producto"].id,
                movimiento["ubicacion"].id,
                movimiento["tipo_movimiento"],
            )

            if clave in combinaciones:

                raise serializers.ValidationError(
                    (
                        "Hay movimientos duplicados para "
                        "el mismo producto, ubicación "
                        "y tipo de movimiento."
                    )
                )

            combinaciones.add(clave)

        return movimientos