from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from maestros.models import Producto
from .models import DetalleOrdenCarga, EntregaOrdenCarga, Fletero, OrdenCarga


class EditarOrdenCargaTests(TestCase):
    def setUp(self):
        self.usuario = get_user_model().objects.create_user(
            username="expedicion-test", password="test-seguro-123"
        )
        self.cliente = APIClient()
        self.cliente.force_authenticate(self.usuario)
        self.fletero = Fletero.objects.create(nombre="Fletero inicial")
        self.otro_fletero = Fletero.objects.create(nombre="Fletero nuevo")
        self.producto = Producto.objects.create(
            codigo="T-001", nombre="Producto prueba", presentacion="1/2 LT",
            sabor="COLA", familia=Producto.Familia.GASEOSA,
        )
        self.otro_producto = Producto.objects.create(
            codigo="T-002", nombre="Producto prueba 2", presentacion="3 LT",
            sabor="MANZANA", familia=Producto.Familia.GASEOSA,
        )
        self.orden = OrdenCarga.objects.create(
            numero="OC-TEST-1", fecha=date(2026, 10, 7),
            fletero=self.fletero, creado_por=self.usuario,
        )
        DetalleOrdenCarga.objects.create(
            orden=self.orden, producto=self.producto, cantidad_solicitada=10,
        )

    def payload(self):
        return {
            "numero": "OC-TEST-EDITADA", "fecha": "2026-10-08",
            "fletero_id": self.otro_fletero.id,
            "observaciones": "Orden corregida",
            "detalles": [{
                "producto_id": self.otro_producto.id,
                "cantidad_solicitada": "4.03",
            }],
        }

    def test_edita_orden_sin_entregas(self):
        respuesta = self.cliente.put(
            f"/api/expedicion/ordenes/{self.orden.id}/",
            self.payload(), format="json",
        )
        self.assertEqual(respuesta.status_code, 200)
        self.orden.refresh_from_db()
        self.assertEqual(self.orden.numero, "OC-TEST-EDITADA")
        self.assertEqual(self.orden.fletero, self.otro_fletero)
        detalle = self.orden.detalles.get()
        self.assertEqual(detalle.producto, self.otro_producto)
        self.assertEqual(str(detalle.cantidad_solicitada), "4.03")

    def test_no_edita_orden_con_entregas(self):
        EntregaOrdenCarga.objects.create(
            orden=self.orden, creado_por=self.usuario,
        )
        respuesta = self.cliente.put(
            f"/api/expedicion/ordenes/{self.orden.id}/",
            self.payload(), format="json",
        )
        self.assertEqual(respuesta.status_code, 400)
        self.orden.refresh_from_db()
        self.assertEqual(self.orden.numero, "OC-TEST-1")

    def test_rechaza_productos_duplicados(self):
        payload = self.payload()
        payload["detalles"].append(payload["detalles"][0].copy())
        respuesta = self.cliente.put(
            f"/api/expedicion/ordenes/{self.orden.id}/",
            payload, format="json",
        )
        self.assertEqual(respuesta.status_code, 400)
