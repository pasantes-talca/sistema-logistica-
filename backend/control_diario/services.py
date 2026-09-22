from collections import defaultdict
from decimal import Decimal

from django.db import transaction

from control_diario.models import (
    ControlDiario,
    MovimientoControlDiario,
)


@transaction.atomic
def crear_control_diario(
    *,
    fecha,
    observaciones,
    movimientos,
    usuario=None,
):

    control = ControlDiario.objects.create(
        fecha=fecha,
        observaciones=observaciones,
        creado_por=usuario,
    )

    objetos = []

    for movimiento in movimientos:

        cantidad = movimiento["cantidad"]

        if cantidad <= 0:
            continue

        objetos.append(
            MovimientoControlDiario(
                control=control,
                producto=movimiento["producto"],
                ubicacion=movimiento["ubicacion"],
                tipo_movimiento=(
                    movimiento["tipo_movimiento"]
                ),
                cantidad=cantidad,
                observaciones=(
                    movimiento.get(
                        "observaciones",
                        "",
                    )
                ),
            )
        )

    if objetos:

        MovimientoControlDiario.objects.bulk_create(
            objetos
        )

    return control


def obtener_resumen_control(
    control,
):

    resumen = defaultdict(
        lambda: {
            "disponible": Decimal("0"),
            "reserva": Decimal("0"),
            "asignacion": Decimal("0"),
            "stock_deposito": Decimal("0"),
            "distribucion": Decimal("0"),
            "pendiente": Decimal("0"),
            "ajuste": Decimal("0"),
        }
    )


    movimientos = (
        control.movimientos
        .select_related(
            "producto",
            "ubicacion",
        )
        .all()
    )


    for movimiento in movimientos:

        producto_id = movimiento.producto_id

        tipo = movimiento.tipo_movimiento

        cantidad = movimiento.cantidad


        if tipo == MovimientoControlDiario.TipoMovimiento.DISPONIBLE:

            resumen[producto_id][
                "disponible"
            ] += cantidad


        elif tipo == MovimientoControlDiario.TipoMovimiento.RESERVA:

            resumen[producto_id][
                "reserva"
            ] += cantidad


        elif tipo == MovimientoControlDiario.TipoMovimiento.ASIGNACION:

            resumen[producto_id][
                "asignacion"
            ] += cantidad


        elif tipo == MovimientoControlDiario.TipoMovimiento.STOCK_DEPOSITO:

            resumen[producto_id][
                "stock_deposito"
            ] += cantidad


        elif tipo == MovimientoControlDiario.TipoMovimiento.DISTRIBUCION:

            resumen[producto_id][
                "distribucion"
            ] += cantidad


        elif tipo == MovimientoControlDiario.TipoMovimiento.PENDIENTE:

            resumen[producto_id][
                "pendiente"
            ] += cantidad


        elif tipo == MovimientoControlDiario.TipoMovimiento.AJUSTE:

            resumen[producto_id][
                "ajuste"
            ] += cantidad


    resultado = []

    productos = {}


    for movimiento in movimientos:

        productos[
            movimiento.producto_id
        ] = movimiento.producto


    for producto_id, valores in resumen.items():

        producto = productos[
            producto_id
        ]


        resultado.append(
            {
                "producto_id":
                    producto.id,

                "producto_nombre":
                    producto.nombre,

                "disponible":
                    valores[
                        "disponible"
                    ],

                "reserva":
                    valores[
                        "reserva"
                    ],

                "asignacion":
                    valores[
                        "asignacion"
                    ],

                "stock_deposito":
                    valores[
                        "stock_deposito"
                    ],

                "distribucion":
                    valores[
                        "distribucion"
                    ],

                "pendiente":
                    valores[
                        "pendiente"
                    ],

                "ajuste":
                    valores[
                        "ajuste"
                    ],
            }
        )


    resultado.sort(
        key=lambda item:
            productos[
                item["producto_id"]
            ].orden
    )


    return resultado