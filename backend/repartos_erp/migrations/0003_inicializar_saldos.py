from decimal import Decimal
from django.db import migrations
from django.db.models import Sum


def inicializar(apps, schema_editor):
    Parada = apps.get_model("repartos_erp", "ParadaRepartoERP")
    Documento = apps.get_model("repartos_erp", "DocumentoRepartoERP")
    alias = schema_editor.connection.alias
    for parada in Parada.objects.using(alias).filter(saldo_inicializado=False).iterator():
        referencia = Documento.objects.using(alias).filter(parada_id=parada.id, tipo="FACTURA").aggregate(total=Sum("monto"))["total"] or Decimal("0")
        parada.importe_referencia = referencia
        # Respetar cualquier saldo preexistente distinto de cero.
        if not parada.importe_a_cobrar:
            parada.importe_a_cobrar = referencia
        parada.saldo_inicializado = True
        parada.save(using=alias, update_fields=["importe_referencia", "importe_a_cobrar", "saldo_inicializado"])


class Migration(migrations.Migration):
    dependencies = [("repartos_erp", "0002_clientepersaterp_paradarepartoerp_entregado_en_and_more")]
    operations = [migrations.RunPython(inicializar, migrations.RunPython.noop)]
