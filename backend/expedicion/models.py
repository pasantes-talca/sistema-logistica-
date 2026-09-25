from django.conf import settings
from django.db import models

from maestros.models import Producto


# ============================================================
# FLETEROS
# ============================================================

class Fletero(models.Model):

    nombre = models.CharField(
        max_length=120
    )

    apellido = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )

    empresa = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    activo = models.BooleanField(
        default=True
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = [
            "nombre",
            "apellido",
        ]

    def __str__(self):

        nombre_completo = (
            f"{self.nombre} {self.apellido}"
        ).strip()

        if self.empresa:
            return (
                f"{nombre_completo} - "
                f"{self.empresa}"
            )

        return nombre_completo


# ============================================================
# STOCK DE PRODUCTOS
# ============================================================

class StockProducto(models.Model):

    producto = models.OneToOneField(
        Producto,
        on_delete=models.PROTECT,
        related_name="stock_expedicion",
    )

    cantidad_unidades = (
        models.DecimalField(
            max_digits=14,
            decimal_places=2,
            default=0,
        )
    )

    stock_minimo = (
        models.DecimalField(
            max_digits=14,
            decimal_places=2,
            default=0,
        )
    )

    stock_critico = (
        models.DecimalField(
            max_digits=14,
            decimal_places=2,
            default=0,
        )
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = [
            "producto__codigo",
        ]

    def __str__(self):

        return (
            f"{self.producto} - "
            f"{self.cantidad_unidades}"
        )


# ============================================================
# ÓRDENES DE CARGA
# ============================================================

class OrdenCarga(models.Model):

    class Estado(models.TextChoices):

        RECIBIDA = (
            "RECIBIDA",
            "Recibida",
        )

        CARGA_INICIADA = (
            "CARGA_INICIADA",
            "Carga iniciada",
        )

        PARCIAL = (
            "PARCIAL",
            "Parcial",
        )

        COMPLETA = (
            "COMPLETA",
            "Completa",
        )

        COMPLETA_CON_CAMBIO = (
            "COMPLETA_CON_CAMBIO",
            "Completa con cambio",
        )

        PENDIENTE_CONTROL = (
            "PENDIENTE_CONTROL",
            "Pendiente de control",
        )


    class Facturacion(models.TextChoices):

        NO_APLICA = (
            "NO_APLICA",
            "No aplica",
        )

        PENDIENTE_AVISO = (
            "PENDIENTE_AVISO",
            "Pendiente de aviso",
        )

        AVISADA = (
            "AVISADA",
            "Avisada",
        )


    numero = models.CharField(
        max_length=60,
        unique=True,
    )

    fecha = models.DateField()

    fletero = models.ForeignKey(
        Fletero,
        on_delete=models.PROTECT,
        related_name="ordenes",
    )

    estado = models.CharField(
        max_length=30,
        choices=Estado.choices,
        default=Estado.RECIBIDA,
    )

    facturacion = models.CharField(
        max_length=30,
        choices=Facturacion.choices,
        default=Facturacion.NO_APLICA,
    )

    observaciones = models.TextField(
        blank=True,
        default="",
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "ordenes_expedicion_creadas"
        ),
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:

        ordering = [
            "-fecha",
            "-id",
        ]

    def __str__(self):

        return (
            f"Orden {self.numero}"
        )


# ============================================================
# PRODUCTOS SOLICITADOS EN LA ORDEN
# ============================================================

class DetalleOrdenCarga(models.Model):

    orden = models.ForeignKey(
        OrdenCarga,
        on_delete=models.CASCADE,
        related_name="detalles",
    )

    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name=(
            "detalles_orden_expedicion"
        ),
    )

    cantidad_solicitada = (
        models.DecimalField(
            max_digits=14,
            decimal_places=2,
            default=0,
        )
    )

    class Meta:

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "orden",
                    "producto",
                ],
                name=(
                    "unique_producto_orden_"
                    "expedicion"
                ),
            )
        ]

    def __str__(self):

        return (
            f"{self.orden.numero} - "
            f"{self.producto}"
        )


# ============================================================
# ENTREGAS DE UNA ORDEN
# ============================================================

