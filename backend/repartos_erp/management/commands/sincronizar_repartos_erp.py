from datetime import datetime

from django.core.management.base import (
    BaseCommand,
    CommandError,
)

from repartos_erp.sincronizacion import (
    sincronizar_repartos_fecha,
)


class Command(BaseCommand):
    help = (
        "Sincroniza repartos desde SQL Server "
        "Logistica hacia PostgreSQL."
    )

    def add_arguments(
        self,
        parser,
    ):
        parser.add_argument(
            "--fecha",
            type=str,
            default=None,
            help=(
                "Fecha a sincronizar en formato "
                "DD/MM/YYYY. "
                "Por defecto usa la fecha actual."
            ),
        )

    def handle(
        self,
        *args,
        **options,
    ):
        fecha = options["fecha"]

        if not fecha:
            fecha = datetime.now().strftime(
                "%d/%m/%Y"
            )

        self.stdout.write(
            f"Sincronizando repartos del {fecha}..."
        )

        try:
            resultado = sincronizar_repartos_fecha(
                fecha
            )

        except Exception as exc:
            raise CommandError(
                str(exc)
            ) from exc

        self.stdout.write(
            ""
        )

        self.stdout.write(
            (
                "Repartos encontrados en SQL Server: "
                f"{resultado['repartos_en_sqlserver']}"
            )
        )

        self.stdout.write(
            (
                "Repartos sincronizados: "
                f"{resultado['sincronizados']}"
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
                    (
                        f"- Reparto "
                        f"{error['cod_reparto']}: "
                        f"{error['error']}"
                    )
                )

        self.stdout.write(
            ""
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Sincronización finalizada."
            )
        )