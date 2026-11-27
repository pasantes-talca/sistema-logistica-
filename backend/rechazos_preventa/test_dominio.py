from datetime import date, datetime, timezone

from django.test import SimpleTestCase

from .dominio import departamento, motivo, normalizar, transformar_entrega


def entrega(**cambios):
    base = {
        "_id": "abc123",
        "state": "FINISHED",
        "created": "2026-10-14T12:00:00.000Z",
        "due_date": "2026-10-15T03:00:00.000Z",
        "client": {"uid_client": "C-10", "name": "Almacén Don José"},
        "assignation_info": {"device_name": "Quatro Sur S.A.", "date": "2026-10-14T03:00:00.000Z"},
        "delivery_data": {
            "instructions": {"FWmbX4ieb": "Tocar timbre"},
            "position": {"location": [-68.87295, -32.8789], "address": {"clean": "San Martín 100"}},
            "results": {
                "formvalues": {"FW_FINAL_STATE": "NOT_DELIVERED", "FWxO4cFQk": "Cerrado", "FWt8j1IK5": ""},
                "log": [{"date": "2026-10-14T15:00:00.000Z"}, {"date": "2026-10-14T16:30:00.000Z"}],
            },
        },
    }
    base.update(cambios)
    return base


class NormalizarTests(SimpleTestCase):
    def test_quita_acentos_mayusculas_y_espacios(self):
        self.assertEqual(normalizar("  Luján   de CUYO "), "lujan de cuyo")
        self.assertEqual(normalizar(None), "")


class MotivoTests(SimpleTestCase):
    def test_usa_la_causa_informada(self):
        self.assertEqual(motivo(" Cerrado ", None), "Cerrado")

    def test_otro_con_detalle_se_compone(self):
        self.assertEqual(motivo("Otro", "  Sin acceso "), "Otro: Sin acceso")

    def test_otro_sin_detalle_queda_otro(self):
        self.assertEqual(motivo("otro", "  "), "otro")

    def test_sin_causa(self):
        self.assertEqual(motivo("", None), "Sin razón informada")
        self.assertEqual(motivo(None, "algo"), "Sin razón informada")


class DepartamentoTests(SimpleTestCase):
    def test_ubica_el_punto_en_su_departamento(self):
        self.assertEqual(departamento(entrega()), "Capital")

    def test_sin_coordenadas_validas(self):
        sin = entrega(delivery_data={"position": {"location": [0, 0]}})
        self.assertEqual(departamento(sin), "Sin coordenadas validas")
        self.assertEqual(departamento(entrega(delivery_data={})), "Sin coordenadas validas")

    def test_fuera_de_mendoza(self):
        afuera = entrega(delivery_data={"position": {"location": [-58.38, -34.6]}})
        self.assertEqual(departamento(afuera), "Sin departamento de Mendoza identificado")


class TransformarEntregaTests(SimpleTestCase):
    def test_mapea_los_campos_de_persat(self):
        fila = transformar_entrega(entrega())
        self.assertEqual(fila["id_entrega"], "abc123")
        self.assertEqual(fila["uid_client"], "C-10")
        self.assertEqual(fila["nombre_cliente"], "Almacén Don José")
        self.assertEqual(fila["estado_persat"], "FINISHED")
        self.assertEqual(fila["estado_final"], "NOT_DELIVERED")
        self.assertEqual(fila["movil_asignado"], "Quatro Sur S.A.")
        self.assertEqual(fila["comentarios_observaciones"], "Tocar timbre")
        self.assertEqual(fila["causa_no_entrega"], "Cerrado")
        self.assertIsNone(fila["otro_motivo"])
        self.assertEqual(fila["direccion"], "San Martín 100")
        self.assertEqual(fila["departamento"], "Capital")
        self.assertEqual(fila["fecha_ruta"], date(2026, 10, 14))
        self.assertEqual(fila["fecha_creacion"], datetime(2026, 10, 14, 12, tzinfo=timezone.utc))
        self.assertEqual(fila["fecha_finalizacion"], datetime(2026, 10, 14, 16, 30, tzinfo=timezone.utc))

    def test_tolera_entrega_sin_datos_opcionales(self):
        fila = transformar_entrega({"_id": "x1", "created": "2026-10-14T12:00:00Z"})
        self.assertEqual(fila["id_entrega"], "x1")
        self.assertIsNone(fila["fecha_ruta"])
        self.assertIsNone(fila["fecha_finalizacion"])
        self.assertIsNone(fila["causa_no_entrega"])
        self.assertEqual(fila["departamento"], "Sin coordenadas validas")

    def test_rechaza_entrega_sin_identificador(self):
        with self.assertRaises(ValueError):
            transformar_entrega({"created": "2026-10-14T12:00:00Z"})