class EntregaOrdenCarga(models.Model):

    orden = models.ForeignKey(
        OrdenCarga,
        on_delete=models.CASCADE,
        related_name="entregas",
    )

    fecha = models.DateTimeField(
        auto_now_add=True
    )

    inicio_carga = (
        models.DateTimeField(
            null=True,
            blank=True,
        )
    )

    fin_carga = (
        models.DateTimeField(
            null=True,
            blank=True,
        )
    )

    pallets_salida = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    pallets_entrada = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    chapadur_salida = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    chapadur_entrada = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    observaciones = models.TextField(
        blank=True,
        default="",
    )

    justificacion_stock = (
        models.TextField(
            blank=True,
            default="",
        )
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "entregas_expedicion_creadas"
        ),
    )

    def __str__(self):

        return (
            f"Entrega orden "
            f"{self.orden.numero}"
        )


# ============================================================
# PRODUCTOS REALMENTE ENTREGADOS
# ============================================================

class DetalleEntregaOrdenCarga(
    models.Model
):

    entrega = models.ForeignKey(
        EntregaOrdenCarga,
        on_delete=models.CASCADE,
        related_name="detalles",
    )

    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name=(
            "entregas_expedicion"
        ),
    )

    cantidad_entregada = (
        models.DecimalField(
            max_digits=14,
            decimal_places=2,
            default=0,
        )
    )

    class Meta:

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "entrega",
                    "producto",
                ],
                name=(
                    "unique_producto_entrega_"
                    "expedicion"
                ),
            )
        ]

    def __str__(self):

        return (
            f"{self.entrega} - "
            f"{self.producto}"
        )


# ============================================================
# MOVIMIENTOS DE STOCK
# ============================================================

class MovimientoStock(models.Model):

    class Tipo(models.TextChoices):

        INGRESO = (
            "INGRESO",
            "Ingreso",
        )

        ORDEN_CARGA = (
            "ORDEN_CARGA",
            "Orden de carga",
        )

        AJUSTE = (
            "AJUSTE",
            "Ajuste",
        )

        REBOTE = (
            "REBOTE",
            "Rebote",
        )

        DERRAME = (
            "DERRAME",
            "Derrame",
        )

        CONSUMO_EMPLEADO = (
            "CONSUMO_EMPLEADO",
            "Consumo de empleado",
        )

        ANTICIPO_EMPLEADO = (
            "ANTICIPO_EMPLEADO",
            "Anticipo de empleado",
        )


    class Direccion(models.TextChoices):

        ENTRADA = (
            "ENTRADA",
            "Entrada",
        )

        SALIDA = (
            "SALIDA",
            "Salida",
        )


    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        related_name=(
            "movimientos_stock_expedicion"
        ),
    )

    tipo = models.CharField(
        max_length=30,
        choices=Tipo.choices,
    )

    direccion = models.CharField(
        max_length=10,
        choices=Direccion.choices,
    )

    cantidad = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )

    referencia = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )

    observaciones = models.TextField(
        blank=True,
        default="",
    )

    orden = models.ForeignKey(
        OrdenCarga,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "movimientos_stock"
        ),
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "movimientos_stock_"
            "expedicion_creados"
        ),
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:

        ordering = [
            "-creado_en",
        ]

    def __str__(self):

        return (
            f"{self.tipo} - "
            f"{self.producto} - "
            f"{self.cantidad}"
        )


# ============================================================
# MOVIMIENTOS DE PALLETS Y CHAPADUR
# ============================================================

class MovimientoMaterial(models.Model):

    fletero = models.ForeignKey(
        Fletero,
        on_delete=models.PROTECT,
        related_name=(
            "movimientos_materiales"
        ),
    )

    orden = models.ForeignKey(
        OrdenCarga,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "movimientos_materiales"
        ),
    )

    referencia = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )

    origen = models.CharField(
        max_length=120,
        blank=True,
        default="",
    )

    pallets_salida = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    pallets_entrada = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    chapadur_salida = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    chapadur_entrada = (
        models.DecimalField(
            max_digits=12,
            decimal_places=2,
            default=0,
        )
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name=(
            "movimientos_materiales_"
            "expedicion_creados"
        ),
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:

        ordering = [
            "-creado_en",
        ]

    def __str__(self):

        return (
            f"{self.fletero} - "
            f"{self.referencia}"
        )