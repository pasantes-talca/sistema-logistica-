"""Minimal Persat API client (ported from the standalone rechazos project)."""
import json
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from django.conf import settings

API_BASE = "https://api.persat.com.ar/v1"
LIMITE = 100
REINTENTABLES = {429, 500, 502, 503, 504}


def _clave():
    key = getattr(settings, "PERSAT_API_KEY", "")
    if not key:
        raise RuntimeError("Falta configurar PERSAT_API_KEY")
    return key


def obtener_json(path, params=None):
    key = _clave()
    url = API_BASE + path + ("?" + urlencode(params) if params else "")
    request = Request(url, headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urlopen(request, timeout=30) as response:
                payload = json.load(response)
            if not isinstance(payload, dict) or not payload.get("success", False):
                detail = str((payload or {}).get("error") if isinstance(payload, dict) else payload)
                raise RuntimeError(f"Persat devolvió un error en {path}: {detail.replace(key, '[CLAVE OCULTA]')[:300]}")
            return payload
        except HTTPError as exc:
            if exc.code not in REINTENTABLES or attempt == 3:
                raise RuntimeError(f"HTTP {exc.code} de Persat en {path}") from exc
            retry_after = exc.headers.get("Retry-After")
            time.sleep(min(int(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt, 30))
        except (URLError, TimeoutError, ConnectionError) as exc:
            if attempt == 3:
                raise RuntimeError("No se pudo conectar con Persat") from exc
            time.sleep(2 ** attempt)
    raise RuntimeError("Se agotaron los intentos de consulta a Persat")


def iterar_paginas():
    """Yields every page of deliveries following Persat's cursor."""
    cursor = None
    seen = set()
    while True:
        params = {"limit": LIMITE}
        if cursor is not None:
            params["next"] = cursor
        payload = obtener_json("/deliveries", params)
        deliveries = payload.get("data") or []
        if not deliveries:
            return
        yield deliveries
        cursor = (payload.get("paging") or {}).get("next")
        if cursor is None:
            return
        if cursor in seen:
            raise RuntimeError("Persat repitió un cursor de paginación")
        seen.add(cursor)


def obtener_entrega(identifier):
    delivery = obtener_json("/deliveries/" + quote(identifier, safe="")).get("data")
    if not isinstance(delivery, dict) or delivery.get("_id") != identifier:
        raise RuntimeError("Persat devolvió una entrega inválida")
    return delivery
