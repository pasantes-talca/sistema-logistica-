import unicodedata

from repartos.services import calcular_recargas

from .lectores.rutas import (
    leer_planilla_distribucion,
)

from .lectores.salidas import (
    leer_planilla_salidas,
)


# ============================================================
# UTILIDADES
# ============================================================

def normalizar_nombre(valor):
    """
    Permite comparar:

        M.FRANCO
        m.franco
        M. FRANCO

    de una manera más tolerante.
    """

    texto = str(
        valor or ""
    ).strip().lower()

    texto = unicodedata.normalize(
        "NFKD",
        texto
    )

    texto = "".join(
        caracter
        for caracter in texto
        if not unicodedata.combining(
            caracter
        )
    )

    texto = (
        texto
        .replace(" ", "")
        .replace(".", "")
        .replace(",", "")
        .replace("-", "")
    )

    return texto


# ============================================================
# PROCESAR
# ============================================================

def procesar_planillas(
    *,
    archivo_rutas,
    archivo_salidas,
):

    distribucion = (
        leer_planilla_distribucion(
            archivo_rutas
        )
    )

    salidas = (
        leer_planilla_salidas(
            archivo_salidas
        )
    )


    errores = []
    advertencias = []


    # ========================================================
    # FECHAS
    # ========================================================

    fecha_distribucion = (
        distribucion["fecha"]
    )

    fecha_salidas = (
        salidas["fecha"]
    )


    if (
        fecha_distribucion
        and fecha_salidas
        and fecha_distribucion
        != fecha_salidas
    ):

        errores.append(
            {
                "tipo":
                    "fechas_diferentes",

                "mensaje":
                    (
                        "Las dos planillas "
                        "corresponden a fechas diferentes."
                    ),

                "fecha_distribucion":
                    fecha_distribucion.isoformat(),

                "fecha_salidas":
                    fecha_salidas.isoformat(),
            }
        )


    # ========================================================
    # SOLO CARGAS ACTIVAS
    # ========================================================

    rutas_activas = [
        registro

        for registro
        in distribucion["registros"]

        if registro["activo"]
    ]


    registros_salidas = (
        salidas["registros"]
    )


    # ========================================================
    # ÍNDICES
    # ========================================================

    salidas_por_carga = {
        registro["carga"]:
            registro

        for registro
        in registros_salidas
    }


    usados_salidas = set()

    resultado = []


    # ========================================================
    # CRUZAR
    # ========================================================

    for ruta in rutas_activas:

        carga_distribucion = (
            ruta["carga"]
        )

        salida = (
            salidas_por_carga.get(
                carga_distribucion
            )
        )

        estado = "ok"

        mensaje_advertencia = None


        # ====================================================
        # SI NO COINCIDE LA CARGA,
        # INTENTAR POR CHOFER
        # ====================================================

        if salida is None:

            chofer_normalizado = (
                normalizar_nombre(
                    ruta["chofer"]
                )
            )


            coincidencias = [
                item

                for item
                in registros_salidas

                if normalizar_nombre(
                    item["chofer"]
                )
                == chofer_normalizado
            ]


            if len(
                coincidencias
            ) == 1:

                salida = (
                    coincidencias[0]
                )

                estado = (
                    "advertencia"
                )

                mensaje_advertencia = (
                    (
                        f"El chofer "
                        f"{ruta['chofer']} "
                        "coincide en ambas planillas, "
                        "pero el N° de carga es distinto: "
                        f"Distribución "
                        f"{carga_distribucion} / "
                        f"Salida de personal "
                        f"{salida['carga']}."
                    )
                )

                advertencias.append(
                    {
                        "tipo":
                            "carga_inconsistente",

                        "chofer":
                            ruta["chofer"],

                        "carga_distribucion":
                            carga_distribucion,

                        "carga_personal":
                            salida["carga"],

                        "mensaje":
                            mensaje_advertencia,
                    }
                )


        # ====================================================
        # NO SE PUDO CRUZAR
        # ====================================================

        if salida is None:

            errores.append(
                {
                    "tipo":
                        "sin_salida_personal",

                    "carga":
                        carga_distribucion,

                    "chofer":
                        ruta["chofer"],

                    "mensaje":
                        (
                            f"No se encontró una salida "
                            f"de personal para la carga "
                            f"{carga_distribucion}."
                        ),
                }
            )

            continue


        usados_salidas.add(
            salida["carga"]
        )


        # ========================================================
        # CALCULAR RECARGAS
        # ========================================================

        cantidad_ayudantes = len(
            salida["ayudantes"]
        )

        calculo_recargas = calcular_recargas(
            bultos=ruta["bultos"],
            cantidad_ayudantes=cantidad_ayudantes,
            hay_chofer=True,
        )


        resultado.append(
            {
                # Por ahora mostramos ambas
                # para que Ariel pueda validar.
                "carga_distribucion":
                    carga_distribucion,

                "carga_personal":
                    salida["carga"],

                "chofer_distribucion":
                    ruta["chofer"],

                "chofer":
                    salida["chofer"],

                "patente":
                    salida["patente"],

                "combustible":
                    salida["combustible"],

                "ayudantes":
                    salida["ayudantes"],

                "clientes":
                    ruta["clientes"],

                "bultos":
                    ruta["bultos"],

                "rutas":
                    ruta["rutas"],

                "observaciones":
                    salida[
                        "observaciones"
                    ],

                "estado":
                    estado,

                "advertencia":
                    mensaje_advertencia,

                "cantidad_ayudantes":
                    cantidad_ayudantes,

                "cantidad_personas":
                    calculo_recargas[
                        "cantidad_personas"
                    ],

                "recargas":
                    calculo_recargas[
                        "recargas"
                    ],

                "recargas_totales":
                    calculo_recargas[
                        "recargas_totales"
                    ],
            }
        )


    # ========================================================
    # SALIDAS SIN DISTRIBUCIÓN
    # ========================================================

    for salida in registros_salidas:

        if (
            salida["carga"]
            not in usados_salidas
        ):

            advertencias.append(
                {
                    "tipo":
                        "salida_sin_distribucion",

                    "carga":
                        salida["carga"],

                    "chofer":
                        salida["chofer"],

                    "mensaje":
                        (
                            f"La carga "
                            f"{salida['carga']} "
                            "aparece en Salida de Personal "
                            "pero no se encontró una "
                            "distribución activa equivalente."
                        ),
                }
            )


    fecha = (
        fecha_distribucion
        or fecha_salidas
    )


    return {
        "fecha":
            (
                fecha.isoformat()
                if fecha
                else None
            ),

        "cantidad":
            len(resultado),

        "registros":
            resultado,

        "errores":
            errores,

        "advertencias":
            advertencias,
    }