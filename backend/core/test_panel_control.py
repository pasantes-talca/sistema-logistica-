from datetime import timedelta
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.sessions.models import Session
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from .models import AccesoAcciones, EventoAuditoria, IncidenciaSistema, PreferenciaAdministracion
from .panel_servicios import DEFAULTS
from .permissions import ADMINISTRADOR

BASE = "/api/administracion/"
PASSWORD = "Prueba-segura-Panel-392!"


class PanelControlTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_user("administrador", password=PASSWORD)
        self.admin.groups.add(Group.objects.get_or_create(name=ADMINISTRADOR)[0])
        self.root = User.objects.create_superuser("arielgarro", "root@example.test", PASSWORD)
        self.operador = User.objects.create_user("operador", password=PASSWORD)
        self.operador.groups.add(Group.objects.get_or_create(name="RECHAZOS")[0], Group.objects.get_or_create(name="EXPEDICION")[0])
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def politica(self, permissions, user=None):
        return self.client.put(BASE+"permisos/", {"usuario_id": (user or self.operador).pk, "permisos": permissions, "motivo": "Revisión de accesos"}, format="json")

    def test_secciones_nuevas_disponibles_solo_administrador(self):
        paths = ["panel/", "reportes/", "permisos/", "preferencias/", "estado/", "sesiones/", "errores/", "alertas/"]
        for p in paths:
            self.assertEqual(self.client.get(BASE+p).status_code, 200, p)
        for user in [self.root, self.operador]:
            self.client.force_authenticate(user)
            for p in paths:
                self.assertEqual(self.client.get(BASE+p).status_code, 403, p)

    def test_restricciones_por_accion_en_api_no_solo_ui(self):
        self.assertEqual(self.politica({"RECHAZOS": ["consultar"]}).status_code, 200)
        self.client.force_authenticate(self.operador)
        self.assertEqual(self.client.get("/api/rechazos/").status_code, 200)
        self.assertEqual(self.client.post("/api/rechazos/", {}, format="json").status_code, 403)
        self.assertEqual(self.client.put("/api/rechazos/999/", {}, format="json").status_code, 403)
        self.assertEqual(self.client.delete("/api/rechazos/999/").status_code, 403)
        self.assertEqual(self.client.get("/api/cambios/recibos/").status_code, 403)
        self.assertEqual(self.client.get("/api/rechazos/?formato=csv").status_code, 403)

    def test_politica_vacia_bloquea_lectura_y_no_otorga_modulos(self):
        self.assertEqual(self.politica({"RECHAZOS": [], "CAMBIOS": ["consultar"]}).status_code, 200)
        self.client.force_authenticate(self.operador)
        self.assertEqual(self.client.get("/api/rechazos/").status_code, 403)
        self.assertEqual(self.client.get("/api/cambios/recibos/").status_code, 403)

    def test_permisos_validan_acciones_y_protegen_cuentas(self):
        for rules in [{"OTRO": []}, {"RECHAZOS": ["superuser"]}, {"RECHAZOS": ["crear"]}, {"RECHAZOS": "consultar"}]:
            self.assertEqual(self.politica(rules).status_code, 400)
        for user in [self.root, self.admin]:
            self.assertEqual(self.politica({"RECHAZOS": []}, user).status_code, 403)
        self.assertFalse(AccesoAcciones.objects.exists())

    def test_expedicion_post_diferencia_configurar_editar_anular(self):
        self.politica({"EXPEDICION": ["consultar", "crear"]})
        self.client.force_authenticate(self.operador)
        for payload in [{"accion": "producto"}, {"accion": "empleado"}, {"accion": "anular"}, {"accion": "orden", "id": 1}, {"accion": "corregir_movimiento"}]:
            self.assertEqual(self.client.post("/api/expedicion/operativa/", payload, format="json").status_code, 403)

    def test_preferencias_validadas_auditadas_y_password_minimo(self):
        datos = {**DEFAULTS, "minimo_password": 30}
        self.assertEqual(self.client.put(BASE+"preferencias/", {"datos": datos, "motivo": "Nueva política"}, format="json").status_code, 200)
        self.assertEqual(PreferenciaAdministracion.objects.count(), 1)
        self.assertTrue(EventoAuditoria.objects.filter(accion="Configurar panel y seguridad").exists())
        self.assertEqual(self.client.post(BASE+f"usuarios/{self.operador.pk}/password/", {"password": PASSWORD}, format="json").status_code, 400)
        for invalid in [0, True, 129, "12"]:
            self.assertEqual(self.client.put(BASE+"preferencias/", {"datos": {**datos, "minimo_password": invalid}, "motivo": "Inválido"}, format="json").status_code, 400)
        self.assertEqual(self.client.put(BASE+"preferencias/", {"datos": {**datos, "sql": "UPDATE"}, "motivo": "Inválido"}, format="json").status_code, 400)

    def test_errores_no_guardan_credenciales_ni_query(self):
        client = APIClient()
        client.post("/api/auth/login/?secreto=NoGuardar", {"username": "noexiste", "password": "NoGuardar"}, format="json")
        row = IncidenciaSistema.objects.get(estado=401)
        self.assertNotIn("NoGuardar", str(row.__dict__))
        self.assertNotIn("noexiste", str(row.__dict__))
        self.assertEqual(row.categoria, "Autenticación rechazada")
        self.assertEqual(self.client.patch(BASE+"errores/", {"id": row.pk, "motivo": "Se revisó el acceso"}, format="json").status_code, 200)
        row.refresh_from_db()
        self.assertTrue(row.resuelta)
        self.assertEqual(self.client.get(BASE+"errores/?pendientes=1").data["total"], 0)

    def test_cierra_sesiones_operador_sin_revelar_claves(self):
        browser = APIClient()
        self.assertTrue(browser.login(username="operador", password=PASSWORD))
        secret = browser.cookies["sessionid"].value
        response = self.client.get(BASE+"sesiones/")
        self.assertNotIn(secret, str(response.data))
        self.assertEqual(self.client.post(BASE+"sesiones/", {"usuario_id": self.operador.pk, "confirmacion": "CERRAR SESIONES", "motivo": "Prueba autorizada"}, format="json").status_code, 200)
        self.assertEqual(browser.get("/api/auth/usuario/").status_code, 401)
        self.assertFalse(Session.objects.filter(session_key=secret).exists())
        self.assertEqual(self.client.post(BASE+"sesiones/", {"usuario_id": self.root.pk, "confirmacion": "CERRAR SESIONES", "motivo": "Prueba"}, format="json").status_code, 403)

    def test_sesion_supera_limite_absoluto(self):
        browser = APIClient()
        self.assertEqual(browser.post("/api/auth/login/", {"username": "operador", "password": PASSWORD}, format="json").status_code, 200)
        session = browser.session
        session["talca_inicio"] = (timezone.now() - timedelta(hours=9)).timestamp()
        session.save()
        self.assertEqual(browser.get("/api/auth/usuario/").status_code, 401)

    def test_reportes_no_inventan_actividad_y_csv_seguro(self):
        self.assertEqual(self.client.get(BASE+"panel/").data["operaciones_auditadas"], 0)
        EventoAuditoria.objects.create(usuario="=SUM(1)", modulo="CAMBIOS", accion="Registrar")
        response = self.client.get(BASE+"reportes/")
        self.assertEqual(response.data["filas"][0]["cantidad"], 1)
        csv = self.client.get(BASE+"reportes/?formato=csv").content.decode("utf-8")
        self.assertIn("'=SUM(1)", csv)
        self.assertEqual(self.client.get(BASE+"reportes/?desde=2026-12-31&hasta=2026-01-01").status_code, 400)

    def test_alertas_aplican_reglas(self):
        for _ in range(5):
            IncidenciaSistema.objects.create(ruta="api/test/", metodo="GET", estado=500, categoria="Error de servidor")
        self.assertEqual(self.client.get(BASE+"alertas/").data["alertas"][0]["cantidad"], 5)
        PreferenciaAdministracion.objects.create(pk=1, datos={**DEFAULTS, "alertar_errores": False})
        self.assertEqual(self.client.get(BASE+"alertas/").data["alertas"], [])

    def test_diagnostico_no_expone_secretos_ni_afirma_backup_general(self):
        response = self.client.get(BASE+"estado/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["base"]["conexion"])
        self.assertIn("No verificado", response.data["respaldo_general"])
        for field in ["PASSWORD", "SECRET_KEY", "EMAIL_HOST_PASSWORD", "session_key"]:
            self.assertNotIn(field, str(response.data))
