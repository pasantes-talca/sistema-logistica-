import pyodbc
from contextlib import contextmanager

from django.conf import settings


@contextmanager
def obtener_conexion_sqlserver():
    """
    Abre una conexión al SQL Server de Logistica.

    Esta conexión se utiliza únicamente para consultas
    de solo lectura sobre las vistas del ERP.
    """

    config = settings.SQLSERVER_LOGISTICA

    driver = config["DRIVER"]
    host = config["HOST"]
    port = config["PORT"]
    database = config["DATABASE"]
    user = config["USER"]
    password = config["PASSWORD"]

    if not host:
        raise RuntimeError(
            "SQLSERVER_LOGISTICA_HOST no está configurado."
        )

    if not user:
        raise RuntimeError(
            "SQLSERVER_LOGISTICA_USER no está configurado."
        )

    if not password:
        raise RuntimeError(
            "SQLSERVER_LOGISTICA_PASSWORD no está configurado."
        )

    connection_string = (
        f"DRIVER={{{driver}}};"
        f"SERVER={host},{port};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
        f"Encrypt=no;"
        f"Connection Timeout=10;"
    )

    conexion = pyodbc.connect(connection_string, readonly=True, autocommit=True, timeout=10)
    conexion.timeout = 20
    try:
        yield conexion
    finally:
        conexion.close()


def probar_conexion():
    """
    Comprueba que Django pueda consultar SQL Server.
    No modifica ningún dato.
    """

    consulta = """
        SELECT TOP (1)
            codReparto,
            fechacomprobante,
            chofer,
            transporte,
            montoTotal
        FROM Logistica.dbo.V_Repartos
        ORDER BY codReparto DESC
    """

    with obtener_conexion_sqlserver() as conexion:
        cursor = conexion.cursor()

        cursor.execute(
            consulta
        )

        fila = cursor.fetchone()

        if fila is None:
            return None

        return {
            "cod_reparto": fila.codReparto,
            "fecha": fila.fechacomprobante,
            "chofer": fila.chofer,
            "transporte": fila.transporte,
            "monto_total": fila.montoTotal,
        }
