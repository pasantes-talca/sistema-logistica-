"""Capa común: autorización por módulo y cambios auditados en la misma transacción."""
from django.apps import apps
from django.db import transaction
from django.forms.models import model_to_dict
from rest_framework.views import APIView as DRFAPIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from .permissions import AccesoSistema, PREFIJOS
from .auditoria import registrar
from collections.abc import Mapping

MODELOS = {"repartos": "repartos.Reparto", "rechazos": "rechazos.Rechazo",
           "cambios": "cambios.ReciboCambio", "viaticos": "viaticos.Viatico",
           "kilometrajes": "kilometrajes.ControlKilometraje", "control-diario": "control_diario.ControlDiario"}


class APIView(DRFAPIView):
    auditoria_explicita = False

    def dispatch(self, request, *args, **kwargs):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            with transaction.atomic():
                response = super().dispatch(request, *args, **kwargs)
                if response.status_code >= 400:
                    transaction.set_rollback(True)
                return response
        return super().dispatch(request, *args, **kwargs)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        permission = AccesoSistema()
        if not permission.has_permission(request, self):
            raise PermissionDenied(permission.message)
        if request.method in {"POST", "PUT", "PATCH"} and not isinstance(request.data, Mapping):
            raise ValidationError("Enviá un objeto de datos válido.")
        parts = request.path.strip("/").split("/")
        self.seccion = parts[1] if len(parts) > 1 else ""
        self.antes_auditoria = {}
        if request.method in {"PUT", "PATCH"} and self.seccion in MODELOS and hasattr(self, request.method.lower()) and kwargs.get("pk", kwargs.get("id")):
            reason = str(request.data.get("motivo_correccion", "")).strip()
            if not reason or len(reason) > 2000:
                raise ValidationError({"motivo_correccion": "Explicá el motivo de la corrección (hasta 2000 caracteres)."})
            pk = kwargs.get("pk", kwargs.get("id"))
            if pk:
                obj = apps.get_model(MODELOS[self.seccion]).objects.select_for_update().filter(pk=pk).first()
                if obj:
                    self.antes_auditoria = model_to_dict(obj)
                    for relation in ("personal", "detalles", "viajes", "movimientos"):
                        manager = getattr(obj, relation, None)
                        if manager is not None and hasattr(manager, "values"):
                            self.antes_auditoria[relation] = list(manager.values())

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if (not self.auditoria_explicita and request.method in {"POST", "PUT", "PATCH", "DELETE"}
                and 200 <= response.status_code < 300 and request.user.is_authenticated
                and getattr(self, "seccion", "") != "asistente"):
            data = request.data
            referencia = kwargs.get("pk", kwargs.get("id", data.get("numero", "")))
            action = str(data.get("accion") or ("Corregir" if request.method in {"PUT", "PATCH"} else "Registrar"))
            registrar(request.user, PREFIJOS.get(self.seccion, self.seccion), action, referencia,
                      data.get("motivo_correccion", data.get("motivo", data.get("justificacion", ""))),
                      getattr(self, "antes_auditoria", {}), {"datos": data, "respuesta": getattr(response, "data", {})})
        return response
