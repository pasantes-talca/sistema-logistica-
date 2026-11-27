from django.core.management.base import BaseCommand, CommandError
from repartos_erp.persat import sincronizar_clientes


class Command(BaseCommand):
    help = "Replica clientes Persat mediante GET; no modifica el proveedor. Programar cada hora en el servidor."

    def handle(self, *args, **options):
        try:
            total = sincronizar_clientes()
        except ValueError as exc:
            raise CommandError(str(exc)) from None
        self.stdout.write(self.style.SUCCESS(f"Réplica Persat actualizada: {total} clientes."))
