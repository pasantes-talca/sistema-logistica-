import json
import unicodedata
from urllib.request import urlopen

from django.conf import settings
from django.utils.dateparse import parse_date
from django.utils import timezone

from maestros.models import (
    Asignacion,
    MotivoRechazo,
)

from .models import Rechazo

# ============================================================
# EQUIVALENCIAS DE MOTIVOS HISTÓRICOS DE GOOGLE FORMS
# ============================================================

EQUIVALENCIAS_MOTIVOS = {
    "no tenia sistema": "sin sistema",

    "sobre stock": "sobrestock",
    "rechazo por sobre estok": "sobrestock",

    "observado": "observado por producto cambiado",

    "no salio factura": "no salio la factura",

    "no pidio": "no es lo que pidio",
}



# ============================================================
# UTILIDADES
# ============================================================

def normalizar_texto(valor):
    """
    Normaliza texto para comparar motivos y otros valores.

    Ejemplo:
        "Sin Dinero"
        "sin dinero"
        "SIN DINERO"

    pasan a:
        "sin dinero"
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

    return texto


def obtener_valor(fila, *posibles_nombres):
    """
    Busca una columna ignorando mayúsculas,
    minúsculas y tildes.
    """

    claves = {
        normalizar_texto(clave): valor
        for clave, valor in fila.items()
    }

    for nombre in posibles_nombres:

        clave = normalizar_texto(
            nombre
        )

        if clave in claves:
            return claves[clave]

    return None


def convertir_fecha(valor):
    """
    Convierte la fecha de Google a YYYY-MM-DD.
    """

    texto = str(
        valor or ""
    ).strip()

    # Apps Script puede devolver:
    # 2026-09-07 10:30:00

    if len(texto) >= 10:

        fecha = parse_date(
            texto[:10]
        )

        if fecha:
            return fecha

    return None


def convertir_datetime(valor):
    """
    Convierte la Marca temporal de Google
    a DateTime con zona horaria.
    """

    texto = str(
        valor or ""
    ).strip()

    if not texto:
        return None

    try:

        fecha_hora = timezone.datetime.strptime(
            texto,
            "%Y-%m-%d %H:%M:%S"
        )

        return timezone.make_aware(
            fecha_hora
        )

    except ValueError:
        return None


def obtener_asignacion(valor):
    """
    Busca la asignación por código.
    """

    codigo = str(
        valor or ""
    ).strip()

    if not codigo:
        return None

    return (
        Asignacion.objects
        .filter(
            codigo=codigo
        )
        .first()
    )


def obtener_motivo(valor):
    """
    Busca el motivo normalizando mayúsculas,
    minúsculas, tildes y equivalencias históricas.
    """

    motivo_google = normalizar_texto(
        valor
    )

    if not motivo_google:
        return None

    # Aplicar equivalencias históricas.
    motivo_google = EQUIVALENCIAS_MOTIVOS.get(
        motivo_google,
        motivo_google,
    )

    motivos = MotivoRechazo.objects.filter(
        activo=True
    )

    for motivo in motivos:

        if (
            normalizar_texto(
                motivo.nombre
            )
            == motivo_google
        ):
            return motivo

    return None

# ============================================================
# LEER GOOGLE
# ============================================================

def obtener_filas_google():
    """
    Consulta el Apps Script publicado como Web App
    y devuelve las filas del formulario.
    """

    url = settings.GOOGLE_RECHAZOS_URL

    if not url:

        raise RuntimeError(
            "GOOGLE_RECHAZOS_URL no está configurada."
        )

    with urlopen(
        url,
        timeout=30
    ) as respuesta:

        contenido = respuesta.read()

    datos = json.loads(
        contenido.decode("utf-8")
    )

    if "error" in datos:

        raise RuntimeError(
            datos["error"]
        )

    return datos.get(
        "filas",
        []
    )


# ============================================================
# SINCRONIZAR
# ============================================================

def sincronizar_rechazos_google():
    """
    Lee todas las filas de Google y crea únicamente
    las que todavía no existen en PostgreSQL.
    """

    filas = obtener_filas_google()

    creados = 0
    existentes = 0
    errores = []

    for fila in filas:

        numero_fila = fila.get(
            "_fila_sheet"
        )

        marca_temporal = obtener_valor(
            fila,
            "Marca temporal"
        )

        # Identificador único.
        origen_id = (
            f"google_forms:"
            f"{numero_fila}:"
            f"{marca_temporal}"
        )

        if Rechazo.objects.filter(
            origen_id=origen_id
        ).exists():

            existentes += 1
            continue

        fecha = convertir_fecha(
            obtener_valor(
                fila,
                "Fecha"
            )
        )

        asignacion_valor = obtener_valor(
            fila,
            "Asignación",
            "Asignacion"
        )

        punto_venta = str(
            obtener_valor(
                fila,
                "Punto de venta"
            )
            or ""
        ).strip()

        bultos = str(
            obtener_valor(
                fila,
                "Bultos"
            )
            or ""
        ).strip()

        motivo_valor = obtener_valor(
            fila,
            "Motivo de NO entrega",
            "Causa de NO entrega"
        )

        observacion = str(
            obtener_valor(
                fila,
                "Observación",
                "Observacion"
            )
            or ""
        ).strip()

        registrado_en = convertir_datetime(
            marca_temporal
        )

        if not fecha:

            errores.append(
                f"Fila {numero_fila}: fecha inválida."
            )
            continue

        asignacion = obtener_asignacion(
            asignacion_valor
        )

        motivo = obtener_motivo(
            motivo_valor
        )

        if motivo is None:

            errores.append(
                (
                    f"Fila {numero_fila}: "
                    f"motivo no encontrado "
                    f"'{motivo_valor}'."
                )
            )
            continue

        Rechazo.objects.create(
            fecha=fecha,
            asignacion=asignacion,
            punto_venta=punto_venta,
            bultos=bultos,
            motivo=motivo,
            observacion=observacion,
            registrado_en=registrado_en,
            creado_por=None,
            origen="google_forms",
            origen_id=origen_id,
        )

        creados += 1

    return {
        "filas_google":
            len(filas),

        "creados":
            creados,

        "existentes":
            existentes,

        "errores":
            errores,
    }