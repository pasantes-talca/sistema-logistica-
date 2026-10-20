from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from core.administracion_instalacion import instalar
from core.models import EventoAuditoria


class Command(BaseCommand):
    help = "Instala únicamente la tabla de auditoría en log, sin migrar ni modificar tablas existentes."

    def add_arguments(self, parser):
        parser.add_argument("--aplicar", action="store_true")

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("Para bases nuevas o de prueba usá migrate con su configuración aislada.")
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), current_schema()")
            database, schema = cursor.fetchone()
        self.stdout.write(f"Destino: {connection.settings_dict['HOST']} / {database} / {schema}")
        if schema != "log":
            raise CommandError("Se requiere el esquema log.")
        if not options["aplicar"]:
            self.stdout.write("Simulación. Solo se crearía auditoria_sistema si falta; no se cambió nada. Usá --aplicar para confirmar.")
            return
        with transaction.atomic():
            created = instalar(connection, EventoAuditoria)
        self.stdout.write(self.style.SUCCESS("Tabla de auditoría creada y validada." if created else "Tabla de auditoría existente validada, sin cambios."))
