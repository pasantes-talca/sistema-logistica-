import copy
import json
from io import StringIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.db import connection
from unittest.mock import patch
from rest_framework.test import APIClient

from .historicos import ENCABEZADOS, importar, preparar, registros_originales
from .models import ImportacionRepartosHistoricos, Reparto, RepartoPersonal
from .services import calcular_recargas


def fuente_prueba():
    return {'version': 1, 'origen': {'id': 'planilla-prueba-2026', 'titulo': 'Recargas 2026'}, 'capturado_en': '2026-10-14', 'pestanas': [
        {'nombre': 'Datos Empleados', 'filas': [['Legajo', 'Nombre', 'Puesto'], ['1', 'Chofer prueba', 'Chofer 1ra. Categoria'], ['2', 'Ayudante prueba', 'Ayudante']]},
        {'nombre': 'Registros', 'filas': [ENCABEZADOS.copy(), ['7/3/32026', 'NCH087', '70', 'Chofer prueba', 'Ayudante prueba', 'Ayudante prueba', '', '6433', '12', '3', '0', '  Observación exacta  ']]},
        {'nombre': 'Recarga 01/03/2026 al 31/03/2026', 'sheet_id': 1, 'filas': [['Título'], [], ['Empleado', 'Recargas'], ['Ayudante prueba', '99'], ['Total', '99'], [], ['NOTA HISTÓRICA']]},
    ]}


