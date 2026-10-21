import json
from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.db import connection
from django.contrib.auth import get_user_model
from expedicion.importacion_firebase import leer_archivo, cargar
from expedicion.firebase_import import convertir
from collections import Counter


class Command(BaseCommand):
    help = "Ensaya/importa respaldo Firebase solo sobre Expedición vacía. Nunca importa contraseñas."

    def add_arguments(self, parser):
        parser.add_argument("archivo")
        parser.add_argument("--ensayo", action="store_true")
        parser.add_argument("--aplicar", action="store_true")
        parser.add_argument("--sha256")
        parser.add_argument("--actor", default="arielgarro")

    def handle(self, *args, **options):
        if options["ensayo"] and options["aplicar"]:
            raise CommandError("Elegí ensayo o aplicar, no ambos.")
        if options["ensayo"]:
            if connection.vendor != "sqlite" or connection.settings_dict["NAME"] != ":memory:":
                raise CommandError("El ensayo exige config.test_settings y SQLite en memoria.")
            call_command("migrate", verbosity=0)
            # Las migraciones semilla llenan configuración, no operaciones reales.
            from expedicion.respaldos import MODELOS
            for model in reversed(MODELOS):
                model.objects.all().delete()
            actor = get_user_model().objects.create_superuser(options["actor"], password=None)
        else:
            if connection.vendor != "postgresql":
                raise CommandError("La carga operativa exige PostgreSQL.")
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database(),current_schema()")
                if cursor.fetchone() != ("logistica", "log"):
                    raise CommandError("Destino permitido: logistica.log.")
            actor = get_user_model().objects.get(username=options["actor"], is_active=True, is_superuser=True)
        try:
            payload, huella = leer_archivo(options["archivo"])
            if options["aplicar"] and options["sha256"] != huella:
                raise CommandError("Para aplicar, indicá el SHA256 exacto del archivo ensayado.")
            if options["ensayo"] or options["aplicar"]:
                report = cargar(payload, actor, huella)
            else:
                converted = convertir(payload)
                report = {"sha256": huella, "simulacion": True, "filas": dict(Counter(r["model"] for r in converted["registros"])), "informe": converted["informe"]}
            self.stdout.write(json.dumps(report, ensure_ascii=True, indent=2))
            self.stdout.write("Ensayo completado en memoria; PostgreSQL no fue utilizado." if options["ensayo"] else
                "Importación confirmada y validada." if options["aplicar"] else "Solo lectura. Usá --aplicar --sha256 tras el ensayo.")
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(str(exc)) from exc
