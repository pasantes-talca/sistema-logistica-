from datetime import date
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import EntregaPersat
from .servicios import guardar_entregas, guardar_filas, resumen
from .test_dominio import entrega

TOKEN = "t" * 40
BASE = "/api/rechazos-preventa/"


def rechazo(identifier, movil="Quatro Sur S.A.", departamento="Capital", causa="Cerrado", otro=None,
            uid="C-1", fecha=date(2026, 10, 14), estado="NOT_DELIVERED"):
    return EntregaPersat.objects.create(
        id_entrega=identifier, uid_client=uid, nombre_cliente=f"Cliente {uid}", estado_final=estado,
        movil_asignado=movil, departamento=departamento, causa_no_entrega=causa, otro_motivo=otro, fecha_ruta=fecha)


class GuardarEntregasTests(TestCase):
    def test_crea_y_actualiza_por_id_entrega(self):
        self.assertEqual(guardar_entregas([entrega()]), 1)
        cambiada = entrega()
        cambiada["delivery_data"]["results"]["formvalues"]["FW_FINAL_STATE"] = "DELIVERED"
        guardar_entregas([cambiada])
        self.assertEqual(EntregaPersat.objects.count(), 1)
        self.assertEqual(EntregaPersat.objects.get().estado_final, "DELIVERED")

    def test_no_borra_fecha_ruta_ni_direccion_conocidas(self):
        guardar_entregas([entrega()])
        sin_datos = entrega(assignation_info={"device_name": "Quatro Sur S.A."})
        sin_datos["delivery_data"]["position"]["address"] = {}
        guardar_entregas([sin_datos])
        fila = EntregaPersat.objects.get()
        self.assertEqual(fila.fecha_ruta, date(2026, 10, 14))
        self.assertEqual(fila.direccion, "San Martín 100")


class ResumenTests(TestCase):
    def setUp(self):
        rechazo("1", causa="Cerrado", uid="A")
        rechazo("2", causa="Otro", otro="Sin acceso", uid="A")
        rechazo("3", movil="Leonardo Torres Chofer", departamento="Godoy Cruz", causa="Cerrado", uid="B")
        rechazo("4", departamento="Sin coordenadas validas", causa="", uid=None)
        rechazo("5", estado="DELIVERED")
        rechazo("6", movil="Otro móvil")
        rechazo("7", fecha=date(2026, 9, 30))

    def test_cuenta_por_departamento_movil_y_motivo(self):
        data = resumen(date(2026, 10, 1), date(2026, 10, 31))
        por_depto = {d["nombre"]: d for d in data["departamentos"]}
        self.assertEqual(len(por_depto), 18)
        self.assertEqual(por_depto["Capital"]["cantidad"], 2)
        self.assertEqual(por_depto["Capital"]["clientes"], 1)
        self.assertEqual(por_depto["Godoy Cruz"]["cantidad"], 1)
        self.assertEqual(data["total_mapa"], 3)
        self.assertEqual(data["sin_ubicacion"], 1)
        self.assertEqual(data["moviles"], {"Quatro Sur S.A.": 3, "Leonardo Torres Chofer": 1})
        motivos = {m["nombre"]: m["cantidad"] for m in data["motivos"]}
        self.assertEqual(motivos, {"Cerrado": 2, "Otro: Sin acceso": 1, "Sin razón informada": 1})
        self.assertEqual(data["motivo_principal"], "Cerrado")
        self.assertEqual(data["clientes"][0]["uid"], "A")
        self.assertEqual(data["clientes"][0]["cantidad"], 2)
        self.assertEqual(data["sin_uid"], 1)

    def test_filtra_por_movil(self):
        data = resumen(date(2026, 10, 1), date(2026, 10, 31), "Leonardo Torres Chofer")
        self.assertEqual(data["total_mapa"], 1)
        self.assertEqual(data["moviles"]["Quatro Sur S.A."], 3)

    def test_movil_invalido(self):
        with self.assertRaises(ValueError):
            resumen(date(2026, 10, 1), date(2026, 10, 31), "Desconocido")


