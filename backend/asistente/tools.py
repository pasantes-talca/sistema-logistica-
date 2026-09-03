from decimal import Decimal

from django.db.models import Count, Sum

from cambios.models import (
    DetalleReciboCambio,
    ReciboCambio,
)
from rechazos.models import Rechazo
from repartos.models import (
    Reparto,
    RepartoPersonal,
)


def decimal_a_float(valor):
    if valor is None:
        return 0

    if isinstance(valor, Decimal):
        return float(valor)

    return valor


# ============================================================
# REPARTOS
# ============================================================

def consultar_repartos(
    desde=None,
    hasta=None,
    asignacion_codigo=None,
):
    """
    Consulta repartos.
    SOLO LECTURA.
    """

    queryset = (
        Reparto.objects
        .select_related(
            "asignacion",
            "vehiculo",
        )
        .all()
    )

    if desde:
        queryset = queryset.filter(
            fecha__gte=desde
        )

    if hasta:
        queryset = queryset.filter(
            fecha__lte=hasta
        )

    if asignacion_codigo:
        queryset = queryset.filter(
            asignacion__codigo=
                asignacion_codigo
        )


    total_repartos = queryset.count()


    totales = queryset.aggregate(
        total_bultos=Sum("bultos"),
        total_recargas=Sum("recargas"),
    )


    por_asignacion = (
        queryset
        .values(
            "asignacion__codigo"
        )
        .annotate(
            cantidad=Count("id"),
            bultos=Sum("bultos"),
        )
        .order_by(
            "-cantidad"
        )
    )


    return {
        "total_repartos":
            total_repartos,

        "total_bultos":
            decimal_a_float(
                totales["total_bultos"]
            ),

        "recargas_por_reparto":
            decimal_a_float(
                totales["total_recargas"]
            ),

        "por_asignacion": [
            {
                "asignacion":
                    item[
                        "asignacion__codigo"
                    ]
                    or "Sin asignación",

                "cantidad":
                    item["cantidad"],

                "bultos":
                    decimal_a_float(
                        item["bultos"]
                    ),
            }
            for item
            in por_asignacion
        ],
    }


# ============================================================
# RECARGAS POR EMPLEADO
# ============================================================

def consultar_recargas(
    desde=None,
    hasta=None,
    empleado=None,
):
    """
    Consulta las recargas acumuladas por empleado.

    Cada persona participante del reparto suma
    las recargas correspondientes a ese reparto.

    SOLO LECTURA.
    """

    personal = (
        RepartoPersonal.objects
        .select_related(
            "empleado",
            "reparto",
        )
        .filter(
            reparto__recargas__gt=0
        )
    )


    if desde:
        personal = personal.filter(
            reparto__fecha__gte=desde
        )


    if hasta:
        personal = personal.filter(
            reparto__fecha__lte=hasta
        )


    consulta = (
        personal
        .values(
            "empleado_id"
        )
        .annotate(
            recargas=Sum(
                "reparto__recargas"
            ),
            participaciones=Count(
                "id"
            ),
        )
        .order_by(
            "-recargas"
        )
    )


    resultados = []


    for item in consulta:

        registro = (
            personal
            .filter(
                empleado_id=
                    item["empleado_id"]
            )
            .select_related(
                "empleado"
            )
            .first()
        )


        if not registro:
            continue


        nombre = str(
            registro.empleado
        )


        if (
            empleado
            and empleado.lower()
            not in nombre.lower()
        ):
            continue


        resultados.append(
            {
                "empleado_id":
                    item["empleado_id"],

                "empleado":
                    nombre,

                "recargas":
                    decimal_a_float(
                        item["recargas"]
                    ),

                "participaciones":
                    item[
                        "participaciones"
                    ],
            }
        )


    total_recargas = sum(
        item["recargas"]
        for item
        in resultados
    )


    return {
        "total_recargas":
            total_recargas,

        "empleados":
            resultados,
    }


# ============================================================
# RECHAZOS
# ============================================================

