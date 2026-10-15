"""Conversión explícita de las copias de Drive a los modelos de trabajo.

No corrige datos dudosos, no recalcula recargas ni envía correos.
"""
import hashlib
import json
from collections import Counter
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import connection, transaction

from maestros.models import Empleado, Vehiculo, Asignacion, Concesionario, Producto, MotivoRechazo
from repartos.historicos import registros_originales, pestana, texto, normalizar, entero_original
from repartos.models import Reparto, RepartoPersonal, ImportacionRepartosHistoricos
from repartos.services import validar_personal_reparto, PUESTO_CHOFER, PUESTOS_AYUDANTE_VALIDOS
from rechazos.historicos import registros as filas_rechazos
from rechazos.models import Rechazo, ImportacionRechazosHistoricos
from cambios.historicos import recibos as filas_cambios
from cambios.models import ReciboCambio, ImportacionCambiosHistoricos
from cambios.services import guardar_recibo_cambio
from .models import RegistroImportacion


ORIGENES = {
    'repartos': (ImportacionRepartosHistoricos, '1neF-d-AbDoMWC1pYgtHxQy3xyAL9aiDOmEDJmUbNvfk'),
    'rechazos': (ImportacionRechazosHistoricos, '18XNFASCFr0HFB4Os7LxI4_2D-Usi7glLMlvxP6VzpB0'),
    'cambios': (ImportacionCambiosHistoricos, '1Z3u2Ng-doXgCHV5PgrLifnQOWYTG67Lbww5awJkYmZA'),
}


def fuentes_guardadas():
    from repartos.historicos import preparar as preparar_r
    from rechazos.historicos import preparar as preparar_x
    from cambios.historicos import preparar as preparar_c
    validadores = dict(repartos=preparar_r, rechazos=preparar_x, cambios=preparar_c)
    result = {}
    for modulo, (model, origen) in ORIGENES.items():
        obj = model.objects.get(origen_id=origen)
        if validadores[modulo](obj.fuente)[0] != obj.huella:
            raise ValidationError('La copia de origen no coincide con su huella. Se canceló la conversión.')
        result[modulo] = obj.fuente
    return result


