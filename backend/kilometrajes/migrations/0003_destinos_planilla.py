from django.db import migrations


def preparar(apps, schema_editor):
    Destino = apps.get_model("kilometrajes", "DestinoKilometraje")
    Control = apps.get_model("kilometrajes", "ControlKilometraje")
    Registro = apps.get_model("kilometrajes", "RegistroKilometraje")
    alias = schema_editor.connection.alias
    anteriores = [{"id": d.pk, "nombre": d.nombre, "distancia_km": str(d.distancia_km), "activo": d.activo}
                  for d in Destino.objects.using(alias).order_by("id")]
    for control in Control.objects.using(alias).filter(columnas=[]).iterator():
        columnas = {d["id"]: dict(d) for d in anteriores if d["activo"]}
        for r in Registro.objects.using(alias).filter(control=control).select_related("destino"):
            columnas[r.destino_id] = {"id": r.destino_id, "nombre": r.destino.nombre,
                "distancia_km": str(r.distancia_km), "activo": r.destino.activo}
        control.columnas = list(columnas.values())
        control.save(using=alias, update_fields=["columnas"])
    for nombre, distancia in [("Gatica / C. Araujo", 110), ("Martins", 12), ("Tunuyán", 154),
            ("Aibak / Las Heras", 30), ("Marthos / Luján", 30), ("Sharp / Mai-Gua", 5),
            ("Muedaz", 20), ("Porro", 20), ("G. Cruz", 20)]:
        d, _ = Destino.objects.using(alias).get_or_create(nombre=nombre, defaults={"distancia_km": distancia})
        if nombre == "Sharp / Mai-Gua":
            d.distancia_km = 5
            d.save(using=alias, update_fields=["distancia_km"])


class Migration(migrations.Migration):
    dependencies = [("kilometrajes", "0002_planilla")]
    operations = [migrations.RunPython(preparar, migrations.RunPython.noop)]