class HistoricosTests(TestCase):
    def test_valida_solo_tabla_historica_con_estructura_y_unicidad(self):
        from .historicos_instalacion import validar_tabla
        validar_tabla(connection, ImportacionRepartosHistoricos)
        with patch.object(connection.introspection, 'get_constraints', return_value={}):
            with self.assertRaises(ValidationError):
                validar_tabla(connection, ImportacionRepartosHistoricos)

    def test_instalacion_puntual_rechaza_otro_modelo_y_sqlite(self):
        from .historicos_instalacion import instalar_tabla
        with self.assertRaises(ValidationError):
            instalar_tabla(connection, Reparto)
        with self.assertRaises(ValidationError):
            instalar_tabla(connection, ImportacionRepartosHistoricos)

    def test_vista_previa_no_escribe(self):
        result = importar(fuente_prueba())
        self.assertFalse(result['aplicado'])
        self.assertEqual(ImportacionRepartosHistoricos.objects.count(), 0)

    def test_importa_exactamente_sin_recalcular_y_sin_tocar_operativos(self):
        original = fuente_prueba()
        snapshot = copy.deepcopy(original)
        result = importar(original, aplicar=True)
        obj = ImportacionRepartosHistoricos.objects.get(pk=result['id'])
        self.assertEqual(obj.fuente, snapshot)
        self.assertEqual(original, snapshot)
        self.assertEqual(Reparto.objects.count(), 0)
        self.assertEqual(RepartoPersonal.objects.count(), 0)
        r = registros_originales(obj.fuente)[0]
        self.assertEqual(r['recargas'], '3')
        self.assertEqual(r['recarga_total'], '0')
        self.assertEqual(r['observaciones'], '  Observación exacta  ')
        self.assertIsNone(r['fecha'])
        self.assertEqual(r['ayudantes'], ['Ayudante prueba', 'Ayudante prueba', ''])
        self.assertTrue(any('Persona repetida' in i for i in r['incidencias']))

    def test_reimportacion_idempotente_incluso_con_otra_fecha_de_descarga(self):
        f = fuente_prueba()
        first = importar(f, aplicar=True)
        f['capturado_en'] = '2026-11-01'
        second = importar(f, aplicar=True)
        self.assertEqual(first['id'], second['id'])
        self.assertTrue(second['duplicado'])
        self.assertEqual(ImportacionRepartosHistoricos.objects.count(), 1)

    def test_misma_planilla_distinta_no_se_sobrescribe(self):
        f = fuente_prueba()
        importar(f, aplicar=True)
        f['pestanas'][1]['filas'][1][9] = '19'
        with self.assertRaises(ValidationError):
            importar(f, aplicar=True)
        self.assertEqual(ImportacionRepartosHistoricos.objects.get().fuente['pestanas'][1]['filas'][1][9], '3')

    def test_cantidades_invalidas_no_se_truncan(self):
        f = fuente_prueba()
        f['pestanas'][1]['filas'][1][7] = '2.5'
        r = registros_originales(f)[0]
        self.assertEqual(r['bultos'], '2.5')
        self.assertIsNone(r['calculo_actual'])
        self.assertTrue(any('Cantidad no interpretable' in i for i in r['incidencias']))

    def test_no_silenciar_anios_0206_y_1926_ni_fabricar_legajos(self):
        f = fuente_prueba()
        f['pestanas'][1]['filas'][1][0] = '28/3/0206'
        f['pestanas'][1]['filas'][1][3] = 'Persona desconocida'
        r = registros_originales(f)[0]
        self.assertEqual(r['fecha'], '0206-03-28')
        self.assertTrue(any(i.startswith('Año ') for i in r['incidencias']))
        self.assertTrue(any('Persona desconocida' in i for i in r['incidencias']))

    def test_rechaza_pestanas_repetidas_y_encabezados_incorrectos(self):
        for f in [dict(fuente_prueba(), pestanas=[]), dict(fuente_prueba(), pestanas=fuente_prueba()['pestanas'] * 2)]:
            with self.assertRaises(ValidationError):
                preparar(f)
        f = fuente_prueba()
        f['pestanas'][1]['filas'][0][0] = 'CAMBIADO'
        with self.assertRaises(ValidationError):
            preparar(f)

    def test_reglas_para_nuevos_repartos_no_cambian(self):
        importar(fuente_prueba(), aplicar=True)
        self.assertEqual(calcular_recargas(bultos=1152, cantidad_ayudantes=1)['recargas'], 3)

    def test_api_autenticada_solo_lectura_y_restringida_a_repartos(self):
        result = importar(fuente_prueba(), aplicar=True)
        client = APIClient()
        url = f'/api/repartos/historicos/{result["id"]}/'
        self.assertIn(client.get(url + 'registros/').status_code, (401, 403))
        u = get_user_model().objects.create_user('consulta')
        client.force_authenticate(u)
        self.assertEqual(client.get(url + 'registros/').status_code, 403)
        u.groups.add(Group.objects.create(name='REPARTOS'))
        self.assertEqual(client.get(url + 'registros/').status_code, 200)
        self.assertEqual(client.post(url + 'registros/', {}).status_code, 405)
        self.assertEqual(client.get(url + 'desconocido/').status_code, 404)
        self.assertEqual(client.get(url + 'respaldo/').json(), fuente_prueba())
        self.assertEqual(client.get(url + 'resumenes/').json()[0]['filas'][-1], ['NOTA HISTÓRICA'])
        self.assertEqual(client.get(url + 'padron/').json()[1][0], '1')

    def test_cli_exige_confirmacion_antes_de_escribir(self):
        with self.assertRaises(CommandError):
            call_command('importar_recargas_historicas', 'archivo-no-importado.json', aplicar=True, stdout=StringIO())

    def test_snapshot_real_si_esta_disponible(self):
        path = Path(__file__).resolve().parent.parent / 'importaciones/recargas-2026/planilla-original.json'
        if not path.exists():
            self.skipTest('La copia privada de la planilla no se publica en Git.')
        f = json.loads(path.read_text(encoding='utf-8'))
        result = importar(f, aplicar=True)
        self.assertEqual(result['revision']['registros'], 1031)
        self.assertEqual(result['revision']['resumenes'], 8)
        self.assertEqual(result['revision']['fechas_para_revisar'], 13)
        self.assertEqual(result['revision']['participantes_repetidos'], 3)
        self.assertEqual(ImportacionRepartosHistoricos.objects.get().fuente, f)
