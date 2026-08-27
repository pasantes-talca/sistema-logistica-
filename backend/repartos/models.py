from django.conf import settings
from django.db import models
from django.db.models import Q


class Reparto(models.Model):
    """
    Representa cada registro diario del sistema actual "Recargas 2026".

    Actualmente en Google Sheets se guarda:
    FECHA, PATENTE, ASIGNACION, CHOFER, AYUDANTES,
    BULTOS, P.VENTAS, RECARGAS, RECARGA TOTAL y OBSERVACIONES.

    En la nueva BD, chofer y ayudantes se guardan aparte
    en RepartoPersonal.
    """

    fecha = models.DateField()

    vehiculo = models.ForeignKey(
        "maestros.Vehiculo",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="repartos"
    )

    asignacion = models.ForeignKey(
        "maestros.Asignacion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="repartos"
    )

    bultos = models.PositiveIntegerField(
        default=0
    )

    # En el Apps Script actual este dato se recibe como texto
    # y no tiene validación numérica, por eso por ahora
    # lo conservamos flexible.
    puntos_venta = models.CharField(
        max_length=50,
        blank=True
    )

    # Es la cantidad de recargas POR PERSONA calculada
    # según las reglas actuales de Recargas 2026.
    recargas = models.PositiveIntegerField(
        default=0
    )

    observaciones = models.TextField(
        blank=True
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="repartos_creados"
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    actualizado_en = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "reparto"

        ordering = [
            "-fecha",
            "-id"
        ]

        indexes = [
            models.Index(
                fields=["fecha"],
                name="idx_reparto_fecha"
            ),
            models.Index(
                fields=["asignacion"],
                name="idx_reparto_asignacion"
            ),
            models.Index(
                fields=["vehiculo"],
                name="idx_reparto_vehiculo"
            ),
        ]

    def __str__(self):
        return f"Reparto {self.id} - {self.fecha}"

    @property
    def cantidad_personas(self):
        """
        Cantidad de personas participantes del reparto.
        """
        return self.personal.count()

    @property
    def recargas_totales(self):
        """
        En el Apps Script actual:

        recargasTotales = recargas * cantidad de personas
        """
        return self.recargas * self.cantidad_personas


class RepartoPersonal(models.Model):
    """
    Personas participantes de un reparto.

    Reemplaza las columnas rígidas:
    Chofer / Ayudante 1 / Ayudante 2 / Ayudante 3.

    Esto permite tener cualquier cantidad de ayudantes.
    """

    class Rol(models.TextChoices):
        CHOFER = "CHOFER", "Chofer"
        AYUDANTE = "AYUDANTE", "Ayudante"

    reparto = models.ForeignKey(
        Reparto,
        on_delete=models.CASCADE,
        related_name="personal"
    )

    empleado = models.ForeignKey(
        "maestros.Empleado",
        on_delete=models.PROTECT,
        related_name="participaciones_reparto"
    )

    rol = models.CharField(
        max_length=20,
        choices=Rol.choices
    )

    # Sirve para mantener el orden visual de los participantes.
    # Chofer normalmente = 0
    # Ayudantes = 1, 2, 3...
    orden = models.PositiveSmallIntegerField(
        default=0
    )

    creado_en = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        db_table = "reparto_personal"

        ordering = [
            "reparto",
            "orden",
            "id"
        ]

        constraints = [
            # Una misma persona no puede aparecer dos veces
            # en el mismo reparto.
            models.UniqueConstraint(
                fields=["reparto", "empleado"],
                name="uq_reparto_empleado"
            ),

            # Solo puede existir un CHOFER por reparto.
            models.UniqueConstraint(
                fields=["reparto"],
                condition=Q(rol="CHOFER"),
                name="uq_reparto_un_chofer"
            ),
        ]

        indexes = [
            models.Index(
                fields=["reparto"],
                name="idx_reparto_personal_rep"
            ),
            models.Index(
                fields=["empleado"],
                name="idx_reparto_personal_emp"
            ),
        ]

    def __str__(self):
        return (
            f"{self.reparto_id} - "
            f"{self.empleado.nombre} - "
            f"{self.get_rol_display()}"
        )