def consultar_rechazos(
    desde=None,
    hasta=None,
    asignacion_codigo=None,
):
    """
    Consulta rechazos.
    SOLO LECTURA.
    """

    queryset = (
        Rechazo.objects
        .select_related(
            "asignacion",
            "motivo",
        )
        .all()
    )


    if desde:
        queryset = queryset.filter(
            fecha__gte=desde
        )


    if hasta:
        queryset = queryset.filter(
            fecha__lte=hasta
        )


    if asignacion_codigo:
        queryset = queryset.filter(
            asignacion__codigo=
                asignacion_codigo
        )


    total = queryset.count()


    motivos = (
        queryset
        .values(
            "motivo__nombre"
        )
        .annotate(
            cantidad=Count("id")
        )
        .order_by(
            "-cantidad"
        )
    )


    por_asignacion = (
        queryset
        .values(
            "asignacion__codigo"
        )
        .annotate(
            cantidad=Count("id")
        )
        .order_by(
            "-cantidad"
        )
    )


    return {
        "total_rechazos":
            total,

        "motivos": [
            {
                "motivo":
                    item[
                        "motivo__nombre"
                    ]
                    or "Sin motivo",

                "cantidad":
                    item["cantidad"],
            }
            for item
            in motivos
        ],

        "por_asignacion": [
            {
                "asignacion":
                    item[
                        "asignacion__codigo"
                    ]
                    or "Sin asignación",

                "cantidad":
                    item["cantidad"],
            }
            for item
            in por_asignacion
        ],
    }


# ============================================================
# CAMBIOS
# ============================================================

def consultar_cambios(
    desde=None,
    hasta=None,
    concesionario=None,
    producto=None,
):
    """
    Consulta recibos de cambios y sus productos.
    SOLO LECTURA.
    """

    recibos = (
        ReciboCambio.objects
        .select_related(
            "concesionario"
        )
        .all()
    )


    if desde:
        recibos = recibos.filter(
            fecha__gte=desde
        )


    if hasta:
        recibos = recibos.filter(
            fecha__lte=hasta
        )


    if concesionario:
        recibos = recibos.filter(
            concesionario__nombre__icontains=
                concesionario
        )


    total_recibos = (
        recibos.count()
    )


    pallets = recibos.aggregate(
        pallets=Sum(
            "pallets"
        ),

        pallets_descargados=Sum(
            "pallets_descargados"
        ),

        prensados=Sum(
            "prensados"
        ),
    )


    detalles = (
        DetalleReciboCambio.objects
        .select_related(
            "producto",
            "recibo__concesionario",
        )
        .filter(
            recibo__in=recibos
        )
    )


    if producto:
        detalles = detalles.filter(
            producto__nombre__icontains=
                producto
        )


    total_cantidad = (
        detalles.aggregate(
            total=Sum(
                "cantidad"
            )
        )["total"]
        or 0
    )


    por_producto = (
        detalles
        .values(
            "producto__codigo",
            "producto__nombre",
        )
        .annotate(
            cantidad=Sum(
                "cantidad"
            )
        )
        .order_by(
            "-cantidad"
        )
    )


    por_concesionario = (
        detalles
        .values(
            "recibo__concesionario__nombre"
        )
        .annotate(
            cantidad=Sum(
                "cantidad"
            )
        )
        .order_by(
            "-cantidad"
        )
    )


    return {
        "total_recibos":
            total_recibos,

        "total_cantidad":
            decimal_a_float(
                total_cantidad
            ),

        "pallets":
            decimal_a_float(
                pallets["pallets"]
            ),

        "pallets_descargados":
            decimal_a_float(
                pallets[
                    "pallets_descargados"
                ]
            ),

        "prensados":
            decimal_a_float(
                pallets["prensados"]
            ),

        "por_producto": [
            {
                "codigo":
                    item[
                        "producto__codigo"
                    ],

                "producto":
                    item[
                        "producto__nombre"
                    ],

                "cantidad":
                    decimal_a_float(
                        item["cantidad"]
                    ),
            }
            for item
            in por_producto
        ],

        "por_concesionario": [
            {
                "concesionario":
                    item[
                        "recibo__concesionario__nombre"
                    ],

                "cantidad":
                    decimal_a_float(
                        item["cantidad"]
                    ),
            }
            for item
            in por_concesionario
        ],
    }


# ============================================================
# RESUMEN GENERAL
# ============================================================

def consultar_resumen_general(
    desde=None,
    hasta=None,
):
    """
    Resume los tres sistemas.
    SOLO LECTURA.
    """

    repartos = consultar_repartos(
        desde=desde,
        hasta=hasta,
    )

    recargas = consultar_recargas(
        desde=desde,
        hasta=hasta,
    )

    rechazos = consultar_rechazos(
        desde=desde,
        hasta=hasta,
    )

    cambios = consultar_cambios(
        desde=desde,
        hasta=hasta,
    )


    return {
        "repartos":
            repartos,

        "recargas":
            recargas,

        "rechazos":
            rechazos,

        "cambios":
            cambios,
    }