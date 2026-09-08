from django.core.management.base import BaseCommand

from rechazos.google_forms import (
    sincronizar_rechazos_google,
)


class Command(BaseCommand):

    help = (
        "Sincroniza rechazos desde "
        "Google Forms / Google Sheets."
    )

    def handle(
        self,
        *args,
        **options,
    ):

        self.stdout.write(
            "Consultando Google Forms..."
        )

        resultado = (
            sincronizar_rechazos_google()
        )

        self.stdout.write(
            ""
        )

        self.stdout.write(
            (
                f"Filas encontradas: "
                f"{resultado['filas_google']}"
            )
        )

        self.stdout.write(
            (
                f"Nuevos importados: "
                f"{resultado['creados']}"
            )
        )

        self.stdout.write(
            (
                f"Ya existentes: "
                f"{resultado['existentes']}"
            )
        )

        errores = resultado[
            "errores"
        ]

        if errores:

            self.stdout.write(
                ""
            )

            self.stdout.write(
                self.style.WARNING(
                    "Errores encontrados:"
                )
            )

            for error in errores:

                self.stdout.write(
                    f"- {error}"
                )

        self.stdout.write(
            ""
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Sincronización finalizada."
            )
        )