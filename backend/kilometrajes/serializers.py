from rest_framework import serializers

from maestros.models import Empleado

from .models import (
    ControlKilometraje,
    DestinoKilometraje,
    RegistroKilometraje,
)
from .planilla import columnas_actuales, columnas_control


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
        max_digits=20,
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

    columnas = serializers.SerializerMethodField()

    def get_columnas(self, obj):
        return columnas_control(obj)

    chofer_nombre = serializers.CharField(
        source="chofer.nombre",
        read_only=True,
    )

    total_km = serializers.DecimalField(
        max_digits=20,
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
            "estado", "version", "columnas", "envio_estado", "enviado_en", "error_envio",
        ]


class RegistroKilometrajeEntradaSerializer(
    serializers.Serializer
):

    fecha = serializers.DateField()

    destino = serializers.PrimaryKeyRelatedField(
        queryset=DestinoKilometraje.objects.all()
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

    version = serializers.IntegerField(required=False, min_value=1, write_only=True)
    motivo_correccion = serializers.CharField(required=False, allow_blank=True, write_only=True)

    chofer = serializers.PrimaryKeyRelatedField(
        queryset=Empleado.objects.all()
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

        if (fecha_hasta - fecha_desde).days >= 366:
            raise serializers.ValidationError("El período no puede superar 366 días.")
        if self.instance:
            if attrs.get("version") != self.instance.version:
                raise serializers.ValidationError("La planilla cambió. Volvé a abrirla antes de guardar; no se sobrescribieron datos.")
            if self.instance.envio_estado == "ENVIANDO":
                raise serializers.ValidationError("Hay un envío en curso. Esperá antes de modificar la planilla.")
            if (attrs["chofer"].pk, fecha_desde, fecha_hasta) != (self.instance.chofer_id, self.instance.fecha_desde, self.instance.fecha_hasta):
                raise serializers.ValidationError("No se puede cambiar el chofer ni el período de una planilla existente.")
            columnas = columnas_control(self.instance)
        else:
            if not attrs["chofer"].activo:
                raise serializers.ValidationError("El chofer no está activo.")
            existente = ControlKilometraje.objects.filter(chofer=attrs["chofer"], fecha_desde=fecha_desde, fecha_hasta=fecha_hasta).first()
            if existente:
                raise serializers.ValidationError({"error": f"Ya existe la planilla N.º {existente.pk}. Abrila desde el historial para continuar."})
            columnas = columnas_actuales()
        if not columnas:
            raise serializers.ValidationError("No hay destinos configurados. Consultá al administrador.")
        ids = {d["id"] for d in columnas}
        vistos = set()
        for item in attrs.get("registros", []):
            clave = (item["fecha"], item["destino"].pk)
            if not fecha_desde <= item["fecha"] <= fecha_hasta:
                raise serializers.ValidationError("Hay viajes fuera del período.")
            if clave in vistos:
                raise serializers.ValidationError("Hay celdas repetidas para un día y destino.")
            if item["destino"].pk not in ids:
                raise serializers.ValidationError("El destino no pertenece a esta planilla.")
            if item["cantidad_viajes"] > 2147483647:
                raise serializers.ValidationError("Cantidad de viajes demasiado grande.")
            vistos.add(clave)
        self.columnas_validadas = columnas
        return attrs

    def create(
        self,
        validated_data,
    ):

        validated_data.pop("version", None)
        validated_data.pop("motivo_correccion", None)
        registros_data = validated_data.pop(
            "registros",
            [],
        )

        request = self.context.get(
            "request"
        )

        control = ControlKilometraje.objects.create(
            columnas=self.columnas_validadas,
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

    def update(self, instance, validated_data):
        anteriores = {(r.fecha, r.destino_id): r.distancia_km for r in instance.registros.all()}
        columnas = {d["id"]: d for d in self.columnas_validadas}
        nuevos = []
        for item in validated_data["registros"]:
            if not item["cantidad_viajes"]:
                continue
            destino = item["destino"]
            nuevos.append(RegistroKilometraje(control=instance, fecha=item["fecha"], destino=destino,
                cantidad_viajes=item["cantidad_viajes"],
                distancia_km=anteriores.get((item["fecha"], destino.pk), columnas[destino.pk]["distancia_km"]),
                observaciones=item.get("observaciones", "")))
        instance.registros.all().delete()
        RegistroKilometraje.objects.bulk_create(nuevos)
        instance.columnas = self.columnas_validadas
        instance.observaciones = validated_data.get("observaciones", "")
        instance.estado = "BORRADOR"
        instance.envio_estado = "PENDIENTE"
        instance.error_envio = ""
        instance.enviado_en = None
        instance.version += 1
        instance.save()
        return instance
