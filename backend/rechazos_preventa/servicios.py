"""Persistence and aggregation for preventa rejections."""
from collections import Counter
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Max

from .dominio import departamentos_geojson, motivo, normalizar, transformar_entrega
from .models import EntregaPersat

NO_ENTREGADO = "NOT_DELIVERED"
MOVILES = ["Quatro Sur S.A.", "Leonardo Torres Chofer"]
SIN_DEPARTAMENTO = "Sin departamento identificado"
CAMPOS = [f.name for f in EntregaPersat._meta.fields if f.name not in {"id", "actualizado_en"}]
# Known values are kept when a later payload omits them (same as the original upsert).
CONSERVAR_SI_VACIO = {"fecha_ruta", "direccion"}


@transaction.atomic
def guardar_filas(filas, aplicar=True):
    """Idempotent upsert keyed by id_entrega. Unknown keys are ignored."""
    filas = list(filas)
    ids = [str(f["id_entrega"]) for f in filas]
    existentes = {e.id_entrega: e for e in EntregaPersat.objects.filter(id_entrega__in=ids)}
    resultado = {"leidas": len(filas), "nuevas": 0, "actualizadas": 0}
    for fila in filas:
        datos = {k: v for k, v in fila.items() if k in CAMPOS}
        datos["id_entrega"] = str(datos["id_entrega"])
        actual = existentes.get(datos["id_entrega"])
        if actual is None:
            resultado["nuevas"] += 1
            if aplicar:
                existentes[datos["id_entrega"]] = EntregaPersat.objects.create(**datos)
            continue
        resultado["actualizadas"] += 1
        if aplicar:
            for campo, valor in datos.items():
                if valor is None and campo in CONSERVAR_SI_VACIO:
                    continue
                setattr(actual, campo, valor)
            actual.save()
    if not aplicar:
        transaction.set_rollback(True)
    return resultado


def guardar_entregas(deliveries):
    """Maps raw Persat deliveries and upserts them. Returns the number of rows read."""
    return guardar_filas(transformar_entrega(d) for d in deliveries)["leidas"]


def revision():
    data = EntregaPersat.objects.aggregate(ultimo=Max("actualizado_en"), total=Count("id"))
    ultimo = data["ultimo"].isoformat() if data["ultimo"] else "0"
    return f"{data['total']}:{ultimo}"


def _lideres(counter):
    if not counter:
        return "Sin registros"
    maximum = max(counter.values())
    return " / ".join(sorted(k for k, v in counter.items() if v == maximum))


def resumen(desde, hasta, movil=""):
    """Heat map summary: same rules as the original panel, over an inclusive date range."""
    if movil and movil not in MOVILES:
        raise ValueError("Móvil inválido")
    rows = EntregaPersat.objects.filter(
        estado_final=NO_ENTREGADO, movil_asignado__in=MOVILES,
        fecha_ruta__gte=desde, fecha_ruta__lt=hasta + timedelta(days=1),
    ).values_list("id_entrega", "uid_client", "nombre_cliente", "departamento", "movil_asignado",
                  "causa_no_entrega", "otro_motivo")

    nombres = {normalizar(f["properties"]["nombre"]): f["properties"]["nombre"]
               for f in departamentos_geojson()["features"]}
    deptos = {n: {"cantidad": 0, "clientes": set(), "razones": Counter()} for n in nombres.values()}
    totales = {m: 0 for m in MOVILES}
    razones = Counter()
    clientes = {}
    sin_ubicacion = sin_uid = 0

    for identifier, uid, cliente, departamento, vehiculo, causa, otro in rows:
        totales[vehiculo] += 1
        if movil and vehiculo != movil:
            continue
        razon = motivo(causa, otro)
        razones[razon] += 1
        nombre = nombres.get(normalizar(departamento))
        if nombre:
            deptos[nombre]["cantidad"] += 1
            deptos[nombre]["razones"][razon] += 1
            if uid:
                deptos[nombre]["clientes"].add(str(uid))
        else:
            sin_ubicacion += 1
        if not uid:
            sin_uid += 1
        key = ("uid", str(uid)) if uid else ("entrega", identifier)
        entry = clientes.setdefault(key, {"nombre": cliente or "Sin cliente informado", "uid": uid,
                                          "cantidad": 0, "departamentos": set(), "razones": Counter()})
        entry["cantidad"] += 1
        entry["departamentos"].add(nombre or SIN_DEPARTAMENTO)
        entry["razones"][razon] += 1

    ranking = sorted(
        ({"nombre": c["nombre"], "uid": c["uid"], "cantidad": c["cantidad"],
          "departamento": ", ".join(sorted(c["departamentos"])), "motivo": _lideres(c["razones"])}
         for c in clientes.values()),
        key=lambda c: (-c["cantidad"], c["nombre"]))
    total_mapa = sum(d["cantidad"] for d in deptos.values())
    return {
        "departamentos": [{"nombre": n, "cantidad": d["cantidad"], "clientes": len(d["clientes"]),
                           "motivo": _lideres(d["razones"])} for n, d in deptos.items()],
        "moviles": totales,
        "total_mapa": total_mapa,
        "sin_ubicacion": sin_ubicacion,
        "clientes": ranking,
        "clientes_unicos": sum(c["uid"] is not None for c in ranking),
        "sin_uid": sin_uid,
        "motivos": [{"nombre": n, "cantidad": c} for n, c in razones.most_common()],
        "motivo_principal": _lideres(razones),
    }
