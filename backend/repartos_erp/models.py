from django.db import models
from django.conf import settings
import uuid


class RepartoERP(models.Model):
    """
    Cabecera de un reparto proveniente de SQL Server.

    SQL Server es únicamente la fuente de lectura.
    Este registro se almacena en PostgreSQL.
    """

    cod_jerarquia = models.IntegerField(null=True, blank=True)
    usuario_asignado = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="repartos_erp_asignados")
    unidad = models.ForeignKey("UnidadERP", null=True, blank=True, on_delete=models.PROTECT)
    version_operativa = models.PositiveIntegerField(default=0)
    recorrido_guardado = models.JSONField(default=dict, blank=True)

    cod_reparto = models.IntegerField(
        unique=True
    )

    nro_comprobante = models.CharField(
        max_length=50,
        blank=True
    )

    fecha_comprobante = models.DateField(
        null=True,
        blank=True
    )

    fecha_salida = models.DateField(
        null=True,
        blank=True
    )

    almacen = models.CharField(
        max_length=100,
        blank=True
    )

    ruta = models.CharField(
        max_length=100,
        blank=True
    )

    transporte = models.CharField(
        max_length=200,
        blank=True
    )

    chofer = models.CharField(
        max_length=200,
        blank=True
    )

    camion = models.CharField(
        max_length=100,
        blank=True
    )

    estado = models.IntegerField(
        null=True,
        blank=True
    )

    observaciones = models.TextField(
        blank=True
    )

    hora_salida = models.CharField(
        max_length=20,
        blank=True
    )

    monto_total = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True
    )

    cod_usuario = models.CharField(
        max_length=100,
        blank=True
    )

    cod_proveedor = models.IntegerField(
        null=True,
        blank=True
    )

    cod_liquidacion = models.IntegerField(
        null=True,
        blank=True
    )

    sincronizado_en = models.DateTimeField(
        auto_now=True
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        db_table = "repartos_erp"
        ordering = [
            "-fecha_comprobante",
            "-cod_reparto",
        ]

        indexes = [
            models.Index(
                fields=["fecha_comprobante"],
                name="idx_rep_erp_fecha"
            ),
            models.Index(
                fields=["chofer"],
                name="idx_rep_erp_chofer"
            ),
        ]

    def __str__(self):
        return (
            f"Reparto {self.cod_reparto} "
            f"- {self.chofer}"
        )


class ParadaRepartoERP(models.Model):
    """
    Cliente o punto de entrega perteneciente
    a un reparto.
    """

    importe_referencia = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    importe_editado = models.BooleanField(default=False)
    saldo_inicializado = models.BooleanField(default=False)
    observaciones_entrega = models.TextField(blank=True)
    orden_real = models.PositiveIntegerField(null=True, blank=True)
    entregado_en = models.DateTimeField(null=True, blank=True)

    reparto = models.ForeignKey(
        RepartoERP,
        on_delete=models.CASCADE,
        related_name="paradas"
    )

    cliente = models.CharField(
        max_length=250
    )

    codigo_cliente = models.CharField(
        max_length=100,
        blank=True
    )

    orden = models.PositiveIntegerField(
        default=0
    )

    estado = models.CharField(
        max_length=50,
        blank=True
    )

    importe_a_cobrar = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "repartos_erp_paradas"
        ordering = [
            "reparto",
            "orden",
            "id",
        ]

        indexes = [
            models.Index(
                fields=["reparto"],
                name="idx_rep_erp_parada"
            ),
        ]

    def __str__(self):
        return (
            f"{self.reparto.cod_reparto} "
            f"- {self.cliente}"
        )


class DocumentoRepartoERP(models.Model):

    class Tipo(models.TextChoices):
        FACTURA = "FACTURA", "Factura"
        PEDIDO = "PEDIDO", "Pedido"
        REMITO = "REMITO", "Remito"

    reparto = models.ForeignKey(
        RepartoERP,
        on_delete=models.CASCADE,
        related_name="documentos"
    )

    parada = models.ForeignKey(
        ParadaRepartoERP,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documentos"
    )

    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices
    )

    origen_id = models.IntegerField()

    tipo_comprobante = models.CharField(
        max_length=30,
        blank=True
    )

    nro_comprobante = models.CharField(
        max_length=50,
        blank=True
    )

    fecha_comprobante = models.DateField(
        null=True,
        blank=True
    )

    cliente = models.CharField(
        max_length=250,
        blank=True
    )

    neto = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True
    )

    monto = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True
    )

    estado = models.IntegerField(
        null=True,
        blank=True
    )

    cobrado = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True
    )

    condicion_venta = models.IntegerField(
        null=True,
        blank=True
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "repartos_erp_documentos"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "tipo",
                    "origen_id",
                ],
                name="uq_rep_erp_documento"
            ),
        ]

        indexes = [
            models.Index(
                fields=["reparto"],
                name="idx_rep_erp_doc_rep"
            ),
        ]

    def __str__(self):
        return (
            f"{self.tipo} "
            f"{self.nro_comprobante}"
        )


