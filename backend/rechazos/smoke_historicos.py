"""Servidor de prueba: SQLite en memoria; nunca PostgreSQL operativo."""
import os
import json
from pathlib import Path


def main():
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.test_settings'
    import django
    django.setup()
    from django.conf import settings
    assert settings.DATABASES['default']['NAME'] == ':memory:'
    settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
    settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5177']
    settings.CSRF_TRUSTED_ORIGINS = ['http://127.0.0.1:5177']
    from django.core.management import call_command
    call_command('migrate', verbosity=0)
    from django.contrib.auth import get_user_model
    get_user_model().objects.create_superuser('rechazos_smoke', 'test@example.test', 'Rechazos-local-123!')
    from .historicos import importar
    importar(json.loads(Path('importaciones/rechazos/planilla-original.json').read_text(encoding='utf-8')), aplicar=True)
    from repartos.historicos import importar as importar_repartos
    importar_repartos(json.loads(Path('importaciones/recargas-2026/planilla-original.json').read_text(encoding='utf-8')), aplicar=True)
    from .models import Rechazo
    from maestros.models import MotivoRechazo
    from datetime import date
    Rechazo.objects.create(fecha=date(2026,10,14), punto_venta='Prueba operativa', bultos='3 packs', motivo=MotivoRechazo.objects.create(nombre='Motivo de prueba'))
    from django.core.wsgi import get_wsgi_application
    from wsgiref.simple_server import make_server, WSGIServer
    class SmokeServer(WSGIServer):
        request_queue_size = 128
    print('Rechazos aislados: 127.0.0.1:8767 · SQLite en memoria', flush=True)
    make_server('127.0.0.1',8767,get_wsgi_application(),server_class=SmokeServer).serve_forever()


if __name__ == '__main__':
    main()