class ComandosTests(TestCase):
    @patch("rechazos_preventa.management.commands.sincronizar_persat.iterar_paginas")
    def test_sincronizar_guarda_cada_pagina(self, paginas):
        segunda = entrega(_id="def456")
        paginas.return_value = iter([[entrega()], [segunda]])
        out = StringIO()
        call_command("sincronizar_persat", stdout=out)
        self.assertEqual(EntregaPersat.objects.count(), 2)
        self.assertIn("2", out.getvalue())

    def test_guardar_filas_de_migracion_es_idempotente(self):
        fila = {"id_entrega": "m1", "estado_final": "NOT_DELIVERED", "departamento": "Capital",
                "movil_asignado": "Quatro Sur S.A.", "fecha_ruta": date(2026, 10, 1), "columna_extra": "x"}
        self.assertEqual(guardar_filas([fila], aplicar=False), {"leidas": 1, "nuevas": 1, "actualizadas": 0})
        self.assertEqual(EntregaPersat.objects.count(), 0)
        guardar_filas([fila])
        self.assertEqual(guardar_filas([fila]), {"leidas": 1, "nuevas": 0, "actualizadas": 1})
        self.assertEqual(EntregaPersat.objects.count(), 1)


@override_settings(PERSAT_WEBHOOK_TOKEN=TOKEN)
class WebhookTests(TestCase):
    url = f"/api/webhooks/persat/{TOKEN}/"

    def post(self, body, url=None):
        return self.client.post(url or self.url, body, content_type="application/json")

    def test_token_invalido(self):
        self.assertEqual(self.post({}, "/api/webhooks/persat/" + "x" * 40 + "/").status_code, 403)

    @override_settings(PERSAT_WEBHOOK_TOKEN="corto")
    def test_token_configurado_demasiado_corto_rechaza_todo(self):
        self.assertEqual(self.post({}, "/api/webhooks/persat/corto/").status_code, 403)

    def test_ignora_otros_eventos(self):
        response = self.post({"eventType": "delivery.created", "payload": {"_id": "abc123"}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["estado"], "ignorado")

    def test_evento_sin_id(self):
        self.assertEqual(self.post({"eventType": "delivery.finished", "payload": {}}).status_code, 400)
        self.assertEqual(self.client.post(self.url, "no-json", content_type="application/json").status_code, 400)

    @patch("rechazos_preventa.views.obtener_entrega")
    def test_actualiza_la_entrega_consultando_persat(self, obtener):
        obtener.return_value = entrega()
        response = self.post({"eventType": "delivery.finished", "payload": {"_id": "abc123"}})
        self.assertEqual(response.status_code, 200)
        obtener.assert_called_once_with("abc123")
        self.assertTrue(EntregaPersat.objects.filter(id_entrega="abc123", departamento="Capital").exists())

    @patch("rechazos_preventa.views.obtener_entrega", side_effect=RuntimeError("Persat caído"))
    def test_falla_de_persat_pide_reintento(self, _):
        response = self.post({"eventType": "delivery.finished", "payload": {"_id": "abc123"}})
        self.assertEqual(response.status_code, 503)


class LecturaAPITests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.preventa = users.create_user("preventa")
        self.preventa.groups.add(Group.objects.get_or_create(name="RECHAZOS_PREVENTA")[0])
        self.otro = users.create_user("otro")
        self.otro.groups.add(Group.objects.get_or_create(name="RECHAZOS")[0])
        self.client = APIClient()
        rechazo("1")

    def test_requiere_el_modulo(self):
        self.client.force_authenticate(self.otro)
        self.assertEqual(self.client.get(BASE + "resumen/").status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(BASE + "resumen/").status_code, {401, 403})

    def test_resumen_con_rango(self):
        self.client.force_authenticate(self.preventa)
        response = self.client.get(BASE + "resumen/", {"desde": "2026-10-01", "hasta": "2026-10-31"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total_mapa"], 1)

    def test_resumen_fechas_invalidas(self):
        self.client.force_authenticate(self.preventa)
        self.assertEqual(self.client.get(BASE + "resumen/", {"desde": "ayer"}).status_code, 400)
        self.assertEqual(self.client.get(BASE + "resumen/", {"desde": "2026-10-31", "hasta": "2026-10-01"}).status_code, 400)
        self.assertEqual(self.client.get(BASE + "resumen/", {"movil": "Nadie"}).status_code, 400)

    def test_resumen_no_oculta_errores_internos_como_400(self):
        self.client.force_authenticate(self.preventa)
        self.client.raise_request_exception = False
        with patch("rechazos_preventa.views.resumen", side_effect=ValueError("bug interno")):
            response = self.client.get(BASE + "resumen/", {"desde": "2026-10-01", "hasta": "2026-10-31"})
        self.assertEqual(response.status_code, 500)

    def test_revision_cambia_al_guardar(self):
        self.client.force_authenticate(self.preventa)
        antes = self.client.get(BASE + "revision/").json()["revision"]
        guardar_entregas([entrega()])
        self.assertNotEqual(self.client.get(BASE + "revision/").json()["revision"], antes)

    def test_mapa_devuelve_geojson(self):
        self.client.force_authenticate(self.preventa)
        response = self.client.get(BASE + "mapa/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["features"]), 18)
