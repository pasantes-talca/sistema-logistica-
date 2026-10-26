from datetime import date
from decimal import Decimal
from io import BytesIO
from unittest.mock import patch
from importlib import import_module
from django.apps import apps
from django.db import connection

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from openpyxl import load_workbook

from core.models import AccesoAcciones, EventoAuditoria
from maestros.models import Empleado
from .models import ControlKilometraje, DestinoKilometraje
from .planilla import excel, pdf


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", DEFAULT_FROM_EMAIL="pruebas@example.test")
class PlanillaTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("operador-km", password="solo-pruebas")
        self.user.groups.add(Group.objects.get_or_create(name="KILOMETRAJES")[0])
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.chofer = Empleado.objects.create(nombre="OLGUIN", puesto="Chofer 1ra. Categoria")
        self.sharp = DestinoKilometraje.objects.get(nombre="Sharp / Mai-Gua")
        self.gatica = DestinoKilometraje.objects.get(nombre="Gatica / C. Araujo")
        self.marthos = DestinoKilometraje.objects.get(nombre="Marthos / Luján")
        self.porro = DestinoKilometraje.objects.get(nombre="Porro")
        self.datos = {"chofer": self.chofer.pk, "fecha_desde": "2026-08-26", "fecha_hasta": "2026-09-25", "registros": [
            {"fecha": "2026-08-27", "destino": self.sharp.pk, "cantidad_viajes": 29},
            {"fecha": "2026-09-05", "destino": self.gatica.pk, "cantidad_viajes": 2},
            {"fecha": "2026-09-12", "destino": self.marthos.pk, "cantidad_viajes": 1},
            {"fecha": "2026-09-01", "destino": self.porro.pk, "cantidad_viajes": 1},
        ]}

    def crear(self, datos=None):
        r = self.client.post("/api/kilometrajes/", datos or self.datos, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def finalizar(self, c, **extras):
        return self.client.post(f'/api/kilometrajes/{c["id"]}/finalizar/', {"version": c["version"], "confirmar": True, **extras}, format="json")

    def modificar(self, c, **extras):
        return self.client.put(f'/api/kilometrajes/{c["id"]}/', {**self.datos, "version": c["version"], "motivo_correccion": "Completar viajes", **extras}, format="json")

    def test_creacion_detalle_lista_y_total_ejemplo(self):
        c = self.crear()
        self.assertEqual(c["total_km"], "415.00")
        self.assertEqual(c["estado"], "BORRADOR")
        self.assertEqual(len(c["columnas"]), 9)
        self.assertEqual(Decimal(next(d["distancia_km"] for d in c["columnas"] if d["id"] == self.sharp.pk)), 5)
        self.assertEqual(self.client.get(f'/api/kilometrajes/{c["id"]}/').data["registros"], c["registros"])
        self.assertEqual(len(self.client.get("/api/kilometrajes/?chofer=%s&fecha_desde=2026-08-26&fecha_hasta=2026-09-25" % self.chofer.pk).data), 1)
        self.assertEqual([d["id"] for d in self.client.get("/api/kilometrajes/destinos/").data], [d["id"] for d in c["columnas"]])

    def test_preparacion_preserva_controles_anteriores_y_es_idempotente(self):
        self.sharp.distancia_km = 20
        self.sharp.save()
        c = self.crear()
        ControlKilometraje.objects.filter(pk=c["id"]).update(columnas=[])
        preparar = import_module("kilometrajes.migrations.0003_destinos_planilla").preparar
        preparar(apps, connection.schema_editor())
        preparar(apps, connection.schema_editor())
        control = ControlKilometraje.objects.get()
        self.sharp.refresh_from_db()
        self.assertEqual(self.sharp.distancia_km, 5)
        self.assertEqual(control.total_km, 850)
        self.assertEqual(next(d["distancia_km"] for d in control.columnas if d["id"] == self.sharp.pk), "20.00")
        self.assertEqual(DestinoKilometraje.objects.count(), 9)

    def test_duplicado_no_crea_otra_planilla(self):
        self.crear()
        r = self.client.post("/api/kilometrajes/", self.datos, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(ControlKilometraje.objects.count(), 1)

    def test_correccion_version_auditoria_y_distancias_congeladas(self):
        c = self.crear()
        self.sharp.distancia_km = 20
        self.sharp.activo = False
        self.sharp.save()
        r = self.modificar(c, observaciones="Viajes completos")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["total_km"], "415.00")
        self.assertEqual(r.data["version"], 2)
        evento = EventoAuditoria.objects.filter(accion="Corregir").last()
        self.assertTrue(evento.antes["registros"])
        self.assertEqual(self.modificar(c).status_code, 409)
        self.assertEqual(ControlKilometraje.objects.get().version, 2)

    def test_no_cambia_identidad_ni_periodo(self):
        c = self.crear()
        self.assertEqual(self.modificar(c, fecha_hasta="2026-09-26").status_code, 400)
        self.assertEqual(self.modificar(c, motivo_correccion="").status_code, 400)

    def test_validacion_celdas_y_atomicidad(self):
        c = self.crear()
        for registros in [self.datos["registros"]*2,
                [{"fecha": "2026-10-01", "destino": self.sharp.pk, "cantidad_viajes": 1}],
                [{"fecha": "2026-09-01", "destino": self.sharp.pk, "cantidad_viajes": -1}],
                [{"fecha": "2026-09-01", "destino": self.sharp.pk, "cantidad_viajes": 1.5}]]:
            self.assertEqual(self.modificar(c, registros=registros).status_code, 400)
        self.assertEqual(ControlKilometraje.objects.get().total_km, Decimal("415"))
        self.assertEqual(ControlKilometraje.objects.get().version, 1)

    def test_limite_periodo_y_borrador_vacio(self):
        self.assertEqual(self.client.post("/api/kilometrajes/", {**self.datos, "fecha_hasta": "2028-01-01"}, format="json").status_code, 400)
        c = self.crear({**self.datos, "registros": []})
        self.assertEqual(c["total_km"], "0.00")

    def test_excel_y_pdf_misma_matriz_y_formulas(self):
        c = self.crear()
        control = ControlKilometraje.objects.get(pk=c["id"])
        w = load_workbook(BytesIO(excel(control)))
        s = w.active
        self.assertEqual(s["G5"].value, 5)
        self.assertEqual(s["A12"].value.date(), date(2026, 8, 31))
        self.assertEqual(s["G38"].value, "=SUM(G7:G37)*G5")
        self.assertEqual(s["I40"].value, "=SUM(B38:J38)")
        self.assertEqual(s.freeze_panes, "B7")
        documento = pdf(control)
        self.assertTrue(documento.startswith(b"%PDF-"))
        self.assertIn(b"/Count 1", documento)
        for fmt, tipo in [("xlsx", "spreadsheetml"), ("pdf", "application/pdf")]:
            r = self.client.get(f'/api/kilometrajes/{c["id"]}/exportar/{fmt}/')
            self.assertEqual(r.status_code, 200)
            self.assertIn(tipo, r["Content-Type"])
        self.assertEqual(self.client.get(f'/api/kilometrajes/{c["id"]}/exportar/txt/').status_code, 400)

    def test_finalizar_adjunta_dos_archivos_y_no_duplica(self):
        c = self.crear()
        r = self.finalizar(c)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["envio_estado"], "ENVIADO")
        self.assertEqual(r.data["estado"], "FINALIZADA")
        self.assertEqual(mail.outbox[0].to, ["pasantes@talca.com.ar"])
        self.assertEqual(len(mail.outbox[0].attachments), 2)
        self.assertEqual(mail.outbox[0].attachments[0].filename, f'kilometraje-{c["id"]}.xlsx')
        self.assertEqual(mail.outbox[0].attachments[1].content[:5], b"%PDF-")
        self.assertEqual(self.finalizar(c).status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_correccion_de_finalizada_requiere_nuevo_envio(self):
        c = self.crear()
        self.finalizar(c)
        r = self.modificar(c, observaciones="Corrección posterior")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["estado"], "BORRADOR")
        self.assertEqual(r.data["envio_estado"], "PENDIENTE")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.finalizar(c).status_code, 409)
        self.assertEqual(self.finalizar(r.data).status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

    def test_fallo_smtp_preserva_datos_y_permite_reintento_explicito(self):
        c = self.crear()
        with patch("kilometrajes.documentos_views.EmailMessage.send", side_effect=OSError("simulado")), self.assertLogs("kilometrajes.documentos_views", level="ERROR"):
            self.assertEqual(self.finalizar(c).status_code, 502)
        control = ControlKilometraje.objects.get()
        self.assertEqual(control.envio_estado, "ERROR")
        self.assertEqual(control.total_km, 415)
        self.assertEqual(self.finalizar(c).status_code, 200)

    def test_enviando_bloquea_edicion_y_duplicados(self):
        c = self.crear()
        ControlKilometraje.objects.update(envio_estado="ENVIANDO")
        self.assertEqual(self.modificar(c).status_code, 400)
        self.assertEqual(self.finalizar(c).status_code, 409)

    def test_permisos_modulo_y_exportacion(self):
        c = self.crear()
        AccesoAcciones.objects.create(usuario=self.user, permisos={"KILOMETRAJES": ["consultar"]})
        self.assertEqual(self.finalizar(c).status_code, 403)
        self.assertEqual(self.client.get(f'/api/kilometrajes/{c["id"]}/exportar/pdf/').status_code, 403)
        self.assertEqual(self.modificar(c).status_code, 403)
        self.assertEqual(self.client.get(f'/api/kilometrajes/{c["id"]}/').status_code, 200)
        self.user.groups.clear()
        self.assertEqual(self.client.get(f'/api/kilometrajes/{c["id"]}/').status_code, 403)
