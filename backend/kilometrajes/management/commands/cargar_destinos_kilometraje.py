from decimal import Decimal

from django.core.management.base import BaseCommand

from kilometrajes.models import DestinoKilometraje


class Command(BaseCommand):

    help = (
        "Carga los destinos iniciales "
        "del módulo de kilometrajes."
    )

    def handle(
        self,
        *args,
        **options,
    ):

        destinos = [
            {
                "nombre":
                    "Gatica / C. Araujo",

                "distancia_km":
                    Decimal("110"),
            },

            {
                "nombre":
                    "Martins",

                "distancia_km":
                    Decimal("12"),
            },

            {
                "nombre":
                    "Tunuyán",

                "distancia_km":
                    Decimal("154"),
            },

            {
                "nombre":
                    "Aibak / Las Heras",

                "distancia_km":
                    Decimal("30"),
            },

            {
                "nombre":
                    "Marthos / Luján",

                "distancia_km":
                    Decimal("30"),
            },

            {
                "nombre":
                    "Sharp / Mai-Gua",

                "distancia_km":
                    Decimal("20"),
            },

            {
                "nombre":
                    "Muedaz",

                "distancia_km":
                    Decimal("20"),
            },

            {
                "nombre":
                    "Porro",

                "distancia_km":
                    Decimal("20"),
            },

            {
                "nombre":
                    "G. Cruz",

                "distancia_km":
                    Decimal("20"),
            },
        ]


        creados = 0
        actualizados = 0


        for item in destinos:

            destino, creado = (
                DestinoKilometraje.objects.update_or_create(
                    nombre=item["nombre"],
                    defaults={
                        "distancia_km":
                            item["distancia_km"],

                        "activo":
                            True,
                    },
                )
            )


            if creado:

                creados += 1

                self.stdout.write(
                    self.style.SUCCESS(
                        (
                            f"Creado: "
                            f"{destino.nombre} "
                            f"- "
                            f"{destino.distancia_km} km"
                        )
                    )
                )

            else:

                actualizados += 1

                self.stdout.write(
                    (
                        f"Actualizado: "
                        f"{destino.nombre} "
                        f"- "
                        f"{destino.distancia_km} km"
                    )
                )


        self.stdout.write(
            ""
        )


        self.stdout.write(
            self.style.SUCCESS(
                (
                    "Carga finalizada. "
                    f"Creados: {creados}. "
                    f"Actualizados: {actualizados}."
                )
            )
        )