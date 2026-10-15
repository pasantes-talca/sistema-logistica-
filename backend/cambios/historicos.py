"""Recibos y resúmenes originales: sin identidades inferidas ni acumulación."""
import copy
import hashlib
import json
import re
from datetime import datetime

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction

from .models import ImportacionCambiosHistoricos


def celda(rows, row, col):
    value = rows[row-1][col-1] if len(rows) >= row and len(rows[row-1]) >= col else None
    return '' if value is None else str(value)


def recibos(fuente):
    data = []
    for sheet in fuente['pestanas']:
        if not sheet['nombre'].startswith('Recibo '):
            continue
        rows = sheet['filas']
        fecha_original = celda(rows, 3, 9)
        fecha = None
        try:
            fecha = datetime.strptime(fecha_original.strip(), '%d-%m-%Y').date().isoformat()
        except ValueError:
            pass
        nombre = celda(rows, 5, 3)
        warnings = []
        if fecha is None:
            warnings.append('Fecha vacía o inválida; no se reemplaza por el nombre de la hoja.')
        if not nombre.strip():
            warnings.append('Concesionario vacío; no se asignó automáticamente.')
        if sheet['nombre'] != f'Recibo {fecha_original} - {nombre}':
            warnings.append('El nombre de la hoja no coincide con sus datos internos; se conservan ambos.')
        productos = []
        tam = ''
        for row in range(8, 29):
            tam = celda(rows, row, 1) or tam
            codigo = celda(rows, row, 3)
            if not codigo:
                continue
            cantidad, observacion = celda(rows, row, 7), celda(rows, row, 9)
            productos.append(dict(fila=row, codigo=codigo, presentacion=tam, sabor=celda(rows, row, 5), cantidad=cantidad, observacion=observacion))
        materiales = [dict(fila=row, nombre=celda(rows,row,3), cantidad=celda(rows,row,7), observacion=celda(rows,row,9)) for row in (30,31,32)]
        data.append(dict(sheet_id=sheet['sheet_id'], nombre_hoja=sheet['nombre'], fecha_original=fecha_original, fecha=fecha,
            concesionario=nombre, productos=productos, materiales=materiales,
            productos_cargados=sum(bool(p['cantidad'].strip() or p['observacion'].strip()) for p in productos),
            incidencias=warnings, filas_originales=rows))
    return data


def preparar(fuente):
    if not isinstance(fuente, dict) or fuente.get('version') != 1 or not isinstance(fuente.get('origen'),dict):
        raise ValidationError('Formato de archivo de cambios no admitido.')
    origen = fuente['origen']
    if not re.fullmatch(r'[A-Za-z0-9_-]{10,120}',str(origen.get('id',''))) or not isinstance(origen.get('titulo'),str) or not origen['titulo'].strip() or len(origen['titulo']) > 200:
        raise ValidationError('Identificación de planilla inválida.')
    if origen.get('zona_horaria') != 'America/Buenos_Aires':
        raise ValidationError('Confirmá la zona horaria antes de importar.')
    sheets = fuente.get('pestanas')
    if not isinstance(sheets,list) or not sheets or len(sheets) > 500:
        raise ValidationError('No se encontraron hojas válidas.')
    names, ids = set(), set()
    for s in sheets:
        if not isinstance(s,dict) or not isinstance(s.get('nombre'),str) or not isinstance(s.get('sheet_id'),int) or s['nombre'] in names or s['sheet_id'] in ids or not isinstance(s.get('filas'),list):
            raise ValidationError('Hoja inválida o repetida.')
        names.add(s['nombre']); ids.add(s['sheet_id'])
        if len(s['filas']) > 50000 or any(not isinstance(r,list) or len(r)>100 or any(not isinstance(v,(str,int,float,bool,type(None))) for v in r) for r in s['filas']):
            raise ValidationError('Dimensiones o celdas no admitidas.')
        if s['nombre'].startswith('Recibo '):
            if celda(s['filas'],5,1) != 'Concesionario' or celda(s['filas'],6,3) != 'COD' or celda(s['filas'],7,7) != 'CAMBIOS':
                raise ValidationError('La estructura de un recibo no coincide con la original.')
    data = recibos(fuente)
    if not data:
        raise ValidationError('No se encontraron recibos.')
    body = {'origen_id':origen['id'],'titulo':origen['titulo'],'zona_horaria':origen['zona_horaria'],'pestanas':sheets}
    huella = hashlib.sha256(json.dumps(body,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
    revision = dict(recibos=len(data),resumenes=sum(s['nombre'].startswith('Resumen ') for s in sheets),
        anexos=sum(not s['nombre'].startswith(('Recibo ','Resumen ')) for s in sheets),
        fechas_para_revisar=sum(r['fecha'] is None for r in data),recibos_para_revisar=sum(bool(r['incidencias']) for r in data))
    return huella, revision


def importar(fuente, aplicar=False, instalar=False):
    huella, revision = preparar(fuente)
    result = dict(huella=huella,revision=revision,aplicado=False,duplicado=False)
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
                result['tabla_creada'] = instalar_tabla(connection,ImportacionCambiosHistoricos)
            obj = ImportacionCambiosHistoricos.objects.filter(origen_id=fuente['origen']['id']).first()
            if obj:
                if obj.huella != huella:
                    raise ValidationError('Esa fuente ya tiene otra copia; no se sobrescribe ni acumula.')
                return dict(result,id=obj.pk,aplicado=True,duplicado=True)
            obj = ImportacionCambiosHistoricos.objects.create(origen_id=fuente['origen']['id'],nombre=fuente['origen']['titulo'],huella=huella,fuente=copy.deepcopy(fuente),revision=revision)
            return dict(result,id=obj.pk,aplicado=True)
    except IntegrityError:
        obj = ImportacionCambiosHistoricos.objects.filter(origen_id=fuente['origen']['id'],huella=huella).first()
        if obj:
            return dict(result,id=obj.pk,aplicado=True,duplicado=True)
        raise ValidationError('Carga concurrente con otro contenido; no se reemplazó.')
