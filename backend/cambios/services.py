from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction

from maestros.models import (
    Concesionario,
    MotivoCambio,
    MotivoCambioFamilia,
    Producto,
)

from .models import (
    DetalleReciboCambio,
    ReciboCambio,
)


# =========================================================
# UTILIDADES
# =========================================================

def convertir_decimal(valor, nombre_campo):
    """
    Convierte un valor a Decimal y valida
    que sea un número válido y no negativo.
    """

    if valor in (
        None,
        "",
    ):
        return Decimal("0")

    try:
        numero = Decimal(
            str(valor)
        )

    except (
        InvalidOperation,
        TypeError,
        ValueError,
    ):
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


def combinar_observaciones(
    observacion_actual,
    observacion_nueva,
):
    """
    Conserva la observación anterior cuando
    una nueva carga se acumula sobre un recibo.
    """

    actual = str(
        observacion_actual or ""
    ).strip()

    nueva = str(
        observacion_nueva or ""
    ).strip()

    if not nueva:
        return actual

    if not actual:
        return nueva

    if nueva == actual:
        return actual

    return (
        f"{actual} | {nueva}"
    )


# =========================================================
# OBTENER MAESTROS
# =========================================================

def obtener_producto(
    producto_id,
):
    """
    Obtiene un producto activo.
    """

    try:

        return Producto.objects.get(
            id=producto_id,
            activo=True,
        )

    except Producto.DoesNotExist:

        raise ValidationError(
            {
                "producto_id":
                    (
                        "El producto seleccionado "
                        "no existe o está inactivo."
                    )
            }
        )


def obtener_motivo(
    motivo_id,
):
    """
    Obtiene un motivo activo.

    Puede devolver None porque un producto
    puede quedar sin clasificar.
    """

    if motivo_id in (
        None,
        "",
    ):
        return None

    try:

        return MotivoCambio.objects.get(
            id=motivo_id,
            activo=True,
        )

    except MotivoCambio.DoesNotExist:

        raise ValidationError(
            {
                "motivo_id":
                    (
                        "El motivo seleccionado "
                        "no existe o está inactivo."
                    )
            }
        )


def obtener_concesionario(
    concesionario,
):
    """
    Permite recibir un objeto Concesionario
    o directamente su ID.
    """

    if isinstance(
        concesionario,
        int,
    ):

        try:

            return Concesionario.objects.get(
                id=concesionario,
                activo=True,
            )

        except Concesionario.DoesNotExist:

            raise ValidationError(
                {
                    "concesionario_id":
                        (
                            "El concesionario seleccionado "
                            "no existe o está inactivo."
                        )
                }
            )

    if not concesionario:

        raise ValidationError(
            {
                "concesionario_id":
                    "Debe seleccionar un concesionario."
            }
        )

    if not concesionario.activo:

        raise ValidationError(
            {
                "concesionario_id":
                    (
                        "El concesionario seleccionado "
                        "está inactivo."
                    )
            }
        )

    return concesionario


# =========================================================
# VALIDAR MOTIVO SEGÚN FAMILIA
# =========================================================

def validar_motivo_producto(
    *,
    producto,
    motivo,
):
    """
    Comprueba que el motivo seleccionado esté
    habilitado para la familia del producto.
    """

    if motivo is None:
        return

    if not motivo.activo:

        raise ValidationError(
            {
                "motivo":
                    (
                        f"El motivo '{motivo.nombre}' "
                        "está inactivo."
                    )
            }
        )

    permitido = (
        MotivoCambioFamilia.objects
        .filter(
            motivo=motivo,
            familia=producto.familia,
        )
        .exists()
    )

    if not permitido:

        raise ValidationError(
            {
                "motivo":
                    (
                        f"El motivo '{motivo.nombre}' "
                        f"no está permitido para "
                        f"la familia {producto.familia}."
                    )
            }
        )


# =========================================================
# NUEVA CARGA / ACUMULACIÓN
# =========================================================

