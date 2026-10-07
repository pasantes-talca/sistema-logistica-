from django.db import migrations


def actualizar_productos(apps, schema_editor):
    Producto = apps.get_model("maestros", "Producto")

    correcciones = {
        "5051": ("1/2 LT COLA", "1/2 LT", "COLA"),
        "5056": ("1/2 LT LIMA", "1/2 LT", "LIMA"),
        "5066": ("1/2 LT NARANJA", "1/2 LT", "NARANJA"),
        "5071": ("1/2 LT POMELO", "1/2 LT", "POMELO"),
    }

    for codigo, (nombre, presentacion, sabor) in correcciones.items():
        Producto.objects.filter(codigo=codigo).update(
            nombre=nombre,
            presentacion=presentacion,
            sabor=sabor,
            activo=True,
        )

    manzanas = [
        ("5061", "1/2 LT MANZANA", "1/2 LT"),
        ("5210", "2 1/4 LT MANZANA", "2 1/4 LT"),
        ("5680", "3 LT MANZANA", "3 LT"),
    ]

    for codigo, nombre, presentacion in manzanas:
        Producto.objects.update_or_create(
            codigo=codigo,
            defaults={
                "nombre": nombre,
                "presentacion": presentacion,
                "sabor": "MANZANA",
                "familia": "GASEOSA",
                "activo": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("maestros", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            actualizar_productos,
            migrations.RunPython.noop,
        ),
    ]
