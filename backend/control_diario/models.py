from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class ProductoControlDiario(models.Model):

    familia = models.CharField(
        max_length=80,
        blank=True,
    )

    sabor = models.CharField(
        max_length=80,
        blank=True,
    )

    presentacion = models.CharField(
        max_length=80,
        blank=True,
    )

    nombre = models.CharField(
        max_length=180,
        unique=True,
    )

    orden = models.PositiveIntegerField(
        default=0,
    )

    activo = models.BooleanField(
        default=True,
    )

    creado_en = models.DateTimeField(
        auto_now_add=True,
    )

    actualizado_en = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "producto_control_diario"

        ordering = [
            "orden",
            "nombre",
        ]

        indexes = [
            models.Index(
                fields=[
                    "activo",
                ],
                name="idx_prod_ctrl_diario_activo",
            ),
        ]

    def __str__(self):
        return self.nombre


class UbicacionControlDiario(models.Model):

    class TipoUbicacion(models.TextChoices):
        PLANTA = "PLANTA", "Planta"
        DEPOSITO = "DEPOSITO", "Depósito"
        DISTRIBUIDOR = "DISTRIBUIDOR", "Distribuidor"
        DESTINO = "DESTINO", "Destino"
        OTRO = "OTRO", "Otro"

    nombre = models.CharField(
        max_length=180,
        unique=True,
    )

    tipo = models.CharField(
        max_length=20,
        choices=TipoUbicacion.choices,
        default=TipoUbicacion.OTRO,
    )

    orden = models.PositiveIntegerField(
        default=0,
    )

    activo = models.BooleanField(
        default=True,
    )

    creado_en = models.DateTimeField(
        auto_now_add=True,
    )

    actualizado_en = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "ubicacion_control_diario"

        ordering = [
            "tipo",
            "orden",
            "nombre",
        ]

        indexes = [
            models.Index(
                fields=[
                    "tipo",
                ],
                name="idx_ubic_ctrl_diario_tipo",
            ),

            models.Index(
                fields=[
                    "activo",
                ],
                name="idx_ubic_ctrl_diario_activo",
            ),
        ]

    def __str__(self):
        return self.nombre


class ControlDiario(models.Model):

    fecha = models.DateField(
        unique=True,
    )

    observaciones = models.TextField(
        blank=True,
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="controles_diarios_creados",
    )

    creado_en = models.DateTimeField(
        auto_now_add=True,
    )

    actualizado_en = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "control_diario"

        ordering = [
            "-fecha",
        ]

        indexes = [
            models.Index(
                fields=[
                    "fecha",
                ],
                name="idx_control_diario_fecha",
            ),
        ]

    def __str__(self):
        return str(self.fecha)


class MovimientoControlDiario(models.Model):

    class TipoMovimiento(models.TextChoices):
        DISPONIBLE = "DISPONIBLE", "Disponible"
        RESERVA = "RESERVA", "Reserva"
        ASIGNACION = "ASIGNACION", "Asignación"
        STOCK_DEPOSITO = "STOCK_DEPOSITO", "Stock depósito"
        DISTRIBUCION = "DISTRIBUCION", "Distribución"
        PENDIENTE = "PENDIENTE", "Pendiente"
        AJUSTE = "AJUSTE", "Ajuste"

    control = models.ForeignKey(
        ControlDiario,
        on_delete=models.CASCADE,
        related_name="movimientos",
    )

    producto = models.ForeignKey(
        ProductoControlDiario,
        on_delete=models.PROTECT,
        related_name="movimientos_control_diario",
    )

    ubicacion = models.ForeignKey(
        UbicacionControlDiario,
        on_delete=models.PROTECT,
        related_name="movimientos_control_diario",
    )

    tipo_movimiento = models.CharField(
        max_length=30,
        choices=TipoMovimiento.choices,
    )

    cantidad = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[
            MinValueValidator(
                Decimal("0")
            )
        ],
    )

    observaciones = models.TextField(
        blank=True,
    )

    creado_en = models.DateTimeField(
        auto_now_add=True,
    )

    actualizado_en = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "movimiento_control_diario"

        ordering = [
            "control__fecha",
            "tipo_movimiento",
            "ubicacion__orden",
            "producto__orden",
        ]

        indexes = [
            models.Index(
                fields=[
                    "tipo_movimiento",
                ],
                name="idx_mov_ctrl_diario_tipo",
            ),

            models.Index(
                fields=[
                    "producto",
                ],
                name="idx_mov_ctrl_diario_prod",
            ),

            models.Index(
                fields=[
                    "ubicacion",
                ],
                name="idx_mov_ctrl_diario_ubic",
            ),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "control",
                    "producto",
                    "ubicacion",
                    "tipo_movimiento",
                ],
                name="uniq_mov_control_prod_ubic_tipo",
            ),
        ]

    def __str__(self):
        return (
            f"{self.control.fecha} - "
            f"{self.tipo_movimiento} - "
            f"{self.ubicacion.nombre} - "
            f"{self.producto.nombre}"
        )