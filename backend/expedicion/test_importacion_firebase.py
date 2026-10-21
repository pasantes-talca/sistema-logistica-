from copy import deepcopy
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from maestros.models import Producto
from .firebase_preparacion import preparar
from .importacion_firebase import cargar
from .models import OrdenCarga, StockProducto, RespaldoExpedicion, EmpleadoExpedicion
from .operativa import snapshot
from .respaldos import MODELOS


def fuente():
    return {"app": "Talca Expedición", "schemaVersion": 1, "exportedAt": "2026-10-20T15:45:55Z", "data": {
        "products": [{"id": "417", "name": "Soda 500 ml", "pack": 12, "perCut": 20, "cuts": 7}],
        "stock": {"417": 100}, "stockBuckets": {"417": {"preventa": 0, "sinCodificar": 0}},
        "fleteros": [], "users": [{"id": "u1", "username": "pablo", "password": "NO-IMPORTAR-CLAVE"}],
        "employees": [{"id": "e1", "legajo": "00001", "name": "Julieta", "surname": "Aparicio", "active": False, "balance": 0},
                      {"id": "e2", "legajo": "00001", "name": "Julieta", "surname": "Aparicio", "active": True, "balance": 2}],
        "orders": [{"id": "o1", "number": "OC-1", "date": "2026-08-01", "createdAt": "2026-08-20T10:00:00Z", "createdBy": "Pablo Villarruel", "createdShift": "Mañana",
            "fleteroId": "f1", "carrierSnapshot": {"id": "f1", "name": "Fletero histórico", "company": "Empresa"}, "pendingType": "immediate", "status": "Despachada",
            "requestLines": [{"productId": "4171", "total": 24, "resolvedTotal": 24}, {"productId": "BIDON", "total": 2, "resolvedTotal": 2}],
            "deliveries": [{"date": "2026-08-20T10:30:00Z", "user": "Pablo Villarruel", "shift": "Mañana", "lines": [{"productId": "4171", "total": 24}, {"productId": "BIDON", "total": 2}]}]}],
        "movements": [{"id": "m1", "date": "2026-08-20T10:30:00Z", "user": "Pablo Villarruel", "type": "Orden de carga", "dir": "out", "ref": "OC-1", "productId": "4171", "total": 24},
                      {"id": "m2", "date": "2026-08-20T10:30:00Z", "type": "Orden de carga", "dir": "out", "ref": "OC-1", "productId": "BIDON", "total": 2}],
        "materialMoves": [], "counts": [], "audit": [], "counters": {"CE": 33, "AE": 55}}}


class ImportacionFirebaseTests(TestCase):
    def setUp(self):
        for model in reversed(MODELOS):
            model.objects.all().delete()
        Producto.objects.filter(codigo__in=["BIDON", "4171"]).delete()
        self.actor = get_user_model().objects.create_superuser("arielgarro", password=None)

    def test_normaliza_sin_mutar_fuente_ni_sumar_saldos(self):
        original = fuente()
        unchanged = deepcopy(original)
        clean, report = preparar(original)
        self.assertEqual(original, unchanged)
        self.assertNotIn("NO-IMPORTAR-CLAVE", str(clean))
        self.assertEqual(len(clean["data"]["employees"]), 1)
        self.assertEqual(clean["data"]["employees"][0]["balance"], 2)
        self.assertEqual(len(report["fleteros_recuperados"]), 1)
        historical = {p["id"]: p for p in clean["data"]["products"] if p.get("historicalOnly")}
        self.assertEqual(historical["4171"]["pack"], 12)
        self.assertEqual(historical["BIDON"]["pack"], 1)
        self.assertFalse(historical["4171"]["active"])

    def test_importa_fechas_cantidades_autores_sin_cambiar_cuentas(self):
        existing = Producto.objects.create(codigo="417", nombre="Nombre compartido", familia="SODA") if not Producto.objects.filter(codigo="417").exists() else Producto.objects.get(codigo="417")
        original_name = existing.nombre
        result = cargar(fuente(), self.actor, "a"*64)
        self.assertEqual(result["validacion"]["ordenes"], 1)
        self.assertEqual(StockProducto.objects.get(producto__codigo="417").cantidad_unidades, 100)
        self.assertFalse(StockProducto.objects.filter(producto__codigo__in=["4171", "BIDON"]).exists())
        self.assertFalse(Producto.objects.get(codigo="BIDON").activo)
        self.assertEqual(EmpleadoExpedicion.objects.get(legajo="00001").saldo_fardos, 2)
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertEqual(OrdenCarga.objects.get().fecha.isoformat(), "2026-08-01")
        self.assertEqual(OrdenCarga.objects.get().creado_en.isoformat(), "2026-08-20T10:00:00+00:00")
        data = snapshot(self.actor)
        self.assertEqual(data["ordenes"][0]["creado_por_nombre"], "Pablo Villarruel")
        self.assertEqual(next(m for m in data["movimientos"] if m["referencia"] == "OC-1" and m["usuario"])["usuario"], "Pablo Villarruel")
        existing.refresh_from_db()
        self.assertEqual(existing.nombre, original_name)
        for backup in RespaldoExpedicion.objects.all():
            self.assertNotIn("NO-IMPORTAR-CLAVE", str(backup.datos))

    def test_legajo_ambiguo_se_rechaza(self):
        data = fuente()
        data["data"]["employees"][0]["balance"] = 3
        with self.assertRaises(ValidationError):
            preparar(data)

    def test_producto_desconocido_no_se_inventa(self):
        data = fuente()
        data["data"]["movements"][0]["productId"] = "DESCONOCIDO"
        with self.assertRaises(ValidationError):
            preparar(data)

    def test_fletero_sin_snapshot_no_se_inventa(self):
        data = fuente()
        data["data"]["orders"][0].pop("carrierSnapshot")
        with self.assertRaises(ValidationError):
            preparar(data)

    def test_carga_repetida_no_duplica_y_no_reemplaza_operaciones(self):
        cargar(fuente(), self.actor, "a"*64)
        with self.assertRaises(ValidationError):
            cargar(fuente(), self.actor, "a"*64)
        with self.assertRaises(ValidationError):
            cargar(fuente(), self.actor, "b"*64)
        self.assertEqual(OrdenCarga.objects.count(), 1)

    def test_error_de_validacion_revierte_toda_la_carga(self):
        before = Producto.objects.count()
        with patch("expedicion.importacion_firebase.comprobar", side_effect=ValidationError("Diferencia detectada")):
            with self.assertRaises(ValidationError):
                cargar(fuente(), self.actor, "a"*64)
        self.assertFalse(OrdenCarga.objects.exists())
        self.assertFalse(RespaldoExpedicion.objects.exists())
        self.assertEqual(Producto.objects.count(), before)
