from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from maestros.models import Empleado


class Viatico(models.Model):

    class TipoReparto(models.TextChoices):
        LOCAL = "LOCAL", "Local"
        LARGA_DISTANCIA = (
            "LARGA_DISTANCIA",
            "Larga distancia",
        )

    chofer = models.ForeignKey(
        Empleado,
        on_delete=models.PROTECT,
        related_name="viaticos",
    )

    tipo_reparto = models.CharField(
        max_length=30,
        choices=TipoReparto.choices,
    )

    fecha = models.DateField()

    valor_viatico = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[
            MinValueValidator(
                Decimal("0")
            )
        ],
    )

    cantidad_viaticos = models.PositiveIntegerField()

    observaciones = models.TextField(
        blank=True,
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="viaticos_creados",
    )

    creado_en = models.DateTimeField(
        auto_now_add=True,
    )

    actualizado_en = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "viatico"

        ordering = [
            "-fecha",
            "-id",
        ]

        indexes = [
            models.Index(
                fields=["fecha"],
                name="idx_viatico_fecha",
            ),
            models.Index(
                fields=["tipo_reparto"],
                name="idx_viatico_tipo",
            ),
            models.Index(
                fields=["chofer"],
                name="idx_viatico_chofer",
            ),
        ]

    def __str__(self):
        return (
            f"{self.chofer} - "
            f"{self.tipo_reparto} - "
            f"{self.fecha}"
        )

    @property
    def monto_total(self):
        return (
            self.valor_viatico
            *
            self.cantidad_viaticos
        )