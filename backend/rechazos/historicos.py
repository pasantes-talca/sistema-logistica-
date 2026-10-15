import copy
import hashlib
import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from repartos.historicos import fecha_original, texto

from .models import ImportacionRechazosHistoricos

HOJA = 'Respuestas de formulario 1'
HEADERS = ['Marca temporal', 'Fecha', 'Asignación', 'Punto de venta', 'Bultos ', 'Motivo de NO entrega ', 'Observación']


def hoja(fuente):
    return next(s for s in fuente['pestanas'] if s['nombre'] == HOJA)


def registros(fuente):
    rows = []
    for fila, row in enumerate(hoja(fuente)['filas'][1:], 2):
        if not any(v is not None and str(v).strip() for v in row):
            continue
        fecha = fecha_original(texto(row, 1))
        marca = None
        try:
            marca = datetime.strptime(texto(row, 0).strip(), '%d/%m/%Y %H:%M:%S').replace(tzinfo=ZoneInfo(fuente['origen']['zona_horaria'])).isoformat()
        except (ValueError, TypeError):
            pass
        warnings = []
        if fecha is None:
            warnings.append('Fecha de rechazo vacía o inválida. No se sustituye por la marca temporal.')
        if marca is None:
            warnings.append('Marca temporal no interpretable; se conserva el texto original.')
        for index, label in [(3, 'Punto de venta'), (5, 'Motivo')]:
            if not texto(row, index).strip():
                warnings.append(label + ' vacío; requiere revisión.')
        rows.append(dict(fila=fila, fecha_original=texto(row, 1), fecha=fecha.isoformat() if fecha else None,
            marca_temporal=texto(row, 0), registrado_en=marca, asignacion=texto(row, 2), punto_venta=texto(row, 3),
            bultos=texto(row, 4), motivo=texto(row, 5), observacion=texto(row, 6), incidencias=warnings, celdas_originales=row))
    return rows


def preparar(fuente):
    if not isinstance(fuente, dict) or fuente.get('version') != 1 or not isinstance(fuente.get('origen'), dict):
        raise ValidationError('Formato histórico de rechazos no admitido.')
    origen = fuente['origen']
    if not re.fullmatch(r'[A-Za-z0-9_-]{10,120}', str(origen.get('id', ''))) or not isinstance(origen.get('titulo'), str) or not origen['titulo'].strip() or len(origen['titulo']) > 200:
        raise ValidationError('Identificación de planilla inválida.')
    if origen.get('zona_horaria') != 'America/Buenos_Aires':
        raise ValidationError('Confirmá la zona horaria del archivo antes de importarlo.')
    sheets = fuente.get('pestanas')
    if not isinstance(sheets, list) or not sheets or len(sheets) > 100:
        raise ValidationError('No se encontraron pestañas válidas.')
    seen = set()
    for sheet in sheets:
        if not isinstance(sheet, dict) or not isinstance(sheet.get('nombre'), str) or sheet['nombre'] in seen or not isinstance(sheet.get('filas'), list):
            raise ValidationError('Pestaña inválida o repetida.')
        seen.add(sheet['nombre'])
        if len(sheet['filas']) > 50000 or any(not isinstance(r, list) or len(r) > 100 or any(isinstance(v, (dict, list)) for v in r) for r in sheet['filas']):
            raise ValidationError('Dimensiones o celdas no admitidas.')
    if HOJA not in seen or not hoja(fuente)['filas'] or hoja(fuente)['filas'][0][:7] != HEADERS:
        raise ValidationError('No se reconoce la hoja de respuestas y sus encabezados.')
    body = {'origen_id': origen['id'], 'titulo': origen['titulo'], 'zona_horaria': origen['zona_horaria'], 'pestanas': sheets}
    huella = hashlib.sha256(json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    data = registros(fuente)
    return huella, dict(registros=len(data), fechas_para_revisar=sum(r['fecha'] is None for r in data), registros_para_revisar=sum(bool(r['incidencias']) for r in data), anexos=len(sheets)-1)


def importar(fuente, aplicar=False, instalar=False):
    huella, revision = preparar(fuente)
    result = dict(huella=huella, revision=revision, aplicado=False, duplicado=False)
    if not aplicar:
        return result
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_schema()')
            if cursor.fetchone()[0] != 'log':
                raise ValidationError('La importación sólo admite el esquema log.')
    try:
        with transaction.atomic():
            if instalar:
                from core.historicos_instalacion import instalar_tabla
                result['tabla_creada'] = instalar_tabla(connection, ImportacionRechazosHistoricos)
            obj = ImportacionRechazosHistoricos.objects.filter(origen_id=fuente['origen']['id']).first()
            if obj:
                if obj.huella != huella:
                    raise ValidationError('Esa fuente ya tiene otra copia. No se sobrescribe ni duplica.')
                return dict(result, id=obj.pk, aplicado=True, duplicado=True)
            obj = ImportacionRechazosHistoricos.objects.create(origen_id=fuente['origen']['id'], nombre=fuente['origen']['titulo'], huella=huella, fuente=copy.deepcopy(fuente), revision=revision)
            return dict(result, id=obj.pk, aplicado=True)
    except IntegrityError:
        obj = ImportacionRechazosHistoricos.objects.filter(origen_id=fuente['origen']['id'], huella=huella).first()
        if obj:
            return dict(result, id=obj.pk, aplicado=True, duplicado=True)
        raise ValidationError('Importación concurrente con otro contenido; no se reemplazó.')
