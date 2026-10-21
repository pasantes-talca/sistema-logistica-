"""Instalador aditivo limitado a las tres tablas de control administrativo."""
from django.core.exceptions import ValidationError

TABLAS = {"administracion_preferencias", "administracion_acceso_acciones", "administracion_incidencia"}


def validar_panel(connection, model):
    table = model._meta.db_table
    if table not in TABLAS:
        raise ValidationError("Tabla ajena al panel administrativo.")
    with connection.cursor() as cursor:
        fields = {f.name: f for f in connection.introspection.get_table_description(cursor, table)}
        constraints = connection.introspection.get_constraints(cursor, table)
        if set(fields) != {f.column for f in model._meta.local_fields}:
            raise ValidationError(f"Columnas incompatibles en {table}; no se alteró la tabla.")
        for f in model._meta.local_fields:
            if not f.primary_key and fields[f.column].null_ok != f.null:
                raise ValidationError(f"Nulabilidad incompatible en {table}.")
            if (f.unique or f.primary_key) and not any((c.get("unique") or c.get("primary_key")) and c["columns"] == [f.column] for c in constraints.values()):
                raise ValidationError(f"Falta una restricción de unicidad en {table}.")
            if f.db_index and not f.unique and not any(c.get("index") and c["columns"] == [f.column] for c in constraints.values()):
                raise ValidationError(f"Falta un índice en {table}.")
        if connection.vendor == "postgresql":
            cursor.execute("SELECT current_database(),current_schema()")
            if cursor.fetchone() != ("logistica", "log"):
                raise ValidationError("Instalación autorizada únicamente en logistica.log.")
            cursor.execute("SELECT a.attname,format_type(a.atttypid,a.atttypmod) FROM pg_attribute a WHERE a.attrelid=%s::regclass AND a.attnum>0 AND NOT a.attisdropped", [f"log.{table}"])
            types = dict(cursor.fetchall())
            if any(types.get(f.column) != f.db_type(connection).replace("varchar", "character varying") for f in model._meta.local_fields):
                raise ValidationError(f"Tipos incompatibles en {table}.")
            if table == "administracion_acceso_acciones":
                cursor.execute("SELECT count(*) FROM pg_constraint WHERE conrelid=%s::regclass AND confrelid='log.auth_user'::regclass AND contype='f'", [f"log.{table}"])
                if cursor.fetchone()[0] != 1:
                    raise ValidationError("La política debe referenciar log.auth_user.")


def instalar_panel(connection):
    from .models import PreferenciaAdministracion, AccesoAcciones, IncidenciaSistema
    if connection.vendor != "postgresql":
        raise ValidationError("Este instalador es únicamente para PostgreSQL existente.")
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database(),current_schema()")
        if cursor.fetchone() != ("logistica", "log"):
            raise ValidationError("Se requiere logistica.log.")
        cursor.execute("SET LOCAL lock_timeout='5s'")
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [202610200001])
    created = []
    for model in [PreferenciaAdministracion, AccesoAcciones, IncidenciaSistema]:
        table = model._meta.db_table
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass(%s)", [f"log.{table}"])
            exists = cursor.fetchone()[0] is not None
        if not exists:
            with connection.schema_editor(atomic=False) as editor:
                editor.create_model(model)
            created.append(table)
        validar_panel(connection, model)
    return created
