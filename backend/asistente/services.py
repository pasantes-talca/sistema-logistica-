import json

from django.conf import settings
from django.utils import timezone

from google import genai

from .tools import (
    consultar_cambios,
    consultar_recargas,
    consultar_rechazos,
    consultar_repartos,
    consultar_resumen_general,
)


MODELO = "gemini-3-flash-preview"


def limpiar_json(texto):
    texto = texto.strip()

    if texto.startswith("```json"):
        texto = texto[
            len("```json"):
        ]

    elif texto.startswith("```"):
        texto = texto[
            len("```"):
        ]

    if texto.endswith("```"):
        texto = texto[:-3]

    return texto.strip()


def interpretar_pregunta(
    pregunta
):
    """
    Gemini SOLO interpreta la consulta.

    No consulta PostgreSQL.
    No modifica datos.
    """

    if not settings.GEMINI_API_KEY:
        raise ValueError(
            "No está configurada GEMINI_API_KEY."
        )


    hoy = (
        timezone
        .localdate()
        .isoformat()
    )


    client = genai.Client(
        api_key=
            settings.GEMINI_API_KEY
    )


    prompt = f"""
Sos el intérprete de consultas del sistema
interno Logística Talca.

Fecha actual:
{hoy}

Tu única tarea es convertir la pregunta del
usuario en JSON estructurado.

NO respondas la pregunta.
NO inventes datos de la empresa.
NO generes SQL.

Los módulos disponibles son:

1. repartos
2. recargas
3. rechazos
4. cambios
5. general

TIPOS DE CONSULTA:

REPARTOS:
- resumen
- por_asignacion

RECARGAS:
- resumen
- por_empleado

RECHAZOS:
- resumen
- motivo_frecuente
- por_asignacion

CAMBIOS:
- resumen
- por_concesionario
- por_producto

GENERAL:
- resumen

Formato obligatorio:

{{
  "tipo": "repartos|recargas|rechazos|cambios|general",
  "accion": "accion_correspondiente",
  "desde": "YYYY-MM-DD o null",
  "hasta": "YYYY-MM-DD o null",
  "asignacion_codigo": null,
  "empleado": null,
  "concesionario": null,
  "producto": null
}}

Interpretá expresiones como:

"hoy"
"ayer"
"esta semana"
"este mes"
"mes pasado"
"agosto"
"agosto de 2026"

usando la fecha actual indicada arriba.

Ejemplos:

Pregunta:
¿Cuántos rechazos hubo en agosto de 2026?

Respuesta:
{{
  "tipo": "rechazos",
  "accion": "resumen",
  "desde": "2026-08-01",
  "hasta": "2026-08-31",
  "asignacion_codigo": null,
  "empleado": null,
  "concesionario": null,
  "producto": null
}}

Pregunta:
¿Qué concesionario tuvo más cambios en agosto?

Respuesta:
{{
  "tipo": "cambios",
  "accion": "por_concesionario",
  "desde": "2026-08-01",
  "hasta": "2026-08-31",
  "asignacion_codigo": null,
  "empleado": null,
  "concesionario": null,
  "producto": null
}}

Pregunta:
¿Quién tuvo más recargas este mes?

Respuesta:
{{
  "tipo": "recargas",
  "accion": "por_empleado",
  "desde": null,
  "hasta": null,
  "asignacion_codigo": null,
  "empleado": null,
  "concesionario": null,
  "producto": null
}}

Pregunta:
Dame un resumen general de logística de agosto.

Respuesta:
{{
  "tipo": "general",
  "accion": "resumen",
  "desde": "2026-08-01",
  "hasta": "2026-08-31",
  "asignacion_codigo": null,
  "empleado": null,
  "concesionario": null,
  "producto": null
}}

Respondé ÚNICAMENTE JSON válido.

Pregunta del usuario:

{pregunta}
"""


    interaction = (
        client.interactions.create(
            model=MODELO,
            input=prompt,
        )
    )


    texto = limpiar_json(
        interaction.output_text
    )


    try:
        return json.loads(
            texto
        )

    except json.JSONDecodeError:

        raise ValueError(
            (
                "Gemini devolvió una "
                "interpretación inválida: "
                f"{texto}"
            )
        )


