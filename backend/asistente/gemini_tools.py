CONSULTAR_RECHAZOS_TOOL = {
    "type": "function",

    "name": "consultar_rechazos",

    "description": (
        "Consulta información real sobre los rechazos "
        "registrados en el sistema Logística Talca. "
        "Puede obtener cantidades, motivos y asignaciones."
    ),

    "parameters": {

        "type": "object",

        "properties": {

            "desde": {
                "type": "string",
                "description":
                    "Fecha inicial en formato YYYY-MM-DD.",
            },

            "hasta": {
                "type": "string",
                "description":
                    "Fecha final en formato YYYY-MM-DD.",
            },

            "asignacion_id": {
                "type": "integer",
                "description":
                    "ID de la asignación si se quiere filtrar.",
            },

        },

        "required": [],
    },
}