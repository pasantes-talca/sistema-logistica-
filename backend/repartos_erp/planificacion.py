"""Rutas viales OSRM. La propuesta no modifica la secuencia hasta confirmarse."""
import hashlib
import json
import math
import os
from urllib.parse import urlsplit
import requests
from django.core import signing
from rest_framework.exceptions import ValidationError
from .models import ClientePersatERP
from .operaciones import evento

MAX_PARADAS = 60
SALT = "talca.repartos-erp.plan.v1"


def punto(lat, lon):
    try:
        if isinstance(lat, bool) or isinstance(lon, bool):
            return None
        lat, lon = float(lat), float(lon)
        if math.isfinite(lat) and math.isfinite(lon) and -85 <= lat <= 85 and -180 <= lon <= 180 and (lat, lon) != (0, 0):
            return [lat, lon]
    except (ValueError, TypeError, OverflowError):
        pass
    return None


def ubicaciones(reparto):
    codigos = [p.codigo_cliente for p in reparto.paradas.all() if p.codigo_cliente]
    return {c.codigo: c for c in ClientePersatERP.objects.filter(codigo__in=codigos)}


def huella(reparto):
    """Incluye la réplica: una ubicación actualizada invalida propuestas viejas."""
    geo = ubicaciones(reparto)
    datos = [(p.id, p.orden, p.estado, p.codigo_cliente,
              [geo[p.codigo_cliente].latitud, geo[p.codigo_cliente].longitud] if p.codigo_cliente in geo else None)
             for p in reparto.paradas.order_by("orden", "id")]
    return hashlib.sha256(json.dumps([reparto.version_operativa, datos], sort_keys=True).encode()).hexdigest()


def origen(reparto):
    if reparto.cod_jerarquia == 7 or reparto.almacen in {"MZA_EXPEDICION", "MZA_MERMAS PP"}:
        return [-32.929560, -68.816710]
    return reparto.recorrido_guardado.get("origen")


def osrm(servicio, puntos, parametros):
    base = os.environ.get("TALCA_OSRM_URL", "http://127.0.0.1:4800").rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValidationError("Configurá TALCA_OSRM_URL en el servidor.")
    coords = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in puntos)
    try:
        with requests.Session() as sesion:
            sesion.trust_env = False
            with sesion.get(f"{base}/{servicio}/v1/driving/{coords}", params={**parametros,
                    "radiuses": ";".join(["300"] * len(puntos)), "generate_hints": "false"},
                    timeout=(5, 20), allow_redirects=False, stream=True) as respuesta:
                respuesta.raise_for_status()
                if respuesta.is_redirect:
                    raise ValueError()
                raw = bytearray()
                for chunk in respuesta.iter_content(65536):
                    raw.extend(chunk)
                    if len(raw) > 4_000_000:
                        raise ValueError()
                data = json.loads(raw)
        if data.get("code") != "Ok":
            raise ValueError()
        return data
    except (requests.RequestException, ValueError, TypeError, AttributeError):
        raise ValidationError("OSRM no está disponible o no encontró una ruta vial. No se guardó ningún cambio.") from None


def costo(matriz, orden, regreso):
    seq = [0, *orden, *([0] if regreso else [])]
    return sum(matriz[a][b] for a, b in zip(seq, seq[1:]))


def mejorar(matriz, regreso):
    originales = list(range(1, len(matriz)))
    pendientes, cercano, ultimo = set(originales), [], 0
    while pendientes:
        siguiente = min(pendientes, key=lambda j: (matriz[ultimo][j], j))
        cercano.append(siguiente)
        pendientes.remove(siguiente)
        ultimo = siguiente
    mejor = min([originales, cercano], key=lambda o: costo(matriz, o, regreso))
    valor = costo(matriz, mejor, regreso)
    for _ in range(4):
        candidato, menor = mejor, valor
        for i in range(len(mejor) - 1):
            for j in range(i + 2, len(mejor) + 1):
                alt = mejor[:i] + mejor[i:j][::-1] + mejor[j:]
                nuevo = costo(matriz, alt, regreso)
                if nuevo < menor - 1e-8:
                    candidato, menor = alt, nuevo
        if menor >= valor - 1e-8:
            break
        mejor, valor = candidato, menor
    return mejor


