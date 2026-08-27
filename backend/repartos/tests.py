from django.test import SimpleTestCase

from .services import calcular_recargas


class CalculoRecargasTests(SimpleTestCase):

    def test_480_bultos_sin_ayudante(self):
        resultado = calcular_recargas(
            bultos=480,
            cantidad_ayudantes=0,
        )

        self.assertEqual(resultado["recargas"], 0)
        self.assertEqual(resultado["recargas_totales"], 0)

    def test_482_bultos_no_generan_recarga(self):
        resultado = calcular_recargas(
            bultos=482,
            cantidad_ayudantes=0,
        )

        self.assertEqual(resultado["recargas"], 0)

    def test_483_bultos_generan_minimo_una(self):
        resultado = calcular_recargas(
            bultos=483,
            cantidad_ayudantes=0,
        )

        self.assertEqual(resultado["recargas"], 1)
        self.assertEqual(resultado["recargas_totales"], 1)

    def test_un_ayudante_agrega_una_recarga(self):
        resultado = calcular_recargas(
            bultos=480,
            cantidad_ayudantes=1,
        )

        self.assertEqual(resultado["recargas"], 1)

        # Chofer + ayudante = 2 personas
        self.assertEqual(
            resultado["cantidad_personas"],
            2
        )

        self.assertEqual(
            resultado["recargas_totales"],
            2
        )

    def test_483_bultos_y_un_ayudante(self):
        resultado = calcular_recargas(
            bultos=483,
            cantidad_ayudantes=1,
        )

        # 1 por bultos + 1 por tener exactamente un ayudante
        self.assertEqual(resultado["recargas"], 2)

        # Chofer + ayudante = 2
        # 2 recargas × 2 personas = 4
        self.assertEqual(
            resultado["recargas_totales"],
            4
        )

    def test_limite_40_por_ciento(self):
        # 1152:
        # 1152 - 480 = 672
        # 1 bloque completo de 480 + 192
        # 192 representa exactamente el 40%
        resultado = calcular_recargas(
            bultos=1152,
            cantidad_ayudantes=0,
        )

        self.assertEqual(resultado["recargas"], 2)

    def test_dos_ayudantes_no_agregan_recarga_extra(self):
        resultado = calcular_recargas(
            bultos=483,
            cantidad_ayudantes=2,
        )

        self.assertEqual(resultado["recargas"], 1)

        # Chofer + 2 ayudantes = 3 personas
        self.assertEqual(
            resultado["recargas_totales"],
            3
        )