from django.db import models
from django.conf import settings


class EventoAuditoria(models.Model):
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    usuario = models.CharField(max_length=150)
    modulo = models.CharField(max_length=40)
    accion = models.CharField(max_length=80)
    referencia = models.CharField(max_length=180, blank=True)
    motivo = models.CharField(max_length=2000, blank=True)
    antes = models.JSONField(default=dict)
    despues = models.JSONField(default=dict)

    class Meta:
        db_table = "auditoria_sistema"
        ordering = ["-id"]

class RegistroImportacion(models.Model):
    """Trazabilidad interna; los datos de trabajo viven en los modelos normales."""
    modulo = models.CharField(max_length=20)
    origen_id = models.CharField(max_length=120)
    clave = models.CharField(max_length=120)
    huella = models.CharField(max_length=64)
    datos = models.JSONField()
    reparto = models.OneToOneField('repartos.Reparto', on_delete=models.SET_NULL, null=True, blank=True, related_name='registro_importado')
    rechazo = models.OneToOneField('rechazos.Rechazo', on_delete=models.SET_NULL, null=True, blank=True, related_name='registro_importado')
    recibo = models.OneToOneField('cambios.ReciboCambio', on_delete=models.SET_NULL, null=True, blank=True, related_name='registro_importado')
    recargas_autorizadas = models.BooleanField(default=False)
    total_autorizado = models.PositiveIntegerField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'registro_importacion'
        constraints = [models.UniqueConstraint(fields=['modulo','origen_id','clave'],name='uq_importacion_origen_fila')]
