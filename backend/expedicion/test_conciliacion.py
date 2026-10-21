import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient
from .models import (StockProducto, MovimientoStock, OrdenCarga, Fletero,
    EntregaOrdenCarga, DetalleEntregaOrdenCarga, DetalleOrdenCarga,
    AuditoriaExpedicion, RespaldoExpedicion, ControlOperativa, ConfiguracionProducto)
from maestros.models import Producto


class ConciliacionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="admin-prueba")
        self.user.groups.add(Group.objects.get_or_create(name="ADMINISTRADOR")[0])
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.p = Producto.objects.get(codigo="5670")
        self.s = StockProducto.objects.create(producto=self.p, cantidad_unidades=100)
        self.f = Fletero.objects.create(nombre="Prueba")

    def informe(self):
        r = self.client.get("/api/expedicion/diagnostico/")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def post(self, accion, expected=200, **extras):
        body = {"accion": accion, "turno": "Mañana", "clave": str(uuid.uuid4()), "motivo": "Verificación de prueba",
            "confirmacion": "CONCILIAR", "huella": self.informe()["huella"], **extras}
        r = self.client.post("/api/expedicion/operativa/", body, format="json")
        self.assertEqual(r.status_code, expected, r.data)
        return r.data

    def base(self):
        self.post("base_conciliacion", fisico_verificado=True)

    def test_diagnostico_sin_base_no_escribe_ni_inventa_stock_cero(self):
        informe = self.informe()
        self.assertFalse(informe["base_valida"])
        self.assertIsNone(informe["productos"][0]["esperado"])
        self.assertFalse(informe["productos"][0]["calibrable"])
        self.assertEqual(ControlOperativa.objects.count(), 0)
        self.assertEqual(AuditoriaExpedicion.objects.count(), 0)
        self.post("calibrar_stock", expected=400, seleccion=[self.p.pk])
        self.s.refresh_from_db()
        self.assertEqual(self.s.cantidad_unidades, 100)

    def test_base_exige_administrador_verificacion_y_confirmacion(self):
        self.post("base_conciliacion", expected=400)
        self.post("base_conciliacion", expected=400, fisico_verificado=True, confirmacion="NO")
        self.user.groups.clear()
        self.user.groups.add(Group.objects.get_or_create(name="EXPEDICION")[0])
        self.post("base_conciliacion", expected=403, fisico_verificado=True)
        self.assertFalse(AuditoriaExpedicion.objects.exists())

    def test_calibracion_seleccionada_base_movimientos_copia_auditoria_e_idempotencia(self):
        self.base()
        self.post("movimiento", tipo="PRODUCCION", lineas=[{"producto": self.p.pk, "packs": 1, "unidades": 0}])
        pack = ConfiguracionProducto.objects.get(producto=self.p).unidades_pack
        StockProducto.objects.filter(pk=self.s.pk).update(cantidad_unidades=300)
        informe = self.informe()
        self.assertEqual(Decimal(informe["productos"][0]["esperado"]), 100 + pack)
        body = dict(accion="calibrar_stock", turno="Mañana", clave=str(uuid.uuid4()), motivo="Corregir alteración externa",
            confirmacion="CONCILIAR", huella=informe["huella"], seleccion=[self.p.pk])
        for _ in range(2):
            r = self.client.post("/api/expedicion/operativa/", body, format="json")
            self.assertEqual(r.status_code, 200, r.data)
        self.s.refresh_from_db()
        self.assertEqual(self.s.cantidad_unidades, 100 + pack)
        self.assertEqual(RespaldoExpedicion.objects.count(), 1)
        self.assertEqual(MovimientoStock.objects.count(), 1)
        self.assertEqual(AuditoriaExpedicion.objects.filter(accion="Calibrar stock").count(), 1)

    def test_base_se_invalida_si_cambia_historia_previa_y_huella_vence(self):
        m = MovimientoStock.objects.create(producto=self.p, tipo="INGRESO", direccion="ENTRADA", cantidad=100)
        self.base()
        huella = self.informe()["huella"]
        m.cantidad = 99
        m.save()
        self.assertFalse(self.informe()["base_valida"])
        r = self.client.post("/api/expedicion/operativa/", dict(accion="calibrar_stock", turno="Mañana", clave=str(uuid.uuid4()),
            motivo="No aplicar", confirmacion="CONCILIAR", huella=huella, seleccion=[self.p.pk]), format="json")
        self.assertEqual(r.status_code, 400)

    def test_no_reconstruye_salidas_faltantes_ni_repara_orden_ambigua(self):
        o = OrdenCarga.objects.create(numero="OC-AMB", fecha="2026-10-21", fletero=self.f)
        DetalleOrdenCarga.objects.create(orden=o, producto=self.p, cantidad_solicitada=12)
        e = EntregaOrdenCarga.objects.create(orden=o)
        DetalleEntregaOrdenCarga.objects.create(entrega=e, producto=self.p, cantidad_entregada=12)
        informe = self.informe()
        self.assertFalse(informe["ordenes"][0]["reparable"])
        self.base()
        StockProducto.objects.filter(pk=self.s.pk).update(cantidad_unidades=50)
        self.assertFalse(self.informe()["productos"][0]["calibrable"])
        self.post("calibrar_stock", expected=400, seleccion=[self.p.pk])
        self.post("conciliar_estados", expected=400, seleccion=[o.pk])
        self.assertFalse(MovimientoStock.objects.exists())
        self.s.refresh_from_db()
        self.assertEqual(self.s.cantidad_unidades, 50)

    def test_concilia_solo_estado_con_evidencia_coincidente(self):
        o = OrdenCarga.objects.create(numero="OC-OK", fecha="2026-10-21", fletero=self.f)
        DetalleOrdenCarga.objects.create(orden=o, producto=self.p, cantidad_solicitada=12)
        e = EntregaOrdenCarga.objects.create(orden=o)
        DetalleEntregaOrdenCarga.objects.create(entrega=e, producto=self.p, cantidad_entregada=12)
        MovimientoStock.objects.create(orden=o, producto=self.p, tipo="ORDEN_CARGA", direccion="SALIDA", cantidad=12)
        self.post("conciliar_estados", seleccion=[o.pk])
        o.refresh_from_db()
        self.assertEqual(o.estado, "COMPLETA")
        self.assertEqual(o.version, 2)
        self.s.refresh_from_db()
        self.assertEqual(self.s.cantidad_unidades, 100)
        self.assertFalse(self.informe()["ordenes"])

    def test_pendientes_manuales_se_conservan(self):
        c = ConfiguracionProducto.objects.get(producto=self.p)
        c.pendientes_manuales = {"preventa": 50}
        c.save()
        self.base()
        c.refresh_from_db()
        self.assertEqual(c.pendientes_manuales, {"preventa": 50})

    def test_usuario_sin_modulo_no_puede_consultar(self):
        self.user.groups.clear()
        self.assertEqual(self.client.get("/api/expedicion/diagnostico/").status_code, 403)
