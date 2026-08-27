from django.conf import settings
from django.db import models
from django.db.models import Q


class ReciboCambio(models.Model):
    """
    Representa un recibo de cambios.

    En el sistema actual existe un único recibo por:
        FECHA + CONCESIONARIO

    Si vuelve a cargarse información para la misma fecha
    y el mismo concesionario, el Apps Script actualiza
    ese mismo recibo y suma las cantidades.
    """

    fecha = models.DateField()

    concesionario = models.ForeignKey(
        "maestros.Concesionario",
        on_delete=models.PROTECT,
        related_name="recibos_cambio"
    )

    pallets = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    pallets_observacion = models.TextField(
        blank=True
    )

    pallets_descargados = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    pallets_descargados_observacion = models.TextField(
        blank=True
    )

    prensados = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    prensados_observacion = models.TextField(
        blank=True
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recibos_cambio_creados"
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "recibo_cambio"

        ordering = [
            "-fecha",
            "-id"
        ]

        constraints = [
            # Solo debe existir un recibo para la misma
            # fecha y concesionario.
            models.UniqueConstraint(
                fields=["fecha", "concesionario"],
                name="uq_recibo_fecha_concesionario"
            ),

            models.CheckConstraint(
                condition=Q(pallets__gte=0),
                name="chk_recibo_pallets_no_neg"
            ),

            models.CheckConstraint(
                condition=Q(pallets_descargados__gte=0),
                name="chk_recibo_pal_desc_no_neg"
            ),

            models.CheckConstraint(
                condition=Q(prensados__gte=0),
                name="chk_recibo_prensados_no_neg"
            ),
        ]

        indexes = [
            models.Index(
                fields=["fecha"],
                name="idx_recibo_cambio_fecha"
            ),
            models.Index(
                fields=["concesionario"],
                name="idx_recibo_cambio_conc"
            ),
        ]

    def __str__(self):
        return (
            f"Recibo {self.fecha} - "
            f"{self.concesionario.nombre}"
        )


class DetalleReciboCambio(models.Model):
    """
    Cada producto presente dentro de un recibo de cambios.

    Reemplaza las posiciones fijas de la planilla:
        G8, G9, G10...
        G23, G24...
        etc.

    Esto permite que el catálogo de productos pueda crecer
    sin modificar la estructura de la base de datos.
    """

    recibo = models.ForeignKey(
        ReciboCambio,
        on_delete=models.CASCADE,
        related_name="detalles"
    )

    producto = models.ForeignKey(
        "maestros.Producto",
        on_delete=models.PROTECT,
        related_name="detalles_cambio"
    )

    cantidad = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    observacion = models.TextField(
        blank=True
    )

    # El módulo actual de Motivos permite guardar
    # un motivo por producto dentro del recibo.
    # Puede quedar vacío hasta que el motivo sea clasificado.
    motivo = models.ForeignKey(
        "maestros.MotivoCambio",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="detalles_cambio"
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "recibo_cambio_detalle"

        ordering = [
            "recibo",
            "producto__codigo"
        ]

        constraints = [
            # Dentro de un mismo recibo no queremos
            # dos filas distintas para el mismo producto.
            #
            # Si vuelve a cargarse ese producto, se suma
            # la cantidad sobre este mismo registro.
            models.UniqueConstraint(
                fields=["recibo", "producto"],
                name="uq_recibo_producto"
            ),

            models.CheckConstraint(
                condition=Q(cantidad__gte=0),
                name="chk_detalle_cambio_cant_no_neg"
            ),
        ]

        indexes = [
            models.Index(
                fields=["recibo"],
                name="idx_detalle_cambio_recibo"
            ),
            models.Index(
                fields=["producto"],
                name="idx_detalle_cambio_prod"
            ),
            models.Index(
                fields=["motivo"],
                name="idx_detalle_cambio_motivo"
            ),
        ]

    def __str__(self):
        return (
            f"{self.recibo} - "
            f"{self.producto.codigo}: "
            f"{self.cantidad}"
        )