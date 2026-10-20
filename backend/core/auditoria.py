import json
from django.core.serializers.json import DjangoJSONEncoder
from .models import EventoAuditoria

SECRETOS = {"password", "password_actual", "password_nueva", "contraseña", "contrasena", "token", "csrftoken", "secret", "archivo"}


def limpiar(value, depth=0):
    if depth > 5:
        return "[detalle anidado]"
    if isinstance(value, dict):
        return {str(k): limpiar(v, depth + 1) for k, v in list(value.items())[:80]
                if not any(secret in str(k).lower() for secret in SECRETOS)}
    if isinstance(value, (list, tuple)):
        return [limpiar(v, depth + 1) for v in value[:100]]
    if isinstance(value, str):
        return value[:2000]
    try:
        return json.loads(json.dumps(value, cls=DjangoJSONEncoder))
    except TypeError:
        return "[archivo o dato no serializable]"


def registrar(actor, modulo, accion, referencia="", motivo="", antes=None, despues=None):
    return EventoAuditoria.objects.create(actor=actor, usuario=actor.username, modulo=modulo,
        accion=accion, referencia=str(referencia)[:180], motivo=str(motivo)[:2000],
        antes=limpiar(antes or {}), despues=limpiar(despues or {}))
