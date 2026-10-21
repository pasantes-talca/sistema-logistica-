"""Normaliza referencias históricas verificables sin inventar operaciones ni saldos."""
from copy import deepcopy
from collections import defaultdict
from decimal import Decimal
from rest_framework.exceptions import ValidationError


def sin_credenciales(value):
    if isinstance(value, dict):
        return {k: sin_credenciales(v) for k, v in value.items()
            if not any(s in str(k).casefold() for s in ("password", "contrase", "token", "secret", "credential"))}
    if isinstance(value, list):
        return [sin_credenciales(v) for v in value]
    return value


def preparar(payload):
    result = sin_credenciales(deepcopy(payload))
    data = result.get("data", result)
    if not isinstance(data, dict) or not isinstance(data.get("products"), list):
        raise ValidationError("No es un respaldo de Talca Expedición.")
    report = {"productos_historicos": [], "fleteros_recuperados": [], "empleados_consolidados": [], "avisos": []}
    products = {str(p["id"]): p for p in data["products"]}
    referenced = {str(m["productId"]) for m in data.get("movements", [])}
    for o in data.get("orders", []):
        for l in o.get("requestLines", []):
            referenced.add(str(l["productId"]))
        for delivery in o.get("deliveries", []):
            for l in delivery.get("lines", []):
                referenced.add(str(l["productId"]))
                referenced.add(str(l.get("sourceProductId") or l["productId"]))
    # Equivalencias presentes en expedicion/0003 y operativa.configuracion.
    known = {
        "4171": {"name": "Soda 500 ml", "alias": "SO5", "pack": 12, "perCut": 20, "cuts": 7},
        "BIDON": {"name": "Bidón de agua", "alias": "BID", "pack": 1, "perCut": 42, "cuts": 2},
    }
    for code in sorted(referenced - products.keys()):
        if code not in known:
            raise ValidationError(f"Producto sin catálogo ni equivalencia comprobada: {code}.")
        p = {"id": code, **known[code], "active": False, "employeeBenefit": False, "historicalOnly": True}
        data["products"].append(p)
        report["productos_historicos"].append({"codigo": code, **known[code], "activo": False, "stock_actual": "No informado"})
    carriers = {str(f["id"]) for f in data.get("fleteros", [])}
    snapshots = defaultdict(list)
    for o in data.get("orders", []):
        if str(o.get("fleteroId")) not in carriers:
            snap = o.get("carrierSnapshot")
            if not isinstance(snap, dict) or not str(snap.get("name", "")).strip():
                raise ValidationError("Una orden referencia un fletero sin padrón ni snapshot recuperable.")
            snapshots[str(o["fleteroId"])].append((str(o.get("createdAt") or o.get("date") or ""), snap))
    for fid, options in sorted(snapshots.items()):
        snap = max(options, key=lambda item: item[0])[1]
        data["fleteros"].append({"id": fid, "name": snap.get("name", ""), "surname": snap.get("surname", ""),
            "company": snap.get("company", ""), "active": False})
        report["fleteros_recuperados"].append({"id_origen": fid, "ordenes": len(options), "activo": False})
    employees = defaultdict(list)
    for e in data.get("employees", []):
        employees[str(e.get("legajo", "")).strip()].append(e)
    normalized = []
    for legajo, group in employees.items():
        if not legajo:
            raise ValidationError("Empleado sin legajo.")
        if len(group) == 1:
            normalized.extend(group)
            continue
        identities = {(str(e.get("name", "")).strip().casefold(), str(e.get("surname", "")).strip().casefold()) for e in group}
        active = [e for e in group if e.get("active", True)]
        if len(identities) != 1 or len(active) != 1 or any(Decimal(str(e.get("balance", 0))) != 0 for e in group if e is not active[0]):
            raise ValidationError(f"Legajo duplicado ambiguo: {legajo}. No se combinaron sus saldos.")
        normalized.append(active[0])
        report["empleados_consolidados"].append({"legajo": legajo, "ids_origen": [e["id"] for e in group],
            "id_conservado": active[0]["id"], "saldo_conservado": active[0].get("balance", 0)})
    data["employees"] = normalized
    report["avisos"].append("Autores originales conservados como trazabilidad; no se importan contraseñas ni se crean accesos de Firebase.")
    return result, report
