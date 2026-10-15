"""Aplicación de ensayo efímera. No usa la base ni el correo del servidor."""
import os
import json
from pathlib import Path


def main():
    os.environ['DJANGO_SETTINGS_MODULE']='config.test_settings'
    import django
    django.setup()
    from django.conf import settings
    assert settings.DATABASES['default']['NAME']==':memory:'
    settings.ALLOWED_HOSTS=['127.0.0.1','localhost']
    settings.CORS_ALLOWED_ORIGINS=['http://127.0.0.1:5179']
    settings.CSRF_TRUSTED_ORIGINS=['http://127.0.0.1:5179']
    from django.core.management import call_command
    call_command('migrate',verbosity=0)
    from django.contrib.auth import get_user_model
    get_user_model().objects.create_superuser('conversion_smoke','test@example.test','Conversion-local-123!')
    from repartos.historicos import importar as r
    from rechazos.historicos import importar as x
    from cambios.historicos import importar as c
    for path,fn in [('recargas-2026',r),('rechazos',x),('cambios',c)]:
        fn(json.loads(Path(f'importaciones/{path}/planilla-original.json').read_text(encoding='utf-8')),aplicar=True)
    from .conversion_operativa import convertir,fuentes_guardadas
    result=convertir(fuentes_guardadas(),aplicar=True)
    print(result['resumen'],flush=True)
    from django.core.wsgi import get_wsgi_application
    from wsgiref.simple_server import make_server,WSGIServer
    class SmokeServer(WSGIServer):request_queue_size=128
    print('Conversión aislada: 127.0.0.1:8769 · SQLite en memoria',flush=True)
    make_server('127.0.0.1',8769,get_wsgi_application(),server_class=SmokeServer).serve_forever()


if __name__=='__main__':main()
