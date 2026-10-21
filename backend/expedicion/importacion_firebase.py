"""Carga controlada del respaldo de Pablo. No ejecuta comandos de negocio."""
import hashlib
import json
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from django.db import connection, transaction
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from maestros.models import Producto
from .firebase_import import convertir
from .firebase_preparacion import preparar, sin_credenciales
from .models import (ControlOperativa, OperacionExpedicion, RespaldoExpedicion, OrdenCarga,
    DetalleOrdenCarga, EntregaOrdenCarga, DetalleEntregaOrdenCarga, MovimientoStock,
    MovimientoMaterial, EmpleadoExpedicion, ComprobanteEmpleado, ConfiguracionProducto,
    StockProducto, ConteoExpedicion)
from .respaldos import MODELOS, restaurar


def leer_archivo(path):
    raw = Path(path).read_bytes()
    if len(raw) > 25_000_000:
        raise ValidationError("El respaldo excede 25 MB.")
    payload = json.loads(raw.decode("utf-8-sig"))
    if payload.get("app") != "Talca Expedición" or payload.get("schemaVersion") != 1:
        raise ValidationError("Aplicación o versión de respaldo no admitida.")
    return payload, hashlib.sha256(raw).hexdigest()


def comprobar(converted, fuente):
    """Comparación completa tras guardar: FK, cantidades, fechas y saldos."""
    data = fuente.get("data", fuente)
    codes = dict(Producto.objects.values_list("pk", "codigo"))
    destination_products = {p.codigo: p.pk for p in Producto.objects.all()}
    product_map = {p["id"]: destination_products[p["codigo"]] for p in converted["productos"]}
    # Compara cada campo de cada fila, no solo totales: fechas, autores,
    # cantidades, observaciones, JSON y vínculos de entregas y materiales.
    import copy
    by_model = defaultdict(list)
    for row in converted["registros"]:
        by_model[row["model"]].append(row)
    for model in MODELOS:
        expected_rows = by_model[model._meta.label_lower]
        expected_count = len(expected_rows) + (1 if model._meta.model_name == "auditoriaexpedicion" else 0)
        if model.objects.count() != expected_count:
            raise ValidationError(f"Cantidad inesperada en {model._meta.db_table}.")
        saved_rows = model.objects.in_bulk([r["pk"] for r in expected_rows])
        for row in expected_rows:
            saved = saved_rows[row["pk"]]
            for name, value in row["fields"].items():
                field = model._meta.get_field(name)
                expected = copy.deepcopy(value)
                if field.is_relation and field.related_model == Producto:
                    expected = product_map.get(value) if value is not None else None
                if name == "lineas":
                    for line in expected:
                        if "producto" in line:
                            line["producto"] = product_map[line["producto"]]
                expected = field.to_python(expected)
                if getattr(saved, field.attname) != expected:
                    raise ValidationError(f"Campo diferente al origen: {model._meta.db_table}.{name}, fila {row['pk']}.")
    orders = {o.numero: o for o in OrdenCarga.objects.prefetch_related("detalles", "entregas__detalles")}
    if len(orders) != len(data["orders"]):
        raise ValidationError("La cantidad de órdenes no coincide con el origen.")
    for source in data["orders"]:
        o = orders[str(source["number"])]
        if o.fecha.isoformat() != source["date"] or o.anulada != (source.get("pendingType") == "cancelled"):
            raise ValidationError("Se detectó una diferencia en fecha o anulación de orden.")
        expected = {str(l["productId"]): Decimal(str(l.get("total", 0))) for l in source["requestLines"]}
        got = {codes[l.producto_id]: l.cantidad_solicitada for l in o.detalles.all()}
        if expected != got:
            raise ValidationError(f"Productos o cantidades diferentes en orden {o.numero}.")
        actual_resolved = defaultdict(Decimal)
        deliveries = list(o.entregas.all())
        if len(deliveries) != len(source.get("deliveries", [])):
            raise ValidationError("Cantidad de entregas diferente al origen.")
        for e in deliveries:
            for l in e.detalles.all():
                actual_resolved[codes[l.producto_solicitado_id or l.producto_id]] += l.cantidad_entregada
        for l in source["requestLines"]:
            if actual_resolved[str(l["productId"])] != Decimal(str(l.get("resolvedTotal", 0))):
                raise ValidationError(f"Entregado/resuelto distinto en orden {o.numero}.")
    for code, stock in data["stock"].items():
        saved = StockProducto.objects.get(producto__codigo=str(code))
        if saved.cantidad_unidades != Decimal(str(stock)):
            raise ValidationError(f"Stock diferente en {code}.")
    for e in data.get("employees", []):
        saved = EmpleadoExpedicion.objects.get(legajo=str(e["legajo"]))
        if saved.saldo_fardos != e.get("balance", 0) or saved.activo != e.get("active", True):
            raise ValidationError("Saldo o estado de empleado diferente al origen.")
    expected_moves = Counter((str(m["productId"]), str(m["dir"]), str(m.get("ref", "")), Decimal(str(m.get("total", 0)))) for m in data.get("movements", []))
    actual_moves = Counter((codes[m.producto_id], "neutral" if m.sin_impacto else "in" if m.direccion == "ENTRADA" else "out", m.referencia, m.cantidad) for m in MovimientoStock.objects.all())
    if expected_moves != actual_moves:
        raise ValidationError("Los movimientos guardados no coinciden con los originales.")
    for field, source_key in [("pallets_salida", "palletOut"), ("pallets_entrada", "palletIn"), ("chapadur_salida", "chapOut"), ("chapadur_entrada", "chapIn")]:
        expected_total = sum((Decimal(str(m.get(source_key, 0))) for m in data.get("materialMoves", [])), Decimal(0))
        got_total = sum(MovimientoMaterial.objects.values_list(field, flat=True), Decimal(0))
        if expected_total != got_total:
            raise ValidationError("Saldo de materiales diferente al origen.")
    for r in converted["registros"]:
        if r["model"] == "expedicion.configuracionproducto":
            fields = r["fields"]
            code = next(p["codigo"] for p in converted["productos"] if p["id"] == fields["producto"])
            config = ConfiguracionProducto.objects.get(producto__codigo=code)
            if config.pendientes_manuales != fields["pendientes_manuales"] or config.sin_codificar != Decimal(str(fields["sin_codificar"])):
                raise ValidationError("Configuración de pendientes/sin codificar diferente.")
    ctrl = ControlOperativa.objects.get(pk=1)
    if ctrl.contador_consumo != data.get("counters", {}).get("CE", 0) or ctrl.contador_anticipo != data.get("counters", {}).get("AE", 0):
        raise ValidationError("Numeradores de comprobantes diferentes al origen.")
    connection.check_constraints()
    return {"ordenes": OrdenCarga.objects.count(), "entregas": EntregaOrdenCarga.objects.count(),
        "lineas_solicitadas": DetalleOrdenCarga.objects.count(), "lineas_entregadas": DetalleEntregaOrdenCarga.objects.count(),
        "stock_actual_informado": StockProducto.objects.count(), "movimientos_stock": MovimientoStock.objects.count(),
        "movimientos_materiales": MovimientoMaterial.objects.count(), "empleados": EmpleadoExpedicion.objects.count(),
        "comprobantes": ComprobanteEmpleado.objects.count(), "conteos": ConteoExpedicion.objects.count()}


