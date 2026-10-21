from django.test import TestCase
from django.core.management import call_command
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from io import StringIO
from .models import ProductoControlDiario, UbicacionControlDiario, ControlDiario, MovimientoControlDiario


class MaestrosControlDiarioTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_maestros_control_diario", stdout=StringIO())
        cls.admin = get_user_model().objects.create_user("admin.control")
        cls.admin.groups.add(Group.objects.get_or_create(name="ADMINISTRADOR")[0])

    def test_catalogo_del_commit_sin_crear_cargas(self):
        self.assertEqual(ProductoControlDiario.objects.filter(activo=True).count(), 17)
        self.assertEqual(UbicacionControlDiario.objects.filter(activo=True).count(), 21)
        self.assertEqual(UbicacionControlDiario.objects.filter(tipo="DEPOSITO").count(), 3)
        self.assertEqual(UbicacionControlDiario.objects.filter(tipo="DISTRIBUIDOR").count(), 12)
        self.assertTrue(UbicacionControlDiario.objects.filter(nombre="Planta Mendoza").exists())
        for nombre in ["Sharp", "Distribuidores Mza", "SMK Mza", "Vertelier", "Feria Mza", "San Juan", "San Luis"]:
            self.assertTrue(UbicacionControlDiario.objects.filter(nombre=nombre, activo=True).exists())
        self.assertFalse(ControlDiario.objects.exists())
        self.assertFalse(MovimientoControlDiario.objects.exists())

    def test_comando_repetido_no_duplica_maestros(self):
        before = list(ProductoControlDiario.objects.values_list("pk", "nombre"))
        call_command("cargar_maestros_control_diario", stdout=StringIO())
        self.assertEqual(before, list(ProductoControlDiario.objects.values_list("pk", "nombre")))
        self.assertEqual(UbicacionControlDiario.objects.count(), 21)
        self.assertFalse(ControlDiario.objects.exists())

    def test_apis_devuelven_columnas_y_filas_y_permiten_primera_carga(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        self.assertEqual(len(client.get("/api/control-diario/productos/").data), 17)
        self.assertEqual(len(client.get("/api/control-diario/ubicaciones/").data), 21)
        producto = ProductoControlDiario.objects.get(nombre="Cola 3 L")
        ubicacion = UbicacionControlDiario.objects.get(nombre="Planta Mendoza")
        response = client.post("/api/control-diario/", {"fecha": "2026-10-21", "observaciones": "Prueba aislada", "movimientos": [
            {"producto": producto.pk, "ubicacion": ubicacion.pk, "tipo_movimiento": "DISPONIBLE", "cantidad": "25.00"}]}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(ControlDiario.objects.count(), 1)
        self.assertEqual(MovimientoControlDiario.objects.count(), 1)

    def test_usuario_sin_modulo_no_accede_a_maestros(self):
        client = APIClient()
        client.force_authenticate(get_user_model().objects.create_user("sin.control"))
        self.assertEqual(client.get("/api/control-diario/productos/").status_code, 403)
        self.assertEqual(client.get("/api/control-diario/ubicaciones/").status_code, 403)
