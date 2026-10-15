"""Prueba visual aislada; requiere un JSON local y nunca usa PostgreSQL."""
import json
import os
import sys
from pathlib import Path


def main():
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.test_settings'
    import django
    django.setup()
    from django.conf import settings
    assert settings.DATABASES['default']['NAME'] == ':memory:'
    settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
    settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5176']
    settings.CSRF_TRUSTED_ORIGINS = ['http://127.0.0.1:5176']
    from django.core.management import call_command
    call_command('migrate', verbosity=0)
    from django.contrib.auth import get_user_model
    get_user_model().objects.create_superuser('historico_smoke', 'test@example.test', 'Historico-local-123!')
    from .historicos import importar
    from .services import crear_reparto
    from maestros.models import Empleado
    from datetime import date
    crear_reparto(fecha=date(2026, 10, 14), bultos=480, chofer=Empleado.objects.create(nombre='Chofer de prueba', puesto='Chofer 1ra. Categoria'))
    source = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    importar(source, aplicar=True)
    from django.core.wsgi import get_wsgi_application
    from wsgiref.simple_server import make_server, WSGIServer
    class HistoricoSmokeServer(WSGIServer):
        # El dashboard consulta varios módulos simultáneamente. Sigue siendo
        # un servidor de prueba monohilo con la misma base en memoria.
        request_queue_size = 128
    print('Historico aislado: 127.0.0.1:8766 · SQLite en memoria', flush=True)
    make_server('127.0.0.1', 8766, get_wsgi_application(), server_class=HistoricoSmokeServer).serve_forever()


if __name__ == '__main__':
    main()
