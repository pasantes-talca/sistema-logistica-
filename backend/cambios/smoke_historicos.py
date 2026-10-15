"""Prueba local en SQLite en memoria, sin PostgreSQL ni correos reales."""
import json
import os
from pathlib import Path


def main():
    os.environ['DJANGO_SETTINGS_MODULE']='config.test_settings'
    import django
    django.setup()
    from django.conf import settings
    assert settings.DATABASES['default']['NAME']==':memory:'
    settings.ALLOWED_HOSTS=['127.0.0.1','localhost']
    settings.CORS_ALLOWED_ORIGINS=['http://127.0.0.1:5178']
    settings.CSRF_TRUSTED_ORIGINS=['http://127.0.0.1:5178']
    from django.core.management import call_command
    call_command('migrate',verbosity=0)
    from django.contrib.auth import get_user_model
    get_user_model().objects.create_superuser('cambios_smoke','test@example.test','Cambios-local-123!')
    from .historicos import importar
    importar(json.loads(Path('importaciones/cambios/planilla-original.json').read_text(encoding='utf-8')),aplicar=True)
    from rechazos.historicos import importar as importar_rechazos
    importar_rechazos(json.loads(Path('importaciones/rechazos/planilla-original.json').read_text(encoding='utf-8')),aplicar=True)
    from repartos.historicos import importar as importar_repartos
    importar_repartos(json.loads(Path('importaciones/recargas-2026/planilla-original.json').read_text(encoding='utf-8')),aplicar=True)
    from .models import ReciboCambio
    from maestros.models import Concesionario
    from datetime import date
    ReciboCambio.objects.create(fecha=date(2026,10,15),concesionario=Concesionario.objects.create(nombre='Prueba operativa'),pallets='3')
    from django.core.wsgi import get_wsgi_application
    from wsgiref.simple_server import make_server, WSGIServer
    class SmokeServer(WSGIServer):
        request_queue_size=128
    print('Cambios aislados: 127.0.0.1:8768 · SQLite en memoria',flush=True)
    make_server('127.0.0.1',8768,get_wsgi_application(),server_class=SmokeServer).serve_forever()


if __name__=='__main__':
    main()
