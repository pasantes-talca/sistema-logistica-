"""Pure Persat delivery rules ported from the standalone rechazos project."""
import json
import math
import unicodedata
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

GEOJSON = Path(__file__).resolve().parent / "data" / "mendoza.geojson"

# Persat form widget ids used by the delivery schema (same ids as the original sync).
WIDGET_CAUSA = "FWxO4cFQk"
WIDGET_OTRO_MOTIVO = "FWt8j1IK5"
WIDGET_COMENTARIOS = "FWmbX4ieb"

SIN_COORDENADAS = "Sin coordenadas validas"
FUERA_DE_MENDOZA = "Sin departamento de Mendoza identificado"
SIN_RAZON = "Sin razón informada"


def normalizar(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    return " ".join("".join(c for c in text if not unicodedata.combining(c)).casefold().split())


def motivo(causa, otro_motivo):
    reason = (causa or "").strip() or SIN_RAZON
    detail = (otro_motivo or "").strip()
    if normalizar(reason) == "otro" and detail:
        return f"Otro: {detail}"
    return reason


def coordenadas(delivery):
    location = ((delivery.get("delivery_data") or {}).get("position") or {}).get("location")
    if not isinstance(location, (list, tuple)) or len(location) != 2:
        return None
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in location):
        return None
    lon, lat = location
    if not -180 <= lon <= 180 or not -90 <= lat <= 90 or (lon == 0 and lat == 0):
        return None
    return lon, lat


@lru_cache(maxsize=1)
def departamentos_geojson():
    return json.loads(GEOJSON.read_text(encoding="utf-8"))


def _dentro(point, ring):
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def departamento(delivery):
    point = coordenadas(delivery)
    if point is None:
        return SIN_COORDENADAS
    for feature in departamentos_geojson()["features"]:
        geometry = feature["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        if any(_dentro(point, p[0]) and not any(_dentro(point, hole) for hole in p[1:]) for p in polygons):
            return feature["properties"]["nombre"]
    return FUERA_DE_MENDOZA


def _fecha(value):
    if not isinstance(value, str) or not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else None


def _texto(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    return json.dumps(value, ensure_ascii=False)


def transformar_entrega(delivery):
    """Maps a Persat delivery to EntregaPersat field values."""
    identifier = delivery.get("_id")
    if not isinstance(identifier, str) or not identifier.strip():
        raise ValueError("La entrega de Persat no tiene identificador")
    client = delivery.get("client") or {}
    assignation = delivery.get("assignation_info") or {}
    data = delivery.get("delivery_data") or {}
    results = data.get("results") or {}
    values = results.get("formvalues") or {}
    log = results.get("log") or []
    route_date = assignation.get("date")
    return {
        "id_entrega": identifier,
        "uid_client": _texto(client.get("uid_client")),
        "nombre_cliente": _texto(client.get("name")),
        "estado_persat": _texto(delivery.get("state")),
        "estado_final": _texto(values.get("FW_FINAL_STATE")),
        "fecha_creacion": _fecha(delivery.get("created")),
        "fecha_vencimiento": _fecha(delivery.get("due_date")),
        "fecha_finalizacion": _fecha(log[-1].get("date")) if log else None,
        "movil_asignado": _texto(assignation.get("device_name")),
        "comentarios_observaciones": _texto((data.get("instructions") or {}).get(WIDGET_COMENTARIOS)),
        "causa_no_entrega": _texto(values.get(WIDGET_CAUSA)),
        "otro_motivo": _texto(values.get(WIDGET_OTRO_MOTIVO)),
        "direccion": _texto(((data.get("position") or {}).get("address") or {}).get("clean")),
        "departamento": departamento(delivery),
        "fecha_ruta": date.fromisoformat(route_date[:10]) if isinstance(route_date, str) and route_date else None,
    }
