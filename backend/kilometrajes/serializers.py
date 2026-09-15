from rest_framework import serializers

from maestros.models import Empleado

from .models import (
    ControlKilometraje,
    DestinoKilometraje,
    RegistroKilometraje,
)


class DestinoKilometrajeSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = DestinoKilometraje

        fields = [
            "id",
            "nombre",
            "distancia_km",
            "activo",
        ]


class RegistroKilometrajeSerializer(
    serializers.ModelSerializer
):

    destino_nombre = serializers.CharField(
        source="destino.nombre",
        read_only=True,
    )

    kilometros = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = RegistroKilometraje

        fields = [
            "id",
            "fecha",
            "destino",
            "destino_nombre",
            "cantidad_viajes",
            "distancia_km",
            "kilometros",
            "observaciones",
        ]


class ControlKilometrajeSerializer(
    serializers.ModelSerializer
):

    chofer_nombre = serializers.CharField(
        source="chofer.nombre",
        read_only=True,
    )

    total_km = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    registros = RegistroKilometrajeSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = ControlKilometraje

        fields = [
            "id",
            "chofer",
            "chofer_nombre",
            "fecha_desde",
            "fecha_hasta",
            "observaciones",
            "total_km",
            "registros",
            "creado_en",
            "actualizado_en",
        ]


class RegistroKilometrajeEntradaSerializer(
    serializers.Serializer
):

    fecha = serializers.DateField()

    destino = serializers.PrimaryKeyRelatedField(
        queryset=DestinoKilometraje.objects.filter(
            activo=True
        )
    )

    cantidad_viajes = serializers.IntegerField(
        min_value=0
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class CrearControlKilometrajeSerializer(
    serializers.Serializer
):

    chofer = serializers.PrimaryKeyRelatedField(
        queryset=Empleado.objects.filter(
            activo=True
        )
    )

    fecha_desde = serializers.DateField()

    fecha_hasta = serializers.DateField()

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    registros = RegistroKilometrajeEntradaSerializer(
        many=True,
        required=False,
        default=list,
    )

    def validate(
        self,
        attrs,
    ):

        fecha_desde = attrs["fecha_desde"]
        fecha_hasta = attrs["fecha_hasta"]

        if fecha_hasta < fecha_desde:

            raise serializers.ValidationError(
                {
                    "fecha_hasta":
                        (
                            "La fecha hasta no puede "
                            "ser anterior a la fecha desde."
                        )
                }
            )

        return attrs

    def create(
        self,
        validated_data,
    ):

        registros_data = validated_data.pop(
            "registros",
            [],
        )

        request = self.context.get(
            "request"
        )

        control = ControlKilometraje.objects.create(
            creado_por=(
                request.user
                if (
                    request
                    and request.user.is_authenticated
                )
                else None
            ),
            **validated_data,
        )

        registros = []

        for item in registros_data:

            destino = item["destino"]

            registros.append(
                RegistroKilometraje(
                    control=control,
                    fecha=item["fecha"],
                    destino=destino,
                    cantidad_viajes=(
                        item["cantidad_viajes"]
                    ),
                    distancia_km=(
                        destino.distancia_km
                    ),
                    observaciones=(
                        item.get(
                            "observaciones",
                            "",
                        )
                    ),
                )
            )

        RegistroKilometraje.objects.bulk_create(
            registros
        )

        return control