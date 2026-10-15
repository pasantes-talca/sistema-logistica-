"""Servidor de verificación local; base en memoria, independiente de PostgreSQL.

Ejecutar desde backend: .venv/Scripts/python.exe -m expedicion.smoke_server
"""
import os


def main():
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
    import django
    django.setup()
    from django.conf import settings
    assert settings.DATABASES["default"]["NAME"] == ":memory:"
    settings.ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
    settings.CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:5175"]
    settings.CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5175"]
    from django.core.management import call_command
    call_command("migrate", verbosity=0)
    from django.contrib.auth import get_user_model
    from .models import Fletero, StockProducto
    from maestros.models import Producto
    get_user_model().objects.create_superuser("smoke", "smoke@example.test", "Smoke-local-123!")
    Fletero.objects.create(nombre="Fletero de prueba", empresa="Transporte prueba")
    for p in Producto.objects.all():
        StockProducto.objects.get_or_create(producto=p, defaults={"cantidad_unidades": 5000})
    from django.core.wsgi import get_wsgi_application
    from wsgiref.simple_server import make_server
    print("Servidor aislado en http://127.0.0.1:8765 · base en memoria", flush=True)
    make_server("127.0.0.1", 8765, get_wsgi_application()).serve_forever()


if __name__ == "__main__":
    main()
