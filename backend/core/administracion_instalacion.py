"""Instalación aditiva para la BD existente: no ejecuta migraciones históricas."""
from django.core.exceptions import ValidationError


def validar(connection, model):
    if model._meta.db_table != "auditoria_sistema":
        raise ValidationError("Operación limitada a auditoria_sistema.")
    with connection.cursor() as cursor:
        fields = {f.name:f for f in connection.introspection.get_table_description(cursor, model._meta.db_table)}
        constraints = connection.introspection.get_constraints(cursor, model._meta.db_table)
        if set(fields) != {f.column for f in model._meta.local_fields}:
            raise ValidationError("La tabla de auditoría existente tiene columnas diferentes. No se modificó.")
        for f in model._meta.local_fields:
            if not f.primary_key and fields[f.column].null_ok != f.null:
                raise ValidationError("La nulabilidad de la tabla existente no coincide.")
        if connection.vendor == "postgresql":
            cursor.execute("SELECT current_schema()")
            if cursor.fetchone()[0] != "log":
                raise ValidationError("La instalación solo admite el esquema log.")
            cursor.execute("SELECT a.attname, format_type(a.atttypid,a.atttypmod) FROM pg_attribute a WHERE a.attrelid='log.auditoria_sistema'::regclass AND a.attnum>0 AND NOT a.attisdropped")
            types = dict(cursor.fetchall())
            for f in model._meta.local_fields:
                if types.get(f.column) != f.db_type(connection).replace("varchar", "character varying"):
                    raise ValidationError("Los tipos de la tabla existente no coinciden.")
            cursor.execute("SELECT count(*) FROM pg_constraint WHERE conrelid='log.auditoria_sistema'::regclass AND confrelid='log.auth_user'::regclass AND contype='f'")
            if cursor.fetchone()[0] != 1:
                raise ValidationError("La referencia de auditoría no corresponde a log.auth_user.")
        if not any(c.get("primary_key") and c["columns"] == ["id"] for c in constraints.values()):
            raise ValidationError("La auditoría debe tener una clave primaria.")
        if not any(c.get("index") and c["columns"] == ["fecha"] for c in constraints.values()):
            raise ValidationError("Falta el índice de fecha de auditoría.")


def instalar(connection, model):
    if connection.vendor != "postgresql" or model._meta.db_table != "auditoria_sistema":
        raise ValidationError("Instalación limitada a auditoria_sistema en PostgreSQL.")
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_schema()")
        if cursor.fetchone()[0] != "log":
            raise ValidationError("La instalación solo admite log.")
        cursor.execute("SET LOCAL lock_timeout='5s'")
        cursor.execute("SELECT pg_advisory_xact_lock(%s)", [202610190001])
        cursor.execute("SELECT to_regclass('log.auditoria_sistema')")
        exists = cursor.fetchone()[0] is not None
    if not exists:
        with connection.schema_editor(atomic=False) as editor:
            editor.create_model(model)
    validar(connection, model)
    return not exists
