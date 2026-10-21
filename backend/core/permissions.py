"""Roles de la aplicación, independientes del acceso técnico al admin de Django."""
from rest_framework.permissions import BasePermission, SAFE_METHODS

ADMINISTRADOR = "ADMINISTRADOR"
MODULOS = {
    "REPARTOS": "Repartos y recargas", "RECHAZOS": "Rechazos",
    "CAMBIOS": "Recibos de cambios y enlace a Stock de pallets",
    "VIATICOS": "Viáticos", "KILOMETRAJES": "Kilometrajes",
    "CONTROL_DIARIO": "Control diario", "EXPEDICION": "Expedición", "ASISTENTE": "Asistente IA",
}
PREFIJOS = {
    "repartos": "REPARTOS", "planillas-recargas": "REPARTOS", "rechazos": "RECHAZOS",
    "cambios": "CAMBIOS", "viaticos": "VIATICOS", "kilometrajes": "KILOMETRAJES",
    "control-diario": "CONTROL_DIARIO", "expedicion": "EXPEDICION", "asistente": "ASISTENTE",
}
MAESTROS_LECTURA = {
    "choferes": {"REPARTOS", "VIATICOS", "KILOMETRAJES"},
    "ayudantes": {"REPARTOS", "VIATICOS"}, "vehiculos": {"REPARTOS", "KILOMETRAJES"},
    "asignaciones": {"REPARTOS", "RECHAZOS"}, "concesionarios": {"CAMBIOS", "RECHAZOS"},
    "productos": {"CAMBIOS", "EXPEDICION"}, "motivos-cambio": {"CAMBIOS"},
    "motivos-rechazo": {"RECHAZOS"},
}


def es_administrador(user):
    return bool(user and user.is_authenticated and user.is_active and
                (user.is_superuser or user.groups.filter(name=ADMINISTRADOR).exists()))


def tiene_modulo(user, modulo):
    return bool(user and user.is_authenticated and user.is_active and
                (es_administrador(user) or user.groups.filter(name=modulo).exists()))


def puede_administrar(user):
    """Acceso a la sección Talca; la cuenta técnica conserva sus otros accesos."""
    return es_administrador(user) and user.username.casefold() != "arielgarro"


class AccesoSistema(BasePermission):
    message = "No tenés permiso para acceder a esta sección."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if request.method == "DELETE" and hasattr(view, "delete") and not user.is_superuser:
            self.message = "No se permite borrar históricos. Usá las correcciones o anulaciones disponibles."
            return False
        parts = request.path.strip("/").split("/")
        section = parts[1] if len(parts) > 1 else ""
        if section == "administracion":
            return puede_administrar(user)
        if section == "maestros":
            if es_administrador(user):
                return True
            allowed = MAESTROS_LECTURA.get(parts[2] if len(parts) > 2 else "", set())
            if request.method not in SAFE_METHODS:
                return False
            from .models import AccesoAcciones
            policy = AccesoAcciones.objects.filter(usuario=user).first()
            return any(policy is None or "consultar" in policy.permisos.get(module, ["consultar"])
                for module in user.groups.filter(name__in=allowed).values_list("name", flat=True))
        if section not in PREFIJOS or not tiene_modulo(user, PREFIJOS[section]):
            return False
        if es_administrador(user):
            return True
        from .models import AccesoAcciones
        from .panel_servicios import accion_solicitada
        policy = AccesoAcciones.objects.filter(usuario=user).first()
        # Sin política explícita se conserva el comportamiento anterior.
        allowed = policy.permisos.get(PREFIJOS[section]) if policy else None
        if allowed is not None and accion_solicitada(request) not in allowed:
            self.message = "No tenés permiso para realizar esta acción. Consultá al administrador."
            return False
        return True
