from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand
from django.db import transaction

from maestros.models import (
    Concesionario,
    MotivoCambio,
    MotivoCambioFamilia,
    Producto,
)

from cambios.models import (
    DetalleReciboCambio,
    ReciboCambio,
)

from cambios.services import (
    guardar_recibo_cambio,
)


class Command(BaseCommand):

    help = (
        "Prueba automáticamente la lógica "
        "del módulo de cambios sin guardar "
        "datos permanentes."
    )


    def handle(self, *args, **options):

        self.stdout.write("")
        self.stdout.write(
            "======================================"
        )
        self.stdout.write(
            " PRUEBA DEL MÓDULO RECIBOS DE CAMBIOS"
        )
        self.stdout.write(
            "======================================"
        )
        self.stdout.write("")


        try:

            with transaction.atomic():

                # ==========================================
                # DATOS TEMPORALES
                # ==========================================

                concesionario = (
                    Concesionario.objects.create(
                        nombre="TEST CAMBIOS",
                        activo=True,
                    )
                )


                producto_cola = (
                    Producto.objects.create(
                        codigo="TEST-COLA",
                        nombre="Producto test cola",
                        presentacion="TEST",
                        sabor="COLA",
                        familia="GASEOSA",
                        activo=True,
                    )
                )


                producto_lima = (
                    Producto.objects.create(
                        codigo="TEST-LIMA",
                        nombre="Producto test lima",
                        presentacion="TEST",
                        sabor="LIMA",
                        familia="GASEOSA",
                        activo=True,
                    )
                )


                motivo_gaseosa = (
                    MotivoCambio.objects.create(
                        nombre=(
                            "Motivo test gaseosa"
                        ),
                        activo=True,
                    )
                )


                MotivoCambioFamilia.objects.create(
                    motivo=motivo_gaseosa,
                    familia="GASEOSA",
                )


                motivo_agua = (
                    MotivoCambio.objects.create(
                        nombre=(
                            "Motivo test agua"
                        ),
                        activo=True,
                    )
                )


                MotivoCambioFamilia.objects.create(
                    motivo=motivo_agua,
                    familia="AGUA",
                )


                # ==========================================
                # PRUEBA 1
                # CREAR RECIBO
                # ==========================================

                resultado_1 = guardar_recibo_cambio(

                    fecha="2026-08-31",

                    concesionario=
                        concesionario,

                    pallets=3,

                    pallets_observacion=
                        "Primera carga",

                    detalles=[
                        {
                            "producto_id":
                                producto_cola.id,

                            "cantidad":
                                10,

                            "motivo_id":
                                motivo_gaseosa.id,

                            "observacion":
                                "Primera cantidad",
                        }
                    ],
                )


                recibo_1 = resultado_1[
                    "recibo"
                ]


                assert (
                    resultado_1["creado"]
                    is True
                )

                assert (
                    ReciboCambio.objects
                    .filter(
                        fecha="2026-08-31",
                        concesionario=
                            concesionario,
                    )
                    .count()
                    == 1
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 1: "
                        "crea un recibo nuevo"
                    )
                )


                # ==========================================
                # PRUEBA 2
                # MISMA FECHA + CONCESIONARIO
                # NO CREA OTRO RECIBO
                # ==========================================

                resultado_2 = guardar_recibo_cambio(

                    fecha="2026-08-31",

                    concesionario=
                        concesionario,

                    pallets=2,

                    pallets_observacion=
                        "Segunda carga",

                    detalles=[
                        {
                            "producto_id":
                                producto_cola.id,

                            "cantidad":
                                5,

                            "motivo_id":
                                motivo_gaseosa.id,

                            "observacion":
                                "Segunda cantidad",
                        }
                    ],
                )


                recibo_2 = resultado_2[
                    "recibo"
                ]


                assert (
                    resultado_2["creado"]
                    is False
                )

                assert (
                    recibo_1.id
                    == recibo_2.id
                )

                assert (
                    ReciboCambio.objects
                    .filter(
                        fecha="2026-08-31",
                        concesionario=
                            concesionario,
                    )
                    .count()
                    == 1
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 2: "
                        "fecha + concesionario "
                        "reutiliza el mismo recibo"
                    )
                )


                # ==========================================
                # PRUEBA 3
                # ACUMULAR MISMO PRODUCTO
                # 10 + 5 = 15
                # ==========================================

                detalle_cola = (
                    DetalleReciboCambio.objects.get(
                        recibo=recibo_1,
                        producto=producto_cola,
                    )
                )


                assert (
                    detalle_cola.cantidad
                    == Decimal("15")
                )


                assert (
                    DetalleReciboCambio.objects
                    .filter(
                        recibo=recibo_1,
                        producto=producto_cola,
                    )
                    .count()
                    == 1
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 3: "
                        "producto repetido "
                        "acumula 10 + 5 = 15"
                    )
                )


                # ==========================================
                # PRUEBA 4
                # PRODUCTO DIFERENTE
                # ==========================================

                guardar_recibo_cambio(

                    fecha="2026-08-31",

                    concesionario=
                        concesionario,

                    detalles=[
                        {
                            "producto_id":
                                producto_lima.id,

                            "cantidad":
                                8,

                            "motivo_id":
                                motivo_gaseosa.id,

                            "observacion":
                                "Producto diferente",
                        }
                    ],
                )


                assert (
                    DetalleReciboCambio.objects
                    .filter(
                        recibo=recibo_1
                    )
                    .count()
                    == 2
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 4: "
                        "producto distinto crea "
                        "un detalle diferente"
                    )
                )


                # ==========================================
                # PRUEBA 5
                # PALLETS 3 + 2 = 5
                # ==========================================

                recibo_1.refresh_from_db()


                assert (
                    recibo_1.pallets
                    == Decimal("5")
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 5: "
                        "pallets acumulan "
                        "3 + 2 = 5"
                    )
                )


                # ==========================================
                # PRUEBA 6
                # OBSERVACIONES NO SE PIERDEN
                # ==========================================

                assert (
                    "Primera carga"
                    in
                    recibo_1
                    .pallets_observacion
                )

                assert (
                    "Segunda carga"
                    in
                    recibo_1
                    .pallets_observacion
                )


                assert (
                    "Primera cantidad"
                    in
                    detalle_cola.observacion
                )

                assert (
                    "Segunda cantidad"
                    in
                    detalle_cola.observacion
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 6: "
                        "conserva observaciones "
                        "anteriores"
                    )
                )


                # ==========================================
                # PRUEBA 7
                # MOTIVO CORRECTO PARA GASEOSA
                # ==========================================

                assert (
                    detalle_cola.motivo_id
                    == motivo_gaseosa.id
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 7: "
                        "acepta motivo válido "
                        "para GASEOSA"
                    )
                )


                # ==========================================
                # PRUEBA 8
                # MOTIVO DE AGUA NO PUEDE
                # APLICARSE A GASEOSA
                # ==========================================

                motivo_invalido_rechazado = False


                try:

                    guardar_recibo_cambio(

                        fecha="2026-09-01",

                        concesionario=
                            concesionario,

                        detalles=[
                            {
                                "producto_id":
                                    producto_cola.id,

                                "cantidad":
                                    1,

                                "motivo_id":
                                    motivo_agua.id,
                            }
                        ],
                    )


                except ValidationError:

                    motivo_invalido_rechazado = (
                        True
                    )


                assert (
                    motivo_invalido_rechazado
                    is True
                )


                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ Prueba 8: "
                        "rechaza un motivo de AGUA "
                        "para producto GASEOSA"
                    )
                )


                # ==========================================
                # ROLLBACK VOLUNTARIO
                # ==========================================

                transaction.set_rollback(
                    True
                )


            self.stdout.write("")
            self.stdout.write(
                self.style.SUCCESS(
                    "======================================"
                )
            )

            self.stdout.write(
                self.style.SUCCESS(
                    " TODAS LAS PRUEBAS PASARON"
                )
            )

            self.stdout.write(
                self.style.SUCCESS(
                    "======================================"
                )
            )

            self.stdout.write("")

            self.stdout.write(
                "Los datos utilizados fueron "
                "temporales y NO quedaron guardados."
            )

            self.stdout.write("")


        except AssertionError:

            self.stdout.write("")
            self.stdout.write(
                self.style.ERROR(
                    "✗ Una prueba no dio "
                    "el resultado esperado."
                )
            )

            raise


        except Exception as error:

            self.stdout.write("")
            self.stdout.write(
                self.style.ERROR(
                    f"✗ Error durante la prueba: "
                    f"{error}"
                )
            )

            raise