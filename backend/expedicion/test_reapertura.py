import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import AccesoAcciones
from maestros.models import Producto
from .conciliacion import diagnosticar
from .models import (AuditoriaExpedicion, Fletero, MovimientoMaterial,
                     MovimientoStock, OrdenCarga, StockProducto)
from .operativa import detalle_orden


class ReaperturaTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("encargado")
        self.user.groups.add(Group.objects.get_or_create(name="EXPEDICION")[0])
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.p = Producto.objects.get(codigo="5670")
        self.q = Producto.objects.get(codigo="5680")
        self.f = Fletero.objects.create(nombre="Fletero prueba")
        for p in (self.p, self.q):
            StockProducto.objects.create(producto=p, cantidad_unidades=100)

    def post(self, accion, expected=200, **data):
        r = self.client.post("/api/expedicion/operativa/", {
            "accion": accion, "turno": "Mañana", "clave": str(uuid.uuid4()), **data,
        }, format="json")
        self.assertEqual(r.status_code, expected, r.data)
        return r.data

    def linea(self, packs=2, p=None, **data):
        return {"producto": (p or self.p).pk, "packs": packs, **data}

    def orden(self, circuito="preventa"):
        r = self.post("orden", numero="R-1", fecha="2026-11-01", fletero=self.f.pk,
                      circuito=circuito, lineas=[self.linea()])
        return OrdenCarga.objects.get(pk=r["id"])

    def cancelar(self, o):
        o.refresh_from_db()
        self.post("anular", id=o.pk, version=o.version, motivo="Despacho por error")
        o.refresh_from_db()

    def reabrir(self, o, expected=200, **data):
        o.refresh_from_db()
        return self.post("reabrir_orden", expected, **{
            "id": o.pk, "version": o.version, "confirmar": True,
            "motivo": "La mercadería todavía debe salir", **data,
        })

    def stock(self, p=None):
        return StockProducto.objects.get(producto=p or self.p).cantidad_unidades

    def estado(self, o):
        o.refresh_from_db()
        return detalle_orden(o)

    def test_ciclo_completo_stock_materiales_fechas_y_pendientes(self):
        o = self.orden()
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.linea()],
                  fecha="2026-11-01", pallets_salida=2, chapadur_salida=3)
        self.assertEqual(self.stock(), 88)
        self.cancelar(o)
        self.assertEqual(self.stock(), 100)
        antes = (MovimientoStock.objects.count(), MovimientoMaterial.objects.count())
        self.reabrir(o)
        d = self.estado(o)
        self.assertFalse(d["anulada"])
        self.assertEqual(o.estado, "RECIBIDA")
        self.assertEqual(o.numero, "R-1")
        self.assertEqual(d["detalles"][0]["pendiente"], 12)
        self.assertEqual(d["detalles"][0]["resuelto"], 0)
        self.assertEqual(d["estado_operativo"], "Pendiente de despacho")
        self.assertTrue(d["entregas"][0]["anulada"])
        self.assertEqual(antes, (MovimientoStock.objects.count(), MovimientoMaterial.objects.count()))
        self.assertEqual(self.stock(), 100)
        self.assertEqual(diagnosticar()["ordenes"], [])
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.linea()],
                  fecha="2026-11-13", turno="Tarde", pallets_salida=1, chapadur_salida=2)
        d = self.estado(o)
        self.assertEqual(d["estado_operativo"], "Despachada")
        self.assertEqual(self.stock(), 88)
        vigentes = [e for e in d["entregas"] if not e["anulada"]]
        self.assertEqual(len(vigentes), 1)
        self.assertEqual(vigentes[0]["fecha_operativa"], "2026-11-13")
        self.assertEqual(vigentes[0]["turno"], "Tarde")
        self.assertEqual(vigentes[0]["creado_por_nombre"], self.user.username)
        self.assertEqual(sum(m.pallets_salida-m.pallets_entrada for m in MovimientoMaterial.objects.all()), 1)
        self.assertEqual(diagnosticar()["ordenes"], [])
        self.assertEqual(AuditoriaExpedicion.objects.filter(accion="Reabrir orden").count(), 1)

    def test_cancelar_y_reabrir_multiples_veces_sin_duplicar_efectos(self):
        o = self.orden()
        for _ in range(3):
            self.post("entrega", id=o.pk, version=o.version, lineas=[self.linea()], pallets_salida=2)
            self.assertEqual(self.stock(), 88)
            self.cancelar(o)
            self.assertEqual(self.stock(), 100)
            self.reabrir(o)
            self.assertEqual(self.estado(o)["detalles"][0]["pendiente"], 12)
        self.assertEqual(o.entregas.count(), 3)
        self.assertTrue(all(e["anulada"] for e in self.estado(o)["entregas"]))
        self.assertEqual(sum(m.pallets_salida-m.pallets_entrada for m in MovimientoMaterial.objects.all()), 0)
        self.assertEqual(diagnosticar()["ordenes"], [])

    def test_parcial_y_sustitucion_no_se_cuentan_al_reabrir(self):
        o = self.orden()
        self.post("entrega", id=o.pk, version=o.version, lineas=[self.linea(1, p=self.q, solicitado=self.p.pk)])
        self.cancelar(o)
        self.reabrir(o)
        d = self.estado(o)
        self.assertEqual(d["estado_operativo"], "Pendiente de despacho")
        self.assertEqual(d["detalles"][0]["pendiente"], 12)
        self.assertEqual(self.stock(self.q), 100)
        self.assertEqual(diagnosticar()["ordenes"], [])

    def test_anulada_sin_entregas_y_salida_inmediata(self):
        o = self.orden("immediate")
        self.cancelar(o)
        self.reabrir(o, 400)  # No puede reabrirse con despacho automático.
        self.reabrir(o, circuito="preventa")
        self.assertEqual(self.stock(), 100)
        self.assertEqual(self.estado(o)["circuito"], "preventa")

    def test_validaciones_no_alteran_datos(self):
        o = self.orden()
        self.reabrir(o, 400)
        self.cancelar(o)
        for cambios in ({"confirmar":False}, {"motivo":" "}, {"motivo":"x"*2001},
                        {"version":0}, {"circuito":"cancelled"}):
            self.reabrir(o, 400, **cambios)
            o.refresh_from_db()
            self.assertTrue(o.anulada)
        self.assertFalse(AuditoriaExpedicion.objects.filter(accion="Reabrir orden").exists())

    def test_anulacion_antigua_sin_auditoria_o_reversion_incompleta_se_bloquea(self):
        o = self.orden()
        OrdenCarga.objects.filter(pk=o.pk).update(anulada=True)
        self.reabrir(o, 400)
        OrdenCarga.objects.filter(pk=o.pk).update(anulada=False)
        o.refresh_from_db()
        self.cancelar(o)
        MovimientoMaterial.objects.create(orden=o,fletero=self.f,pallets_salida=1)
        self.reabrir(o, 400)

    def test_mismos_permisos_que_anular_y_autenticacion_obligatoria(self):
        o = self.orden()
        self.cancelar(o)
        AccesoAcciones.objects.create(usuario=self.user, permisos={"EXPEDICION":["consultar","crear","editar"]})
        self.reabrir(o, 403)
        self.client.force_authenticate(None)
        r=self.client.post("/api/expedicion/operativa/",{"accion":"reabrir_orden"},format="json")
        self.assertIn(r.status_code,[401,403])

    def test_reintento_misma_clave_es_idempotente(self):
        o = self.orden()
        self.cancelar(o)
        data={"accion":"reabrir_orden","id":o.pk,"version":o.version,"confirmar":True,
              "motivo":"Aún debe salir","turno":"Mañana","clave":str(uuid.uuid4())}
        for _ in range(2):
            r=self.client.post("/api/expedicion/operativa/",data,format="json")
            self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(AuditoriaExpedicion.objects.filter(accion="Reabrir orden").count(),1)
        self.reabrir(o,400)

    def test_fallo_auditoria_revierte_estado(self):
        o=self.orden()
        self.cancelar(o)
        with patch("expedicion.operativa.auditoria",side_effect=RuntimeError("Prueba")):
            with self.assertRaises(RuntimeError): self.reabrir(o)
        o.refresh_from_db()
        self.assertTrue(o.anulada)

    def test_api_anterior_serializa_y_calcula_solo_entregas_vigentes(self):
        from .serializers import OrdenCargaSerializer
        from .services import calcular_cantidad_entregada
        o=self.orden("immediate")
        self.cancelar(o)
        self.reabrir(o,circuito="preventa")
        o.refresh_from_db()
        self.assertTrue(OrdenCargaSerializer(o).data["entregas"][0]["anulada"])
        self.assertEqual(calcular_cantidad_entregada(orden=o,producto=self.p),0)
        from .services import confirmar_entrega_orden
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            confirmar_entrega_orden(entrega=o.entregas.first(),creado_por=self.user)

    def test_respaldo_y_restauracion_conservan_reapertura_e_historial(self):
        o=self.orden("immediate")
        self.cancelar(o)
        self.reabrir(o,circuito="preventa")
        self.user.is_superuser=True
        self.user.save(update_fields=["is_superuser"])
        archivo=self.client.get("/api/expedicion/respaldos/").data
        r=self.client.post("/api/expedicion/respaldos/",{"archivo":archivo},format="json")
        self.assertEqual(r.status_code,200,r.data)
        r=self.client.post("/api/expedicion/respaldos/",{
            "archivo":archivo,"revision":r.data["revision"],"confirmacion":"RESTAURAR",
        },format="json")
        self.assertEqual(r.status_code,200,r.data)
        # Instancia nueva: sin caché del proceso que hizo la reapertura.
        d=detalle_orden(OrdenCarga.objects.get(pk=o.pk))
        self.assertEqual(d["detalles"][0]["pendiente"],12)
        self.assertTrue(d["entregas"][0]["anulada"])
        self.assertEqual(self.stock(),100)
