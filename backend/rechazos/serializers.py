from django.utils import timezone

from rest_framework import serializers

from maestros.models import (
    Asignacion,
    MotivoRechazo,
)

from .models import Rechazo


class RechazoSerializer(serializers.ModelSerializer):
    """
    Serializer de lectura.

    Devuelve el rechazo junto con información legible
    de asignación y motivo.
    """

    asignacion_id = serializers.IntegerField(
        source="asignacion.id",
        read_only=True,
        allow_null=True,
    )

    asignacion_codigo = serializers.CharField(
        source="asignacion.codigo",
        read_only=True,
        allow_null=True,
    )

    motivo_id = serializers.IntegerField(
        source="motivo.id",
        read_only=True,
    )

    motivo_nombre = serializers.CharField(
        source="motivo.nombre",
        read_only=True,
    )

    class Meta:
        model = Rechazo

        fields = [
            "id",

            "fecha",

            "asignacion_id",
            "asignacion_codigo",

            "punto_venta",
            "bultos",

            "motivo_id",
            "motivo_nombre",

            "observacion",

            "registrado_en",
            "creado_en",
            "actualizado_en",
        ]


class RechazoCreateUpdateSerializer(serializers.Serializer):
    """
    Serializer utilizado para crear y editar rechazos.
    """

    fecha = serializers.DateField()

    asignacion_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )

    punto_venta = serializers.CharField(
        max_length=250
    )

    bultos = serializers.CharField(
        max_length=100
    )

    motivo_id = serializers.IntegerField()

    observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


    # =========================================================
    # VALIDAR ASIGNACIÓN
    # =========================================================

    def validate_asignacion_id(self, value):
        if value is None:
            return value

        if not Asignacion.objects.filter(
            id=value,
            activo=True,
        ).exists():

            raise serializers.ValidationError(
                "La asignación seleccionada no existe o está inactiva."
            )

        return value


    # =========================================================
    # VALIDAR MOTIVO
    # =========================================================

    def validate_motivo_id(self, value):

        if not MotivoRechazo.objects.filter(
            id=value,
            activo=True,
        ).exists():

            raise serializers.ValidationError(
                "El motivo seleccionado no existe o está inactivo."
            )

        return value


    # =========================================================
    # CREAR
    # =========================================================

    def create(self, validated_data):

        asignacion = None

        asignacion_id = validated_data.get(
            "asignacion_id"
        )

        if asignacion_id is not None:

            asignacion = Asignacion.objects.get(
                id=asignacion_id
            )


        motivo = MotivoRechazo.objects.get(
            id=validated_data["motivo_id"]
        )


        request = self.context.get(
            "request"
        )

        creado_por = None

        if (
            request
            and request.user
            and request.user.is_authenticated
        ):

            creado_por = request.user


        rechazo = Rechazo.objects.create(

            fecha=validated_data["fecha"],

            asignacion=asignacion,

            punto_venta=validated_data[
                "punto_venta"
            ].strip(),

            bultos=validated_data[
                "bultos"
            ].strip(),

            motivo=motivo,

            observacion=validated_data.get(
                "observacion",
                ""
            ).strip(),

            registrado_en=timezone.now(),

            creado_por=creado_por,
        )

        return rechazo


    # =========================================================
    # ACTUALIZAR
    # =========================================================

    def update(
        self,
        instance,
        validated_data
    ):

        asignacion = None

        asignacion_id = validated_data.get(
            "asignacion_id"
        )

        if asignacion_id is not None:

            asignacion = Asignacion.objects.get(
                id=asignacion_id
            )


        motivo = MotivoRechazo.objects.get(
            id=validated_data["motivo_id"]
        )


        instance.fecha = validated_data[
            "fecha"
        ]

        instance.asignacion = asignacion

        instance.punto_venta = (
            validated_data[
                "punto_venta"
            ].strip()
        )

        instance.bultos = (
            validated_data[
                "bultos"
            ].strip()
        )

        instance.motivo = motivo

        instance.observacion = (
            validated_data.get(
                "observacion",
                ""
            ).strip()
        )

        instance.save()

        return instance