import copy
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

from repartos.test_historicos import fuente_prueba
from rechazos.test_historicos import source as fuente_rechazos
from cambios.test_historicos import source as fuente_cambios
from maestros.models import Empleado, Concesionario
from repartos.models import Reparto
from repartos.services import actualizar_reparto, crear_reparto
from rechazos.models import Rechazo
from cambios.models import ReciboCambio
from .conversion_operativa import convertir
from .importacion_instalacion import validar
from .models import RegistroImportacion


def fuentes():
    r=fuente_prueba()
    for p in r['pestanas'][0]['filas'][1:]:p.append('SI')
    fila=r['pestanas'][1]['filas'][1]
    fila[0]='7/3/2026';fila[5]=''
    x=fuente_rechazos();x['pestanas'][0]['filas'][1][1]='20/4/2026'
    return dict(repartos=r,rechazos=x,cambios=fuente_cambios())


class ConversionOperativaTests(TestCase):
    def test_solo_previsualiza(self):
        result=convertir(fuentes())
        self.assertFalse(result['aplicado'])
        self.assertEqual(result['resumen']['repartos']['creados'],1)
        self.assertEqual(Empleado.objects.count(),0)
        self.assertEqual(RegistroImportacion.objects.count(),0)

    def test_valores_autorizados_en_modelos_normales_sin_correos(self):
        f=fuentes();before=copy.deepcopy(f)
        with patch('cambios.email.enviar_recibo_cambio_por_email') as email:
            result=convertir(f,aplicar=True)
        email.assert_not_called();self.assertEqual(f,before)
        self.assertEqual(Reparto.objects.get().recargas,3)
        self.assertEqual(Reparto.objects.get().recargas_totales,0)
        self.assertEqual(Rechazo.objects.get().bultos,'15.03')
        self.assertEqual(ReciboCambio.objects.get().detalles.get(producto__codigo='5051').cantidad,Decimal('1.03'))
        self.assertEqual(RegistroImportacion.objects.count(),3)
        self.assertEqual(sum(v['creados'] for v in result['resumen'].values()),3)
        validar(connection,RegistroImportacion)

    def test_omite_sin_corregir_errores(self):
        f=fuentes();f['repartos']['pestanas'][1]['filas'][1][0]='7/3/32026'
        f['rechazos']['pestanas'][0]['filas'][1][1]=None
        result=convertir(f,aplicar=True)
        self.assertEqual(Reparto.objects.count(),0);self.assertEqual(Rechazo.objects.count(),0)
        self.assertEqual(ReciboCambio.objects.count(),1)
        self.assertEqual(len(result['omitidos']),2)

    def test_no_inventa_personas_ni_legajos(self):
        f=fuentes();f['repartos']['pestanas'][1]['filas'][1][4]='Nombre no confirmado'
        result=convertir(f,aplicar=True)
        self.assertEqual(result['resumen']['repartos']['omitidos'],1)
        self.assertEqual(Empleado.objects.count(),0)

    def test_no_fusiona_personas_repetidas(self):
        f=fuentes();f['repartos']['pestanas'][1]['filas'][1][5]='Ayudante prueba'
        result=convertir(f,aplicar=True)
        self.assertEqual(result['resumen']['repartos']['omitidos'],1)
        self.assertEqual(Reparto.objects.count(),0)

    def test_idempotente_y_no_sobrescribe_origen_distinto(self):
        f=fuentes();convertir(f,aplicar=True)
        result=convertir(f,aplicar=True)
        self.assertEqual(sum(result['ya_importados'].values()),3)
        self.assertEqual(RegistroImportacion.objects.count(),3)
        f['repartos']['pestanas'][1]['filas'][1][9]='1'
        with self.assertRaises(ValidationError):convertir(f,aplicar=True)
        self.assertEqual(Reparto.objects.get().recargas,3)

    def test_no_recrea_destino_eliminado(self):
        f=fuentes();convertir(f,aplicar=True)
        Reparto.objects.get().delete()
        with self.assertRaises(ValidationError):convertir(f,aplicar=True)
        self.assertEqual(Reparto.objects.count(),0)

    def test_no_reemplaza_recibo_manual_existente(self):
        conc=Concesionario.objects.create(nombre='Aiobak')
        manual=ReciboCambio.objects.create(fecha=date(2026,3,23),concesionario=conc,pallets=99)
        result=convertir(fuentes(),aplicar=True)
        manual.refresh_from_db();self.assertEqual(manual.pallets,99)
        self.assertEqual(result['resumen']['cambios']['omitidos'],1)
        self.assertEqual(ReciboCambio.objects.count(),1)

    def test_edicion_normal_no_recalcula_autorizados(self):
        convertir(fuentes(),aplicar=True);r=Reparto.objects.get()
        chofer=r.personal.get(rol='CHOFER').empleado
        actualizar_reparto(reparto=r,fecha=r.fecha,bultos=100,chofer=chofer,ayudantes=[],observaciones='Editado')
        r.refresh_from_db();self.assertEqual(r.recargas,3);self.assertEqual(r.recargas_totales,0)
        self.assertEqual(r.observaciones,'Editado')
        preview=convertir(fuentes())
        self.assertEqual(preview['ya_importados']['repartos'],1)
        self.assertEqual(preview['resumen']['repartos']['creados'],0)
        convertir(fuentes(),aplicar=True)
        r.refresh_from_db();self.assertEqual(r.observaciones,'Editado')
        manual=crear_reparto(fecha=date(2026,10,15),bultos=1152,chofer=chofer,ayudantes=[])
        self.assertFalse(manual.recargas_autorizadas);self.assertEqual(manual.recargas,2)
        actualizar_reparto(reparto=manual,fecha=manual.fecha,bultos=100,chofer=chofer,ayudantes=[])
        self.assertEqual(manual.recargas,0)

    def test_reporte_diferencia_autorizada_explicita_sin_repartir(self):
        convertir(fuentes(),aplicar=True)
        client=APIClient();client.force_authenticate(get_user_model().objects.create_user('consulta'))
        data=client.get('/api/repartos/reporte-recargas/?desde=2026-01-01&hasta=2026-12-31').json()
        self.assertEqual(data['total_general'],0)
        self.assertEqual(data['total_por_empleados'],6)
        self.assertEqual(data['diferencia_autorizada'],-6)
        row=client.get('/api/repartos/').json()[0]
        self.assertTrue(row['recargas_autorizadas']);self.assertEqual(row['recargas_totales'],0)

    def test_incluye_total_positivo_aunque_recarga_individual_cero(self):
        f=fuentes();f['repartos']['pestanas'][1]['filas'][1][9]='0';f['repartos']['pestanas'][1]['filas'][1][10]='2'
        convertir(f,aplicar=True)
        client=APIClient();client.force_authenticate(get_user_model().objects.create_user('consulta'))
        data=client.get('/api/repartos/reporte-recargas/?desde=2026-01-01&hasta=2026-12-31').json()
        self.assertEqual(data['total_general'],2);self.assertEqual(data['total_por_empleados'],0)

    def test_conversion_real_completa_copias_privadas(self):
        root=Path(__file__).resolve().parent.parent/'importaciones'
        paths=dict(repartos=root/'recargas-2026/planilla-original.json',rechazos=root/'rechazos/planilla-original.json',cambios=root/'cambios/planilla-original.json')
        if not all(p.exists() for p in paths.values()):self.skipTest('Fuentes privadas excluidas de Git.')
        f={k:json.loads(p.read_text(encoding='utf-8')) for k,p in paths.items()}
        result=convertir(f,aplicar=True)
        self.assertEqual(result['resumen'],dict(repartos=dict(creados=905,omitidos=126,ya_importados=0),rechazos=dict(creados=61,omitidos=1,ya_importados=0),cambios=dict(creados=87,omitidos=0,ya_importados=0)))
        for registro in RegistroImportacion.objects.filter(modulo='repartos').select_related('reparto'):
            self.assertEqual(registro.reparto.recargas,int(registro.datos['recargas']))
            self.assertEqual(registro.reparto.recargas_totales,int(registro.datos['recarga_total']))
        second=convertir(f,aplicar=True)
        self.assertEqual(second['ya_importados'],dict(repartos=905,rechazos=61,cambios=87))
        self.assertEqual(RegistroImportacion.objects.count(),1053)
