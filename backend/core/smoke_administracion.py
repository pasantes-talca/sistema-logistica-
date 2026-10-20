"""Ensayo local de roles y gestión: base efímera, sin acceso a PostgreSQL ni correo real."""
import os


def main():
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
    import django
    django.setup()
    from django.conf import settings
    assert settings.DATABASES["default"]["NAME"] == ":memory:"
    settings.ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
    settings.CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:5180"]
    settings.CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5180"]
    from django.core.management import call_command
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Group
    from core.permissions import ADMINISTRADOR
    call_command("migrate", verbosity=0)
    User = get_user_model()
    User.objects.create_superuser("arielgarro", "smoke@example.test", "Prueba-local-492!")
    admin = User.objects.create_user("administrador", first_name="Administrador", password="Prueba-local-492!")
    admin.groups.add(Group.objects.get_or_create(name=ADMINISTRADOR)[0])
    user = User.objects.create_user("cbagnardi", first_name="Carlos", last_name="Bagnardi", password="Prueba-local-492!")
    user.groups.add(Group.objects.get_or_create(name="CAMBIOS")[0])
    from django.core.wsgi import get_wsgi_application
    from wsgiref.simple_server import make_server
    print("Administración de prueba: http://127.0.0.1:8770 · SQLite en memoria", flush=True)
    make_server("127.0.0.1", 8770, get_wsgi_application()).serve_forever()


if __name__ == "__main__":
    main()
