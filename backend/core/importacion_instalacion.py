"""Instalación limitada de la trazabilidad; jamás modifica tablas existentes."""
from django.core.exceptions import ValidationError


def validar(connection, model):
    if model._meta.db_table != 'registro_importacion':
        raise ValidationError('Esta operación sólo admite registro_importacion.')
    with connection.cursor() as cursor:
        desc=connection.introspection.get_table_description(cursor,model._meta.db_table)
        constraints=connection.introspection.get_constraints(cursor,model._meta.db_table)
        if connection.vendor=='postgresql':
            cursor.execute('SELECT current_schema()')
            if cursor.fetchone()[0]!='log':raise ValidationError('Sólo se admite log.')
            cursor.execute('SELECT a.attname,format_type(a.atttypid,a.atttypmod) FROM pg_attribute a WHERE a.attrelid=%s::regclass AND a.attnum>0 AND NOT a.attisdropped',['log.registro_importacion'])
            types=dict(cursor.fetchall())
            for f in model._meta.local_fields:
                expected=f.db_type(connection).replace('varchar','character varying')
                if types.get(f.column)!=expected:raise ValidationError('Tipo de columna inesperado; no se modificó la tabla.')
    fields={d.name:d for d in desc}
    if set(fields)!={f.column for f in model._meta.local_fields}:raise ValidationError('Columnas inesperadas.')
    for f in model._meta.local_fields:
        if not f.primary_key and fields[f.column].null_ok!=f.null:raise ValidationError('Nulabilidad inesperada.')
        if f.unique and not any(c.get('primary_key') or c.get('unique') for c in constraints.values() if c['columns']==[f.column]):raise ValidationError('Falta una clave única.')
        if f.is_relation:
            target=(f.remote_field.model._meta.db_table,f.target_field.column)
            if not any(c.get('foreign_key')==target and c['columns']==[f.column] for c in constraints.values()):raise ValidationError('Falta una referencia esperada.')
    if not any(c.get('unique') and c['columns']==['modulo','origen_id','clave'] for c in constraints.values()):raise ValidationError('Falta la clave de idempotencia.')


def instalar(connection, model):
    if model._meta.db_table!='registro_importacion' or connection.vendor!='postgresql':raise ValidationError('Instalación limitada a registro_importacion en PostgreSQL.')
    with connection.cursor() as cursor:
        cursor.execute('SELECT current_schema()')
        if cursor.fetchone()[0]!='log':raise ValidationError('Sólo se admite log.')
        cursor.execute("SET LOCAL lock_timeout='5s'")
        cursor.execute('SELECT pg_advisory_xact_lock(%s)',[202610160001])
        cursor.execute('SELECT to_regclass(%s)',['log.registro_importacion'])
        exists=cursor.fetchone()[0] is not None
    if not exists:
        with connection.schema_editor(atomic=False) as editor:editor.create_model(model)
    validar(connection,model)
    return not exists
