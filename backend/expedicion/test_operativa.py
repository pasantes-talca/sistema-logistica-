import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient
from .models import (Fletero, StockProducto, ConfiguracionProducto, MovimientoStock,
    OrdenCarga, AuditoriaExpedicion, EmpleadoExpedicion, ComprobanteEmpleado, ConteoExpedicion)
from maestros.models import Producto


class OperativaTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="operador", password="test")
        self.user.groups.add(Group.objects.get_or_create(name="EXPEDICION")[0])
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.p = Producto.objects.get(codigo="5670")
        self.q = Producto.objects.get(codigo="5680")
        self.f = Fletero.objects.create(nombre="Transporte")
        StockProducto.objects.create(producto=self.p, cantidad_unidades=100)
        StockProducto.objects.create(producto=self.q, cantidad_unidades=100)

    def post(self, accion, expected=200, **data):
        response = self.client.post("/api/expedicion/operativa/", {"accion": accion, "turno": "Mañana", "clave": str(uuid.uuid4()), **data}, format="json")
        self.assertEqual(response.status_code, expected, response.data)
        return response.data

    def line(self, packs=2, units=0, p=None, **extra):
        return {"producto": (p or self.p).pk, "packs": packs, "unidades": units, **extra}

    def order(self, **kw):
        result = self.post("orden", numero="OC-1", fecha="2026-10-09", fletero=self.f.pk,
            circuito=kw.pop("circuito", "preventa"), lineas=[self.line()], **kw)
        return OrdenCarga.objects.get(pk=result["id"])

    def stock(self, p=None):
        return StockProducto.objects.get(producto=p or self.p).cantidad_unidades

    def test_order_only_reserves_and_delivery_decrements(self):
        o = self.order()
        self.assertEqual(self.stock(), 100)
        snapshot = self.client.get("/api/expedicion/operativa/").data
        p = next(p for p in snapshot["productos"] if p["id"] == self.p.pk)
        self.assertEqual(p["pendientes"]["preventa"], 12)
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.line(1, 3)])
        self.assertEqual(self.stock(), 91)
        o.refresh_from_db()
        self.assertEqual(o.estado, "PARCIAL")

    def test_substitution_keeps_original_pending(self):
        o = self.order()
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.line(p=self.q, solicitado=self.p.pk)])
        self.assertEqual(self.stock(self.q), 88)
        result = self.client.get("/api/expedicion/operativa/").data["ordenes"][0]
        self.assertEqual(result["detalles"][0]["pendiente"], 12)
        self.assertEqual(result["estado_operativo"], "Pendiente de definición")

    def test_correct_after_delivery_preserves_history(self):
        o = self.order()
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.line(1)])
        o.refresh_from_db()
        self.post("orden", id=o.pk, version=o.version, numero=o.numero, fecha=str(o.fecha), fletero=self.f.pk,
            circuito="preventa", motivo="Pedido ampliado", lineas=[self.line(3)])
        self.assertEqual(o.entregas.count(), 1)
        self.assertEqual(self.stock(), 94)
        self.assertTrue(AuditoriaExpedicion.objects.filter(accion="Corregir orden").exists())

    def test_immediate_correction_compensates_and_preserves_deliveries(self):
        o = self.order(circuito="immediate")
        self.assertEqual(self.stock(), 88)
        self.post("orden", id=o.pk, version=o.version, numero=o.numero, fletero=self.f.pk, circuito="immediate",
            fecha=str(o.fecha), motivo="Corrección física", lineas=[self.line(1)], entregado=[self.line(1)])
        self.assertEqual(self.stock(), 94)
        self.assertEqual(o.entregas.count(), 2)
        self.assertEqual(MovimientoStock.objects.filter(tipo="CORRECCION", direccion="ENTRADA").get().cantidad, 6)
        o.refresh_from_db()
        self.post("anular", id=o.pk, version=o.version, motivo="Anulación")
        self.assertEqual(self.stock(), 100)
        self.assertEqual(o.entregas.count(), 2)

    def test_shortage_rolls_back_all_products(self):
        self.post("movimiento", expected=400, tipo="BUFFET", lineas=[self.line(1), self.line(100, p=self.q)])
        self.assertEqual(self.stock(), 100)
        self.assertEqual(MovimientoStock.objects.count(), 0)

    def test_uncoded_stock_cannot_be_dispatched(self):
        self.post("movimiento", tipo="PRODUCCION_SIN_CODIFICAR", lineas=[self.line(10)])
        self.assertEqual(self.stock(), 160)
        self.post("movimiento", expected=400, tipo="BUFFET", lineas=[self.line(20)], justificacion="No debe habilitar sin codificar")
        self.assertEqual(self.stock(), 160)

    def test_substitutions_share_actual_product_without_integrity_error(self):
        r = self.post("orden", numero="OC-MIX", fletero=self.f.pk, circuito="preventa", lineas=[self.line(1), self.line(1, p=self.q)])
        o = OrdenCarga.objects.get(pk=r["id"])
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.line(1, solicitado=self.p.pk), self.line(1, solicitado=self.q.pk)])
        self.assertEqual(self.stock(), 88)
        self.assertEqual(o.entregas.get().detalles.count(), 2)

    def test_receipt_numbers_have_separate_sequences(self):
        e = EmpleadoExpedicion.objects.create(legajo="1", nombre="Empleado", saldo_fardos=4)
        for tipo in ("CONSUMO", "ANTICIPO", "CONSUMO"):
            self.post("consumo", empleado=e.pk, tipo=tipo, lineas=[self.line(1)])
        self.assertEqual(list(ComprobanteEmpleado.objects.filter(tipo="CONSUMO").values_list("numero", flat=True)), [1, 2])
        self.assertEqual(ComprobanteEmpleado.objects.get(tipo="ANTICIPO").numero, 1)

    def test_creator_shift_survives_correction(self):
        o = self.order()
        self.post("orden", id=o.pk, version=o.version, numero=o.numero, fletero=self.f.pk, circuito="preventa", turno="Tarde",
            motivo="Cambio de cantidad", lineas=[self.line(3)])
        o.refresh_from_db()
        self.assertEqual(o.turno, "Mañana")
        self.assertEqual(AuditoriaExpedicion.objects.filter(accion="Corregir orden").get().turno, "Tarde")

    def test_immediate_material_correction_is_compensated(self):
        from .models import MovimientoMaterial
        o = self.order(circuito="immediate", pallets_salida=3, chapadur_salida=4)
        self.post("orden", id=o.pk, version=o.version, numero=o.numero, fletero=self.f.pk, circuito="immediate",
            motivo="Se corrigieron materiales", lineas=[self.line(2)], pallets_salida=2, chapadur_salida=2)
        ms = MovimientoMaterial.objects.filter(orden=o)
        self.assertEqual(sum(m.pallets_salida - m.pallets_entrada for m in ms), 2)
        self.assertEqual(sum(m.chapadur_salida - m.chapadur_entrada for m in ms), 2)
        o.refresh_from_db()
        self.post("anular", id=o.pk, version=o.version, motivo="Revertir orden y materiales")
        self.assertEqual(sum(m.pallets_salida - m.pallets_entrada for m in MovimientoMaterial.objects.filter(orden=o)), 0)

    def test_delivery_above_requested_records_physical_and_clamps_resolved(self):
        o = self.order()
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.line(3)])
        self.assertEqual(self.stock(), 82)
        detail = self.client.get("/api/expedicion/operativa/").data["ordenes"][0]["detalles"][0]
        self.assertEqual(detail["resuelto"], 12)
        self.assertEqual(detail["pendiente"], 0)

    def test_spill_has_no_stock_impact(self):
        self.post("movimiento", tipo="DERRAME", lineas=[self.line(2)])
        self.assertEqual(self.stock(), 100)
        self.assertTrue(MovimientoStock.objects.get().sin_impacto)

    def test_idempotency(self):
        key = str(uuid.uuid4())
        self.post("movimiento", clave=key, tipo="PRODUCCION", lineas=[self.line(1)])
        self.post("movimiento", clave=key, tipo="PRODUCCION", lineas=[self.line(1)])
        self.assertEqual(self.stock(), 106)
        self.assertEqual(MovimientoStock.objects.count(), 1)

    def test_stale_order_rejected(self):
        o = self.order()
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.line(1)])
        self.post("entrega", expected=400, id=o.pk, version=o.version, lineas=[self.line(1)])
        self.assertEqual(self.stock(), 94)

    def test_employee_benefit_and_advance(self):
        e = EmpleadoExpedicion.objects.create(legajo="1", nombre="Empleado")
        self.post("acreditar", motivo="Acreditación del mes")
        self.post("consumo", empleado=e.pk, tipo="CONSUMO", lineas=[self.line(1)])
        e.refresh_from_db()
        self.assertEqual(e.saldo_fardos, 1)
        self.post("consumo", empleado=e.pk, tipo="ANTICIPO", lineas=[self.line(0, 2)])
        e.refresh_from_db()
        self.assertEqual(e.saldo_fardos, 1)
        self.assertEqual(self.stock(), 92)
        self.assertEqual(ComprobanteEmpleado.objects.count(), 2)
        self.post("consumo", expected=400, empleado=e.pk, tipo="CONSUMO", lineas=[self.line(0, 1)])

    def test_count_does_not_adjust_and_requires_other_shift(self):
        self.post("conteo", tipo="Cierre de turno", lineas=[self.line(10)])
        self.assertEqual(self.stock(), 100)
        c = ConteoExpedicion.objects.get()
        self.assertEqual(c.lineas[0]["diferencia"], -40)
        self.post("corroborar", expected=400, id=c.pk)
        self.post("corroborar", id=c.pk, turno="Tarde")
        c.refresh_from_db()
        self.assertIsNotNone(c.corroborado_en)

    def test_invalid_numeric_input(self):
        for qty in ("NaN", "Infinity", -1, 1.5):
            self.post("movimiento", expected=400, tipo="PRODUCCION", lineas=[self.line(qty)])
        self.assertEqual(self.stock(), 100)

    def test_authentication_and_module_permission(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/expedicion/operativa/").status_code, (401, 403))
        other = get_user_model().objects.create_user(username="other")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get("/api/expedicion/operativa/").status_code, 403)

    def test_nonadmin_cannot_manage_users(self):
        self.post("usuario", expected=403, username="nuevo", nombre="Nuevo", password="Strong-password-123")

    def test_backup_restore_atomic_with_previous_copy(self):
        from .models import RespaldoExpedicion
        self.user.is_superuser = True
        self.user.save()
        o = self.order(circuito="immediate")
        backup = self.client.get("/api/expedicion/respaldos/").data
        self.post("movimiento", tipo="PRODUCCION", lineas=[self.line(1)])
        preview = self.client.post("/api/expedicion/respaldos/", {"archivo": backup}, format="json")
        self.assertEqual(preview.status_code, 200)
        restored = self.client.post("/api/expedicion/respaldos/", {"archivo": backup, "revision": preview.data["revision"], "confirmacion": "RESTAURAR"}, format="json")
        self.assertEqual(restored.status_code, 200, restored.data)
        self.assertEqual(self.stock(), 88)
        self.assertEqual(OrdenCarga.objects.get(pk=o.pk).numero, "OC-1")
        self.assertEqual(RespaldoExpedicion.objects.count(), 1)

    def test_bad_restore_does_not_delete_live_data(self):
        self.user.is_superuser = True
        self.user.save()
        self.order()
        backup = self.client.get("/api/expedicion/respaldos/").data
        next(r for r in backup["registros"] if r["model"] == "expedicion.ordencarga")["fields"]["fletero"] = 999999
        preview = self.client.post("/api/expedicion/respaldos/", {"archivo": backup}, format="json")
        result = self.client.post("/api/expedicion/respaldos/", {"archivo": backup, "revision": preview.data["revision"], "confirmacion": "RESTAURAR"}, format="json")
        self.assertEqual(result.status_code, 400, result.data)
        self.assertEqual(OrdenCarga.objects.count(), 1)
        self.assertEqual(self.stock(), 100)

    def test_firebase_import_preserves_units_pending_and_receipt(self):
        self.user.is_superuser = True
        self.user.save()
        data = {"counters": {"CE": 40, "AE": 12}, "products": [{"id": "5670", "name": "Cola", "pack": 6, "perCut": 15, "cuts": 4}],
            "stock": {"5670": 90}, "stockBuckets": {"5670": {"preventa": 6, "sinCodificar": 12}},
            "fleteros": [{"id": "f1", "name": "Transportista"}], "employees": [{"id": "e1", "legajo": "100", "name": "Empleado", "balance": 3}],
            "orders": [{"id": "o1", "number": "OC-IMPORTED", "date": "2026-10-13", "createdAt": "2026-10-13T10:00:00Z", "fleteroId": "f1", "pendingType": "preventa",
                "requestLines": [{"productId": "5670", "total": 12, "resolvedTotal": 6}],
                "deliveries": [{"date": "2026-10-13T12:00:00Z", "lines": [{"productId": "5670", "total": 6}]}]}],
            "movements": [{"id": "m1", "type": "Consumo de empleado", "productId": "5670", "dir": "out", "ref": "100", "receiptNumber": "CE-000004", "total": 6, "date": "2026-10-13T10:00:00Z"}]}
        payload = {"app": "Talca Expedición", "data": data}
        preview = self.client.post("/api/expedicion/respaldos/", {"archivo": payload}, format="json")
        self.assertEqual(preview.status_code, 200, preview.data)
        restored = self.client.post("/api/expedicion/respaldos/", {"archivo": payload, "revision": preview.data["revision"], "confirmacion": "RESTAURAR"}, format="json")
        self.assertEqual(restored.status_code, 200, restored.data)
        result = self.client.get("/api/expedicion/operativa/").data
        p = next(p for p in result["productos"] if p["codigo"] == "5670")
        self.assertEqual(p["stock"], 90)
        self.assertEqual(p["sin_codificar"], 12)
        self.assertEqual(p["pendientes"]["preventa"], 6)
        self.assertEqual(result["comprobantes"][0]["numero"], "CE-000004")
        e = EmpleadoExpedicion.objects.get(legajo="100")
        self.post("consumo", empleado=e.pk, tipo="CONSUMO", lineas=[self.line(1)])
        self.assertEqual(ComprobanteEmpleado.objects.filter(tipo="CONSUMO").order_by("-pk").first().numero, 41)
