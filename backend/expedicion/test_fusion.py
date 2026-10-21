from copy import deepcopy
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Fletero, AuditoriaExpedicion, RespaldoExpedicion, StockProducto
from .respaldos import exportar
from maestros.models import Producto


class FusionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_superuser(username="tecnico-prueba", password="test")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.p = Producto.objects.get(codigo="5670")
        StockProducto.objects.create(producto=self.p, cantidad_unidades=100)
        self.f = Fletero.objects.create(nombre="Existente")
        nuevo = Fletero.objects.create(nombre="Recuperar")
        self.nuevo_id = nuevo.pk
        self.archivo = exportar()
        nuevo.delete()

    def post(self, archivo=None, expected=200, **extras):
        r = self.client.post("/api/expedicion/respaldos/fusion/", {"archivo": self.archivo if archivo is None else archivo, **extras}, format="json")
        self.assertEqual(r.status_code, expected, r.data)
        return r.data

    def test_preview_valida_sin_guardar_y_fusion_solo_agrega_con_copia_previa(self):
        antes = exportar()
        preview = self.post()
        self.assertTrue(preview["aplicable"])
        self.assertEqual(preview["nuevos"]["expedicion.fletero"], 1)
        self.assertEqual(exportar(), antes)
        self.assertEqual(RespaldoExpedicion.objects.count(), 0)
        self.assertEqual(AuditoriaExpedicion.objects.count(), 0)
        self.post(revision=preview["revision"], huella=preview["huella"], confirmacion="FUSIONAR")
        self.assertTrue(Fletero.objects.filter(pk=self.nuevo_id, nombre="Recuperar").exists())
        self.assertEqual(StockProducto.objects.get(producto=self.p).cantidad_unidades, 100)
        self.assertEqual(RespaldoExpedicion.objects.count(), 1)
        self.assertEqual(AuditoriaExpedicion.objects.filter(accion="Fusionar respaldo").count(), 1)
        self.assertFalse(self.post()["aplicable"])
        for r in antes["registros"]:
            actual = next(x for x in exportar()["registros"] if x["model"] == r["model"] and x["pk"] == r["pk"])
            self.assertEqual(actual, r)

    def test_stock_diferente_es_conflicto_no_se_suma_ni_sobrescribe(self):
        archivo = deepcopy(self.archivo)
        next(r for r in archivo["registros"] if r["model"] == "expedicion.stockproducto")["fields"]["cantidad_unidades"] = "900.00"
        preview = self.post(archivo)
        self.assertEqual(preview["total_conflictos"], 1)
        self.assertFalse(preview["aplicable"])
        self.post(archivo, expected=400, revision=preview["revision"], huella=preview["huella"], confirmacion="FUSIONAR")
        self.assertFalse(Fletero.objects.filter(pk=self.nuevo_id).exists())
        self.assertEqual(StockProducto.objects.get(producto=self.p).cantidad_unidades, 100)

    def test_preview_caduca_ante_cualquier_cambio(self):
        preview = self.post()
        self.f.nombre = "Modificado"
        self.f.save()
        self.post(expected=400, revision=preview["revision"], huella=preview["huella"], confirmacion="FUSIONAR")
        self.assertFalse(Fletero.objects.filter(pk=self.nuevo_id).exists())

    def test_rechaza_origen_ajeno_antiguo_firebase_tablas_y_credenciales(self):
        for mutar in (lambda a: a.pop("origen"), lambda a: a.update(origen="otra-base"),
            lambda a: a.update(formato="Firebase"),
            lambda a: a["registros"].append({"model": "auth.user", "pk": 8, "fields": {"password": "no"}}),
            lambda a: a["registros"][0]["fields"].update(password="no")):
            archivo = deepcopy(self.archivo)
            mutar(archivo)
            self.post(archivo, expected=400)
        self.assertFalse(RespaldoExpedicion.objects.exists())

    def test_rechaza_relaciones_inexistentes_en_preview_sin_efectos(self):
        archivo = deepcopy(self.archivo)
        archivo["registros"].append({"model": "expedicion.stockproducto", "pk": 99999,
            "fields": {"producto": 999999, "cantidad_unidades": "1.00", "stock_minimo": "0.00", "stock_critico": "0.00", "actualizado_en": "2026-10-21T12:00:00Z"}})
        self.post(archivo, expected=400)
        self.assertFalse(Fletero.objects.filter(pk=self.nuevo_id).exists())
        self.assertFalse(RespaldoExpedicion.objects.exists())

    def test_operador_no_superusuario_no_puede_fusionar(self):
        self.user.is_superuser = False
        self.user.save()
        from django.contrib.auth.models import Group
        self.user.groups.add(Group.objects.get_or_create(name="ADMINISTRADOR")[0])
        self.post(expected=403)

    def test_numeros_json_equivalentes_no_son_conflictos(self):
        AuditoriaExpedicion.objects.create(usuario=self.user, turno="Mañana", accion="Cantidad", despues={"cantidad": 6.0})
        archivo = exportar()
        fila = next(r for r in archivo["registros"] if r["model"] == "expedicion.auditoriaexpedicion")
        fila["fields"]["despues"]["cantidad"] = 6
        preview = self.post(archivo)
        self.assertEqual(preview["total_conflictos"], 0)
