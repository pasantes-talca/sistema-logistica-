from rest_framework import serializers

from maestros.models import Empleado, Vehiculo, Asignacion
from .models import Reparto, RepartoPersonal
from .services import (
    crear_reparto,
    actualizar_reparto,
)


class RepartoPersonalSerializer(serializers.ModelSerializer):
    empleado_id = serializers.IntegerField(
        source="empleado.id",
        read_only=True
    )

    empleado_nombre = serializers.CharField(
        source="empleado.nombre",
        read_only=True
    )

    class Meta:
        model = RepartoPersonal
        fields = [
            "id",
            "empleado_id",
            "empleado_nombre",
            "rol",
            "orden",
        ]


class RepartoSerializer(serializers.ModelSerializer):
    vehiculo_id = serializers.IntegerField(
        source="vehiculo.id",
        read_only=True,
        allow_null=True
    )

    patente = serializers.CharField(
        source="vehiculo.patente",
        read_only=True,
        allow_null=True
    )

    asignacion_id = serializers.IntegerField(
        source="asignacion.id",
        read_only=True,
        allow_null=True
    )

    asignacion_codigo = serializers.CharField(
        source="asignacion.codigo",
        read_only=True,
        allow_null=True
    )

    personal = RepartoPersonalSerializer(
        many=True,
        read_only=True
    )

    cantidad_personas = serializers.IntegerField(
        read_only=True
    )

    recargas_totales = serializers.IntegerField(
        read_only=True
    )

    class Meta:
        model = Reparto
        fields = [
            "id",
            "fecha",

            "vehiculo_id",
            "patente",

            "asignacion_id",
            "asignacion_codigo",

            "bultos",
            "puntos_venta",

            "recargas",
            "cantidad_personas",
            "recargas_totales",

            "observaciones",

            "personal",

            "creado_en",
            "actualizado_en",
        ]


class RepartoCreateSerializer(serializers.Serializer):
    fecha = serializers.DateField()

    vehiculo_id = serializers.IntegerField(
        required=False,
        allow_null=True
    )

    asignacion_id = serializers.IntegerField(
        required=False,
        allow_null=True
    )

    chofer_id = serializers.IntegerField()

    ayudantes_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list
    )

    bultos = serializers.IntegerField(
        min_value=0
    )

    puntos_venta = serializers.CharField(
        required=False,
        allow_blank=True,
        default=""
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default=""
    )

    def validate_vehiculo_id(self, value):
        if value is None:
            return value

        if not Vehiculo.objects.filter(
            id=value,
            activo=True
        ).exists():
            raise serializers.ValidationError(
                "El vehículo seleccionado no existe o está inactivo."
            )

        return value

    def validate_asignacion_id(self, value):
        if value is None:
            return value

        if not Asignacion.objects.filter(
            id=value,
            activo=True
        ).exists():
            raise serializers.ValidationError(
                "La asignación seleccionada no existe o está inactiva."
            )

        return value

    def validate_chofer_id(self, value):
        if not Empleado.objects.filter(
            id=value
        ).exists():
            raise serializers.ValidationError(
                "El chofer seleccionado no existe."
            )

        return value

    def validate_ayudantes_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError(
                "No se puede seleccionar dos veces al mismo ayudante."
            )

        existentes = set(
            Empleado.objects.filter(
                id__in=value
            ).values_list(
                "id",
                flat=True
            )
        )

        faltantes = set(value) - existentes

        if faltantes:
            raise serializers.ValidationError(
                "Uno o más ayudantes no existen."
            )

        return value

    def validate(self, attrs):
        if attrs["chofer_id"] in attrs.get(
            "ayudantes_ids",
            []
        ):
            raise serializers.ValidationError(
                "El chofer no puede estar también entre los ayudantes."
            )

        return attrs

    def create(self, validated_data):
        vehiculo = None
        asignacion = None

        vehiculo_id = validated_data.get(
            "vehiculo_id"
        )

        asignacion_id = validated_data.get(
            "asignacion_id"
        )

        if vehiculo_id is not None:
            vehiculo = Vehiculo.objects.get(
                id=vehiculo_id
            )

        if asignacion_id is not None:
            asignacion = Asignacion.objects.get(
                id=asignacion_id
            )

        chofer = Empleado.objects.get(
            id=validated_data["chofer_id"]
        )

        ayudantes = list(
            Empleado.objects.filter(
                id__in=validated_data.get(
                    "ayudantes_ids",
                    []
                )
            )
        )

        request = self.context.get("request")

        creado_por = None

        if (
            request
            and request.user
            and request.user.is_authenticated
        ):
            creado_por = request.user

        return crear_reparto(
            fecha=validated_data["fecha"],
            bultos=validated_data["bultos"],
            chofer=chofer,
            ayudantes=ayudantes,
            vehiculo=vehiculo,
            asignacion=asignacion,
            puntos_venta=validated_data.get(
                "puntos_venta",
                ""
            ),
            observaciones=validated_data.get(
                "observaciones",
                ""
            ),
            creado_por=creado_por,
        )

    def update(self, instance, validated_data):
        vehiculo = None
        asignacion = None

        vehiculo_id = validated_data.get(
            "vehiculo_id"
        )

        asignacion_id = validated_data.get(
            "asignacion_id"
        )

        if vehiculo_id is not None:
            vehiculo = Vehiculo.objects.get(
                id=vehiculo_id
            )

        if asignacion_id is not None:
            asignacion = Asignacion.objects.get(
                id=asignacion_id
            )

        chofer = Empleado.objects.get(
            id=validated_data["chofer_id"]
        )

        ayudantes = list(
            Empleado.objects.filter(
                id__in=validated_data.get(
                    "ayudantes_ids",
                    []
                )
            )
        )

        return actualizar_reparto(
            reparto=instance,
            fecha=validated_data["fecha"],
            bultos=validated_data["bultos"],
            chofer=chofer,
            ayudantes=ayudantes,
            vehiculo=vehiculo,
            asignacion=asignacion,
            puntos_venta=validated_data.get(
                "puntos_venta",
                ""
            ),
            observaciones=validated_data.get(
                "observaciones",
                ""
            ),
        )