class DetalleDocumentoRepartoERP(models.Model):
    """
    Productos provenientes principalmente de
    V_RepartoFacturaDetalle.
    """

    documento = models.ForeignKey(
        DocumentoRepartoERP,
        on_delete=models.CASCADE,
        related_name="detalles"
    )

    origen_id = models.IntegerField(
        unique=True
    )

    codigo = models.CharField(
        max_length=100,
        blank=True
    )

    descripcion = models.CharField(
        max_length=500,
        blank=True
    )

    cod_articulo = models.IntegerField(
        null=True,
        blank=True
    )

    cantidad = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )

    cantidad_bultos = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )

    cantidad_unidades = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )

    bultos_dev = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )

    unidades_dev = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )

    precio = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True
    )

    rubro = models.CharField(
        max_length=200,
        blank=True
    )

    familia = models.CharField(
        max_length=200,
        blank=True
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        db_table = "repartos_erp_detalles"

        indexes = [
            models.Index(
                fields=["documento"],
                name="idx_rep_erp_det_doc"
            ),
        ]

    def __str__(self):
        return self.descripcion or self.codigo


class UnidadERP(models.Model):
    """Capacidad explícita, sin inventar capacidades para la flota existente."""
    dominio = models.CharField(max_length=40, unique=True)
    descripcion = models.CharField(max_length=200, blank=True)
    capacidad = models.PositiveIntegerField()
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "repartos_erp_unidades"
        ordering = ["dominio"]
        constraints = [models.CheckConstraint(condition=models.Q(capacidad__gt=0), name="erp_capacidad_positiva")]


class CobroERP(models.Model):
    parada = models.ForeignKey(ParadaRepartoERP, on_delete=models.PROTECT, related_name="cobros")
    solicitud = models.UUIDField(default=uuid.uuid4, unique=True)
    importe = models.DecimalField(max_digits=18, decimal_places=2)
    medios = models.JSONField(default=list)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cobros_erp")
    creado_en = models.DateTimeField(auto_now_add=True)
    anulado_en = models.DateTimeField(null=True, blank=True)
    anulado_por = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="cobros_erp_anulados")
    motivo_anulacion = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = "repartos_erp_cobros"
        ordering = ["-creado_en", "-id"]
        constraints = [models.CheckConstraint(condition=models.Q(importe__gt=0), name="erp_cobro_positivo")]


class ClientePersatERP(models.Model):
    """Réplica de solo lectura de Persat, vinculada exclusivamente por código exacto."""
    codigo = models.CharField(max_length=100, unique=True)
    nombre = models.CharField(max_length=250, blank=True)
    latitud = models.FloatField(null=True, blank=True)
    longitud = models.FloatField(null=True, blank=True)
    servicio_minutos = models.FloatField(null=True, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "repartos_erp_clientes_persat"


class EventoERP(models.Model):
    reparto = models.ForeignKey(RepartoERP, on_delete=models.PROTECT, related_name="eventos")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    accion = models.CharField(max_length=80)
    datos = models.JSONField(default=dict)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "repartos_erp_eventos"
        ordering = ["-creado_en", "-id"]
