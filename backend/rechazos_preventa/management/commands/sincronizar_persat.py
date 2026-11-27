from django.core.management.base import BaseCommand

from rechazos_preventa.persat import iterar_paginas
from rechazos_preventa.servicios import guardar_entregas


class Command(BaseCommand):
    help = "Full Persat sync: walks every delivery page and upserts it by id_entrega."

    def handle(self, *args, **options):
        total = 0
        for page in iterar_paginas():
            # One transaction per page: a failure keeps the pages already saved.
            total += guardar_entregas(page)
        self.stdout.write(self.style.SUCCESS(f"Entregas de Persat sincronizadas: {total}"))