@transaction.atomic
def cargar(payload, actor, huella, solo_vacio=True):
    # Evita que lleguen operaciones mientras se comprueba/carga el módulo vacío.
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [202610210001])
            cursor.execute("SET LOCAL lock_timeout='5s'")
            tables = [m._meta.db_table for m in [*MODELOS, OperacionExpedicion, ControlOperativa, RespaldoExpedicion]]
            cursor.execute("LOCK TABLE " + ",".join(connection.ops.quote_name(t) for t in tables) + " IN SHARE ROW EXCLUSIVE MODE")
    marker = f"Fuente Firebase SHA256 {huella}"
    if RespaldoExpedicion.objects.filter(motivo=marker).exists():
        raise ValidationError("Este archivo ya fue importado. No se repitió la carga.")
    if solo_vacio and any(m.objects.exists() for m in [*MODELOS, OperacionExpedicion]):
        raise ValidationError("Expedición ya contiene registros. No se reemplazó ni eliminó información.")
    fuente, report = preparar(payload)
    converted = convertir(payload)
    existing_products = {p.codigo: (p.pk, p.nombre, p.familia, p.presentacion, p.sabor, p.activo) for p in Producto.objects.all()}
    existing_users = list(get_user_model().objects.order_by("pk").values())
    restaurar(converted, actor)
    checks = comprobar(converted, fuente)
    if existing_users != list(get_user_model().objects.order_by("pk").values()):
        raise ValidationError("Se detectó una modificación inesperada de cuentas. Se revierte la carga.")
    for p in Producto.objects.filter(codigo__in=existing_products):
        if existing_products[p.codigo] != (p.pk, p.nombre, p.familia, p.presentacion, p.sabor, p.activo):
            raise ValidationError("Se detectó un cambio en el catálogo compartido existente.")
    RespaldoExpedicion.objects.create(usuario=actor, motivo=marker, datos={"formato": "fuente-firebase-sin-credenciales", "sha256": huella,
        "fuente": sin_credenciales(payload), "informe": report, "validacion": checks})
    from core.auditoria import registrar
    registrar(actor, "EXPEDICION", "Importar respaldo Firebase", huella,
        "Carga autorizada de respaldo de Pablo en módulo vacío, sin recalcular saldos.", despues={"informe": report, "validacion": checks})
    return {"sha256": huella, "validacion": checks, "informe": report}
