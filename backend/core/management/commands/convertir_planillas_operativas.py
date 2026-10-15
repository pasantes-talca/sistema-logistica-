import json
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from core.conversion_operativa import convertir, fuentes_guardadas


class Command(BaseCommand):
    help='Convierte las tres copias de Drive en registros normales, omitiendo dudas y conservando recargas autorizadas.'

    def add_arguments(self,parser):
        parser.add_argument('--aplicar',action='store_true')
        parser.add_argument('--confirmar',default='')
        parser.add_argument('--detalle',action='store_true')

    def handle(self,*args,**options):
        if options['aplicar'] and options['confirmar']!='CONVERTIR SIN RECALCULAR':
            raise CommandError('Confirmá con --confirmar "CONVERTIR SIN RECALCULAR".')
        try:result=convertir(fuentes_guardadas(),aplicar=options['aplicar'])
        except ValidationError as exc:raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps(result if options['detalle'] else {k:result[k] for k in ('aplicado','resumen')},ensure_ascii=False,indent=2))
