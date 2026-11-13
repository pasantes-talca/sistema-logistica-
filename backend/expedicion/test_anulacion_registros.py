import uuid
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient
from maestros.models import Producto
from .models import (StockProducto, MovimientoStock, MovimientoMaterial,
                     EmpleadoExpedicion, AuditoriaExpedicion, Fletero,
                     ConfiguracionProducto, OperacionExpedicion)


class AnulacionRegistrosTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_user('admin-operativo')
        self.admin.groups.add(Group.objects.get_or_create(name='ADMINISTRADOR')[0])
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.p = Producto.objects.get(codigo='5670')
        StockProducto.objects.create(producto=self.p, cantidad_unidades=100)

    def post(self, accion, expected=200, **data):
        r = self.client.post('/api/expedicion/operativa/',
            {'accion': accion, 'turno': 'Mañana', 'clave': str(uuid.uuid4()), **data}, format='json')
        self.assertEqual(r.status_code, expected, r.data)
        return r.data

    def datos(self):
        return self.client.get('/api/expedicion/operativa/').data

    def anular(self, tipo, fila, expected=200, **data):
        return self.post('anular_registro', expected, tipo_registro=tipo,
            registro=fila['operacion'] if tipo=='movimiento' else fila['id'],
            **{'huella':fila['huella'], 'confirmar':True, 'motivo':'Carga de prueba', **data})

    def stock(self):
        return StockProducto.objects.get(producto=self.p).cantidad_unidades

    def movimiento(self, tipo='BUFFET', **data):
        self.post('movimiento', tipo=tipo, lineas=[{'producto':self.p.pk,'packs':1,'unidades':0}], **data)
        return self.datos()['movimientos'][-1]

    def test_revierte_stock_conserva_original_y_no_duplica(self):
        fila = self.movimiento()
        self.assertEqual(self.stock(),94)
        self.anular('movimiento',fila)
        self.assertEqual(self.stock(),100)
        self.assertEqual(MovimientoStock.objects.count(),2)
        original = next(m for m in self.datos()['movimientos'] if m['id']==fila['id'])
        self.assertTrue(original['anulado'])
        self.anular('movimiento',original,400)
        self.anular('movimiento',next(m for m in self.datos()['movimientos'] if m['reversion']),400)
        self.assertEqual(self.stock(),100)

    def test_solo_administrador_y_confirmacion_y_huella(self):
        fila=self.movimiento()
        self.anular('movimiento',fila,400,confirmar=False)
        self.anular('movimiento',fila,400,huella='vieja')
        for name, superuser in [('operador',False),('arielgarro',True)]:
            u=get_user_model().objects.create_user(name,is_superuser=superuser,is_staff=superuser)
            u.groups.add(Group.objects.get_or_create(name='EXPEDICION')[0])
            self.client.force_authenticate(u)
            self.anular('movimiento',fila,403)
        self.assertEqual(self.stock(),94)

    def test_restaura_beneficio_y_stock_al_anular_comprobante(self):
        e=EmpleadoExpedicion.objects.create(legajo='1',nombre='Empleado',saldo_fardos=3)
        self.post('consumo',empleado=e.pk,tipo='CONSUMO',lineas=[{'producto':self.p.pk,'packs':1}])
        e.refresh_from_db()
        self.assertEqual(e.saldo_fardos,2)
        self.anular('movimiento',self.datos()['movimientos'][0],400)
        self.anular('comprobante',self.datos()['comprobantes'][0])
        e.refresh_from_db()
        self.assertEqual(e.saldo_fardos,3)
        self.assertEqual(self.stock(),100)
        self.assertTrue(self.datos()['comprobantes'][0]['anulado'])
        self.assertTrue(next(m for m in self.datos()['movimientos'] if m['tipo']=='CONSUMO_EMPLEADO')['anulado'])

    def test_anticipo_no_acredita_beneficio(self):
        e=EmpleadoExpedicion.objects.create(legajo='1',nombre='Empleado',saldo_fardos=3)
        self.post('consumo',empleado=e.pk,tipo='ANTICIPO',lineas=[{'producto':self.p.pk,'packs':1}])
        self.anular('comprobante',self.datos()['comprobantes'][0])
        e.refresh_from_db()
        self.assertEqual(e.saldo_fardos,3)
        self.assertEqual(self.stock(),100)

    def test_transferencia_revierte_materiales_y_stock_juntos(self):
        f=Fletero.objects.create(nombre='Fletero prueba')
        fila=self.movimiento('TRANSFERENCIA',direccion='SALIDA',referencia='T-1',destino='San Juan',fletero=f.pk,pallets_salida=2)
        self.anular('material',self.datos()['materiales'][0],400)
        self.anular('movimiento',fila)
        self.assertEqual(self.stock(),100)
        self.assertEqual(sum(m.pallets_salida-m.pallets_entrada for m in MovimientoMaterial.objects.all()),0)

    def test_transferencia_antigua_ambigua_no_adivina_vinculos(self):
        f=Fletero.objects.create(nombre='Fletero prueba')
        fila=self.movimiento('TRANSFERENCIA',referencia='T-antigua',destino='Mendoza',fletero=f.pk,pallets_entrada=2)
        OperacionExpedicion.objects.filter(pk=fila['operacion']).update(resultado={})
        self.anular('movimiento',fila,400)
        self.anular('material',self.datos()['materiales'][0],400)
        self.assertEqual(self.stock(),106)

    def test_clave_idempotente_no_duplica_reversiones(self):
        fila=self.movimiento()
        datos={'accion':'anular_registro','tipo_registro':'movimiento','registro':fila['operacion'],
            'huella':fila['huella'],'confirmar':True,'motivo':'Prueba','turno':'Mañana','clave':str(uuid.uuid4())}
        for _ in range(2):
            r=self.client.post('/api/expedicion/operativa/',datos,format='json')
            self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(self.stock(),100)
        self.assertEqual(MovimientoStock.objects.filter(tipo='ANULACION').count(),1)

    def test_material_independiente_y_conteo(self):
        f=Fletero.objects.create(nombre='Fletero prueba')
        self.post('materiales',fletero=f.pk,pallets_salida=2)
        self.anular('material',self.datos()['materiales'][0])
        self.assertEqual(sum(m.pallets_salida-m.pallets_entrada for m in MovimientoMaterial.objects.all()),0)
        self.post('conteo',tipo='Cierre de turno',lineas=[{'producto':self.p.pk,'unidades':99}])
        self.anular('conteo',self.datos()['conteos'][0])
        c=self.datos()['conteos'][0]
        self.assertTrue(c['anulado'])
        self.post('corroborar',400,id=c['id'],turno='Tarde')
        self.assertEqual(self.stock(),100)

    def test_sin_codificar_revierte_ambos_saldos(self):
        fila=self.movimiento('PRODUCCION_SIN_CODIFICAR')
        self.anular('movimiento',fila)
        self.assertEqual(ConfiguracionProducto.objects.get(producto=self.p).sin_codificar,0)
        self.assertEqual(self.stock(),100)

    def test_fallo_auditoria_revierte_stock(self):
        from unittest.mock import patch
        fila=self.movimiento()
        with patch('expedicion.operativa.auditoria',side_effect=RuntimeError('Prueba')):
            with self.assertRaises(RuntimeError): self.anular('movimiento',fila)
        self.assertEqual(self.stock(),94)
        self.assertEqual(MovimientoStock.objects.count(),1)
        self.assertFalse(AuditoriaExpedicion.objects.filter(accion='Anular registro').exists())
