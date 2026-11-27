from django.db import models


class EntregaPersat(models.Model):
    """Persat delivery snapshot; preventa rejections are rows with estado_final NOT_DELIVERED."""

    id_entrega = models.CharField(max_length=64, unique=True)
    uid_client = models.CharField(max_length=100, blank=True, null=True)
    nombre_cliente = models.CharField(max_length=255, blank=True, null=True)
    estado_persat = models.CharField(max_length=50, blank=True, null=True)
    estado_final = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    fecha_creacion = models.DateTimeField(blank=True, null=True)
    fecha_vencimiento = models.DateTimeField(blank=True, null=True)
    fecha_finalizacion = models.DateTimeField(blank=True, null=True)
    fecha_ruta = models.DateField(blank=True, null=True, db_index=True)
    movil_asignado = models.CharField(max_length=150, blank=True, null=True)
    comentarios_observaciones = models.TextField(blank=True, null=True)
    causa_no_entrega = models.TextField(blank=True, null=True)
    otro_motivo = models.TextField(blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    departamento = models.CharField(max_length=100, blank=True, null=True)
    actualizado_en = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = "entrega_persat"
        verbose_name = "Entrega Persat"
        verbose_name_plural = "Entregas Persat"
        indexes = [models.Index(fields=["estado_final", "fecha_ruta"], name="idx_persat_estado_ruta")]

    def __str__(self):
        return f"{self.id_entrega} ({self.estado_final or 'sin estado'})"
