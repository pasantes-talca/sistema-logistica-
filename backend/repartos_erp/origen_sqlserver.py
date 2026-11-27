from .sqlserver import obtener_conexion_sqlserver


def convertir_fila(cursor, fila):
    """
    Convierte una fila devuelta por pyodbc
    en un diccionario usando los nombres
    originales de las columnas.
    """

    columnas = [
        columna[0]
        for columna in cursor.description
    ]

    return dict(
        zip(
            columnas,
            fila,
        )
    )


def consultar_todos(cursor):
    """
    Convierte todas las filas de una consulta
    en una lista de diccionarios.
    """

    columnas = [
        columna[0]
        for columna in cursor.description
    ]

    return [
        dict(
            zip(
                columnas,
                fila,
            )
        )
        for fila in cursor.fetchall()
    ]


# ============================================================
# REPARTOS
# ============================================================

def obtener_repartos(fecha=None):
    """
    Obtiene repartos desde Logistica.dbo.V_Repartos.

    Si se informa fecha, filtra por fechaSalida, igual que el portal.
    La fecha debe enviarse como DD/MM/YYYY.
    """

    consulta = """
        SELECT
            abrev,
            nrocomprobante,
            fechacomprobante,
            fechaSalida,
            almacen,
            ruta,
            transporte,
            chofer,
            camion,
            codReparto,
            codjerarquia,
            codalmacen,
            estado,
            codtalonario,
            tipo,
            observaciones,
            horaSalida,
            codMovimiento,
            nroMovimiento,
            codruta,
            montoTotal,
            codusuario,
            codproveedor,
            fechaemision,
            codliquidacion
        FROM Logistica.dbo.V_Repartos
    """

    parametros = []

    if fecha:
        consulta += """
            WHERE TRY_CONVERT(date, fechaSalida, 103) = CONVERT(date, ?, 103)
        """
        parametros.append(fecha)

    consulta += """
        ORDER BY codReparto DESC
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta,
            parametros,
        )

        return consultar_todos(
            cursor
        )


def obtener_reparto(cod_reparto):
    """
    Obtiene un único reparto por codReparto.
    """

    consulta = """
        SELECT
            *
        FROM Logistica.dbo.V_Repartos
        WHERE codReparto = ?
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta,
            cod_reparto,
        )

        fila = cursor.fetchone()

        if fila is None:
            return None

        return convertir_fila(
            cursor,
            fila,
        )


# ============================================================
# FACTURAS
# ============================================================

def obtener_facturas(cod_reparto):
    """
    Obtiene las facturas asociadas a un reparto.
    """

    consulta = """
        SELECT
            *
        FROM Logistica.dbo.v_RepartoFacturas
        WHERE codreparto = ?
        ORDER BY codfactura
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta,
            cod_reparto,
        )

        return consultar_todos(
            cursor
        )


# ============================================================
# DETALLE DE FACTURAS
# ============================================================

def obtener_detalle_factura(cod_factura):
    """
    Obtiene los productos de una factura.
    """

    consulta = """
        SELECT
            *
        FROM Logistica.dbo.V_RepartoFacturaDetalle
        WHERE codfactura = ?
        ORDER BY codfacturadetalle
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta,
            cod_factura,
        )

        return consultar_todos(
            cursor
        )


def obtener_detalles_reparto(cod_reparto):
    """
    Obtiene directamente todos los productos
    correspondientes a un reparto.
    """

    consulta = """
        SELECT
            *
        FROM Logistica.dbo.V_RepartoFacturaDetalle
        WHERE codreparto = ?
        ORDER BY codfactura, codfacturadetalle
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta,
            cod_reparto,
        )

        return consultar_todos(
            cursor
        )


# ============================================================
# PEDIDOS
# ============================================================

def obtener_pedidos(cod_reparto):
    """
    Obtiene pedidos asociados al reparto.
    """

    consulta = """
        SELECT
            *
        FROM Logistica.dbo.v_RepartoPedidos
        WHERE codreparto = ?
        ORDER BY codpedido
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta,
            cod_reparto,
        )

        return consultar_todos(
            cursor
        )


# ============================================================
# REMITOS
# ============================================================

def obtener_remitos(cod_reparto):
    """
    Obtiene remitos asociados al reparto.
    """

    consulta = """
        SELECT
            *
        FROM Logistica.dbo.v_RepartoRemitos
        WHERE codreparto = ?
        ORDER BY codremito
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta,
            cod_reparto,
        )

        return consultar_todos(
            cursor
        )


# ============================================================
# REPARTO COMPLETO
# ============================================================

def obtener_reparto_completo(cod_reparto):
    """
    Devuelve toda la información disponible
    de un reparto desde SQL Server.

    No modifica ningún dato.
    """

    reparto = obtener_reparto(
        cod_reparto
    )

    if reparto is None:
        return None

    facturas = obtener_facturas(
        cod_reparto
    )

    for factura in facturas:

        factura["detalle"] = (
            obtener_detalle_factura(
                factura["codfactura"]
            )
        )

    pedidos = obtener_pedidos(
        cod_reparto
    )

    remitos = obtener_remitos(
        cod_reparto
    )

    return {
        "reparto": reparto,
        "facturas": facturas,
        "pedidos": pedidos,
        "remitos": remitos,
    }
