from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from maestros.models import Empleado


class DestinoKilometraje(models.Model):

    nombre = models.CharField(
        max_length=150,
        unique=True,
    )

    distancia_km = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[
            MinValueValidator(
                Decimal("0")
            )
        ],
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
        db_table = "destino_kilometraje"

        ordering = [
            "nombre",
        ]

        indexes = [
            models.Index(
                fields=[
                    "activo",
                ],
                name="idx_destino_km_activo",
            ),
        ]

    def __str__(self):

        return (
            f"{self.nombre} "
            f"({self.distancia_km} km)"
        )


class ControlKilometraje(models.Model):

    chofer = models.ForeignKey(
        Empleado,
        on_delete=models.PROTECT,
        related_name="controles_kilometraje",
    )

    fecha_desde = models.DateField()

    fecha_hasta = models.DateField()

    observaciones = models.TextField(
        blank=True,
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="controles_kilometraje_creados",
    )

    creado_en = models.DateTimeField(
        auto_now_add=True,
    )

    actualizado_en = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "control_kilometraje"

        ordering = [
            "-fecha_hasta",
            "-id",
        ]

        indexes = [
            models.Index(
                fields=[
                    "chofer",
                ],
                name="idx_control_km_chofer",
            ),

            models.Index(
                fields=[
                    "fecha_desde",
                    "fecha_hasta",
                ],
                name="idx_control_km_periodo",
            ),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "chofer",
                    "fecha_desde",
                    "fecha_hasta",
                ],
                name="uniq_control_km_chofer_periodo",
            ),
        ]

    @property
    def total_km(self):

        total = Decimal("0")

        for registro in self.registros.all():

            total += registro.kilometros

        return total

    def __str__(self):

        return (
            f"{self.chofer.nombre} - "
            f"{self.fecha_desde} / "
            f"{self.fecha_hasta}"
        )


class RegistroKilometraje(models.Model):

    control = models.ForeignKey(
        ControlKilometraje,
        on_delete=models.CASCADE,
        related_name="registros",
    )

    fecha = models.DateField()

    destino = models.ForeignKey(
        DestinoKilometraje,
        on_delete=models.PROTECT,
        related_name="registros_kilometraje",
    )

    cantidad_viajes = models.PositiveIntegerField(
        default=0,
    )

    distancia_km = models.DecimalField(
        max_digits=8,
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
        db_table = "registro_kilometraje"

        ordering = [
            "fecha",
            "destino__nombre",
        ]

        indexes = [
            models.Index(
                fields=[
                    "fecha",
                ],
                name="idx_registro_km_fecha",
            ),

            models.Index(
                fields=[
                    "destino",
                ],
                name="idx_registro_km_destino",
            ),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "control",
                    "fecha",
                    "destino",
                ],
                name="uniq_registro_km_control_fecha_dest",
            ),
        ]

    @property
    def kilometros(self):

        return (
            self.distancia_km
            *
            self.cantidad_viajes
        )

    def save(
        self,
        *args,
        **kwargs,
    ):

        if (
            not self.distancia_km
            and self.destino_id
        ):

            self.distancia_km = (
                self.destino.distancia_km
            )

        super().save(
            *args,
            **kwargs,
        )

    def __str__(self):

        return (
            f"{self.fecha} - "
            f"{self.destino.nombre} - "
            f"{self.cantidad_viajes} viaje(s)"
        )