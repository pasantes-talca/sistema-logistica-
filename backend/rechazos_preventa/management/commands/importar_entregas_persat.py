"""One-shot migration from the standalone rechazos DB (rechazo.entregas_persat)."""
import psycopg
from psycopg.rows import dict_row
from django.core.management.base import BaseCommand, CommandError

from rechazos_preventa.servicios import CAMPOS, guardar_filas

LOTE = 1000


class Command(BaseCommand):
    help = "Copies rechazo.entregas_persat from the old rechazos DB. Dry run unless --aplicar is given."

    def add_arguments(self, parser):
        parser.add_argument("--origen", required=True,
                            help="Source connection string, e.g. postgresql://user:pass@host:5432/rechazos")
        parser.add_argument("--aplicar", action="store_true", help="Write the rows (default is a dry run).")

    def handle(self, *args, origen, aplicar, **options):
        totals = {"leidas": 0, "nuevas": 0, "actualizadas": 0}
        try:
            with psycopg.connect(origen, connect_timeout=15, row_factory=dict_row) as connection:
                with connection.cursor(name="entregas_persat") as cursor:
                    cursor.execute("SELECT * FROM rechazo.entregas_persat ORDER BY id_entrega")
                    while rows := cursor.fetchmany(LOTE):
                        result = guardar_filas(({k: v for k, v in r.items() if k in CAMPOS} for r in rows), aplicar)
                        for key in totals:
                            totals[key] += result[key]
        except psycopg.Error as exc:
            raise CommandError(f"No se pudo leer la base de origen: {type(exc).__name__}") from exc
        mode = "APLICADO" if aplicar else "SIMULACIÓN (usar --aplicar para escribir)"
        self.stdout.write(self.style.SUCCESS(
            f"{mode}: leídas {totals['leidas']}, nuevas {totals['nuevas']}, actualizadas {totals['actualizadas']}"))
