"""Políticas administrativas, sin modificar parámetros de cálculo del negocio."""
from .models import PreferenciaAdministracion

ACCIONES = ("consultar", "crear", "editar", "anular", "configurar", "exportar")
DEFAULTS = {
    "nombre_plataforma": "Logística Talca",
    "dias_panel": 30,
    "alertar_pendientes": True,
    "alertar_errores": True,
    "umbral_errores": 5,
    "minimo_password": 8,
    "sesion_horas": 8,
}


def preferencias():
    row = PreferenciaAdministracion.objects.filter(pk=1).first()
    return {**DEFAULTS, **(row.datos if row else {})}


def accion_solicitada(request):
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        path = request.path.lower()
        return "exportar" if (any(s in path for s in ("export", "pdf", "excel", "respaldo")) or
            request.query_params.get("formato") in {"csv", "pdf", "xlsx"}) else "consultar"
    data = request.data if isinstance(request.data, dict) else {}
    action = str(data.get("accion", ""))
    if request.method == "DELETE" or action == "anular":
        return "anular"
    if action in {"usuario", "fletero", "producto", "empleado", "acreditar", "configuracion", "depurar_fleteros", "pendientes", "base_conciliacion", "conciliar_estados", "calibrar_stock"}:
        return "configurar"
    if request.method in {"PUT", "PATCH"} or (action == "orden" and data.get("id")) or action in {"corregir_movimiento", "corregir_fecha"}:
        return "editar"
    return "crear"
