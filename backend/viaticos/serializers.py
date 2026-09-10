from rest_framework import serializers

from maestros.models import Empleado

from .models import Viatico


class ViaticoSerializer(serializers.ModelSerializer):

    chofer_nombre = serializers.CharField(
        source="chofer.nombre",
        read_only=True,
    )

    tipo_reparto_nombre = serializers.CharField(
        source="get_tipo_reparto_display",
        read_only=True,
    )

    mes = serializers.SerializerMethodField()

    monto_total = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Viatico

        fields = [
            "id",
            "chofer",
            "chofer_nombre",
            "tipo_reparto",
            "tipo_reparto_nombre",
            "fecha",
            "mes",
            "valor_viatico",
            "cantidad_viaticos",
            "monto_total",
            "observaciones",
            "creado_en",
            "actualizado_en",
        ]

        read_only_fields = [
            "id",
            "creado_en",
            "actualizado_en",
        ]

    def get_mes(
        self,
        obj,
    ):
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

        return meses.get(
            obj.fecha.month,
            "",
        )


class CrearActualizarViaticoSerializer(
    serializers.Serializer
):

    chofer = serializers.PrimaryKeyRelatedField(
        queryset=Empleado.objects.filter(
            activo=True
        )
    )

    tipo_reparto = serializers.ChoiceField(
        choices=Viatico.TipoReparto.choices
    )

    fecha = serializers.DateField()

    valor_viatico = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=0,
    )

    cantidad_viaticos = serializers.IntegerField(
        min_value=1
    )

    observaciones = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def create(
        self,
        validated_data,
    ):
        request = self.context.get(
            "request"
        )

        return Viatico.objects.create(
            **validated_data,
            creado_por=(
                request.user
                if (
                    request
                    and
                    request.user.is_authenticated
                )
                else None
            ),
        )

    def update(
        self,
        instance,
        validated_data,
    ):
        instance.chofer = (
            validated_data["chofer"]
        )

        instance.tipo_reparto = (
            validated_data[
                "tipo_reparto"
            ]
        )

        instance.fecha = (
            validated_data["fecha"]
        )

        instance.valor_viatico = (
            validated_data[
                "valor_viatico"
            ]
        )

        instance.cantidad_viaticos = (
            validated_data[
                "cantidad_viaticos"
            ]
        )

        instance.observaciones = (
            validated_data.get(
                "observaciones",
                "",
            )
        )

        instance.save()

        return instance