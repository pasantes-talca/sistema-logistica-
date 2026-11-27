from decimal import Decimal
from rest_framework import serializers
from .models import (RepartoERP, ParadaRepartoERP, DocumentoRepartoERP,
    DetalleDocumentoRepartoERP, CobroERP, UnidadERP, EventoERP)


def resumen(paradas):
    paradas = list(paradas)
    cobrar = sum((p.importe_a_cobrar for p in paradas), Decimal("0"))
    pagado = sum((c.importe for p in paradas for c in p.cobros.all() if c.anulado_en is None), Decimal("0"))
    return {"cantidad_paradas": len(paradas), "entregadas": sum(p.estado == "entregado" for p in paradas),
        "a_cobrar": str(cobrar), "cobrado_local": str(pagado), "saldo": str(cobrar - pagado)}


class DetalleDocumentoRepartoERPSerializer(serializers.ModelSerializer):
    class Meta:
        model = DetalleDocumentoRepartoERP
        exclude = ["documento", "creado_en"]


class DocumentoRepartoERPSerializer(serializers.ModelSerializer):
    detalles = DetalleDocumentoRepartoERPSerializer(many=True, read_only=True)
    class Meta:
        model = DocumentoRepartoERP
        exclude = ["reparto", "parada", "creado_en", "actualizado_en"]


class CobroERPSerializer(serializers.ModelSerializer):
    actor_nombre = serializers.CharField(source="actor.username", read_only=True)
    class Meta:
        model = CobroERP
        exclude = ["solicitud", "parada"]


class ParadaRepartoERPSerializer(serializers.ModelSerializer):
    documentos = DocumentoRepartoERPSerializer(many=True, read_only=True)
    cobros = CobroERPSerializer(many=True, read_only=True)
    cobrado_local = serializers.SerializerMethodField()
    saldo = serializers.SerializerMethodField()
    ubicacion = serializers.SerializerMethodField()

    def get_cobrado_local(self, obj):
        return str(sum((c.importe for c in obj.cobros.all() if c.anulado_en is None), Decimal("0")))

    def get_saldo(self, obj):
        return str(obj.importe_a_cobrar - Decimal(self.get_cobrado_local(obj)))

    def get_ubicacion(self, obj):
        cliente = self.context.get("ubicaciones", {}).get(obj.codigo_cliente)
        if not cliente:
            return {"estado": "sin_codigo" if not obj.codigo_cliente else "sin_consultar", "punto": None}
        punto = [cliente.latitud, cliente.longitud] if cliente.latitud is not None and cliente.longitud is not None else None
        return {"estado": "ubicado" if punto else "sin_coordenadas", "punto": punto,
            "nombre": cliente.nombre, "actualizado_en": cliente.actualizado_en,
            "servicio_minutos": cliente.servicio_minutos}

    class Meta:
        model = ParadaRepartoERP
        exclude = ["reparto", "saldo_inicializado", "importe_editado", "creado_en", "actualizado_en"]


class RepartoERPListaSerializer(serializers.ModelSerializer):
    resumen = serializers.SerializerMethodField()
    importado = serializers.BooleanField(default=True, read_only=True)
    def get_resumen(self, obj):
        return resumen(obj.paradas.all())
    class Meta:
        model = RepartoERP
        fields = ["id", "cod_reparto", "nro_comprobante", "fecha_comprobante", "fecha_salida", "almacen",
            "ruta", "chofer", "transporte", "camion", "estado", "monto_total", "cod_jerarquia", "resumen", "importado"]


class UnidadERPSerializer(serializers.ModelSerializer):
    capacidad = serializers.IntegerField(min_value=1, max_value=1000000)
    def validate_dominio(self, value):
        value = value.strip().upper()
        if UnidadERP.objects.filter(dominio__iexact=value).exclude(pk=self.instance.pk if self.instance else None).exists():
            raise serializers.ValidationError("Esta unidad ya está registrada.")
        return value
    class Meta:
        model = UnidadERP
        fields = ["id", "dominio", "descripcion", "capacidad", "activo"]


class RepartoERPDetalleSerializer(serializers.ModelSerializer):
    paradas = ParadaRepartoERPSerializer(many=True, read_only=True)
    resumen = serializers.SerializerMethodField()
    unidad_detalle = UnidadERPSerializer(source="unidad", read_only=True)
    usuario_asignado_nombre = serializers.SerializerMethodField()
    def get_usuario_asignado_nombre(self, obj):
        return (obj.usuario_asignado.get_full_name() or obj.usuario_asignado.username) if obj.usuario_asignado else ""
    def get_resumen(self, obj):
        return resumen(obj.paradas.all())
    class Meta:
        model = RepartoERP
        fields = "__all__"


class MedioSerializer(serializers.Serializer):
    medio = serializers.ChoiceField(choices=["efectivo", "transferencia", "cheque"])
    importe = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0.01"))
    referencia = serializers.CharField(max_length=200, required=False, allow_blank=True)
    banco = serializers.CharField(max_length=120, required=False, allow_blank=True)
    numero_cheque = serializers.CharField(max_length=100, required=False, allow_blank=True)
    fecha_pago = serializers.DateField(required=False, allow_null=True)
    def validate(self, attrs):
        if attrs["medio"] == "cheque" and not all(attrs.get(k) for k in ["banco", "numero_cheque", "fecha_pago"]):
            raise serializers.ValidationError("Completá banco, número y fecha de pago de cada cheque.")
        return attrs


class CobroEntradaSerializer(serializers.Serializer):
    solicitud = serializers.UUIDField()
    medios = MedioSerializer(many=True, allow_empty=False, max_length=20)


class EstadoEntradaSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=["pendiente", "entregado", "no_entregado"])
    observaciones = serializers.CharField(max_length=1000, required=False, allow_blank=True)


class ImporteEntradaSerializer(serializers.Serializer):
    importe = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0"))


class EventoERPSerializer(serializers.ModelSerializer):
    usuario = serializers.CharField(source="actor.username", read_only=True)
    class Meta:
        model = EventoERP
        fields = ["id", "accion", "datos", "usuario", "creado_en"]
