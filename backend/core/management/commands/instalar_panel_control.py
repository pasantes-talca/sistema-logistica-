from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from core.panel_instalacion import instalar_panel


class Command(BaseCommand):
    help = "Agrega solo preferencias, políticas de acciones e incidencias; no ejecuta migraciones históricas."

    def add_arguments(self, parser):
        parser.add_argument("--aplicar", action="store_true")

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("En bases de prueba usá migrate con configuración aislada.")
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(),current_schema()")
            dest = cursor.fetchone()
        if dest != ("logistica", "log"):
            raise CommandError("Se requiere logistica.log.")
        self.stdout.write("Destino: logistica.log. Solo tres tablas nuevas; sin cambios en las operativas.")
        if not options["aplicar"]:
            self.stdout.write("Simulación. Usá --aplicar para crear y validar las tablas.")
            return
        with transaction.atomic():
            created = instalar_panel(connection)
        self.stdout.write(self.style.SUCCESS(f"Tablas validadas. Nuevas: {', '.join(created) or 'ninguna'}."))
