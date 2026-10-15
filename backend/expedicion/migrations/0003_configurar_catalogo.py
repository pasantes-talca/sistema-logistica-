from django.db import migrations


def configurar(apps, schema_editor):
    Producto = apps.get_model("maestros", "Producto")
    Config = apps.get_model("expedicion", "ConfiguracionProducto")
    # No renumerar el código 417 existente ni duplicarlo con el 4171 del sitio.
    catalogo = [
        ("5670", "Talca Cola 3 L", "CO3", 6, 15, 4, True),
        ("5675", "Talca Lima Limón 3 L", "LI3", 6, 15, 4, True),
        ("5680", "Talca Manzana 3 L", "MA3", 6, 15, 4, True),
        ("5685", "Talca Naranja 3 L", "NA3", 6, 15, 4, True),
        ("5690", "Talca Pomelo 3 L", "PO3", 6, 15, 4, True),
        ("5051", "Talca Cola 500 ml", "CO5", 12, 20, 7, False),
        ("5056", "Talca Lima Limón 500 ml", "LI5", 12, 20, 7, False),
        ("5061", "Talca Manzana 500 ml", "MA5", 12, 20, 7, False),
        ("5066", "Talca Naranja 500 ml", "NA5", 12, 20, 7, False),
        ("5071", "Talca Pomelo 500 ml", "PO5", 12, 20, 7, False),
        ("8670", "Agua 2 L", "AG2", 6, 20, 4, True),
        ("4900", "Soda 2,25 L", "SO2", 6, 20, 4, False),
        ("417" if Producto.objects.filter(codigo="417").exists() else "4171", "Soda 500 ml", "SO5", 12, 20, 7, False),
        ("4910", "Soda sifón 2 L", "SIF", 6, 20, 4, False),
        ("BIDON", "Bidón de agua", "BID", 1, 42, 2, False),
    ]
    for code, name, alias, pack, cut, pallet, benefit in catalogo:
        p, _ = Producto.objects.get_or_create(codigo=code, defaults={"nombre": name, "familia": "GASEOSA" if code.startswith("5") else "AGUA" if code in {"8670", "BIDON"} else "SIFON" if code == "4910" else "SODA"})
        Config.objects.get_or_create(producto=p, defaults={"alias": alias, "unidades_pack": pack,
            "packs_corte": cut, "cortes_pallet": pallet, "beneficio_empleado": benefit})
    # Códigos adicionales del catálogo local conservan su identidad.
    for p in Producto.objects.exclude(config_expedicion__isnull=False):
        Config.objects.get_or_create(producto=p, defaults={"unidades_pack": 6 if p.codigo in {"5200", "5205", "5210", "5215", "5220"} else 1})


class Migration(migrations.Migration):
    dependencies = [("expedicion", "0002_empleadoexpedicion_and_more"), ("maestros", "0002_corregir_catalogo_expedicion")]
    operations = [migrations.RunPython(configurar, migrations.RunPython.noop)]
