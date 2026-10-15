import uuid
from django.db import migrations


def normalizar(apps, schema_editor):
    Movimiento = apps.get_model("expedicion", "MovimientoStock")
    Comprobante = apps.get_model("expedicion", "ComprobanteEmpleado")
    # AddField con UUID puede usar el mismo default para filas preexistentes.
    # Separar operaciones históricas sin tocar cantidades ni saldos.
    grupos = {}
    for m in Movimiento.objects.filter(turno="").iterator():
        key = (m.orden_id, m.referencia, m.tipo, m.creado_en.date()) if m.orden_id else ("individual", m.pk)
        m.operacion = grupos.setdefault(key, uuid.uuid4())
        m.save(update_fields=["operacion"])
    for tipo in ("CONSUMO", "ANTICIPO"):
        for n, c in enumerate(Comprobante.objects.filter(tipo=tipo).order_by("pk"), 1):
            if not c.numero:
                c.numero = n
                c.save(update_fields=["numero"])


class Migration(migrations.Migration):
    dependencies = [("expedicion", "0005_remove_detalleentregaordencarga_unique_producto_entrega_expedicion_and_more")]
    operations = [migrations.RunPython(normalizar, migrations.RunPython.noop)]
