from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum

from .models import (
    DetalleEntregaOrdenCarga,
    MovimientoMaterial,
    MovimientoStock,
    OrdenCarga,
    StockProducto,
)


# ============================================================
# UTILIDADES
# ============================================================

def convertir_decimal(valor, nombre_campo):
    try:
        numero = Decimal(str(valor))
    except Exception:
        raise ValidationError(
            {
                nombre_campo:
                    "Debe ingresar un número válido."
            }
        )

    if numero < 0:
        raise ValidationError(
            {
                nombre_campo:
                    "El valor no puede ser negativo."
            }
        )

    return numero


# ============================================================
# STOCK
# ============================================================

@transaction.atomic
def obtener_o_crear_stock(producto):
    stock, _ = (
        StockProducto.objects
        .select_for_update()
        .get_or_create(
            producto=producto,
            defaults={
                "cantidad_unidades": 0,
                "stock_minimo": 0,
                "stock_critico": 0,
            },
        )
    )

    return stock


@transaction.atomic
def registrar_movimiento_stock(
    *,
    producto,
    tipo,
    direccion,
    cantidad,
    referencia="",
    observaciones="",
    orden=None,
    creado_por=None,
):
    cantidad = convertir_decimal(
        cantidad,
        "cantidad",
    )

    if cantidad == 0:
        raise ValidationError(
            {
                "cantidad":
                    "La cantidad debe ser mayor a cero."
            }
        )

    stock = obtener_o_crear_stock(
        producto
    )

    if direccion == MovimientoStock.Direccion.ENTRADA:

        stock.cantidad_unidades += cantidad

    elif direccion == MovimientoStock.Direccion.SALIDA:

        stock.cantidad_unidades -= cantidad

    else:

        raise ValidationError(
            {
                "direccion":
                    "La dirección del movimiento no es válida."
            }
        )

    stock.save(
        update_fields=[
            "cantidad_unidades",
            "actualizado_en",
        ]
    )

    movimiento = MovimientoStock.objects.create(
        producto=producto,
        tipo=tipo,
        direccion=direccion,
        cantidad=cantidad,
        referencia=referencia,
        observaciones=observaciones,
        orden=orden,
        creado_por=creado_por,
    )

    return movimiento


# ============================================================
# MATERIALES
# ============================================================

@transaction.atomic
def registrar_movimiento_material(
    *,
    fletero,
    orden=None,
    referencia="",
    origen="",
    pallets_salida=0,
    pallets_entrada=0,
    chapadur_salida=0,
    chapadur_entrada=0,
    creado_por=None,
):
    return MovimientoMaterial.objects.create(
        fletero=fletero,
        orden=orden,
        referencia=referencia,
        origen=origen,
        pallets_salida=convertir_decimal(
            pallets_salida,
            "pallets_salida",
        ),
        pallets_entrada=convertir_decimal(
            pallets_entrada,
            "pallets_entrada",
        ),
        chapadur_salida=convertir_decimal(
            chapadur_salida,
            "chapadur_salida",
        ),
        chapadur_entrada=convertir_decimal(
            chapadur_entrada,
            "chapadur_entrada",
        ),
        creado_por=creado_por,
    )


# ============================================================
# ESTADO DE ORDEN
# ============================================================

def calcular_cantidad_entregada(
    *,
    orden,
    producto,
):
    resultado = (
        DetalleEntregaOrdenCarga.objects
        .filter(
            entrega__orden=orden,
            producto=producto,
        )
        .aggregate(
            total=Sum(
                "cantidad_entregada"
            )
        )["total"]
    )

    return resultado or Decimal("0")


@transaction.atomic
def actualizar_estado_orden(
    orden
):
    detalles = (
        orden.detalles
        .select_related(
            "producto"
        )
        .all()
    )

    if not detalles.exists():
        orden.estado = (
            OrdenCarga.Estado.RECIBIDA
        )

        orden.save(
            update_fields=[
                "estado",
                "actualizado_en",
            ]
        )

        return orden


    hubo_entrega = False
    todo_completo = True


    for detalle in detalles:

        entregado = (
            calcular_cantidad_entregada(
                orden=orden,
                producto=detalle.producto,
            )
        )

        if entregado > 0:
            hubo_entrega = True

        if (
            entregado
            <
            detalle.cantidad_solicitada
        ):
            todo_completo = False


    if todo_completo:

        orden.estado = (
            OrdenCarga.Estado.COMPLETA
        )

    elif hubo_entrega:

        orden.estado = (
            OrdenCarga.Estado.PARCIAL
        )

    else:

        orden.estado = (
            OrdenCarga.Estado.RECIBIDA
        )


    orden.save(
        update_fields=[
            "estado",
            "actualizado_en",
        ]
    )

    return orden


# ============================================================
# CONFIRMAR ENTREGA
# ============================================================

@transaction.atomic
def confirmar_entrega_orden(
    *,
    entrega,
    creado_por=None,
):
    if not entrega.detalles.exists():

        raise ValidationError(
            {
                "detalles":
                    (
                        "La entrega debe contener "
                        "al menos un producto."
                    )
            }
        )


    orden = entrega.orden


    for detalle in (
        entrega.detalles
        .select_related(
            "producto"
        )
        .all()
    ):

        registrar_movimiento_stock(
            producto=detalle.producto,
            tipo=(
                MovimientoStock.Tipo.ORDEN_CARGA
            ),
            direccion=(
                MovimientoStock.Direccion.SALIDA
            ),
            cantidad=(
                detalle.cantidad_entregada
            ),
            referencia=orden.numero,
            observaciones=(
                entrega.justificacion_stock
                or entrega.observaciones
            ),
            orden=orden,
            creado_por=creado_por,
        )


    registrar_movimiento_material(
        fletero=orden.fletero,
        orden=orden,
        referencia=orden.numero,
        origen="Orden de carga",
        pallets_salida=(
            entrega.pallets_salida
        ),
        pallets_entrada=(
            entrega.pallets_entrada
        ),
        chapadur_salida=(
            entrega.chapadur_salida
        ),
        chapadur_entrada=(
            entrega.chapadur_entrada
        ),
        creado_por=creado_por,
    )


    actualizar_estado_orden(
        orden
    )

    return entrega