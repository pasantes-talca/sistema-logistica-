from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from rechazos_preventa.models import EntregaPersat
from .services import formatear_respuesta, preguntar_gemini
from .tools import consultar_rechazos_preventa


def interpretacion(accion="resumen", **extra):
    base = {"tipo": "rechazos_preventa", "accion": accion, "desde": "2026-10-01", "hasta": "2026-10-31", "movil": None}
    base.update(extra)
    return base


def crear(identifier, departamento="Capital", causa="Cerrado", uid="A", movil="Quatro Sur S.A."):
    EntregaPersat.objects.create(id_entrega=identifier, estado_final="NOT_DELIVERED", movil_asignado=movil,
                                 departamento=departamento, causa_no_entrega=causa, uid_client=uid,
                                 nombre_cliente=f"Cliente {uid}", fecha_ruta=date(2026, 10, 10))


class ConsultarRechazosPreventaTests(TestCase):
    def setUp(self):
        crear("1")
        crear("2", departamento="Maipú", causa="Sin dinero", uid="B", movil="Leonardo Torres Chofer")
        crear("3", causa="Sin dinero")

    def test_resume_el_periodo(self):
        datos = consultar_rechazos_preventa("2026-10-01", "2026-10-31")
        self.assertEqual(datos["total"], 3)
        self.assertEqual(datos["por_departamento"][0], {"departamento": "Capital", "cantidad": 2})
        self.assertEqual(datos["motivos"][0], {"nombre": "Sin dinero", "cantidad": 2})
        self.assertEqual(datos["por_movil"]["Quatro Sur S.A."], 2)
        self.assertEqual(datos["clientes"][0]["uid"], "A")

    def test_sin_fechas_toma_todo_el_historico(self):
        self.assertEqual(consultar_rechazos_preventa()["total"], 3)

    def test_fecha_invalida_del_llm_no_rompe(self):
        datos = consultar_rechazos_preventa("no-es-fecha", "2026-13-45")
        self.assertEqual(datos["total"], 3)
        self.assertEqual(datos["desde"], "2000-01-01")

    def test_formatea_cada_accion(self):
        datos = consultar_rechazos_preventa("2026-10-01", "2026-10-31")
        self.assertIn("3 rechazos de preventa", formatear_respuesta(interpretacion(), datos))
        self.assertIn("Sin dinero", formatear_respuesta(interpretacion("motivo_frecuente"), datos))
        self.assertIn("Capital", formatear_respuesta(interpretacion("por_departamento"), datos))
        self.assertIn("Cliente A", formatear_respuesta(interpretacion("por_cliente"), datos))
        self.assertIn("Quatro Sur S.A.", formatear_respuesta(interpretacion("por_movil"), datos))

    def test_sin_datos(self):
        datos = consultar_rechazos_preventa("2020-01-01", "2020-01-31")
        self.assertIn("No se encontraron rechazos de preventa", formatear_respuesta(interpretacion(), datos))


class PermisoAsistenteTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.con_modulo = users.create_user("con")
        self.con_modulo.groups.add(*[Group.objects.get_or_create(name=g)[0] for g in ("ASISTENTE", "RECHAZOS_PREVENTA")])
        self.sin_modulo = users.create_user("sin")
        self.sin_modulo.groups.add(Group.objects.get_or_create(name="ASISTENTE")[0])
        crear("1")

    @patch("asistente.services.interpretar_pregunta", return_value=interpretacion())
    def test_sin_el_modulo_no_ve_datos(self, _):
        resultado = preguntar_gemini("¿rechazos de preventa?", usuario=self.sin_modulo)
        self.assertIn("No tenés acceso", resultado["respuesta"])
        self.assertEqual(resultado["datos"], {})

    @patch("asistente.services.interpretar_pregunta", return_value=interpretacion())
    def test_con_el_modulo_responde(self, _):
        resultado = preguntar_gemini("¿rechazos de preventa?", usuario=self.con_modulo)
        self.assertEqual(resultado["datos"]["total"], 1)

    @patch("asistente.services.interpretar_pregunta", return_value=interpretacion())
    def test_la_vista_pasa_el_usuario(self, _):
        client = APIClient()
        client.force_authenticate(self.sin_modulo)
        response = client.post("/api/asistente/preguntar/",{"pregunta": "¿rechazos de preventa?"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("No tenés acceso", response.json()["respuesta"])


class ErroresInternosTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user("asis")
        user.groups.add(Group.objects.get_or_create(name="ASISTENTE")[0])
        self.client = APIClient()
        self.client.force_authenticate(user)

    def preguntar(self):
        return self.client.post("/api/asistente/preguntar/", {"pregunta": "hola"}, format="json")

    @patch("asistente.views.preguntar_gemini", side_effect=RuntimeError("password=hunter2 host=db.interno"))
    def test_error_inesperado_no_filtra_detalle(self, _):
        with self.assertLogs("asistente.views", level="ERROR"):
            response = self.preguntar()
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("hunter2", response.content.decode())
        self.assertIn("error", response.json())

    @patch("asistente.views.preguntar_gemini", side_effect=RuntimeError("429 quota exceeded"))
    def test_limite_de_cuota_sigue_siendo_429(self, _):
        with self.assertLogs("asistente.views", level="ERROR"):
            response = self.preguntar()
        self.assertEqual(response.status_code, 429)
