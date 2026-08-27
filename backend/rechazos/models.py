from django.conf import settings
from django.db import models


class Rechazo(models.Model):
    """
    Representa una NO entrega / rechazo.

    Basado en la estructura real actual de:
    "Respuestas de formulario 1"
    """

    fecha = models.DateField()

    asignacion = models.ForeignKey(
        "maestros.Asignacion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rechazos"
    )

    punto_venta = models.CharField(
        max_length=250
    )

    # Se conserva como texto porque los datos históricos
    # no son siempre números puros.
    #
    # Ejemplos reales:
    # "54"
    # "15.03"
    # "6 Bidones"
    # "10 pack de 1/2"
    # "73 bultos"
    bultos = models.CharField(
        max_length=100
    )

    motivo = models.ForeignKey(
        "maestros.MotivoRechazo",
        on_delete=models.PROTECT,
        related_name="rechazos"
    )

    observacion = models.TextField(
        blank=True
    )

    # Permite conservar la Marca temporal original
    # cuando migremos los registros históricos de Google Forms.
    registrado_en = models.DateTimeField(
        null=True,
        blank=True
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rechazos_creados"
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "rechazo"

        ordering = [
            "-fecha",
            "-id"
        ]

        indexes = [
            models.Index(
                fields=["fecha"],
                name="idx_rechazo_fecha"
            ),
            models.Index(
                fields=["asignacion"],
                name="idx_rechazo_asignacion"
            ),
            models.Index(
                fields=["motivo"],
                name="idx_rechazo_motivo"
            ),
        ]

    def __str__(self):
        return (
            f"{self.fecha} - "
            f"{self.punto_venta} - "
            f"{self.motivo.nombre}"
        )