@transaction.atomic
def guardar_recibo_cambio(
    *,
    fecha,
    concesionario,
    detalles=None,

    pallets=0,
    pallets_observacion="",

    pallets_descargados=0,
    pallets_descargados_observacion="",

    prensados=0,
    prensados_observacion="",

    creado_por=None,
):
    """
    Crea un recibo nuevo o acumula información
    sobre uno existente.

    REGLA PRINCIPAL:

        FECHA + CONCESIONARIO
        identifica un único recibo.

    Si ya existe:
        - suma pallets
        - suma pallets descargados
        - suma prensados
        - suma cantidades de productos repetidos

    Si un producto no estaba:
        crea un nuevo detalle.
    """

    detalles = list(
        detalles or []
    )

    concesionario = (
        obtener_concesionario(
            concesionario
        )
    )

    pallets = convertir_decimal(
        pallets,
        "pallets",
    )

    pallets_descargados = (
        convertir_decimal(
            pallets_descargados,
            "pallets_descargados",
        )
    )

    prensados = convertir_decimal(
        prensados,
        "prensados",
    )


    # =====================================================
    # BUSCAR RECIBO EXISTENTE
    # =====================================================

    recibo = (
        ReciboCambio.objects
        .select_for_update()
        .filter(
            fecha=fecha,
            concesionario=concesionario,
        )
        .first()
    )

    creado = False


    # =====================================================
    # CREAR NUEVO RECIBO
    # =====================================================

    if recibo is None:

        recibo = ReciboCambio.objects.create(

            fecha=fecha,

            concesionario=
                concesionario,

            pallets=
                pallets,

            pallets_observacion=
                str(
                    pallets_observacion
                    or ""
                ).strip(),

            pallets_descargados=
                pallets_descargados,

            pallets_descargados_observacion=
                str(
                    pallets_descargados_observacion
                    or ""
                ).strip(),

            prensados=
                prensados,

            prensados_observacion=
                str(
                    prensados_observacion
                    or ""
                ).strip(),

            creado_por=
                creado_por,
        )

        creado = True


    # =====================================================
    # ACUMULAR SOBRE RECIBO EXISTENTE
    # =====================================================

    else:

        recibo.pallets = (
            recibo.pallets
            + pallets
        )

        recibo.pallets_descargados = (
            recibo.pallets_descargados
            + pallets_descargados
        )

        recibo.prensados = (
            recibo.prensados
            + prensados
        )

        recibo.pallets_observacion = (
            combinar_observaciones(
                recibo.pallets_observacion,
                pallets_observacion,
            )
        )

        recibo.pallets_descargados_observacion = (
            combinar_observaciones(
                recibo
                    .pallets_descargados_observacion,
                pallets_descargados_observacion,
            )
        )

        recibo.prensados_observacion = (
            combinar_observaciones(
                recibo.prensados_observacion,
                prensados_observacion,
            )
        )

        recibo.save()


    # =====================================================
    # PROCESAR PRODUCTOS
    # =====================================================

    for detalle_data in detalles:

        producto_id = detalle_data.get(
            "producto_id"
        )

        producto = obtener_producto(
            producto_id
        )

        cantidad = convertir_decimal(
            detalle_data.get(
                "cantidad",
                0,
            ),
            "cantidad",
        )

        # Una carga con cantidad 0 no genera detalle.
        if cantidad <= 0:
            continue

        motivo = obtener_motivo(
            detalle_data.get(
                "motivo_id"
            )
        )

        validar_motivo_producto(
            producto=producto,
            motivo=motivo,
        )

        observacion = str(
            detalle_data.get(
                "observacion",
                ""
            )
            or ""
        ).strip()


        # =================================================
        # BUSCAR PRODUCTO EXISTENTE EN EL RECIBO
        # =================================================

        detalle = (
            DetalleReciboCambio.objects
            .select_for_update()
            .filter(
                recibo=recibo,
                producto=producto,
            )
            .first()
        )


        # =================================================
        # PRODUCTO NUEVO
        # =================================================

        if detalle is None:

            DetalleReciboCambio.objects.create(

                recibo=recibo,

                producto=producto,

                cantidad=cantidad,

                observacion=
                    observacion,

                motivo=motivo,
            )


        # =================================================
        # PRODUCTO EXISTENTE → ACUMULAR
        # =================================================

        else:

            detalle.cantidad = (
                detalle.cantidad
                + cantidad
            )

            detalle.observacion = (
                combinar_observaciones(
                    detalle.observacion,
                    observacion,
                )
            )

            # Si llega un motivo nuevo,
            # reemplaza la clasificación anterior.
            #
            # Si no llega motivo,
            # conserva el que ya tenía.
            if motivo is not None:
                detalle.motivo = motivo

            detalle.save()


    return {
        "recibo": recibo,
        "creado": creado,
    }


