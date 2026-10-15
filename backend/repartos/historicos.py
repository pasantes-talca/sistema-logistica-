"""Importación sin corregir fechas, identidades, cifras ni la lógica operativa."""
import copy
import hashlib
import json
import re
import unicodedata
from collections import Counter
from datetime import date

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction

from .models import ImportacionRepartosHistoricos
from .services import calcular_recargas

ENCABEZADOS = ["FECHA", "PATENTE", "ASIGNACION", "CHOFER", "AYUDANTE 1", "AYUDANTE 2", "AYUDANTE 3", "BULTOS", "P.VENTAS", "RECARGAS", "RECARGA TOTAL", "OBSERVACIONES"]


def normalizar(value):
    return ''.join(c for c in unicodedata.normalize('NFD', str(value or '')) if not unicodedata.combining(c)).strip().upper()


def texto(row, index):
    value = row[index] if index < len(row) else None
    return '' if value is None else str(value)


def fecha_original(value):
    match = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})', str(value).strip())
    if not match:
        return None
    day, month, year = map(int, match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def entero_original(value):
    try:
        # Celdas con texto/números enteros: jamás redondear o truncar silenciosamente.
        from decimal import Decimal, InvalidOperation
        result = Decimal(str(value).strip())
        if not result.is_finite() or result < 0 or result != result.to_integral_value() or result > 2147483647:
            return None
        return int(result)
    except (ValueError, InvalidOperation):
        return None


def pestana(fuente, nombre):
    return next((s for s in fuente['pestanas'] if s['nombre'] == nombre), None)


def registros_originales(fuente):
    padron = pestana(fuente, 'Datos Empleados')
    conocidos = {normalizar(texto(r, 1)) for r in padron['filas'][1:]} if padron else set()
    expected_year = re.search(r'\b(20\d{2})\b', fuente['origen']['titulo'])
    expected_year = int(expected_year.group(1)) if expected_year else None
    records = []
    for numero, row in enumerate(pestana(fuente, 'Registros')['filas'][1:], 2):
        if not any(v is not None and str(v).strip() for v in row):
            continue
        fecha = fecha_original(texto(row, 0))
        participantes = [texto(row, i).strip() for i in range(3, 7) if texto(row, i).strip()]
        ayudantes = [texto(row, i) for i in range(4, 7)]
        bultos, recargas, total = (entero_original(texto(row, i)) for i in (7, 9, 10))
        incidencias = []
        if fecha is None:
            incidencias.append('Fecha no interpretable; se conserva el texto original.')
        elif expected_year and fecha.year != expected_year:
            incidencias.append('Año distinto del título de la planilla; confirmar la fecha.')
        if any(v is None for v in (bultos, recargas, total)):
            incidencias.append('Cantidad no interpretable; se conserva el texto original.')
        if len({normalizar(p) for p in participantes}) != len(participantes):
            incidencias.append('Persona repetida; no se eliminó ni se creó una identidad ficticia.')
        faltantes = [p for p in participantes if normalizar(p) not in conocidos]
        if faltantes:
            incidencias.append('Nombre sin coincidencia exacta en el padrón: ' + ', '.join(faltantes))
        calculo = None
        if bultos is not None:
            calculo = calcular_recargas(bultos=bultos, cantidad_ayudantes=sum(bool(a.strip()) for a in ayudantes), hay_chofer=bool(texto(row, 3).strip()))
            if recargas is not None and calculo['recargas'] != recargas:
                incidencias.append('Recargas originales diferentes del cálculo actual; no se recalcularon.')
        if recargas is not None and total is not None and recargas * len(participantes) != total:
            incidencias.append('Total original diferente de recargas × participantes; no se reemplazó.')
        records.append(dict(fila=numero, fecha_original=texto(row, 0), fecha=fecha.isoformat() if fecha else None,
            patente=texto(row, 1), asignacion=texto(row, 2), chofer=texto(row, 3), ayudantes=ayudantes,
            bultos=texto(row, 7), puntos_venta=texto(row, 8), recargas=texto(row, 9), recarga_total=texto(row, 10),
            observaciones=texto(row, 11), incidencias=incidencias,
            calculo_actual=calculo, celdas_originales=row))
    return records


def resumenes_originales(fuente):
    return [dict(nombre=s['nombre'], sheet_id=s.get('sheet_id'), filas=s['filas'])
            for s in fuente['pestanas'] if s['nombre'].startswith('Recarga ')]


def preparar(fuente):
    if not isinstance(fuente, dict) or fuente.get('version') != 1 or not isinstance(fuente.get('origen'), dict):
        raise ValidationError('Formato de archivo histórico no admitido.')
    origin = fuente['origen']
    if not re.fullmatch(r'[A-Za-z0-9_-]{10,120}', str(origin.get('id', ''))) or not isinstance(origin.get('titulo'), str) or not origin['titulo'].strip() or len(origin['titulo']) > 200:
        raise ValidationError('Identificación de la planilla inválida.')
    sheets = fuente.get('pestanas')
    if not isinstance(sheets, list) or not sheets or len(sheets) > 100:
        raise ValidationError('El archivo no contiene pestañas válidas.')
    names = set()
    for sheet in sheets:
        if not isinstance(sheet, dict) or not isinstance(sheet.get('nombre'), str) or not isinstance(sheet.get('filas'), list):
            raise ValidationError('Pestaña inválida.')
        if sheet['nombre'] in names:
            raise ValidationError('Hay pestañas repetidas.')
        names.add(sheet['nombre'])
        if len(sheet['filas']) > 50000 or any(not isinstance(r, list) or len(r) > 100 or any(isinstance(v, (dict, list)) for v in r) for r in sheet['filas']):
            raise ValidationError('Dimensiones o celdas no admitidas.')
    sheet = pestana(fuente, 'Registros')
    if not sheet or not sheet['filas'] or sheet['filas'][0][:12] != ENCABEZADOS:
        raise ValidationError('No se reconoce el encabezado de Registros.')
    # Huella independiente de fecha de descarga: la misma fuente no se importa dos veces.
    content = {'origen_id': origin['id'], 'titulo': origin['titulo'], 'pestanas': sheets}
    huella = hashlib.sha256(json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()
    records = registros_originales(fuente)
    issues = Counter(i for r in records for i in r['incidencias'])
    revision = dict(registros=len(records), resumenes=len(resumenes_originales(fuente)),
        empleados_padron=max(0, len(pestana(fuente, 'Datos Empleados')['filas']) - 1) if pestana(fuente, 'Datos Empleados') else 0,
        registros_para_revisar=sum(bool(r['incidencias']) for r in records),
        fechas_para_revisar=sum(any(i.startswith(('Fecha ', 'Año ')) for i in r['incidencias']) for r in records),
        participantes_repetidos=sum(any(i.startswith('Persona repetida') for i in r['incidencias']) for r in records),
        incidencias=dict(issues))
    return huella, revision


def importar(fuente, aplicar=False, instalar=False):
    huella, revision = preparar(fuente)
    result = dict(huella=huella, revision=revision, aplicado=False, duplicado=False)
    if not aplicar:
        return result
    # Una única tabla nueva en log; sin tocar public ni otras tablas del sistema.
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_schema()')
            if cursor.fetchone()[0] != 'log':
                raise ValidationError('La importación sólo está permitida en el esquema log.')
    try:
        with transaction.atomic():
            if instalar:
                from .historicos_instalacion import instalar_tabla
                result['tabla_creada'] = instalar_tabla(connection, ImportacionRepartosHistoricos)
            existing = ImportacionRepartosHistoricos.objects.filter(origen_id=fuente['origen']['id']).first()
            if existing:
                if existing.huella != huella:
                    raise ValidationError('Ya existe una importación distinta de esa planilla. No se sobrescribe ni duplica.')
                return dict(result, id=existing.pk, aplicado=True, duplicado=True)
            obj = ImportacionRepartosHistoricos.objects.create(origen_id=fuente['origen']['id'], nombre=fuente['origen']['titulo'], huella=huella, fuente=copy.deepcopy(fuente), revision=revision)
            return dict(result, id=obj.pk, aplicado=True)
    except IntegrityError:
        existing = ImportacionRepartosHistoricos.objects.filter(origen_id=fuente['origen']['id'], huella=huella).first()
        if existing:
            return dict(result, id=existing.pk, aplicado=True, duplicado=True)
        raise ValidationError('La fuente ya fue importada con otro contenido; no se reemplazó.')
