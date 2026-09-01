from rest_framework import serializers

from .models import (
    Empleado,
    Vehiculo,
    Asignacion,
    MotivoRechazo,
    Concesionario,
    Producto,
    MotivoCambio,
)


class EmpleadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empleado
        fields = [
            "id",
            "legajo",
            "nombre",
            "puesto",
            "disponible",
            "activo",
        ]


class VehiculoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehiculo
        fields = [
            "id",
            "patente",
            "descripcion",
            "tipo",
            "activo",
        ]


class AsignacionSerializer(serializers.ModelSerializer):
    chofer_predeterminado_id = serializers.IntegerField(
        source="chofer_predeterminado.id",
        read_only=True,
        allow_null=True,
    )

    chofer_predeterminado_nombre = serializers.CharField(
        source="chofer_predeterminado.nombre",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Asignacion
        fields = [
            "id",
            "codigo",
            "descripcion",
            "activo",
            "chofer_predeterminado_id",
            "chofer_predeterminado_nombre",
        ]

class MotivoRechazoSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = MotivoRechazo

        fields = [
            "id",
            "nombre",
            "activo",
        ]

class ConcesionarioSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = Concesionario

        fields = [
            "id",
            "nombre",
            "activo",
        ]


class ProductoSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = Producto

        fields = [
            "id",
            "codigo",
            "nombre",
            "presentacion",
            "sabor",
            "familia",
            "activo",
        ]


class MotivoCambioSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = MotivoCambio

        fields = [
            "id",
            "nombre",
            "activo",
        ]