# =========================================================
# EDICIÓN
# =========================================================

@transaction.atomic
def actualizar_recibo_cambio(
    *,
    recibo,
    fecha,
    concesionario,
    detalles=None,

    pallets=0,
    pallets_observacion="",

    pallets_descargados=0,
    pallets_descargados_observacion="",

    prensados=0,
    prensados_observacion="",
):
    """
    Edita un recibo existente.

    IMPORTANTE:

    Esta función NO ACUMULA.

    Si había:

        cantidad = 15

    y el usuario edita:

        cantidad = 12

    el resultado es:

        cantidad = 12

    NO:

        15 + 12 = 27
    """

    detalles = list(
        detalles or []
    )

    concesionario = (
        obtener_concesionario(
            concesionario
        )
    )


    # =====================================================
    # EVITAR DUPLICADO FECHA + CONCESIONARIO
    # =====================================================

    existe_otro = (
        ReciboCambio.objects
        .filter(
            fecha=fecha,
            concesionario=concesionario,
        )
        .exclude(
            id=recibo.id
        )
        .exists()
    )

    if existe_otro:

        raise ValidationError(
            {
                "fecha":
                    (
                        "Ya existe otro recibo para "
                        "esa fecha y ese concesionario."
                    )
            }
        )


    # =====================================================
    # VALIDAR LOS DETALLES PRIMERO
    # =====================================================

    detalles_preparados = []

    productos_usados = set()


    for detalle_data in detalles:

        producto = obtener_producto(
            detalle_data.get(
                "producto_id"
            )
        )


        # Dentro de un recibo no queremos
        # el mismo producto dos veces.
        if producto.id in productos_usados:

            raise ValidationError(
                {
                    "detalles":
                        (
                            f"El producto "
                            f"{producto.codigo} "
                            "está repetido."
                        )
                }
            )

        productos_usados.add(
            producto.id
        )


        cantidad = convertir_decimal(
            detalle_data.get(
                "cantidad",
                0,
            ),
            "cantidad",
        )


        # Si una fila queda en cero,
        # no se conserva dentro del recibo.
        if cantidad <= 0:
            continue


        motivo = obtener_motivo(
            detalle_data.get(
                "motivo_id"
            )
        )


        validar_motivo_producto(
            producto=producto,
            motivo=motivo,
        )


        observacion = str(
            detalle_data.get(
                "observacion",
                ""
            )
            or ""
        ).strip()


        detalles_preparados.append(
            {
                "producto":
                    producto,

                "cantidad":
                    cantidad,

                "motivo":
                    motivo,

                "observacion":
                    observacion,
            }
        )


    # =====================================================
    # REEMPLAZAR DATOS GENERALES
    # =====================================================

    recibo.fecha = fecha

    recibo.concesionario = (
        concesionario
    )

    recibo.pallets = convertir_decimal(
        pallets,
        "pallets",
    )

    recibo.pallets_observacion = str(
        pallets_observacion
        or ""
    ).strip()

    recibo.pallets_descargados = (
        convertir_decimal(
            pallets_descargados,
            "pallets_descargados",
        )
    )

    recibo.pallets_descargados_observacion = str(
        pallets_descargados_observacion
        or ""
    ).strip()

    recibo.prensados = convertir_decimal(
        prensados,
        "prensados",
    )

    recibo.prensados_observacion = str(
        prensados_observacion
        or ""
    ).strip()

    recibo.save()


    # =====================================================
    # SINCRONIZAR PRODUCTOS
    # =====================================================
    #
    # Estamos editando, por lo tanto reconstruimos
    # los detalles con los valores enviados desde React.
    # =====================================================

    recibo.detalles.all().delete()


    DetalleReciboCambio.objects.bulk_create(
        [
            DetalleReciboCambio(

                recibo=recibo,

                producto=
                    item["producto"],

                cantidad=
                    item["cantidad"],

                motivo=
                    item["motivo"],

                observacion=
                    item["observacion"],
            )

            for item in detalles_preparados
        ]
    )


    return recibo