def formatear_respuesta(
    interpretacion,
    datos,
):
    """
    Django genera respuestas básicas
    sin hacer una segunda llamada a Gemini.
    """

    tipo = interpretacion.get(
        "tipo"
    )

    accion = interpretacion.get(
        "accion"
    )


    # ========================================================
    # REPARTOS
    # ========================================================

    if tipo == "repartos":

        if (
            accion ==
            "por_asignacion"
        ):

            lista = datos.get(
                "por_asignacion",
                [],
            )

            if not lista:
                return (
                    "No se encontraron "
                    "repartos para el período "
                    "consultado."
                )

            mayor = lista[0]

            return (
                f"La asignación "
                f"{mayor['asignacion']} "
                f"fue la que registró más "
                f"repartos, con "
                f"{mayor['cantidad']}."
            )


        return (
            f"Se encontraron "
            f"{datos['total_repartos']} "
            f"repartos para el período "
            f"consultado, con "
            f"{datos['total_bultos']} "
            f"bultos registrados."
        )


    # ========================================================
    # RECARGAS
    # ========================================================

    if tipo == "recargas":

        empleados = datos.get(
            "empleados",
            [],
        )


        if (
            accion ==
            "por_empleado"
        ):

            if not empleados:
                return (
                    "No se encontraron "
                    "recargas para el período "
                    "consultado."
                )

            mayor = empleados[0]

            return (
                f"{mayor['empleado']} "
                f"fue quien acumuló más "
                f"recargas, con "
                f"{mayor['recargas']}."
            )


        return (
            f"Se registraron "
            f"{datos['total_recargas']} "
            f"recargas acumuladas entre "
            f"los empleados para el "
            f"período consultado."
        )


    # ========================================================
    # RECHAZOS
    # ========================================================

    if tipo == "rechazos":

        if (
            accion ==
            "motivo_frecuente"
        ):

            motivos = datos.get(
                "motivos",
                [],
            )


            if not motivos:

                return (
                    "No se encontraron "
                    "rechazos para el período "
                    "consultado."
                )


            mayor_cantidad = (
                motivos[0]["cantidad"]
            )


            empatados = [
                item
                for item
                in motivos
                if item["cantidad"]
                == mayor_cantidad
            ]


            if len(empatados) > 1:

                nombres = ", ".join(
                    item["motivo"]
                    for item
                    in empatados
                )

                return (
                    f"Hubo un empate entre "
                    f"{nombres}, con "
                    f"{mayor_cantidad} "
                    f"rechazo(s) cada uno."
                )


            principal = motivos[0]

            return (
                f"El motivo de rechazo "
                f"más frecuente fue "
                f"“{principal['motivo']}”, "
                f"con "
                f"{principal['cantidad']} "
                f"caso(s)."
            )


        if (
            accion ==
            "por_asignacion"
        ):

            lista = datos.get(
                "por_asignacion",
                [],
            )

            if not lista:

                return (
                    "No se encontraron "
                    "rechazos para el período "
                    "consultado."
                )


            mayor = lista[0]

            return (
                f"La asignación "
                f"{mayor['asignacion']} "
                f"tuvo la mayor cantidad "
                f"de rechazos, con "
                f"{mayor['cantidad']}."
            )


        return (
            f"Se encontraron "
            f"{datos['total_rechazos']} "
            f"rechazos para el período "
            f"consultado."
        )


    # ========================================================
    # CAMBIOS
    # ========================================================

    if tipo == "cambios":

        if (
            accion ==
            "por_concesionario"
        ):

            lista = datos.get(
                "por_concesionario",
                [],
            )


            if not lista:

                return (
                    "No se encontraron "
                    "cambios para el período "
                    "consultado."
                )


            mayor = lista[0]

            return (
                f"El concesionario "
                f"{mayor['concesionario']} "
                f"registró la mayor cantidad "
                f"de cambios, con "
                f"{mayor['cantidad']} "
                f"unidades."
            )


        if (
            accion ==
            "por_producto"
        ):

            lista = datos.get(
                "por_producto",
                [],
            )


            if not lista:

                return (
                    "No se encontraron "
                    "productos cambiados "
                    "para el período "
                    "consultado."
                )


            mayor = lista[0]

            return (
                f"El producto con mayor "
                f"cantidad de cambios fue "
                f"{mayor['codigo']} - "
                f"{mayor['producto']}, "
                f"con "
                f"{mayor['cantidad']} "
                f"unidades."
            )


        return (
            f"Se encontraron "
            f"{datos['total_recibos']} "
            f"recibos de cambios, con "
            f"{datos['total_cantidad']} "
            f"unidades registradas."
        )


    # ========================================================
    # GENERAL
    # ========================================================

    if tipo == "general":

        return (
            "Resumen del período: "
            f"{datos['repartos']['total_repartos']} "
            "repartos, "
            f"{datos['recargas']['total_recargas']} "
            "recargas acumuladas, "
            f"{datos['rechazos']['total_rechazos']} "
            "rechazos y "
            f"{datos['cambios']['total_recibos']} "
            "recibos de cambios."
        )


    return (
        "No pude interpretar correctamente "
        "la consulta."
    )


def preguntar_gemini(
    pregunta
):

    interpretacion = (
        interpretar_pregunta(
            pregunta
        )
    )


    tipo = interpretacion.get(
        "tipo"
    )


    desde = (
        interpretacion.get(
            "desde"
        )
    )


    hasta = (
        interpretacion.get(
            "hasta"
        )
    )


    # ========================================================
    # REPARTOS
    # ========================================================

    if tipo == "repartos":

        datos = consultar_repartos(
            desde=desde,
            hasta=hasta,

            asignacion_codigo=
                interpretacion.get(
                    "asignacion_codigo"
                ),
        )


    # ========================================================
    # RECARGAS
    # ========================================================

    elif tipo == "recargas":

        datos = consultar_recargas(
            desde=desde,
            hasta=hasta,

            empleado=
                interpretacion.get(
                    "empleado"
                ),
        )


    # ========================================================
    # RECHAZOS
    # ========================================================

    elif tipo == "rechazos":

        datos = consultar_rechazos(
            desde=desde,
            hasta=hasta,

            asignacion_codigo=
                interpretacion.get(
                    "asignacion_codigo"
                ),
        )


    # ========================================================
    # CAMBIOS
    # ========================================================

    elif tipo == "cambios":

        datos = consultar_cambios(
            desde=desde,
            hasta=hasta,

            concesionario=
                interpretacion.get(
                    "concesionario"
                ),

            producto=
                interpretacion.get(
                    "producto"
                ),
        )


    # ========================================================
    # GENERAL
    # ========================================================

    elif tipo == "general":

        datos = (
            consultar_resumen_general(
                desde=desde,
                hasta=hasta,
            )
        )


    else:

        raise ValueError(
            (
                "El asistente no reconoció "
                "el módulo de Logística "
                "consultado."
            )
        )


    respuesta = formatear_respuesta(
        interpretacion,
        datos,
    )


    return {
        "respuesta":
            respuesta,

        "interpretacion":
            interpretacion,

        "datos":
            datos,
    }