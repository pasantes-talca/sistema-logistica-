from django.db import models


class Empleado(models.Model):
    """
    Empleados utilizados principalmente en el módulo de repartos/recargas.

    En el sistema actual provienen de la hoja "Datos Empleados".
    """

    legajo = models.CharField(
        max_length=30,
        unique=True,
        null=True,
        blank=True
    )

    nombre = models.CharField(
        max_length=150
    )

    puesto = models.CharField(
        max_length=100,
        blank=True
    )

    disponible = models.BooleanField(
        default=True
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
        db_table = "empleado"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Vehiculo(models.Model):
    """
    Vehículos utilizados en los repartos.
    """

    patente = models.CharField(
        max_length=20,
        unique=True
    )

    descripcion = models.CharField(
        max_length=150,
        blank=True
    )

    tipo = models.CharField(
        max_length=80,
        blank=True
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
        db_table = "vehiculo"
        ordering = ["patente"]

    def __str__(self):
        return self.patente


class Asignacion(models.Model):
    """
    Códigos de asignación utilizados en Recargas 2026.

    Algunas asignaciones tienen un chofer predeterminado,
    tal como sucede actualmente en el Sidebar.
    """

    codigo = models.CharField(
        max_length=30,
        unique=True
    )

    descripcion = models.CharField(
        max_length=200,
        blank=True
    )

    chofer_predeterminado = models.ForeignKey(
        Empleado,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asignaciones_predeterminadas"
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
        db_table = "asignacion"
        ordering = ["codigo"]

    def __str__(self):
        return self.codigo


class Concesionario(models.Model):
    """
    Concesionarios utilizados tanto en rechazos
    como en recibos de cambios.
    """

    nombre = models.CharField(
        max_length=150,
        unique=True
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
        db_table = "concesionario"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Producto(models.Model):

    class Familia(models.TextChoices):
        GASEOSA = "GASEOSA", "Gaseosa"
        SODA = "SODA", "Soda"
        SIFON = "SIFON", "Sifón"
        AGUA = "AGUA", "Agua"

    codigo = models.CharField(
        max_length=30,
        unique=True
    )

    nombre = models.CharField(
        max_length=150
    )

    presentacion = models.CharField(
        max_length=80,
        blank=True
    )

    sabor = models.CharField(
        max_length=80,
        blank=True
    )

    familia = models.CharField(
        max_length=20,
        choices=Familia.choices
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
        db_table = "producto"
        ordering = ["codigo"]

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class MotivoRechazo(models.Model):
    """
    Catálogo de motivos del módulo de rechazos.

    En la nueva aplicación evitaremos escribir motivos manualmente,
    por lo que ya no necesitaremos fuzzy matching para corregir
    diferencias de escritura.
    """

    nombre = models.CharField(
        max_length=150,
        unique=True
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
        db_table = "motivo_rechazo"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class MotivoCambio(models.Model):
    """
    Motivos utilizados para clasificar productos devueltos
    en los recibos de cambios.
    """

    nombre = models.CharField(
        max_length=150,
        unique=True
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
        db_table = "motivo_cambio"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class MotivoCambioFamilia(models.Model):
    """
    Relaciona cada motivo con las familias de producto
    para las cuales está permitido.

    Ejemplo:
        Bajo de gas -> SIFON
        Pico defectuoso -> SIFON
        Falta de etiqueta -> GASEOSA / SODA / SIFON / AGUA
    """

    motivo = models.ForeignKey(
        MotivoCambio,
        on_delete=models.CASCADE,
        related_name="familias_permitidas"
    )

    familia = models.CharField(
        max_length=20,
        choices=Producto.Familia.choices
    )

    class Meta:
        db_table = "motivo_cambio_familia"

        constraints = [
            models.UniqueConstraint(
                fields=["motivo", "familia"],
                name="uq_motivo_cambio_familia"
            )
        ]

        ordering = ["motivo__nombre", "familia"]

    def __str__(self):
        return f"{self.motivo.nombre} - {self.get_familia_display()}"