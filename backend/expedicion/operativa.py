"""Operaciones de expedición. Cantidades persistidas en unidades, nunca packs decimales.

Cada comando se ejecuta en una transacción. Los saldos se bloquean antes de
validarlos y las correcciones dejan movimientos compensatorios y auditoría.
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
import uuid

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied

from maestros.models import Producto
from .models import (
    AuditoriaExpedicion, ComprobanteEmpleado, ConfiguracionProducto,
    ConteoExpedicion, DetalleEntregaOrdenCarga, DetalleOrdenCarga,
    EmpleadoExpedicion, EntregaOrdenCarga, Fletero, MovimientoMaterial,
    MovimientoStock, OperacionExpedicion, OrdenCarga, StockProducto, ControlOperativa,
)
from .serializers import OrdenCargaSerializer
from core.permissions import es_administrador

CIRCUITOS = {
    "administrative": "Pendiente administrativo", "preventa": "Preventa",
    "distriC": "Distri C", "distriInterior": "Distri Interior",
    "oesteMendoza": "Oeste Mendoza", "oesteJeremias": "Oeste Jeremías",
    "immediate": "Salida inmediata", "cancelled": "Anulada",
}
OPERATIVOS = ("preventa", "distriC", "distriInterior", "oesteMendoza", "oesteJeremias")
FACTURACION = {"NO_APLICA", "PENDIENTE", "PAGADA", "PENDIENTE_AVISO", "AVISADA", "CORREGIDA"}
MATERIALES = ("pallets_salida", "pallets_entrada", "chapadur_salida", "chapadur_entrada")


def numero(value, *, entero=False, positivo=False):
    try:
        n = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError("Ingresá una cantidad válida.")
    if not n.is_finite() or n < 0 or n > Decimal("99999999999"):
        raise ValidationError("La cantidad debe ser finita, positiva y estar dentro del límite permitido.")
    if (entero and n != n.to_integral_value()) or n != n.quantize(Decimal("0.01")):
        raise ValidationError("Usá packs enteros y botellas sueltas enteras.")
    if positivo and not n:
        raise ValidationError("La cantidad debe ser mayor que cero.")
    return n


def texto(data, key, maximo=5000, obligatorio=False):
    value = str(data.get(key, "")).strip()
    if len(value) > maximo or (obligatorio and not value):
        raise ValidationError({key: "Completá este campo con un valor válido."})
    return value


def fecha(data):
    try:
        return date.fromisoformat(str(data.get("fecha") or timezone.localdate()))
    except ValueError:
        raise ValidationError("La fecha no es válida.")


def configuracion(producto):
    # Solo el catálogo comprobado tiene una conversión predeterminada.
    codigo = producto.codigo
    small = codigo in {"5051", "5056", "5061", "5066", "5071", "4171", "417"}
    large = codigo in {"5670", "5675", "5680", "5685", "5690"}
    known = small or large or codigo in {"8670", "4900", "4910"}
    return ConfiguracionProducto.objects.get_or_create(producto=producto, defaults={
        "unidades_pack": 12 if small else 6 if known else 1,
        "packs_corte": 15 if large else 42 if codigo == "BIDON" else 20,
        "cortes_pallet": 7 if small else 2 if codigo == "BIDON" else 4,
        "beneficio_empleado": large or codigo == "8670",
    })[0]


def lineas(data, key="lineas", permitir_cero=False):
    rows = data.get(key, [])
    if not isinstance(rows, list) or not rows or len(rows) > 500:
        raise ValidationError("Agregá al menos un producto (máximo 500).")
    result, usados = [], set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValidationError("Formato de producto inválido.")
        try:
            pid = int(row.get("producto", 0))
        except (ValueError, TypeError):
            raise ValidationError("Seleccioná un producto válido.")
        p = get_object_or_404(Producto, pk=pid, activo=True)
        try:
            source = int(row.get("solicitado") or p.pk)
        except (ValueError, TypeError):
            raise ValidationError("Seleccioná el producto solicitado.")
        pair = (p.pk, source if data.get("accion") == "entrega" else p.pk)
        if pair in usados:
            raise ValidationError("Un producto no puede estar repetido en la misma operación.")
        usados.add(pair)
        c = configuracion(p)
        cantidad = numero(row.get("packs", 0), entero=True) * c.unidades_pack + numero(row.get("unidades", 0), entero=True)
        if not cantidad and not permitir_cero:
            raise ValidationError(f"Ingresá la cantidad de {p.nombre}.")
        result.append((p, cantidad, int(source)))
    return sorted(result, key=lambda x: x[0].pk)


def auditoria(user, turno, accion, referencia="", motivo="", antes=None, despues=None):
    AuditoriaExpedicion.objects.create(usuario=user, turno=turno, accion=accion,
        referencia=str(referencia), motivo=motivo, antes=antes or {}, despues=despues or {})


def saldo(p):
    return StockProducto.objects.select_for_update().get_or_create(producto=p)[0]


def mover(p, cantidad, direccion, tipo, data, user, turno, operacion, orden=None, neutral=False, uncoded=False):
    s = saldo(p)
    c = configuracion(p)
    c = ConfiguracionProducto.objects.select_for_update().get(pk=c.pk)
    justificacion = texto(data, "justificacion")
    if direccion == "SALIDA" and not neutral:
        disponible = max(Decimal(0), s.cantidad_unidades - c.sin_codificar)
        if cantidad > disponible and cantidad <= s.cantidad_unidades:
            raise ValidationError(f"{p.nombre}: hay {disponible} unidades entregables. La producción sin codificar está bloqueada.")
        if cantidad > s.cantidad_unidades and not justificacion:
            raise ValidationError(f"Stock insuficiente de {p.nombre}. Ingresá una justificación.")
    if not neutral:
        s.cantidad_unidades += cantidad if direccion == "ENTRADA" else -cantidad
        s.save(update_fields=["cantidad_unidades", "actualizado_en"])
        if uncoded:
            c.sin_codificar += cantidad
            c.save(update_fields=["sin_codificar"])
    return MovimientoStock.objects.create(producto=p, cantidad=cantidad, direccion=direccion,
        destino=data.get("destino", "") if tipo == "TRANSFERENCIA" else "",
        tipo=tipo, referencia=texto(data, "referencia", 120), observaciones=justificacion or texto(data, "observaciones"),
        orden=orden, creado_por=user, turno=turno, operacion=operacion, fecha_operativa=fecha(data),
        sin_impacto=neutral, sin_codificar=uncoded)


def materiales(data, user, turno, orden=None, reverso=False):
    values = {k: numero(data.get(k, 0), entero=True) for k in MATERIALES}
    if not any(values.values()):
        return None
    if reverso:
        values = {"pallets_salida": values["pallets_entrada"], "pallets_entrada": values["pallets_salida"],
                  "chapadur_salida": values["chapadur_entrada"], "chapadur_entrada": values["chapadur_salida"]}
    f = orden.fletero if orden else get_object_or_404(Fletero, pk=data.get("fletero"), activo=True)
    return MovimientoMaterial.objects.create(fletero=f, orden=orden, creado_por=user, turno=turno,
        fecha_operativa=fecha(data), referencia=orden.numero if orden else texto(data, "referencia", 120),
        origen=texto(data, "origen", 120) or "Carga por turno", observaciones=texto(data, "observaciones"), **values)


def detalle_orden(o):
    datos = dict(OrdenCargaSerializer(o).data)
    resueltos = defaultdict(Decimal)
    sustituciones = False
    for entrega in o.entregas.all():
        for d in entrega.detalles.all():
            if d.producto_solicitado_id and d.producto_solicitado_id != d.producto_id:
                sustituciones = True
            else:
                resueltos[d.producto_id] += d.cantidad_entregada
    datos.update(circuito=o.circuito, turno=o.turno, anulada=o.anulada, version=o.version)
    for d in datos["detalles"]:
        d["resuelto"] = float(max(Decimal(0), min(Decimal(d["cantidad_solicitada"]), resueltos[d["producto"]])))
        d["pendiente"] = max(0, float(d["cantidad_solicitada"]) - d["resuelto"])
    pending = sum(d["pendiente"] for d in datos["detalles"])
    datos["estado_operativo"] = ("Anulada" if o.anulada else "Despachada" if not pending else
        "Pendiente de definición" if sustituciones else "Parcialmente despachada" if o.entregas.exists() else
        "PENDIENTE" if o.circuito == "administrative" else "Pendiente de despacho")
    for e, modelo in zip(datos["entregas"], o.entregas.all()):
        e["turno"] = modelo.turno
        e["fecha_operativa"] = str(modelo.fecha_operativa or timezone.localtime(modelo.fecha).date())
        e["detalles"] = [dict(id=d.pk, producto=d.producto_id, solicitado=d.producto_solicitado_id or d.producto_id,
            codigo=d.producto.codigo, producto_nombre=d.producto.nombre, cantidad_entregada=float(d.cantidad_entregada))
            for d in modelo.detalles.all()]
    return datos


def actualizar_estado(o):
    d = detalle_orden(o)
    o.estado = "COMPLETA" if d["estado_operativo"] == "Despachada" else "PARCIAL" if o.entregas.exists() else "RECIBIDA"
    o.version += 1
    o.save()


def guardar_orden(data, user, turno, op):
    existing = data.get("id")
    o = get_object_or_404(OrdenCarga.objects.select_for_update(), pk=existing) if existing else None
    before = detalle_orden(o) if o else {}
    if o:
        if data.get("version") != o.version:
            raise ValidationError("La orden cambió. Actualizá la pantalla antes de corregirla.")
        if o.anulada:
            raise ValidationError("La orden está anulada.")
        texto(data, "motivo", obligatorio=True)
    circuito = data.get("circuito", "administrative")
    if circuito not in CIRCUITOS or circuito == "cancelled":
        raise ValidationError("Seleccioná un circuito válido. Para anular, usá la acción de anulación.")
    if o and o.entregas.exists() and circuito != o.circuito:
        if o.circuito == "immediate" or circuito == "immediate" or (circuito == "administrative" and o.circuito != "administrative"):
            raise ValidationError("Una salida confirmada debe permanecer en un circuito operativo compatible.")
    numero_orden = texto(data, "numero", 60, True)
    if OrdenCarga.objects.filter(numero=numero_orden).exclude(pk=existing).exists():
        raise ValidationError("El número de orden ya existe.")
    f = get_object_or_404(Fletero, pk=data.get("fletero"), activo=True)
    rows = lineas(data)
    billing = data.get("facturacion", "NO_APLICA")
    if billing not in FACTURACION:
        raise ValidationError("Estado de facturación inválido.")
    o = o or OrdenCarga(creado_por=user)
    o.numero, o.fecha, o.fletero, o.circuito = numero_orden, fecha(data), f, circuito
    o.observaciones, o.facturacion = texto(data, "observaciones"), billing
    if not existing:
        o.turno = turno
    o.save()
    ids = []
    for p, qty, _ in rows:
        d, _ = DetalleOrdenCarga.objects.update_or_create(orden=o, producto=p, defaults={"cantidad_solicitada": qty})
        ids.append(d.pk)
    o.detalles.exclude(pk__in=ids).delete()
    if circuito == "immediate":
        previous = defaultdict(Decimal)
        for d in DetalleEntregaOrdenCarga.objects.filter(entrega__orden=o):
            previous[d.producto_id] += d.cantidad_entregada
        actual_rows = lineas(data, "entregado") if "entregado" in data else rows
        actual = {p.pk: qty for p, qty, _ in actual_rows}
        e = EntregaOrdenCarga.objects.create(orden=o, creado_por=user,
            turno=turno, fecha_operativa=fecha(data),
            observaciones=("Corrección: " + texto(data, "motivo")) if existing else texto(data, "observaciones"))
        # Correcciones compensatorias: entregas anteriores siguen existiendo.
        for pid in sorted(set(previous) | set(actual)):
            delta = actual.get(pid, Decimal(0)) - previous[pid]
            if delta:
                p = Producto.objects.get(pk=pid)
                mover(p, abs(delta), "SALIDA" if delta > 0 else "ENTRADA", "CORRECCION" if existing else "ORDEN_CARGA",
                    {**data, "referencia": o.numero}, user, turno, op, orden=o)
                DetalleEntregaOrdenCarga.objects.create(entrega=e, producto=p, producto_solicitado=p, cantidad_entregada=delta)
        if any(k in data for k in MATERIALES):
            antiguos = {k: sum((getattr(m, k) for m in o.movimientos_materiales.all()), Decimal(0)) for k in MATERIALES}
            objetivo = {k: numero(data.get(k, 0), entero=True) for k in MATERIALES}
            compensacion = {}
            for salida, entrada in (("pallets_salida", "pallets_entrada"), ("chapadur_salida", "chapadur_entrada")):
                delta = objetivo[salida] - objetivo[entrada] - antiguos[salida] + antiguos[entrada]
                compensacion[salida], compensacion[entrada] = max(Decimal(0), delta), max(Decimal(0), -delta)
            materiales({**data, **compensacion, "origen": "Corrección de materiales" if existing else "Orden de carga"}, user, turno, o)
            for k, v in compensacion.items():
                setattr(e, k, v)
            e.save(update_fields=list(MATERIALES))
    actualizar_estado(o)
    auditoria(user, turno, "Corregir orden" if existing else "Nueva orden", o.numero,
        texto(data, "motivo"), before, detalle_orden(o))
    return {"id": o.pk}


def entregar(data, user, turno, op):
    o = get_object_or_404(OrdenCarga.objects.select_for_update(), pk=data.get("id"))
    if o.anulada or o.circuito == "immediate":
        raise ValidationError("La orden no admite nuevas entregas.")
    if data.get("version") != o.version:
        raise ValidationError("La orden cambió. Actualizá antes de entregar.")
    before = detalle_orden(o)
    pending = {d["producto"]: Decimal(str(d["pendiente"])) for d in before["detalles"]}
    rows = lineas(data)
    # Se bloquean saldos en orden estable para evitar interbloqueos.
    from django.utils.dateparse import parse_datetime
    tiempos = {}
    for key in ("inicio_carga", "fin_carga"):
        raw = data.get(key)
        dt = parse_datetime(str(raw)) if raw else None
        if raw and not dt:
            raise ValidationError("Fecha/hora de carga inválida.")
        if dt and timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        tiempos[key] = dt
    if tiempos["inicio_carga"] and tiempos["fin_carga"] and tiempos["fin_carga"] < tiempos["inicio_carga"]:
        raise ValidationError("El fin de carga debe ser posterior al inicio.")
    e = EntregaOrdenCarga.objects.create(orden=o, creado_por=user, turno=turno, fecha_operativa=fecha(data), observaciones=texto(data, "observaciones"),
        justificacion_stock=texto(data, "justificacion"), **tiempos,
        **{k: numero(data.get(k, 0), entero=True) for k in MATERIALES})
    for p, qty, source in rows:
        if source not in pending or pending[source] <= 0:
            raise ValidationError("El producto solicitado no tiene pendiente.")
        # La referencia permite salidas superiores a lo solicitado: se registra
        # todo lo físico, pero solo se resuelve hasta el pedido original.
        mover(p, qty, "SALIDA", "ORDEN_CARGA", {**data, "referencia": o.numero}, user, turno, op, orden=o)
        DetalleEntregaOrdenCarga.objects.create(entrega=e, producto=p, producto_solicitado_id=source, cantidad_entregada=qty)
        if source != p.pk:
            o.facturacion = "PENDIENTE_AVISO"
    materiales({**data, "origen": "Orden de carga"}, user, turno, o)
    actualizar_estado(o)
    auditoria(user, turno, "Entrega", o.numero, texto(data, "observaciones"), before, detalle_orden(o))
    return {"id": o.pk}


def snapshot(user):
    productos = []
    saldos = {s.producto_id: s for s in StockProducto.objects.all()}
    orders = [detalle_orden(o) for o in OrdenCarga.objects.select_related("fletero", "creado_por")
        .prefetch_related("detalles__producto", "entregas__detalles__producto", "entregas__creado_por")]
    pend = defaultdict(lambda: defaultdict(float))
    for o in orders:
        if not o["anulada"] and o["circuito"] in OPERATIVOS:
            for d in o["detalles"]:
                pend[d["producto"]][o["circuito"]] += d["pendiente"]
    configs = {c.producto_id: c for c in ConfiguracionProducto.objects.all()}
    for p in Producto.objects.all():
        c = configs.get(p.pk)
        s = saldos.get(p.pk)
        manual = c.pendientes_manuales if c else {}
        ps = {k: pend[p.pk][k] + float(manual.get(k, 0)) for k in OPERATIVOS}
        productos.append(dict(id=p.pk, codigo=p.codigo, nombre=p.nombre, activo=p.activo,
            alias=c.alias if c else "", unidades_pack=c.unidades_pack if c else 1,
            packs_corte=c.packs_corte if c else 20, cortes_pallet=c.cortes_pallet if c else 4,
            configurado=c is not None, beneficio_empleado=c.beneficio_empleado if c else False,
            stock=float(s.cantidad_unidades) if s else 0, sin_codificar=float(c.sin_codificar) if c else 0,
            minimo=float(s.stock_minimo) if s else 0, critico=float(s.stock_critico) if s else 0,
            pendientes=ps, pendientes_manuales=manual))
    def persona(u):
        return (u.get_full_name() or u.username) if u else ""
    return dict(usuario=persona(user), admin=es_administrador(user), superusuario=user.is_superuser,
        productos=productos, ordenes=orders,
        fleteros=list(Fletero.objects.values()), empleados=list(EmpleadoExpedicion.objects.values()),
        movimientos=[dict(id=m.pk, producto=m.producto_id, tipo=m.tipo, destino=m.destino, direccion=m.direccion,
            cantidad=float(m.cantidad), referencia=m.referencia, observaciones=m.observaciones,
            orden=m.orden_id, operacion=str(m.operacion), fecha=str(m.fecha_operativa or timezone.localtime(m.creado_en).date()),
            turno=m.turno, usuario=persona(m.creado_por), sin_impacto=m.sin_impacto, sin_codificar=m.sin_codificar)
            for m in MovimientoStock.objects.select_related("creado_por")],
        materiales=[dict(id=m.pk, fletero=m.fletero_id, orden=m.orden_id, referencia=m.referencia, origen=m.origen,
            fecha=str(m.fecha_operativa or timezone.localtime(m.creado_en).date()), turno=m.turno,
            observaciones=m.observaciones, **{k: float(getattr(m, k)) for k in MATERIALES}) for m in MovimientoMaterial.objects.all()],
        comprobantes=[dict(id=c.pk, empleado=c.empleado_id, tipo=c.tipo, fecha=c.fecha.isoformat(),
            usuario=persona(c.usuario), turno=c.turno, lineas=c.lineas, observaciones=c.observaciones,
            numero=f'{"CE" if c.tipo == "CONSUMO" else "AE"}-{c.numero:06d}') for c in ComprobanteEmpleado.objects.select_related("usuario").order_by("-id")],
        conteos=[dict(id=c.pk, fecha=c.fecha.isoformat(), usuario=persona(c.usuario), turno=c.turno,
            tipo=c.tipo, lineas=c.lineas, observaciones=c.observaciones, corroborado_por=persona(c.corroborado_por),
            corroborado_en=c.corroborado_en.isoformat() if c.corroborado_en else None)
            for c in ConteoExpedicion.objects.select_related("usuario", "corroborado_por").order_by("-id")],
        auditoria=[dict(id=a.pk, fecha=a.fecha.isoformat(), usuario=persona(a.usuario), turno=a.turno,
            accion=a.accion, referencia=a.referencia, motivo=a.motivo, antes=a.antes, despues=a.despues)
            for a in AuditoriaExpedicion.objects.select_related("usuario")],
        usuarios=[dict(id=u.pk, username=u.username, nombre=persona(u), activo=u.is_active)
            for u in get_user_model().objects.all()] if es_administrador(user) else [])


@transaction.atomic
def comando(data, user):
    if not isinstance(data, dict):
        raise ValidationError("Formato de operación inválido.")
    turno = data.get("turno")
    if turno not in {"Mañana", "Tarde"}:
        raise ValidationError("Seleccioná el turno.")
    control, _ = ControlOperativa.objects.select_for_update().get_or_create(pk=1)
    try:
        op = uuid.UUID(str(data.get("clave")))
    except ValueError:
        raise ValidationError("Falta la clave de la operación.")
    # El bloqueo de usuario serializa reintentos con la misma clave.
    get_user_model().objects.select_for_update().get(pk=user.pk)
    previous = OperacionExpedicion.objects.filter(pk=op).first()
    if previous:
        if previous.usuario_id != user.pk:
            raise PermissionDenied()
        return previous.resultado
    action = data.get("accion")
    result = {}
    if action == "orden":
        result = guardar_orden(data, user, turno, op)
    elif action == "entrega":
        result = entregar(data, user, turno, op)
    elif action == "anular":
        o = get_object_or_404(OrdenCarga.objects.select_for_update(), pk=data.get("id"))
        if o.anulada:
            raise ValidationError("La orden ya está anulada.")
        if data.get("version") != o.version:
            raise ValidationError("La orden cambió. Actualizá la pantalla.")
        motivo = texto(data, "motivo", obligatorio=True)
        before = detalle_orden(o)
        # Revierte el saldo neto de TODOS los movimientos, también correcciones/sustituciones.
        net = defaultdict(Decimal)
        for m in o.movimientos_stock.all():
            if not m.sin_impacto:
                net[m.producto_id] += m.cantidad if m.direccion == "SALIDA" else -m.cantidad
        for pid, qty in sorted(net.items()):
            if qty:
                mover(Producto.objects.get(pk=pid), abs(qty), "ENTRADA" if qty > 0 else "SALIDA", "ANULACION",
                    {**data, "referencia": o.numero, "justificacion": motivo}, user, turno, op, orden=o)
        for m in list(o.movimientos_materiales.all()):
            materiales({**{k: getattr(m, k) for k in MATERIALES}, "origen": "Anulación", "observaciones": motivo}, user, turno, o, True)
        o.anulada = True
        actualizar_estado(o)
        auditoria(user, turno, "Anular orden", o.numero, motivo, before, detalle_orden(o))
    elif action == "movimiento":
        tipo = data.get("tipo")
        allowed = {"PRODUCCION", "PRODUCCION_SIN_CODIFICAR", "REBOTE", "DERRAME", "AJUSTE", "BUFFET", "TRANSFERENCIA"}
        if tipo not in allowed:
            raise ValidationError("Tipo de movimiento inválido.")
        direction = data.get("direccion", "ENTRADA")
        if direction not in {"ENTRADA", "SALIDA"}:
            raise ValidationError("Dirección inválida.")
        if tipo in {"PRODUCCION", "PRODUCCION_SIN_CODIFICAR", "REBOTE"}:
            direction = "ENTRADA"
        if tipo == "BUFFET":
            direction = "SALIDA"
        if tipo == "AJUSTE":
            texto(data, "justificacion", obligatorio=True)
        if tipo == "TRANSFERENCIA":
            texto(data, "referencia", 120, True)
            if data.get("destino") not in {"Mendoza", "San Juan"}:
                raise ValidationError("Seleccioná Mendoza o San Juan.")
        rows = lineas(data)
        for p, qty, _ in rows:
            mover(p, qty, direction, tipo, data, user, turno, op,
                neutral=tipo == "DERRAME", uncoded=tipo == "PRODUCCION_SIN_CODIFICAR")
        if tipo == "TRANSFERENCIA":
            materiales({**data, "origen": ("Recepción desde " if direction == "ENTRADA" else "Envío a ") + data["destino"]}, user, turno)
        auditoria(user, turno, tipo, data.get("referencia", ""), texto(data, "justificacion"),
            despues={"operacion": str(op), "lineas": [{"producto": p.pk, "unidades": float(q)} for p, q, _ in rows]})
    elif action == "corregir_movimiento":
        ms = MovimientoStock.objects.select_for_update().filter(operacion=data.get("operacion"))
        if not ms.exists() or ms.filter(orden__isnull=False).exists():
            raise ValidationError("Corregí los movimientos de órdenes desde la orden.")
        before = list(ms.values("id", "referencia", "fecha_operativa"))
        before = [{**x, "fecha_operativa": str(x["fecha_operativa"])} for x in before]
        ms.update(referencia=texto(data, "referencia", 120), fecha_operativa=fecha(data))
        auditoria(user, turno, "Corregir movimiento", data["operacion"], texto(data, "motivo", obligatorio=True), {"movimientos": before}, {"fecha": str(fecha(data)), "referencia": data.get("referencia", "")})
    elif action == "materiales":
        m = materiales(data, user, turno)
        if not m:
            raise ValidationError("Ingresá al menos una cantidad de materiales.")
        auditoria(user, turno, "Materiales", m.pk, texto(data, "observaciones"))
    elif action == "pendientes":
        p = get_object_or_404(Producto, pk=data.get("producto"))
        c = configuracion(p)
        c = ConfiguracionProducto.objects.select_for_update().get(pk=c.pk)
        before = c.pendientes_manuales
        c.pendientes_manuales = {k: float(numero(data.get("pendientes", {}).get(k, 0), entero=True)) for k in OPERATIVOS}
        c.save()
        auditoria(user, turno, "Pendientes manuales", p.codigo, texto(data, "motivo", obligatorio=True), before, c.pendientes_manuales)
    elif action == "fletero":
        f = get_object_or_404(Fletero, pk=data["id"]) if data.get("id") else Fletero()
        f.nombre = texto(data, "nombre", 120, True)
        f.apellido, f.empresa = texto(data, "apellido", 120), texto(data, "empresa", 150)
        f.activo = data.get("activo", True) is True
        f.save()
        result = {"id": f.pk}
        auditoria(user, turno, "Guardar fletero", f.pk)
    elif action == "producto":
        p = get_object_or_404(Producto, pk=data["id"]) if data.get("id") else Producto(familia="GASEOSA")
        codigo = texto(data, "codigo", 30, True)
        if Producto.objects.filter(codigo=codigo).exclude(pk=p.pk).exists():
            raise ValidationError("El código de producto ya existe.")
        if p.pk and codigo != p.codigo:
            raise ValidationError("El código de un producto existente no se modifica.")
        p.codigo, p.nombre, p.activo = codigo, texto(data, "nombre", 150, True), data.get("activo", True) is True
        p.save()
        c = configuracion(p)
        c.alias = texto(data, "alias", 30)
        for field in ("unidades_pack", "packs_corte", "cortes_pallet"):
            setattr(c, field, int(numero(data.get(field, 1), entero=True, positivo=True)))
        if any(getattr(c, f) > 100000 for f in ("unidades_pack", "packs_corte", "cortes_pallet")):
            raise ValidationError("Las equivalencias deben ser menores o iguales a 100000.")
        c.beneficio_empleado = data.get("beneficio_empleado", False) is True
        c.save()
        s = saldo(p)
        s.stock_minimo, s.stock_critico = numero(data.get("minimo", 0)), numero(data.get("critico", 0))
        s.save()
        auditoria(user, turno, "Configurar producto", p.codigo, despues={"unidades_pack": c.unidades_pack, "alias": c.alias})
    elif action == "empleado":
        e = get_object_or_404(EmpleadoExpedicion, pk=data["id"]) if data.get("id") else EmpleadoExpedicion()
        legajo = texto(data, "legajo", 30, True)
        if EmpleadoExpedicion.objects.filter(legajo=legajo).exclude(pk=e.pk).exists():
            raise ValidationError("El legajo ya existe.")
        e.legajo, e.nombre, e.apellido = legajo, texto(data, "nombre", 150, True), texto(data, "apellido", 150)
        e.activo = data.get("activo", True) is True
        e.save()
        auditoria(user, turno, "Guardar empleado", e.legajo)
    elif action == "acreditar":
        empleados = list(EmpleadoExpedicion.objects.select_for_update().filter(activo=True).order_by("pk"))
        for e in empleados:
            e.saldo_fardos += 2
        EmpleadoExpedicion.objects.bulk_update(empleados, ["saldo_fardos"])
        auditoria(user, turno, "Acreditar beneficio", "Empleados activos", texto(data, "motivo", obligatorio=True), despues={"empleados": [e.pk for e in empleados], "fardos": 2})
    elif action == "consumo":
        e = get_object_or_404(EmpleadoExpedicion.objects.select_for_update(), pk=data.get("empleado"), activo=True)
        tipo = data.get("tipo")
        if tipo not in {"CONSUMO", "ANTICIPO"}:
            raise ValidationError("Tipo de comprobante inválido.")
        rows = lineas(data)
        packs = Decimal(0)
        for p, qty, _ in rows:
            c = configuracion(p)
            if tipo == "CONSUMO":
                if not c.beneficio_empleado or qty % c.unidades_pack:
                    raise ValidationError("El beneficio admite solo fardos completos de productos habilitados.")
                packs += qty / c.unidades_pack
        if packs > e.saldo_fardos:
            raise ValidationError("El empleado no tiene saldo suficiente.")
        e.saldo_fardos -= int(packs)
        e.save()
        campo_contador = "contador_consumo" if tipo == "CONSUMO" else "contador_anticipo"
        secuencia = max(getattr(control, campo_contador), ComprobanteEmpleado.objects.filter(tipo=tipo).aggregate(n=Max("numero"))["n"] or 0) + 1
        setattr(control, campo_contador, secuencia)
        receipt = ComprobanteEmpleado.objects.create(empleado=e, tipo=tipo, numero=secuencia, usuario=user, turno=turno,
            observaciones=texto(data, "observaciones"), lineas=[{"producto": p.pk, "codigo": p.codigo, "nombre": p.nombre,
                "unidades": float(qty), "pack": configuracion(p).unidades_pack} for p, qty, _ in rows])
        for p, qty, _ in rows:
            mover(p, qty, "SALIDA", "CONSUMO_EMPLEADO" if tipo == "CONSUMO" else "ANTICIPO_EMPLEADO",
                {**data, "referencia": f'{"CE" if tipo == "CONSUMO" else "AE"}-{receipt.numero:06d}'}, user, turno, op)
        auditoria(user, turno, tipo, receipt.pk, despues={"empleado": e.pk, "saldo": e.saldo_fardos})
        result = {"comprobante": receipt.pk}
    elif action == "conteo":
        rows = lineas(data, permitir_cero=True)
        tipo = data.get("tipo")
        if tipo not in {"Cierre de turno", "Apertura / corroboración"}:
            raise ValidationError("Tipo de conteo inválido.")
        details = []
        for p, qty, _ in rows:
            s = saldo(p)
            details.append({"producto": p.pk, "codigo": p.codigo, "nombre": p.nombre, "sistema": float(s.cantidad_unidades), "fisico": float(qty), "diferencia": float(qty - s.cantidad_unidades)})
        c = ConteoExpedicion.objects.create(usuario=user, turno=turno, tipo=tipo, lineas=details,
            observaciones=texto(data, "observaciones"), corroborado_por=user if tipo.startswith("Apertura") else None,
            corroborado_en=timezone.now() if tipo.startswith("Apertura") else None)
        auditoria(user, turno, "Conteo", c.pk, despues={"lineas": details})
    elif action == "corroborar":
        c = get_object_or_404(ConteoExpedicion.objects.select_for_update(), pk=data.get("id"))
        if c.corroborado_en or c.turno == turno:
            raise ValidationError("El relevo debe corroborarlo el turno siguiente y solo una vez.")
        c.corroborado_por, c.corroborado_en = user, timezone.now()
        c.save()
        auditoria(user, turno, "Corroborar relevo", c.pk)
    elif action == "usuario":
        from core.cuentas import guardar_cuenta
        payload = {"username": data.get("username"), "nombre": data.get("nombre", ""), "activo": data.get("activo", True)}
        if data.get("password"):
            payload["password"] = data["password"]
        if not data.get("id"):
            payload["modulos"] = ["EXPEDICION"]
        # No se permite elevar privilegios por el endpoint anterior.
        if any(k in data for k in ("is_superuser", "is_staff", "grupos", "groups", "administrador", "modulos")):
            raise ValidationError("Asigná accesos desde Administración > Usuarios.")
        u = guardar_cuenta(user, payload, data.get("id"))
        auditoria(user, turno, "Gestionar usuario", u.username)
    else:
        raise ValidationError("Operación desconocida.")
    OperacionExpedicion.objects.create(clave=op, usuario=user, resultado=result)
    control.revision += 1
    control.save(update_fields=["revision", "contador_consumo", "contador_anticipo"])
    return result
