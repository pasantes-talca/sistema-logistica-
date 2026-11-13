from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient
from maestros.models import Empleado
from kilometrajes.models import ControlKilometraje, RegistroKilometraje, DestinoKilometraje
from viaticos.models import Viatico
from .models import EventoAuditoria, AccesoAcciones


class EliminarHistorialTests(TestCase):
    def setUp(self):
        U = get_user_model()
        self.admin = U.objects.create_user("administrador", password="Prueba-local-492!")
        self.admin.groups.add(Group.objects.get_or_create(name="ADMINISTRADOR")[0])
        self.operador = U.objects.create_user("operador", is_staff=True)
        self.operador.groups.add(*[Group.objects.get_or_create(name=g)[0] for g in ["KILOMETRAJES", "VIATICOS"]])
        AccesoAcciones.objects.create(usuario=self.operador, permisos={m:["consultar", "crear", "editar", "anular"] for m in ["KILOMETRAJES", "VIATICOS"]})
        self.tecnico = U.objects.create_user("arielgarro", is_superuser=True, is_staff=True)
        self.chofer = Empleado.objects.create(nombre="Chofer prueba")
        self.viatico = Viatico.objects.create(chofer=self.chofer, fecha="2026-10-01", tipo_reparto="LOCAL", valor_viatico=100, cantidad_viaticos=2, observaciones="Carga prueba")
        self.control = ControlKilometraje.objects.create(chofer=self.chofer, fecha_desde="2026-10-01", fecha_hasta="2026-10-25")
        RegistroKilometraje.objects.create(control=self.control, fecha="2026-10-01", destino=DestinoKilometraje.objects.first(), distancia_km=10, cantidad_viajes=3)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def borrar(self, tipo, obj, **cambios):
        datos = {"confirmar": True, "motivo": "Carga de prueba", "actualizado_en": obj.actualizado_en.isoformat()}
        if isinstance(obj, ControlKilometraje): datos["version"] = obj.version
        return self.client.delete(f"/api/{tipo}/{obj.pk}/", {**datos, **cambios}, format="json")

    def test_admin_operativo_elimina_viatico_y_audita_antes(self):
        self.assertFalse(self.admin.is_superuser)
        self.assertEqual(self.borrar("viaticos", self.viatico).status_code, 204)
        self.assertFalse(Viatico.objects.exists())
        self.assertTrue(Empleado.objects.filter(pk=self.chofer.pk).exists())
        evento = EventoAuditoria.objects.get(accion="Eliminar")
        self.assertEqual(evento.modulo, "VIATICOS")
        self.assertEqual(evento.usuario, "administrador")
        self.assertEqual(evento.motivo, "Carga de prueba")
        self.assertEqual(evento.antes["monto_total"], "200.00")
        self.assertTrue(evento.despues["eliminado"])

    def test_km_borra_viajes_no_catalogos_y_guarda_auditoria(self):
        self.control.estado = "FINALIZADA"
        self.control.envio_estado = "ENVIADO"
        self.control.save()
        self.assertEqual(self.borrar("kilometrajes", self.control).status_code, 204)
        self.assertFalse(ControlKilometraje.objects.exists())
        self.assertFalse(RegistroKilometraje.objects.exists())
        self.assertEqual(DestinoKilometraje.objects.count(), 9)
        evento = EventoAuditoria.objects.get(accion="Eliminar")
        self.assertEqual(evento.antes["total_km"], "30.00")
        self.assertEqual(len(evento.antes["registros"]), 1)

    def test_operador_staff_o_cuenta_tecnica_no_pueden_eliminar_ni_por_url(self):
        for user in [self.operador, self.tecnico]:
            self.client.force_authenticate(user)
            self.assertEqual(self.borrar("viaticos", self.viatico).status_code, 403)
            self.assertEqual(self.borrar("kilometrajes", self.control).status_code, 403)
        self.assertTrue(Viatico.objects.exists())
        self.assertTrue(ControlKilometraje.objects.exists())

    def test_anonimo_no_borra_y_otros_modulos_siguen_protegidos(self):
        self.assertEqual(self.client.delete("/api/rechazos/999/").status_code, 400)
        self.client.force_authenticate(user=None)
        self.assertIn(self.borrar("viaticos", self.viatico).status_code, [401,403])

    def test_motivo_confirmacion_y_version_obligatorios(self):
        for cambios in [{"confirmar":False},{"motivo":" "},{"motivo":"x"*2001},{"actualizado_en":""},{"motivo":[]}]:
            self.assertEqual(self.borrar("viaticos", self.viatico, **cambios).status_code, 400)
        self.assertEqual(self.borrar("kilometrajes", self.control, version=999).status_code, 409)
        self.assertEqual(EventoAuditoria.objects.count(), 0)

    def test_no_borra_si_cambio_o_si_hay_envio_en_curso(self):
        self.assertEqual(self.borrar("viaticos", self.viatico, actualizado_en="2020-01-01T00:00:00Z").status_code,409)
        self.control.envio_estado = "ENVIANDO"
        self.control.save()
        self.assertEqual(self.borrar("kilometrajes", self.control).status_code,409)
        self.assertTrue(RegistroKilometraje.objects.exists())

    def test_registro_ya_eliminado_no_genera_otra_auditoria(self):
        self.assertEqual(self.borrar("viaticos", self.viatico).status_code,204)
        self.assertEqual(self.borrar("viaticos", self.viatico).status_code,404)
        self.assertEqual(EventoAuditoria.objects.filter(accion="Eliminar").count(),1)

    def test_fallo_auditoria_revierte_el_borrado(self):
        with patch("core.eliminacion_historial.registrar", side_effect=RuntimeError("Fallo de prueba")):
            with self.assertRaises(RuntimeError): self.borrar("kilometrajes", self.control)
        self.assertTrue(ControlKilometraje.objects.exists())
        self.assertTrue(RegistroKilometraje.objects.exists())

    def test_sesion_exige_csrf_para_eliminar(self):
        cliente = APIClient(enforce_csrf_checks=True)
        cliente.force_login(self.admin)
        r = cliente.delete(f"/api/viaticos/{self.viatico.pk}/", {"confirmar":True,"motivo":"prueba","actualizado_en":self.viatico.actualizado_en.isoformat()}, format="json")
        self.assertEqual(r.status_code,403)
        self.assertTrue(Viatico.objects.exists())

    def test_todos_los_historiales_logisticos_solo_admin_y_auditados(self):
        from repartos.models import Reparto, RepartoPersonal
        from rechazos.models import Rechazo
        from cambios.models import ReciboCambio, DetalleReciboCambio
        from control_diario.models import ControlDiario
        from maestros.models import MotivoRechazo, Concesionario, Producto
        reparto=Reparto.objects.create(fecha='2026-10-01',bultos=20,recargas=2)
        RepartoPersonal.objects.create(reparto=reparto,empleado=self.chofer,rol='CHOFER')
        rechazo=Rechazo.objects.create(fecha='2026-10-01',punto_venta='Prueba',bultos='2',
            motivo=MotivoRechazo.objects.create(nombre='Prueba'),origen='google_forms',origen_id='fila-prueba')
        recibo=ReciboCambio.objects.create(fecha='2026-10-01',concesionario=Concesionario.objects.create(nombre='Prueba'))
        DetalleReciboCambio.objects.create(recibo=recibo,producto=Producto.objects.first(),cantidad=2)
        control=ControlDiario.objects.create(fecha='2026-10-01')
        for tipo,obj,modulo in [('repartos',reparto,'REPARTOS'),('rechazos',rechazo,'RECHAZOS'),
                               ('cambios/recibos',recibo,'CAMBIOS'),('control-diario',control,'CONTROL_DIARIO')]:
            self.client.force_authenticate(self.operador)
            self.assertEqual(self.borrar(tipo,obj).status_code,403)
            self.client.force_authenticate(self.admin)
            r=self.borrar(tipo,obj)
            self.assertEqual(r.status_code,204,r.data)
            self.assertFalse(type(obj).objects.filter(pk=obj.pk).exists())
            self.assertTrue(EventoAuditoria.objects.filter(modulo=modulo,accion='Eliminar').exists())
        self.assertFalse(RepartoPersonal.objects.exists())
        self.assertFalse(DetalleReciboCambio.objects.exists())
        self.assertTrue(EventoAuditoria.objects.filter(antes__origen_id='fila-prueba').exists())

    def test_rechazo_eliminado_no_reaparece_al_sincronizar(self):
        from rechazos.google_forms import sincronizar_rechazos_google
        EventoAuditoria.objects.create(usuario='administrador',modulo='RECHAZOS',accion='Eliminar',
            antes={'origen_id':'google_forms:2:27/10/2026 10:00'})
        with patch('rechazos.google_forms.obtener_filas_google',return_value=[{'_fila_sheet':2,'Marca temporal':'27/10/2026 10:00'}]):
            resultado=sincronizar_rechazos_google()
        self.assertEqual(resultado['existentes'],1)
        self.assertEqual(resultado['creados'],0)
