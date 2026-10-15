import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.core.exceptions import ValidationError
from repartos.historicos import importar


class Command(BaseCommand):
    help = 'Revisa/importa una copia histórica de Recargas; nunca modifica repartos operativos.'

    def add_arguments(self, parser):
        parser.add_argument('archivo')
        parser.add_argument('--aplicar', action='store_true')
        parser.add_argument('--confirmar', default='')
        parser.add_argument('--instalar-tabla', action='store_true', help='Crear únicamente la tabla histórica en log, sin registrar ni ejecutar otras migraciones.')

    def handle(self, *args, **options):
        if options['aplicar'] and options['confirmar'] != 'IMPORTAR HISTORICO':
            raise CommandError('Para escribir indicá --confirmar "IMPORTAR HISTORICO".')
        path = Path(options['archivo'])
        try:
            if path.stat().st_size > 10000000:
                raise CommandError('El archivo supera 10 MB.')
            with path.open(encoding='utf-8-sig') as stream:
                fuente = json.load(stream)
            result = importar(fuente, aplicar=options['aplicar'], instalar=options['instalar_tabla'])
        except (OSError, ValueError, ValidationError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2))
