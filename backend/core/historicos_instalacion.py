"""Tablas de archivo autorizadas; sin migraciones falsas ni cambios a operativos."""
from django.core.exceptions import ValidationError

TABLAS = {'repartos_importacion_historica': 202610141031, 'rechazos_importacion_historica': 202610140062, 'cambios_importacion_historica': 202610150087}


def validar_tabla(connection, model):
    table = model._meta.db_table
    if table not in TABLAS:
        raise ValidationError('La instalación sólo admite las tablas históricas autorizadas.')
    with connection.cursor() as cursor:
        description = connection.introspection.get_table_description(cursor, table)
        constraints = connection.introspection.get_constraints(cursor, table)
    fields = {f.name: f for f in description}
    for field in model._meta.local_fields:
        if field.column not in fields or (fields[field.column].null_ok and not field.primary_key):
            raise ValidationError('La tabla histórica existente no tiene la estructura esperada. No se modificó.')
        if field.unique and not field.primary_key and not any(c.get('unique') and c['columns'] == [field.column] for c in constraints.values()):
            raise ValidationError('Falta una restricción única en la tabla histórica. No se modificó.')
    if not any(c.get('primary_key') and c['columns'] == ['id'] for c in constraints.values()):
        raise ValidationError('La tabla histórica no tiene la clave primaria esperada.')
    if connection.vendor == 'postgresql':
        expected = {'id': ('int8', None), 'origen_id': ('varchar', 120), 'nombre': ('varchar', 200), 'huella': ('varchar', 64), 'fuente': ('jsonb', None), 'revision': ('jsonb', None), 'creado_en': ('timestamptz', None)}
        with connection.cursor() as cursor:
            cursor.execute('SELECT current_schema()')
            if cursor.fetchone()[0] != 'log':
                raise ValidationError('Las tablas históricas sólo se instalan en log.')
            cursor.execute('SELECT column_name, udt_name, character_maximum_length FROM information_schema.columns WHERE table_schema=%s AND table_name=%s', ['log', table])
            types = {name: (kind, size) for name, kind, size in cursor.fetchall()}
        if any(types.get(name) != value for name, value in expected.items()):
            raise ValidationError('Los tipos de la tabla histórica no coinciden. No se modificó.')


def instalar_tabla(connection, model):
    table = model._meta.db_table
    if table not in TABLAS:
        raise ValidationError('La instalación sólo admite las tablas históricas autorizadas.')
    if connection.vendor != 'postgresql':
        raise ValidationError('La instalación puntual es sólo para PostgreSQL; en pruebas se usan migraciones.')
    with connection.cursor() as cursor:
        cursor.execute('SELECT current_schema()')
        if cursor.fetchone()[0] != 'log':
            raise ValidationError('La instalación histórica sólo admite el esquema log.')
        cursor.execute("SET LOCAL lock_timeout = '5s'")
        cursor.execute('SELECT pg_advisory_xact_lock(%s)', [TABLAS[table]])
        cursor.execute('SELECT to_regclass(%s)', ['log.' + table])
        existe = cursor.fetchone()[0] is not None
    if not existe:
        with connection.schema_editor(atomic=False) as editor:
            editor.create_model(model)
    validar_tabla(connection, model)
    return not existe
