import json
from pathlib import Path
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from cambios.historicos import importar


class Command(BaseCommand):
    help = 'Importa recibos y resúmenes originales sin acumular ni enviar correos.'

    def add_arguments(self, parser):
        parser.add_argument('archivo')
        parser.add_argument('--aplicar', action='store_true')
        parser.add_argument('--confirmar', default='')
        parser.add_argument('--instalar-tabla', action='store_true')

    def handle(self, *args, **options):
        if options['aplicar'] and options['confirmar'] != 'IMPORTAR HISTORICO':
            raise CommandError('Confirmá con --confirmar "IMPORTAR HISTORICO".')
        try:
            path = Path(options['archivo'])
            if path.stat().st_size > 10000000:
                raise CommandError('El archivo supera 10 MB.')
            with path.open(encoding='utf-8-sig') as stream:
                source = json.load(stream)
            result = importar(source,aplicar=options['aplicar'],instalar=options['instalar_tabla'])
        except (OSError, ValueError, ValidationError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps(result,ensure_ascii=False,indent=2))