def ruta(puntos):
    respuesta = osrm("route", puntos, {"overview": "full", "geometries": "geojson", "steps": "false"})
    try:
        r = respuesta["routes"][0]
        distancia, segundos = r["distance"], r["duration"]
        coords = r["geometry"]["coordinates"]
        if not all(type(v) in (int, float) and math.isfinite(v) and v >= 0 for v in [distancia, segundos]):
            raise ValueError()
        if not isinstance(coords, list) or not 2 <= len(coords) <= 100000:
            raise ValueError()
        geometria = [punto(p[1], p[0]) for p in coords]
        if not all(geometria):
            raise ValueError()
        return {"distancia": distancia, "segundos": segundos, "geometria": geometria}
    except (KeyError, IndexError, TypeError, ValueError):
        raise ValidationError("OSRM devolvió una ruta incompleta.") from None


def calcular(reparto, actor, lat, lon, regreso=True, guardado=False):
    huella_inicial = huella(reparto)
    fijo = reparto.cod_jerarquia == 7 or reparto.almacen in {"MZA_EXPEDICION", "MZA_MERMAS PP"}
    salida = origen(reparto) if fijo else punto(lat, lon) or origen(reparto)
    if not salida:
        raise ValidationError("Indicá las coordenadas reales del depósito de salida.")
    pendientes = list(reparto.paradas.exclude(estado__in=["entregado", "no_entregado"]).order_by("orden", "id"))
    if not 1 <= len(pendientes) <= MAX_PARADAS:
        raise ValidationError(f"Se requieren entre 1 y {MAX_PARADAS} paradas pendientes.")
    geo = ubicaciones(reparto)
    puntos = [salida]
    for p in pendientes:
        cliente = geo.get(p.codigo_cliente)
        loc = punto(cliente.latitud, cliente.longitud) if cliente else None
        if not loc:
            raise ValidationError("Faltan ubicaciones de clientes pendientes. Sincronizá la réplica Persat.")
        puntos.append(loc)
    n = len(puntos)
    orden = list(range(1, n))
    if not guardado:
        matriz = osrm("table", puntos, {"annotations": "duration"}).get("durations")
        if not isinstance(matriz, list) or len(matriz) != n or not all(isinstance(row, list) and len(row) == n and
                all(type(v) in (int, float) and math.isfinite(v) and v >= 0 for v in row) for row in matriz):
            raise ValidationError("No existe conexión vial entre todas las paradas.")
        orden = mejorar(matriz, regreso)
    def camino(o):
        return ruta([puntos[0], *[puntos[i] for i in o], *([puntos[0]] if regreso else [])])
    antes = camino(list(range(1, n)))
    despues = antes if guardado else camino(orden)
    if despues["segundos"] > antes["segundos"] + 1:
        orden, despues = list(range(1, n)), antes
    reparto.refresh_from_db(fields=["version_operativa"])
    if huella(reparto) != huella_inicial:
        raise ValidationError("El reparto cambió durante el cálculo. Volvé a calcular la propuesta.")
    propuesta = {**despues, "distancia_anterior": antes["distancia"], "segundos_anteriores": antes["segundos"],
        "ids": [pendientes[i-1].id for i in orden], "origen": salida, "regreso": regreso,
        "huella": huella_inicial, "usuario": actor.id, "cod_reparto": reparto.cod_reparto}
    return {**propuesta, "firma": None if guardado else signing.dumps(propuesta, salt=SALT, compress=True)}


def confirmar(reparto, actor, firma):
    try:
        plan = signing.loads(firma, salt=SALT, max_age=900)
    except signing.BadSignature:
        raise ValidationError("La propuesta venció o no es válida. Volvé a calcularla.") from None
    if plan["usuario"] != actor.id or plan["cod_reparto"] != reparto.cod_reparto or plan["huella"] != huella(reparto):
        raise ValidationError("El reparto o sus ubicaciones cambiaron. Volvé a calcular la propuesta.")
    pendientes = list(reparto.paradas.exclude(estado__in=["entregado", "no_entregado"]).order_by("orden", "id"))
    if set(plan["ids"]) != {p.id for p in pendientes} or len(plan["ids"]) != len(pendientes):
        raise ValidationError("La propuesta no corresponde a las paradas pendientes.")
    posiciones = [p.orden for p in pendientes]
    if len(set(posiciones)) != len(posiciones):
        raise ValidationError("Hay posiciones repetidas. Reordená las paradas antes de planificar.")
    por_id = {p.id: p for p in pendientes}
    for posicion, pid in zip(posiciones, plan["ids"]):
        parada = por_id[pid]
        parada.orden = posicion
        parada.save(update_fields=["orden", "actualizado_en"])
    reparto.recorrido_guardado = {k: plan[k] for k in ["ids", "origen", "regreso", "distancia", "segundos", "geometria"]}
    reparto.save(update_fields=["recorrido_guardado"])
    evento(reparto, actor, "confirmar_recorrido", {"anterior": [p.id for p in pendientes], "nuevo": plan["ids"]})