def huella(datos):
    return hashlib.sha256(json.dumps(datos, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def cantidad(value):
    try:
        number = Decimal(str(value).strip() or '0')
        if not number.is_finite() or number < 0 or number > Decimal('9999999999.99') or number != number.quantize(Decimal('.01')):
            raise ValueError()
        return number
    except (ValueError, InvalidOperation):
        raise ValidationError('Cantidad inválida; no se redondea ni se convierte automáticamente.')


def maestro(model, campos, defaults=None):
    """No sobrescribe maestros existentes ni desactiva sus restricciones."""
    obj, _ = model.objects.get_or_create(**campos, defaults=defaults or {})
    if hasattr(obj, 'activo') and not obj.activo:
        raise ValidationError('Un maestro requerido está inactivo.')
    return obj


def planificar(fuentes):
    padron = pestana(fuentes['repartos'], 'Datos Empleados')['filas'][1:]
    catalogo = {}
    for row in padron:
        nombre = texto(row, 1).strip()
        item = dict(nombre=nombre, legajo=texto(row, 0).strip() or None,
                    puesto=texto(row, 2).strip(), disponible=normalizar(texto(row, 3)) == 'SI', activo=True)
        catalogo.setdefault(normalizar(nombre), []).append(item)
    existentes = list(Empleado.objects.all())

    def persona(nombre):
        n = normalizar(nombre)
        coinciden = [e for e in existentes if normalizar(e.nombre) == n]
        if len(coinciden) > 1:
            raise ValidationError('Nombre ambiguo en empleados: ' + nombre)
        candidatos = catalogo.get(n, [])
        if len(candidatos) > 1:
            raise ValidationError('Nombre repetido en el padrón: ' + nombre)
        if coinciden:
            e = coinciden[0]
            if candidatos and candidatos[0]['legajo'] and e.legajo != candidatos[0]['legajo']:
                raise ValidationError('Legajo incompatible para ' + nombre)
            return dict(id=e.pk, nombre=e.nombre, legajo=e.legajo, puesto=e.puesto, activo=e.activo, disponible=e.disponible)
        if not candidatos:
            raise ValidationError('Nombre sin correspondencia confirmada: ' + nombre)
        p = candidatos[0]
        if p['legajo'] and any(e.legajo == p['legajo'] for e in existentes):
            raise ValidationError('Legajo ya utilizado por otro nombre: ' + nombre)
        return p

    planes = []

    def agregar(modulo, clave, datos, errores, preparado):
        planes.append(dict(modulo=modulo, origen_id=fuentes[modulo]['origen']['id'], clave=str(clave),
            datos=datos, huella=huella(datos.get('celdas_originales',datos.get('filas_originales',datos))), errores=errores, preparado=preparado))

    repartos = registros_originales(fuentes['repartos'])
    duplicadas = Counter(huella(r['celdas_originales']) for r in repartos)
    for r in repartos:
        errores = [i for i in r['incidencias'] if i.startswith(('Fecha ', 'Año ', 'Persona repetida', 'Cantidad '))]
        if duplicadas[huella(r['celdas_originales'])] > 1:
            errores.append('Fila idéntica repetida en el origen; requiere confirmación.')
        preparado = {}
        try:
            chofer = persona(r['chofer'])
            ayudantes = [persona(p) for p in r['ayudantes'] if p.strip()]
            if not chofer['activo'] or not chofer['disponible'] or chofer['puesto'] != PUESTO_CHOFER:
                raise ValidationError('Chofer no habilitado según su padrón: ' + r['chofer'])
            if any(not p['activo'] or not p['disponible'] or p['puesto'] not in PUESTOS_AYUDANTE_VALIDOS for p in ayudantes):
                raise ValidationError('Ayudante no habilitado según su padrón.')
            if len({normalizar(p['nombre']) for p in [chofer]+ayudantes}) != 1+len(ayudantes):
                raise ValidationError('Persona repetida en el reparto.')
            if len(r['patente'].strip()) > 20 or len(r['asignacion'].strip()) > 30 or len(r['puntos_venta']) > 50:
                raise ValidationError('Un dato excede la longitud admitida por el formulario.')
            preparado = dict(chofer=chofer, ayudantes=ayudantes)
        except ValidationError as exc:
            errores.extend(exc.messages)
        agregar('repartos', r['fila'], r, errores, preparado)

    rechazos = filas_rechazos(fuentes['rechazos'])
    duplicadas = Counter(huella(r['celdas_originales']) for r in rechazos)
    for r in rechazos:
        errores = list(r['incidencias'])
        if duplicadas[huella(r['celdas_originales'])] > 1:
            errores.append('Fila idéntica repetida en el origen; requiere confirmación.')
        if any(len(r[k].strip()) > limit for k,limit in [('punto_venta',250),('bultos',100),('motivo',150),('asignacion',30)]):
            errores.append('Dato demasiado largo para el formulario.')
        if not r['bultos'].strip():errores.append('Bultos vacíos.')
        agregar('rechazos',r['fila'],r,errores,{})

    cambios = filas_cambios(fuentes['cambios'])
    claves = Counter((r['fecha'],normalizar(r['concesionario'])) for r in cambios)
    for r in cambios:
        errores = list(r['incidencias'])
        if claves[(r['fecha'],normalizar(r['concesionario']))] > 1:
            errores.append('Fecha y concesionario repetidos; no se fusionan ni reemplazan recibos.')
        if len(r['concesionario'].strip()) > 150:errores.append('Nombre de concesionario demasiado largo.')
        try:
            for p in r['productos']+r['materiales']:cantidad(p['cantidad'])
            if len({p['codigo'] for p in r['productos']}) != len(r['productos']):
                raise ValidationError('Código de producto repetido dentro del recibo.')
        except ValidationError as exc:errores.extend(exc.messages)
        agregar('cambios',r['sheet_id'],r,errores,{})
    return planes


def _empleado(datos):
    if datos.get('id'):
        return Empleado.objects.get(pk=datos['id'])
    matches = list(Empleado.objects.filter(nombre=datos['nombre'])[:2])
    if len(matches) > 1:raise ValidationError('Empleado ambiguo durante la conversión.')
    if matches:
        obj = matches[0]
        if obj.legajo != datos['legajo']:raise ValidationError('Legajo incompatible durante la conversión.')
        return obj
    return Empleado.objects.create(**datos)


def _crear(plan):
    r = plan['datos']
    if plan['modulo'] == 'repartos':
        chofer = _empleado(plan['preparado']['chofer'])
        ayudantes = [_empleado(p) for p in plan['preparado']['ayudantes']]
        validar_personal_reparto(chofer=chofer,ayudantes=ayudantes)
        vehiculo = maestro(Vehiculo,dict(patente=r['patente'].strip().upper())) if r['patente'].strip() else None
        asignacion = maestro(Asignacion,dict(codigo=r['asignacion'].strip())) if r['asignacion'].strip() else None
        fecha = date.fromisoformat(r['fecha'])
        candidates = Reparto.objects.filter(fecha=fecha,vehiculo=vehiculo,asignacion=asignacion,bultos=entero_original(r['bultos']),puntos_venta=r['puntos_venta'],observaciones=r['observaciones']).prefetch_related('personal')
        participants = {(chofer.pk,'CHOFER')} | {(p.pk,'AYUDANTE') for p in ayudantes}
        if any({(p.empleado_id,p.rol) for p in obj.personal.all()} == participants for obj in candidates):
            raise ValidationError('Posible reparto ya registrado; no se sobrescribe ni duplica.')
        obj = Reparto.objects.create(fecha=fecha,vehiculo=vehiculo,asignacion=asignacion,bultos=entero_original(r['bultos']),
            puntos_venta=r['puntos_venta'],recargas=entero_original(r['recargas']),observaciones=r['observaciones'])
        RepartoPersonal.objects.create(reparto=obj,empleado=chofer,rol='CHOFER',orden=0)
        RepartoPersonal.objects.bulk_create([RepartoPersonal(reparto=obj,empleado=p,rol='AYUDANTE',orden=i) for i,p in enumerate(ayudantes,1)])
        return dict(reparto=obj,recargas_autorizadas=True,total_autorizado=entero_original(r['recarga_total']))
    if plan['modulo'] == 'rechazos':
        asignacion = maestro(Asignacion,dict(codigo=r['asignacion'].strip())) if r['asignacion'].strip() else None
        motivo = maestro(MotivoRechazo,dict(nombre=r['motivo'].strip()))
        datos = dict(fecha=date.fromisoformat(r['fecha']),asignacion=asignacion,motivo=motivo,punto_venta=r['punto_venta'].strip(),bultos=r['bultos'].strip(),observacion=r['observacion'].strip())
        if Rechazo.objects.filter(**datos).exists():raise ValidationError('Posible rechazo ya registrado; no se duplica.')
        obj = Rechazo.objects.create(**datos,registrado_en=r['registrado_en'],origen='drive',origen_id=f"{plan['origen_id']}:{plan['clave']}")
        return dict(rechazo=obj)
    concesionario = maestro(Concesionario,dict(nombre=r['concesionario'].strip()))
    fecha = date.fromisoformat(r['fecha'])
    if ReciboCambio.objects.filter(fecha=fecha,concesionario=concesionario).exists():
        raise ValidationError('Ya existe un recibo para esa fecha y concesionario; no se reemplaza ni acumula.')
    detalles = []
    for p in r['productos']:
        sabor = normalizar(p['sabor'])
        familia = {'SODA':'SODA','SIFON':'SIFON','BIDON':'AGUA','AGUA':'AGUA'}.get(sabor,'GASEOSA')
        producto = maestro(Producto,dict(codigo=p['codigo'].strip()),dict(nombre=f"{p['sabor']} {p['presentacion']}",presentacion=p['presentacion'],sabor=p['sabor'],familia=familia))
        if producto.familia != familia:raise ValidationError('Familia de producto incompatible con el código de origen.')
        if cantidad(p['cantidad']) <= 0:continue
        detalles.append(dict(producto_id=producto.pk,cantidad=cantidad(p['cantidad']),observacion=p['observacion'],motivo_id=None))
    materiales = r['materiales']
    result = guardar_recibo_cambio(fecha=fecha,concesionario=concesionario,detalles=detalles,
        pallets=cantidad(materiales[0]['cantidad']),pallets_observacion=materiales[0]['observacion'],
        pallets_descargados=cantidad(materiales[1]['cantidad']),pallets_descargados_observacion=materiales[1]['observacion'],
        prensados=cantidad(materiales[2]['cantidad']),prensados_observacion=materiales[2]['observacion'])
    return dict(recibo=result['recibo'])


def convertir(fuentes, aplicar=False):
    planes = planificar(fuentes)
    result = dict(aplicado=aplicar,resumen={},omitidos=[],aplicados={m:{} for m in fuentes},ya_importados={m:0 for m in fuentes})
    if aplicar and connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_schema()')
            if cursor.fetchone()[0] != 'log':raise ValidationError('La conversión sólo está autorizada en log.')
    with transaction.atomic():
        if aplicar and connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL lock_timeout='5s'")
                cursor.execute('SELECT pg_advisory_xact_lock(%s)',[202610160001])
        for plan in planes:
            modulo,clave = plan['modulo'],plan['clave']
            existente = RegistroImportacion.objects.filter(modulo=modulo,origen_id=plan['origen_id'],clave=clave).first()
            if existente:
                campo = dict(repartos='reparto_id',rechazos='rechazo_id',cambios='recibo_id')[modulo]
                if existente.huella != plan['huella'] or getattr(existente,campo) is None:
                    raise ValidationError('Origen modificado o destino eliminado; no se sobrescribe ni se recrea.')
                result['ya_importados'][modulo] += 1
                continue
            if plan['errores']:
                result['omitidos'].append(dict(modulo=modulo,clave=clave,fecha=plan['datos'].get('fecha_original'),motivos=plan['errores']))
                continue
            if not aplicar:
                result['aplicados'][modulo][clave] = None
                continue
            try:
                with transaction.atomic():
                    destinos = _crear(plan)
                    RegistroImportacion.objects.create(modulo=modulo,origen_id=plan['origen_id'],clave=clave,huella=plan['huella'],datos=plan['datos'],**destinos)
                    obj = next(destinos[k] for k in ('reparto','rechazo','recibo') if k in destinos)
                    result['aplicados'][modulo][clave] = obj.pk
            except ValidationError as exc:
                result['omitidos'].append(dict(modulo=modulo,clave=clave,fecha=plan['datos'].get('fecha_original'),motivos=exc.messages))
        for modulo in fuentes:
            result['resumen'][modulo] = dict(creados=len(result['aplicados'][modulo]),omitidos=sum(r['modulo']==modulo for r in result['omitidos']),ya_importados=result['ya_importados'][modulo])
    return result
