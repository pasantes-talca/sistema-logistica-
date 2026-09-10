import re
from datetime import datetime

from openpyxl import load_workbook


# ============================================================
# UTILIDADES
# ============================================================

def normalizar_texto(valor):
    return str(
        valor or ""
    ).strip().lower()


def normalizar_carga(valor):
    """
    Convierte 70, 70.0, '70', etc. en '70'.
    """

    if valor in (None, ""):
        return ""

    if isinstance(valor, float):
        if valor.is_integer():
            return str(int(valor))

    if isinstance(valor, int):
        return str(valor)

    texto = str(valor).strip()

    try:
        numero = float(texto)

        if numero.is_integer():
            return str(int(numero))

    except ValueError:
        pass

    return texto


def convertir_numero(valor):
    """
    Convierte clientes/bultos a número.

    Si está vacío devuelve 0.
    """

    if valor in (None, ""):
        return 0

    try:
        numero = float(valor)

        if numero.is_integer():
            return int(numero)

        return numero

    except (
        TypeError,
        ValueError,
    ):
        return 0


# ============================================================
# FECHA
# ============================================================

def extraer_fecha(hoja):
    """
    Busca una fecha DD/MM/YYYY en las primeras filas.
    """

    patron = re.compile(
        r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})"
    )

    for fila in hoja.iter_rows(
        min_row=1,
        max_row=min(
            5,
            hoja.max_row,
        ),
        values_only=True,
    ):

        for valor in fila:

            if isinstance(
                valor,
                datetime,
            ):
                return valor.date()

            texto = str(
                valor or ""
            )

            coincidencia = patron.search(
                texto
            )

            if coincidencia:

                dia = int(
                    coincidencia.group(1)
                )

                mes = int(
                    coincidencia.group(2)
                )

                anio = int(
                    coincidencia.group(3)
                )

                return datetime(
                    anio,
                    mes,
                    dia,
                ).date()

    return None


# ============================================================
# DETECTAR FILA DE ENCABEZADOS
# ============================================================

def buscar_fila_encabezados(hoja):
    """
    Busca automáticamente la fila que contiene:

        Zona/Ruta | Clientes | Bultos

    No dependemos de que siempre sea la fila 3.
    """

    limite = min(
        hoja.max_row,
        20,
    )

    for numero_fila in range(
        1,
        limite + 1,
    ):

        for columna in range(
            1,
            hoja.max_column - 1,
        ):

            valor_1 = normalizar_texto(
                hoja.cell(
                    numero_fila,
                    columna,
                ).value
            )

            valor_2 = normalizar_texto(
                hoja.cell(
                    numero_fila,
                    columna + 1,
                ).value
            )

            valor_3 = normalizar_texto(
                hoja.cell(
                    numero_fila,
                    columna + 2,
                ).value
            )

            if (
                valor_1 == "zona/ruta"
                and valor_2 == "clientes"
                and valor_3 == "bultos"
            ):
                return numero_fila

    return None


# ============================================================
# LECTOR PRINCIPAL
# ============================================================

def leer_planilla_distribucion(
    archivo,
):
    """
    Lee dinámicamente la planilla de distribución.

    Devuelve un registro por bloque:

        carga
        chofer
        clientes
        bultos
        rutas
    """

    libro = load_workbook(
        archivo,
        data_only=True,
    )

    # Si existe la hoja habitual la usamos.
    # Si cambia el nombre, usamos la primera.
    if "Distribucion 2026" in libro.sheetnames:

        hoja = libro[
            "Distribucion 2026"
        ]

    else:

        hoja = libro.active


    fecha = extraer_fecha(
        hoja
    )


    fila_encabezados = (
        buscar_fila_encabezados(
            hoja
        )
    )


    if fila_encabezados is None:

        raise ValueError(
            (
                "No se pudo encontrar la estructura "
                "'Zona/Ruta - Clientes - Bultos' "
                "en la planilla de distribución."
            )
        )


    # La fila anterior contiene:
    #
    # TALCA | CHOFER | N° CARGA
    fila_datos_carga = (
        fila_encabezados - 1
    )


    registros = []


    # Cada reparto ocupa un bloque
    # de tres columnas.
    for columna_inicio in range(
        1,
        hoja.max_column + 1,
        3,
    ):

        if (
            columna_inicio + 2
            > hoja.max_column
        ):
            break


        encabezado_1 = normalizar_texto(
            hoja.cell(
                fila_encabezados,
                columna_inicio,
            ).value
        )

        encabezado_2 = normalizar_texto(
            hoja.cell(
                fila_encabezados,
                columna_inicio + 1,
            ).value
        )

        encabezado_3 = normalizar_texto(
            hoja.cell(
                fila_encabezados,
                columna_inicio + 2,
            ).value
        )


        # Si no es un bloque válido,
        # lo ignoramos.
        if not (
            encabezado_1 == "zona/ruta"
            and encabezado_2 == "clientes"
            and encabezado_3 == "bultos"
        ):
            continue


        empresa = str(
            hoja.cell(
                fila_datos_carga,
                columna_inicio,
            ).value
            or ""
        ).strip()


        chofer = str(
            hoja.cell(
                fila_datos_carga,
                columna_inicio + 1,
            ).value
            or ""
        ).strip()


        carga = normalizar_carga(
            hoja.cell(
                fila_datos_carga,
                columna_inicio + 2,
            ).value
        )


        if not carga and not chofer:
            continue


        fila_total = None


        # Buscar TOTAL dentro del bloque.
        for numero_fila in range(
            fila_encabezados + 1,
            hoja.max_row + 1,
        ):

            valor = normalizar_texto(
                hoja.cell(
                    numero_fila,
                    columna_inicio,
                ).value
            )

            if valor == "total":

                fila_total = numero_fila

                break


        if fila_total is None:
            continue


        clientes = convertir_numero(
            hoja.cell(
                fila_total,
                columna_inicio + 1,
            ).value
        )


        bultos = convertir_numero(
            hoja.cell(
                fila_total,
                columna_inicio + 2,
            ).value
        )


        # ====================================================
        # RUTAS
        # ====================================================

        rutas = []


        for numero_fila in range(
            fila_encabezados + 1,
            fila_total,
        ):

            zona = str(
                hoja.cell(
                    numero_fila,
                    columna_inicio,
                ).value
                or ""
            ).strip()


            clientes_ruta = (
                convertir_numero(
                    hoja.cell(
                        numero_fila,
                        columna_inicio + 1,
                    ).value
                )
            )


            bultos_ruta = (
                convertir_numero(
                    hoja.cell(
                        numero_fila,
                        columna_inicio + 2,
                    ).value
                )
            )


            if (
                zona
                or clientes_ruta
                or bultos_ruta
            ):

                rutas.append(
                    {
                        "zona":
                            zona,

                        "clientes":
                            clientes_ruta,

                        "bultos":
                            bultos_ruta,
                    }
                )


        registros.append(
            {
                "empresa":
                    empresa,

                "carga":
                    carga,

                "chofer":
                    chofer,

                "clientes":
                    clientes,

                "bultos":
                    bultos,

                "rutas":
                    rutas,

                # Si no tuvo actividad,
                # después podremos ignorarlo.
                "activo":
                    (
                        clientes > 0
                        or bultos > 0
                    ),
            }
        )


    return {
        "fecha":
            fecha,

        "registros":
            registros,
    }