"""Convierte un archivo exportado por Talca Expedición, sin consultar Firebase.

Las claves y cantidades originales se convierten a un respaldo portable Django.
No se importan contraseñas. La restauración aplica el mismo control/copia previa.
"""
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from datetime import datetime
import uuid
import re
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from .firebase_preparacion import preparar


def nota_origen(note, author):
    return "\n".join(filter(None, [str(note or ""), f"Usuario original: {author}" if author else ""]))


def convertir(payload):
    payload, informe = preparar(payload)
    data = payload.get("data", payload)
    if not isinstance(data, dict) or not isinstance(data.get("products"), list) or not isinstance(data.get("stock"), dict):
        raise ValidationError("El archivo no es un respaldo de Talca Expedición.")
    rows, products = [], []
    maps = {}
    counters = defaultdict(int)
    users = list(get_user_model().objects.values("id", "username", "first_name", "last_name"))
    usernames = {}
    for u in users:
        usernames[u["username"]] = u["id"]
        full = f'{u["first_name"]} {u["last_name"]}'.strip()
        if full:
            usernames[full] = u["id"]

    def qty(value, signed=False):
        try:
            d = Decimal(str(value or 0))
        except (InvalidOperation, TypeError, ValueError):
            raise ValidationError("El respaldo contiene cantidades inválidas.")
        if not d.is_finite() or abs(d) > Decimal("99999999999") or (not signed and d < 0):
            raise ValidationError("El respaldo contiene cantidades fuera de rango.")
        return float(d)

    def stamp(value):
        if not value:
            return timezone.now().isoformat()
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            raise ValidationError("Una fecha del respaldo no es válida.")
        return (timezone.make_aware(dt) if timezone.is_naive(dt) else dt).isoformat()

    def add(model, fields, source=None):
        counters[model] += 1
        pk = counters[model]
        rows.append({"model": f"expedicion.{model}", "pk": pk, "fields": fields})
        if source is not None:
            maps[(model, str(source))] = pk
        return pk

    def resolve(model, key):
        try:
            return maps[(model, str(key))]
        except KeyError:
            raise ValidationError(f"Falta una referencia de {model}: {key}.")

    buckets = data.get("stockBuckets", {})
    circuitos = {"preventa", "distriC", "distriInterior", "oesteMendoza", "oesteJeremias"}
    pendientes_ordenes = defaultdict(lambda: defaultdict(float))
    for o in data.get("orders", []):
        if not isinstance(o.get("requestLines"), list):
            raise ValidationError("El archivo incluye órdenes de una versión antigua sin solicitud separada. Deben convertirse antes de importar para preservar sus cantidades.")
        if o.get("pendingType") in circuitos:
            for l in o["requestLines"]:
                pendientes_ordenes[str(l["productId"])][o["pendingType"]] += max(0, qty(l.get("total")) - qty(l.get("resolvedTotal")))
    for p in data["products"]:
        code = str(p.get("id", "")).strip()
        if not code or any(x["codigo"] == code for x in products):
            raise ValidationError("Hay códigos de producto vacíos o duplicados.")
        pid = len(products) + 1
        maps[("producto", code)] = pid
        family = "SODA" if code in {"417", "4171", "4900"} else "SIFON" if code == "4910" else "AGUA" if code in {"BIDON", "8687", "8680", "8670"} else "GASEOSA"
        products.append({"id": pid, "codigo": code, "nombre": str(p.get("name", code)), "familia": family, "presentacion": "", "sabor": "", "activo": p.get("active", True)})
        bucket = buckets.get(code, {})
        pack, cut, pallet = [qty(p.get(k, default)) for k, default in (("pack", 1), ("perCut", 20), ("cuts", 4))]
        if any(n <= 0 or n != int(n) for n in (pack, cut, pallet)):
            raise ValidationError("Las equivalencias de los productos deben ser enteras positivas.")
        manual = {k: qty(bucket.get(k, 0)) - pendientes_ordenes[code][k] for k in circuitos}
        add("configuracionproducto", {"producto": pid, "alias": str(p.get("alias", "")), "unidades_pack": int(pack), "packs_corte": int(cut),
            "cortes_pallet": int(pallet), "beneficio_empleado": bool(p.get("employeeBenefit", code in {"5670", "5675", "5680", "5685", "5690", "8670"})),
            "sin_codificar": qty(bucket.get("sinCodificar", 0)), "pendientes_manuales": manual})
        if not p.get("historicalOnly"):
            add("stockproducto", {"producto": pid, "cantidad_unidades": qty(data["stock"].get(code, bucket.get("physical", 0)), True),
                "stock_minimo": qty(p.get("minStock", 0)) * pack, "stock_critico": qty(p.get("criticalStock", 0)) * pack, "actualizado_en": stamp(payload.get("exportedAt"))})
    for f in data.get("fleteros", []):
        add("fletero", {"nombre": str(f.get("name", "")), "apellido": str(f.get("surname", "")), "empresa": str(f.get("company", "")),
            "activo": f.get("active", True), "creado_en": stamp(None), "actualizado_en": stamp(None)}, f["id"])
    for e in data.get("employees", []):
        add("empleadoexpedicion", {"legajo": str(e.get("legajo", "")), "nombre": str(e.get("name", "")), "apellido": str(e.get("surname", "")),
            "activo": e.get("active", True), "saldo_fardos": int(qty(e.get("balance", 0)))}, e["id"])
    billing = {"No aplica": "NO_APLICA", "Pendiente": "PENDIENTE", "Pagada": "PAGADA", "Pendiente de aviso": "PENDIENTE_AVISO", "Corregida": "CORREGIDA"}
    order_numbers = {}
    for o in data.get("orders", []):
        requested = o["requestLines"]
        outstanding = sum(max(0, qty(l.get("total")) - qty(l.get("resolvedTotal"))) for l in requested)
        circuit = o.get("pendingType", "administrative")
        oid = add("ordencarga", {"numero": str(o.get("number", "")), "fecha": str(o.get("date") or stamp(o.get("createdAt"))[:10]),
            "fletero": resolve("fletero", o.get("fleteroId")), "estado": "COMPLETA" if not outstanding else "PARCIAL" if o.get("deliveries") else "RECIBIDA",
            "facturacion": billing.get(o.get("billing"), "NO_APLICA"), "observaciones": nota_origen(o.get("note"), o.get("createdBy")),
            "creado_por": usernames.get(o.get("createdBy")), "creado_en": stamp(o.get("createdAt")), "actualizado_en": stamp(o.get("createdAt")),
            "circuito": circuit, "turno": str(o.get("createdShift", "")), "anulada": circuit == "cancelled", "version": 1}, o["id"])
        order_numbers[str(o.get("number"))] = oid
        for l in requested:
            add("detalleordencarga", {"orden": oid, "producto": resolve("producto", l["productId"]), "cantidad_solicitada": qty(l.get("total"))})
        for d in o.get("deliveries", []):
            did = add("entregaordencarga", {"orden": oid, "fecha": stamp(d.get("date")), "fecha_operativa": stamp(d.get("date"))[:10], "turno": str(d.get("shift", "")),
                "inicio_carga": None, "fin_carga": None, "pallets_salida": qty(d.get("palletOut")), "pallets_entrada": qty(d.get("palletIn")),
                "chapadur_salida": qty(d.get("chapOut")), "chapadur_entrada": qty(d.get("chapIn")), "observaciones": nota_origen(d.get("note"), d.get("user")),
                "justificacion_stock": str(d.get("stockJustification", "")), "creado_por": usernames.get(d.get("user"))})
            for l in d.get("lines", []):
                add("detalleentregaordencarga", {"entrega": did, "producto": resolve("producto", l["productId"]), "producto_solicitado": resolve("producto", l.get("sourceProductId", l["productId"])), "cantidad_entregada": qty(l.get("total"), True)})
        for h in o.get("editHistory", []):
            add("auditoriaexpedicion", {"fecha": stamp(h.get("date")), "usuario": usernames.get(h.get("user")), "turno": str(h.get("shift", "")),
                "accion": "Corrección importada", "referencia": str(o.get("number", "")), "motivo": str(h.get("reason", "")),
                "antes": {**h.get("before", {}), "id": oid}, "despues": {**h.get("after", {}), "id": oid, "usuario_original": h.get("user", "")}})
    for m in data.get("movements", []):
        order = maps.get(("ordencarga", str(m.get("orderId"))))
        if not order and "orden" in str(m.get("type", "")).lower():
            order = order_numbers.get(str(m.get("ref")))
        original_type = str(m.get("type", "Movimiento"))
        normalized = original_type.lower()
        tipo = ("CORRECCION" if "corrección" in normalized and "orden" in normalized else
            "ORDEN_CARGA" if "orden de carga" in normalized else "PRODUCCION_SIN_CODIFICAR" if "producción" in normalized and "sin codificar" in normalized else
            "PRODUCCION" if "producción" in normalized else "CONSUMO_EMPLEADO" if "consumo de empleado" in normalized else
            "ANTICIPO_EMPLEADO" if "anticipo" in normalized else "BUFFET" if "buffet" in normalized else
            "TRANSFERENCIA" if "mendoza" in normalized or "san juan" in normalized else "REBOTE" if "rebote" in normalized else
            "DERRAME" if "derrame" in normalized else "AJUSTE" if "ajuste" in normalized else original_type[:30])
        add("movimientostock", {"producto": resolve("producto", m["productId"]), "tipo": tipo,
            "destino": "Mendoza" if "mendoza" in normalized else "San Juan" if "san juan" in normalized else "",
            "direccion": "ENTRADA" if m.get("dir") == "in" else "SALIDA", "sin_impacto": m.get("dir") not in {"in", "out"},
            "cantidad": qty(m.get("total")), "referencia": str(m.get("ref", "")), "observaciones": " · ".join(filter(None, [original_type, str(m.get("note", "")), "Usuario original: " + str(m.get("user", ""))])), "orden": order,
            "creado_por": usernames.get(m.get("user")), "creado_en": stamp(m.get("date")), "fecha_operativa": stamp(m.get("date"))[:10],
            "turno": str(m.get("shift", "")), "sin_codificar": m.get("productionClass") == "uncoded",
            "operacion": str(uuid.uuid5(uuid.NAMESPACE_URL, "talca/firebase/" + str(m.get("operationId") or m.get("id"))))})
    # En Firebase los comprobantes están en los movimientos del empleado.
    receipt_groups = defaultdict(list)
    empleados_legajo = {str(e.get("legajo")): e for e in data.get("employees", [])}
    for m in data.get("movements", []):
        if str(m.get("ref")) in empleados_legajo and m.get("receiptNumber"):
            receipt_groups[str(m["receiptNumber"])].append(m)
    for reference, group in receipt_groups.items():
        m = group[0]
        e = empleados_legajo[str(m["ref"])]
        match = re.search(r"(\d+)$", reference)
        if not match:
            raise ValidationError(f"Número de comprobante inválido: {reference}.")
        add("comprobanteempleado", {"numero": int(match.group(1)), "empleado": resolve("empleadoexpedicion", e["id"]),
            "tipo": "CONSUMO" if reference.startswith("CE") else "ANTICIPO", "fecha": stamp(m.get("date")),
            "usuario": usernames.get(m.get("user")), "turno": str(m.get("shift", "")), "observaciones": nota_origen(m.get("note"), m.get("user")),
            "lineas": [{"producto": resolve("producto", l["productId"]), "codigo": str(l["productId"]),
                "nombre": next(p["nombre"] for p in products if p["codigo"] == str(l["productId"])),
                "unidades": qty(l.get("total")), "pack": next(int(p.get("pack", 1)) for p in data["products"] if str(p["id"]) == str(l["productId"]))} for l in group]})
    for m in data.get("materialMoves", []):
        add("movimientomaterial", {"fletero": resolve("fletero", m.get("fleteroId")), "orden": maps.get(("ordencarga", str(m.get("orderId")))) or order_numbers.get(str(m.get("ref"))),
            "referencia": str(m.get("ref", "")), "origen": str(m.get("source", "")), "creado_por": usernames.get(m.get("user")),
            "creado_en": stamp(m.get("date")), "fecha_operativa": stamp(m.get("date"))[:10], "turno": str(m.get("shift", "")), "observaciones": nota_origen(m.get("note"), m.get("user")),
            "pallets_salida": qty(m.get("palletOut")), "pallets_entrada": qty(m.get("palletIn")), "chapadur_salida": qty(m.get("chapOut")), "chapadur_entrada": qty(m.get("chapIn"))})
    for c in data.get("counts", []):
        add("conteoexpedicion", {"fecha": stamp(c.get("date")), "usuario": usernames.get(c.get("user")), "turno": str(c.get("shift", "")), "tipo": str(c.get("type", "Cierre de turno")),
            "lineas": [{"producto": resolve("producto", l["productId"]), "codigo": str(l["productId"]), "nombre": next(p["nombre"] for p in products if p["codigo"] == str(l["productId"])),
                "fisico": qty(l.get("physical")), "diferencia": qty(l.get("diff"), True), "sistema": qty(l.get("physical")) - qty(l.get("diff"), True)} for l in c.get("differences", [])],
            "observaciones": nota_origen(c.get("note"), c.get("user")), "corroborado_por": usernames.get(c.get("correlatedBy")), "corroborado_en": stamp(c.get("correlatedAt")) if c.get("correlatedAt") else None})
    for a in data.get("audit", []):
        add("auditoriaexpedicion", {"fecha": stamp(a.get("date")), "usuario": usernames.get(a.get("user")), "turno": str(a.get("shift", "")),
            "accion": str(a.get("action", "Importado")), "referencia": str(a.get("ref", "")), "motivo": str(a.get("detail", "")),
            "antes": {}, "despues": {"origen": "Firebase", "entidad": a.get("entity", ""), "usuario_original": a.get("user", "")}})
    return {"formato": "talca-expedicion-django", "version": 1, "productos": products, "contadores": data.get("counters", {}),
        "usuarios": [{"id": u["id"], "username": u["username"]} for u in users], "registros": rows, "informe": informe}
