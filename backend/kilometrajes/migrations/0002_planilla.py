from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("kilometrajes", "0001_initial")]
    operations = [
        migrations.AddField("controlkilometraje", "estado", models.CharField(default="BORRADOR", max_length=12)),
        migrations.AddField("controlkilometraje", "version", models.PositiveIntegerField(default=1)),
        migrations.AddField("controlkilometraje", "columnas", models.JSONField(blank=True, default=list)),
        migrations.AddField("controlkilometraje", "envio_estado", models.CharField(default="PENDIENTE", max_length=12)),
        migrations.AddField("controlkilometraje", "enviado_en", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("controlkilometraje", "error_envio", models.TextField(blank=True)),
    ]
