"""Actualización acotada para la BD operativa que no tiene historial de migraciones."""
from importlib import import_module

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from kilometrajes.models import ControlKilometraje

NUEVOS = {"estado": "varchar", "version": "int4", "columnas": "jsonb",
          "envio_estado": "varchar", "enviado_en": "timestamptz", "error_envio": "text"}


class Command(BaseCommand):
    help = "Agrega solo los seis campos de planilla y nueve destinos de kilometraje. No ejecuta migrate ni modifica otros módulos."

    def add_arguments(self, parser):
        parser.add_argument("--aplicar", action="store_true")

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("Para bases nuevas o de prueba usá migrate con configuración aislada.")
        with connection.cursor() as c:
            c.execute("SELECT current_database(), current_schema()")
            if c.fetchone() != ("logistica", "log"):
                raise CommandError("Solo se permite actualizar logistica.log.")
            c.execute("SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema='log' AND table_name='control_kilometraje'")
            columnas = dict(c.fetchall())
            if not {"id", "chofer_id", "fecha_desde", "fecha_hasta", "observaciones", "creado_en", "actualizado_en", "creado_por_id"} <= columnas.keys():
                raise CommandError("La tabla de controles no tiene la estructura esperada. No se modificó nada.")
            for campo, tipo in NUEVOS.items():
                if campo in columnas and columnas[campo] != tipo:
                    raise CommandError(f"Tipo inesperado en {campo}. No se modificó nada.")
            c.execute("SELECT count(*) FROM log.control_kilometraje")
            self.stdout.write(f"Destino: logistica.log. Controles existentes: {c.fetchone()[0]}.")
        faltan = [nombre for nombre in NUEVOS if nombre not in columnas]
        self.stdout.write(f"Campos a agregar: {', '.join(faltan) or 'ninguno'}. Destinos: completar faltantes; Sharp / Mai-Gua = 5 km; preservar distancias de controles existentes.")
        if not options["aplicar"]:
            self.stdout.write("SIMULACIÓN: sin cambios. Usá --aplicar para confirmar.")
            return
        with transaction.atomic():
            with connection.cursor() as c:
                c.execute("SET LOCAL lock_timeout = '5s'")
                c.execute("SET LOCAL statement_timeout = '60s'")
                c.execute("SELECT pg_advisory_xact_lock(726264001)")
                c.execute("LOCK TABLE log.control_kilometraje IN ACCESS EXCLUSIVE MODE")
                c.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='log' AND table_name='control_kilometraje'")
                existentes = {r[0] for r in c.fetchall()}
            with connection.schema_editor() as editor:
                for nombre in faltan:
                    if nombre not in existentes:
                        editor.add_field(ControlKilometraje, ControlKilometraje._meta.get_field(nombre))
            import_module("kilometrajes.migrations.0003_destinos_planilla").preparar(apps, connection.schema_editor())
        self.stdout.write(self.style.SUCCESS("Planilla de kilometraje instalada. No se borraron controles ni se modificaron otros módulos o el historial de migraciones."))
