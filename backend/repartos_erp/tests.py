from datetime import date
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from core.models import AccesoAcciones, EventoAuditoria
from .models import RepartoERP, ParadaRepartoERP, DocumentoRepartoERP, ClientePersatERP, CobroERP
from . import sincronizacion as sync, planificacion as plan


class RepartosERPTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("operador_erp", password="test-password")
        self.user.groups.add(Group.objects.get_or_create(name="REPARTOS")[0])
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.r = RepartoERP.objects.create(cod_reparto=210719, nro_comprobante="00000000049959",
            fecha_salida=date(2026, 11, 26), almacen="MZA_EXPEDICION", chofer="FRANCO", monto_total=100)
        self.p = ParadaRepartoERP.objects.create(reparto=self.r, cliente="CLIENTE A", codigo_cliente="190022",
            orden=1, importe_a_cobrar=100, importe_referencia=100, saldo_inicializado=True)
        self.base = f"/api/repartos-erp/{self.r.cod_reparto}"

    def post(self, accion, **data):
        return self.client.post(self.base + "/acciones/", {"accion": accion, **data}, format="json")

    def test_detalle_incluye_saldos_y_no_escribe_en_sql(self):
        with patch("repartos_erp.sqlserver.obtener_conexion_sqlserver") as conn:
            response = self.client.get(self.base + "/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["resumen"]["saldo"], "100.00")
        self.assertEqual(response.data["paradas"][0]["ubicacion"]["estado"], "sin_consultar")
        conn.assert_not_called()

    @patch("repartos_erp.origen_sqlserver.obtener_repartos")
    def test_listado_combina_origen_y_operacion_local(self, fuente):
        fuente.return_value = [{"codReparto": self.r.cod_reparto, "nrocomprobante": self.r.nro_comprobante,
            "almacen": "MZA_EXPEDICION", "montoTotal": 999}, {"codReparto": 123, "nrocomprobante": "000123", "chofer": "OTRO"}]
        response = self.client.get("/api/repartos-erp/?fecha=2026-11-26")
        self.assertEqual(response.status_code, 200, response.data)
        local, nuevo = response.data["results"]
        self.assertTrue(local["importado"])
        self.assertEqual(local["resumen"]["a_cobrar"], "100.00")
        self.assertFalse(nuevo["importado"])
        self.assertIsNone(nuevo["resumen"])
        fuente.assert_called_once_with("26/11/2026")

    @patch("repartos_erp.origen_sqlserver.obtener_repartos", side_effect=RuntimeError("dato técnico sensible"))
    def test_caida_sql_muestra_locales_con_advertencia_sin_detalles_tecnicos(self, fuente):
        response = self.client.get("/api/repartos-erp/?fecha=2026-11-26")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertIn("no es un listado completo", response.data["advertencia"])
        self.assertNotIn("sensible", str(response.data))

    @patch("repartos_erp.origen_sqlserver.obtener_repartos")
    def test_fecha_invalida_es_400_sin_consultar_sql(self, fuente):
        self.assertEqual(self.client.get("/api/repartos-erp/?fecha=2026-99-90").status_code, 400)
        fuente.assert_not_called()

    def test_usuario_sin_modulo_no_puede_leer_ni_escribir(self):
        self.user.groups.clear()
        self.assertEqual(self.client.get(self.base + "/").status_code, 403)
        self.assertEqual(self.post("estado", parada=self.p.id, estado="entregado").status_code, 403)

    def test_permiso_solo_consulta_no_puede_mutar(self):
        AccesoAcciones.objects.create(usuario=self.user, permisos={"REPARTOS": ["consultar"]})
        self.assertEqual(self.client.get(self.base + "/").status_code, 200)
        for accion in ["estado", "importe", "cobro", "anular_cobro", "confirmar_plan", "asignar"]:
            self.assertEqual(self.post(accion, parada=self.p.id).status_code, 403, accion)

    def test_permiso_editar_no_requiere_crear(self):
        AccesoAcciones.objects.create(usuario=self.user, permisos={"REPARTOS": ["consultar", "editar"]})
        self.assertEqual(self.post("estado", parada=self.p.id, estado="entregado").status_code, 200)
        self.assertEqual(self.post("cobro", parada=self.p.id).status_code, 403)

    def test_estado_es_local_y_auditado(self):
        response = self.post("estado", parada=self.p.id, estado="entregado", observaciones="Entregado al titular")
        self.assertEqual(response.status_code, 200, response.data)
        self.p.refresh_from_db()
        self.assertEqual(self.p.estado, "entregado")
        self.assertEqual(self.p.orden_real, 1)
        self.assertIsNotNone(self.p.entregado_en)
        self.assertTrue(self.r.eventos.filter(accion="estado_entrega").exists())
        self.assertTrue(EventoAuditoria.objects.filter(modulo="REPARTOS").exists())
        self.assertEqual(self.post("estado", parada=self.p.id, estado="pendiente").status_code, 200)

    def test_no_puede_modificar_parada_de_otro_reparto(self):
        otro = RepartoERP.objects.create(cod_reparto=123)
        p = ParadaRepartoERP.objects.create(reparto=otro, cliente="AJENO")
        self.assertEqual(self.post("estado", parada=p.id, estado="entregado").status_code, 404)

    def test_reordenar_intercambia_posiciones(self):
        p2 = ParadaRepartoERP.objects.create(reparto=self.r, cliente="B", orden=2)
        self.assertEqual(self.post("mover", parada=self.p.id, direccion="abajo").status_code, 200)
        self.p.refresh_from_db(); p2.refresh_from_db()
        self.assertEqual((self.p.orden, p2.orden), (2, 1))

    def test_cobro_mixto_idempotente_y_anulacion_con_motivo(self):
        data = {"parada": self.p.id, "solicitud": str(uuid4()), "medios": [
            {"medio": "efectivo", "importe": "10"}, {"medio": "transferencia", "importe": "20", "referencia": "OP-1"},
            {"medio": "cheque", "importe": "30", "banco": "Banco", "numero_cheque": "123", "fecha_pago": "2026-11-27"}]}
        response = self.post("cobro", **data)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["resumen"]["saldo"], "40.00")
        self.assertEqual(self.post("cobro", **data).status_code, 200)
        self.assertEqual(CobroERP.objects.count(), 1)
        c = CobroERP.objects.get()
        self.assertEqual(self.post("anular_cobro", cobro=c.id, motivo="").status_code, 400)
        response = self.post("anular_cobro", cobro=c.id, motivo="Cobro duplicado de prueba")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["resumen"]["saldo"], "100.00")
        self.assertEqual(CobroERP.objects.count(), 1)
        self.assertEqual(self.post("anular_cobro", cobro=c.id, motivo="Otra vez").status_code, 400)

    def test_cobro_no_admite_exceso_negativos_ceros_o_cheques_incompletos(self):
        for medio in [{"medio": "efectivo", "importe": "101"}, {"medio": "efectivo", "importe": "-1"},
                      {"medio": "efectivo", "importe": "0"}, {"medio": "cheque", "importe": "5"}]:
            self.assertEqual(self.post("cobro", parada=self.p.id, solicitud=str(uuid4()), medios=[medio]).status_code, 400)
        self.assertFalse(CobroERP.objects.exists())

    def test_base_no_puede_bajar_de_lo_cobrado(self):
        self.post("cobro", parada=self.p.id, solicitud=str(uuid4()), medios=[{"medio": "efectivo", "importe": "70"}])
        self.assertEqual(self.post("importe", parada=self.p.id, importe="60").status_code, 400)
        self.p.refresh_from_db()
        self.assertEqual(self.p.importe_a_cobrar, Decimal("100"))

    def test_asignacion_requiere_usuario_activo_con_acceso(self):
        ajeno = get_user_model().objects.create_user("ajeno", password="test")
        self.assertEqual(self.post("asignar", usuario=ajeno.id).status_code, 400)
        self.assertEqual(self.post("asignar", usuario=self.user.id).status_code, 200)

    def test_configuracion_de_unidades_restringida_y_capacidad_positiva(self):
        policy = AccesoAcciones.objects.create(usuario=self.user, permisos={"REPARTOS": ["consultar", "editar"]})
        data = {"dominio": "NCH087", "capacidad": 480}
        self.assertEqual(self.client.post("/api/repartos-erp/unidades/", data, format="json").status_code, 403)
        policy.permisos["REPARTOS"].append("configurar"); policy.save()
        self.assertEqual(self.client.post("/api/repartos-erp/unidades/", {**data,"capacidad":0}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/repartos-erp/unidades/", data, format="json").status_code, 201)

    @patch("repartos_erp.sincronizacion.obtener_remitos", side_effect=RuntimeError("Permiso sobre función de remitos"))
    @patch("repartos_erp.sincronizacion.obtener_pedidos", return_value=[])
    @patch("repartos_erp.sincronizacion.obtener_detalle_factura")
    @patch("repartos_erp.sincronizacion.obtener_facturas")
    def test_importacion_conserva_operacion_y_tolereo_remitos(self, facturas, detalles, pedidos, remitos):
        facturas.return_value = [{"codfactura": 55, "cliente": "CLIENTE A", "monto": "150", "nrocomprobante": "F-55"}]
        detalles.return_value = [{"codfacturadetalle": 99, "CodigoCliente": "190022", "RazonSocial": "CLIENTE A", "cantBultos": "5"}]
        self.p.estado="entregado";self.p.orden=5;self.p.importe_a_cobrar=80;self.p.save()
        self.r.usuario_asignado=self.user;self.r.save()
        raw={"codReparto": self.r.cod_reparto, "chofer": "NUEVO SQL", "codjerarquia": 7, "montoTotal": "150"}
        for _ in range(2):
            result=sync.sincronizar_reparto(raw)
            self.assertIn("remitos_error", result)
        self.p.refresh_from_db(); self.r.refresh_from_db()
        self.assertEqual(self.r.paradas.count(), 1)
        self.assertEqual(self.p.importe_a_cobrar, Decimal("80"))
        self.assertEqual(self.p.importe_referencia, Decimal("150"))
        self.assertEqual(self.p.estado, "entregado")
        self.assertEqual(self.p.orden, 5)
        self.assertEqual(self.r.usuario_asignado, self.user)
        self.assertEqual(DocumentoRepartoERP.objects.count(), 1)

    def test_parada_antigua_sin_codigo_se_completa_sin_duplicar(self):
        self.p.codigo_cliente=""; self.p.save()
        parada=sync.obtener_o_crear_parada(self.r, self.p.cliente, "190022")
        self.assertEqual(parada.id,self.p.id)
        self.assertEqual(self.r.paradas.count(),1)

    def test_sin_ubicaciones_no_se_consulta_osrm(self):
        with patch("repartos_erp.planificacion.osrm") as motor:
            response=self.client.post(self.base+"/planificar/", {"accion":"calcular"}, format="json")
        self.assertEqual(response.status_code,400)
        motor.assert_not_called()

    def test_propuesta_no_reordena_hasta_confirmar_y_no_se_reutiliza(self):
        p2=ParadaRepartoERP.objects.create(reparto=self.r, cliente="B", codigo_cliente="B", orden=2)
        ClientePersatERP.objects.create(codigo=self.p.codigo_cliente,latitud=-32.9,longitud=-68.8)
        ClientePersatERP.objects.create(codigo="B",latitud=-32.8,longitud=-68.7)
        matriz=[[0,20,1],[1,0,2],[20,1,0]]
        def motor(servicio,puntos,params):
            return {"durations":matriz} if servicio=="table" else {"routes":[{"distance":1000,"duration":100,"geometry":{"coordinates":[[-68.8,-32.9],[-68.7,-32.8]]}}]}
        with patch("repartos_erp.planificacion.osrm",side_effect=motor):
            response=self.client.post(self.base+"/planificar/", {"accion":"calcular"}, format="json")
        self.assertEqual(response.status_code,200,response.data)
        self.p.refresh_from_db(); self.assertEqual(self.p.orden,1)
        self.assertEqual(response.data["ids"],[p2.id,self.p.id])
        firma=response.data["firma"]
        self.assertEqual(self.post("confirmar_plan",firma=firma).status_code,200)
        self.p.refresh_from_db(); self.assertEqual(self.p.orden,2)
        self.assertEqual(self.post("confirmar_plan",firma=firma).status_code,400)

    def test_firma_falsificada_es_rechazada(self):
        self.assertEqual(self.post("confirmar_plan",firma="falsa").status_code,400)

    def test_osrm_sin_servicio_no_guarda_ruta(self):
        ClientePersatERP.objects.create(codigo=self.p.codigo_cliente,latitud=-32.9,longitud=-68.8)
        with patch("repartos_erp.planificacion.osrm",side_effect=ValidationError("OSRM no disponible")):
            response=self.client.post(self.base+"/planificar/", {"accion":"calcular"}, format="json")
        self.assertEqual(response.status_code,400)
        self.r.refresh_from_db(); self.assertEqual(self.r.recorrido_guardado,{})

    def test_conexion_sql_es_readonly_y_se_cierra(self):
        from .sqlserver import obtener_conexion_sqlserver
        cfg={"DRIVER":"ODBC Driver 18 for SQL Server","HOST":"test","PORT":"1433","DATABASE":"Logistica","USER":"readonly","PASSWORD":"test"}
        with self.settings(SQLSERVER_LOGISTICA=cfg), patch("repartos_erp.sqlserver.pyodbc.connect") as connect:
            with obtener_conexion_sqlserver():
                pass
        self.assertTrue(connect.call_args.kwargs["readonly"])
        self.assertTrue(connect.call_args.kwargs["autocommit"])
        connect.return_value.close.assert_called_once()
