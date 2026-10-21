"""Vista local de un respaldo sobre SQLite efímero, sin tocar PostgreSQL."""
import os
import sys


def main():
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.test_settings"
    import django
    django.setup()
    from django.conf import settings
    from django.core.management import call_command
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import Group
    from .respaldos import MODELOS
    from .importacion_firebase import leer_archivo, cargar
    assert settings.DATABASES["default"]["NAME"] == ":memory:"
    settings.ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
    settings.CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:5180"]
    settings.CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5180"]
    call_command("migrate", verbosity=0)
    for model in reversed(MODELOS):
        model.objects.all().delete()
    root = get_user_model().objects.create_superuser("arielgarro", password=None)
    user = get_user_model().objects.create_user("ensayo", password="Ensayo-local-492!")
    user.groups.add(Group.objects.get_or_create(name="EXPEDICION")[0])
    payload, sha = leer_archivo(sys.argv[1])
    result = cargar(payload, root, sha)
    print("Ensayo visual aislado:", result["validacion"], flush=True)
    from django.core.wsgi import get_wsgi_application
    from wsgiref.simple_server import make_server
    make_server("127.0.0.1", 8772, get_wsgi_application()).serve_forever()


if __name__ == "__main__":
    main()
