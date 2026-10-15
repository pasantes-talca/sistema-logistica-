import copy
import json
from pathlib import Path
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient
from .historicos import HEADERS, HOJA, importar, preparar, registros
from .models import ImportacionRechazosHistoricos, Rechazo
from core.historicos_instalacion import validar_tabla


def source():
    return {'version': 1, 'origen': {'id': 'rechazos-prueba-2026', 'titulo': 'Hoja de rechazos ', 'zona_horaria': 'America/Buenos_Aires'}, 'pestanas': [
        {'nombre': HOJA, 'filas': [HEADERS.copy(), ['13/10/2026 16:48:01', None, '180', ' Punto de venta ', '15.03', 'Sin dinero ', ' Observación literal ']]},
        {'nombre': 'Porcentaje de rechazos', 'filas': [['Motivo', 'Cantidad', 'Porcentaje'], ['Sin dinero', '99', '100%']]},
        {'nombre': 'Preventa', 'filas': []},
        {'nombre': 'Hoja 1 (no tocar)', 'oculta': True, 'filas': [['NOTA HISTÓRICA']]},
    ]}


class HistoricosRechazosTests(TestCase):
    def test_dry_run_sin_escrituras(self):
        self.assertFalse(importar(source())['aplicado'])
        self.assertEqual(ImportacionRechazosHistoricos.objects.count(), 0)

    def test_no_inventa_fecha_ni_convierte_bultos_y_conserva_espacios(self):
        r = registros(source())[0]
        self.assertIsNone(r['fecha'])
        self.assertEqual(r['registrado_en'], '2026-10-13T16:48:01-03:00')
        self.assertEqual(r['bultos'], '15.03')
        self.assertEqual(r['punto_venta'], ' Punto de venta ')
        self.assertEqual(r['observacion'], ' Observación literal ')
        self.assertEqual(r['motivo'], 'Sin dinero ')
        self.assertEqual(len(r['incidencias']), 1)

    def test_copia_exacta_sin_crear_rechazos_operativos(self):
        f = source(); before = copy.deepcopy(f)
        result = importar(f, aplicar=True)
        self.assertEqual(ImportacionRechazosHistoricos.objects.get(pk=result['id']).fuente, before)
        self.assertEqual(f, before)
        self.assertEqual(Rechazo.objects.count(), 0)
        validar_tabla(connection, ImportacionRechazosHistoricos)

    def test_idempotencia_y_no_sobrescribir_otro_contenido(self):
        f = source(); first = importar(f, aplicar=True)
        f['capturado_en'] = 'otro instante'
        self.assertTrue(importar(f, aplicar=True)['duplicado'])
        f['pestanas'][0]['filas'][1][4] = '27 bultos'
        with self.assertRaises(ValidationError):
            importar(f, aplicar=True)
        self.assertEqual(ImportacionRechazosHistoricos.objects.count(), 1)
        self.assertEqual(ImportacionRechazosHistoricos.objects.get(pk=first['id']).fuente['pestanas'][0]['filas'][1][4], '15.03')

    def test_fecha_de_rechazo_y_marca_temporal_son_independientes(self):
        f = source(); f['pestanas'][0]['filas'][1][1] = '20/4/2026'
        r = registros(f)[0]
        self.assertEqual(r['fecha'], '2026-04-20')
        self.assertTrue(r['registrado_en'].startswith('2026-10-13'))

    def test_rechaza_encabezados_zona_y_pestanas_invalidas(self):
        invalid = source(); invalid['origen']['zona_horaria'] = 'desconocida'
        with self.assertRaises(ValidationError): preparar(invalid)
        invalid = source(); invalid['pestanas'][0]['filas'][0][0] = 'CAMBIADO'
        with self.assertRaises(ValidationError): preparar(invalid)
        invalid = source(); invalid['pestanas'] *= 2
        with self.assertRaises(ValidationError): preparar(invalid)

    def test_api_readonly_permisos_y_anexos(self):
        result = importar(source(), aplicar=True)
        client = APIClient(); url = f'/api/rechazos/historicos/{result["id"]}/'
        self.assertIn(client.get(url+'registros/').status_code, (401,403))
        user = get_user_model().objects.create_user('consulta-rechazos')
        client.force_authenticate(user)
        self.assertEqual(client.get(url+'registros/').status_code, 403)
        user.groups.add(Group.objects.create(name='RECHAZOS'))
        self.assertEqual(client.get(url+'registros/').status_code, 200)
        self.assertEqual(client.post(url+'registros/', {}).status_code, 405)
        self.assertEqual(client.get(url+'desconocido/').status_code, 404)
        self.assertEqual(client.get(url+'respaldo/').json(), source())
        self.assertEqual(client.get(url+'anexos/').json()[-1]['filas'], [['NOTA HISTÓRICA']])

    def test_copia_real_privada_si_esta_disponible(self):
        path = Path(__file__).resolve().parent.parent/'importaciones/rechazos/planilla-original.json'
        if not path.exists(): self.skipTest('La copia privada no se publica en Git.')
        f = json.loads(path.read_text(encoding='utf-8'))
        result = importar(f, aplicar=True)
        self.assertEqual(result['revision'], {'registros':62,'fechas_para_revisar':1,'registros_para_revisar':1,'anexos':3})
        self.assertEqual(ImportacionRechazosHistoricos.objects.get().fuente, f)
