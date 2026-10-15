import copy
import json
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

from core.historicos_instalacion import validar_tabla
from .historicos import importar, preparar, recibos
from .models import ImportacionCambiosHistoricos, ReciboCambio, DetalleReciboCambio


def source():
    rows = [[] for _ in range(34)]
    rows[2] = [None]*8 + ['23-03-2026']
    rows[4] = ['Concesionario', None, 'Aiobak']
    rows[5] = ['TAM',None,'COD',None,'SABOR ',None,'DESCARGA',None,'OBSERVACIONES']
    rows[6] = [None]*6+['CAMBIOS']
    rows[7] = ['1/5 LT.',None,'5051',None,'COLA',None,'1.03',None,' Texto literal ']
    rows[8] = [None,None,'5056',None,'LIMA',None,'0']
    rows[29] = ['7060',None,'Pallets.',None,None,None,'22']
    rows[31] = ['757',None,'Prensados.',None,None,None,'66']
    return dict(version=1,origen=dict(id='cambios-prueba-2026',titulo='Recibo de cambios ',zona_horaria='America/Buenos_Aires'),pestanas=[
        dict(sheet_id=1,nombre='Recibo 23-03-2026 - Aiobak',filas=rows),
        dict(sheet_id=2,nombre='Resumen 2026-05-01 a 2026-06-30',filas=[['TOTAL','1.03','total de totales: 1,03']]),
        dict(sheet_id=0,nombre='Plantilla',filas=[['MODELO']]),
    ])


class HistoricosCambiosTests(TestCase):
    def test_dry_run(self):
        self.assertFalse(importar(source())['aplicado'])
        self.assertEqual(ImportacionCambiosHistoricos.objects.count(),0)

    def test_cantidades_y_observaciones_literales_incluso_cero_y_vacio(self):
        r=recibos(source())[0]
        self.assertEqual(r['fecha'],'2026-03-23')
        self.assertEqual(r['productos'][0]['cantidad'],'1.03')
        self.assertEqual(r['productos'][0]['presentacion'],'1/5 LT.')
        self.assertEqual(r['productos'][0]['observacion'],' Texto literal ')
        self.assertEqual(r['productos'][1]['cantidad'],'0')
        self.assertEqual(r['materiales'][1]['cantidad'],'')
        self.assertEqual(r['productos_cargados'],2)

    def test_no_infiere_fecha_del_titulo_ni_fusiona_nombres(self):
        f=source(); f['pestanas'][0]['filas'][2][8]=''
        r=recibos(f)[0]
        self.assertIsNone(r['fecha']); self.assertEqual(len(r['incidencias']),2)
        f['pestanas'][0]['filas'][4][2]='AIOBAK'
        self.assertEqual(recibos(f)[0]['concesionario'],'AIOBAK')

    def test_copia_exacta_sin_acumulaciones_ni_correos(self):
        f=source(); before=copy.deepcopy(f)
        with patch('cambios.services.guardar_recibo_cambio') as save, patch('cambios.email.enviar_recibo_cambio_por_email') as email:
            result=importar(f,aplicar=True)
        save.assert_not_called();email.assert_not_called()
        self.assertEqual(f,before)
        self.assertEqual(ImportacionCambiosHistoricos.objects.get(pk=result['id']).fuente,before)
        self.assertEqual(ReciboCambio.objects.count(),0)
        self.assertEqual(DetalleReciboCambio.objects.count(),0)
        validar_tabla(connection,ImportacionCambiosHistoricos)

    def test_idempotente_y_rechaza_sobrescribir(self):
        f=source(); importar(f,aplicar=True)
        f['capturado_en']='otra fecha'
        self.assertTrue(importar(f,aplicar=True)['duplicado'])
        f['pestanas'][1]['filas'][0][1]='OTRO TOTAL'
        with self.assertRaises(ValidationError): importar(f,aplicar=True)
        self.assertEqual(ImportacionCambiosHistoricos.objects.count(),1)

    def test_no_admite_estructura_desconocida(self):
        for mutation in ('headers','ids','timezone','scalar'):
            f=source()
            if mutation=='headers':f['pestanas'][0]['filas'][5][2]='OTRO'
            if mutation=='ids':f['pestanas'][1]['sheet_id']=1
            if mutation=='timezone':f['origen']['zona_horaria']='desconocida'
            if mutation=='scalar':f['pestanas'][0]['filas'][7][6]={'a':1}
            with self.subTest(mutation=mutation), self.assertRaises(ValidationError): preparar(f)

    def test_permisos_readonly_y_resumen_intacto(self):
        result=importar(source(),aplicar=True);client=APIClient()
        url=f'/api/cambios/historicos/{result["id"]}/'
        self.assertIn(client.get(url+'recibos/').status_code,(401,403))
        user=get_user_model().objects.create_user('historico-cambios')
        client.force_authenticate(user)
        self.assertEqual(client.get(url+'recibos/').status_code,403)
        user.groups.add(Group.objects.create(name='CAMBIOS'))
        self.assertEqual(client.get('/api/cambios/historicos/').status_code,200)
        self.assertEqual(client.get(url+'recibos/').json(),recibos(source()))
        self.assertEqual(client.get(url+'resumenes/').json(),[source()['pestanas'][1]])
        self.assertEqual(client.get(url+'anexos/').json(),[source()['pestanas'][2]])
        self.assertEqual(client.get(url+'respaldo/').json(),source())
        self.assertEqual(client.get(url+'otro/').status_code,404)
        for method in ('post','put','patch','delete'):
            self.assertEqual(getattr(client,method)(url+'recibos/').status_code,405)

    def test_comando_exige_confirmacion(self):
        with self.assertRaises(CommandError):
            call_command('importar_cambios_historicos','no-existe.json',aplicar=True)

    def test_snapshot_real_privado(self):
        path=Path(__file__).resolve().parent.parent/'importaciones/cambios/planilla-original.json'
        if not path.exists():self.skipTest('La fuente privada no se publica en Git.')
        f=json.loads(path.read_text(encoding='utf-8'))
        result=importar(f,aplicar=True)
        self.assertEqual(result['revision'],dict(recibos=87,resumenes=1,anexos=1,fechas_para_revisar=0,recibos_para_revisar=0))
        self.assertEqual(ImportacionCambiosHistoricos.objects.get().fuente,f)
        self.assertEqual(len(recibos(f)),87)
        self.assertEqual(recibos(f)[0]['filas_originales'],f['pestanas'][2]['filas'])
        self.assertEqual(len(f['pestanas'][1]['filas']),97)
