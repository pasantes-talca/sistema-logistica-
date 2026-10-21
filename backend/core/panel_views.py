import csv
import platform
from datetime import timedelta
from time import perf_counter
import django
from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.db import connection
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework import serializers
from rest_framework.response import Response
from .administracion_views import AdministracionAPIView, fecha_param, csv_seguro
from .auditoria import registrar
from .cuentas import cuenta_protegida
from .models import AccesoAcciones, PreferenciaAdministracion, IncidenciaSistema, EventoAuditoria
from .panel_servicios import ACCIONES, DEFAULTS, preferencias
from .permissions import MODULOS, es_administrador


def motivo(data):
    value = data.get("motivo")
    if not isinstance(value, str) or not value.strip() or len(value) > 1000:
        raise ValidationError("Explicá el motivo del cambio (hasta 1000 caracteres).")
    return value.strip()


def identificador(value):
    return serializers.IntegerField(min_value=1).run_validation(value)


def periodo(request):
    desde, hasta = fecha_param(request, "desde"), fecha_param(request, "hasta")
    hasta = hasta or timezone.localdate()
    desde = desde or hasta - timedelta(days=preferencias()["dias_panel"] - 1)
    if desde > hasta:
        raise ValidationError("Desde no puede ser posterior a Hasta.")
    return desde, hasta


def actividad(request):
    desde, hasta = periodo(request)
    rows = EventoAuditoria.objects.filter(fecha__date__range=(desde, hasta))
    return desde, hasta, rows


class PanelAPIView(AdministracionAPIView):
    def get(self, request):
        desde, hasta, events = actividad(request)
        counts = {}
        for key, model in {"Repartos": "repartos.Reparto", "Rechazos": "rechazos.Rechazo", "Recibos de cambios": "cambios.ReciboCambio", "Órdenes de carga": "expedicion.OrdenCarga", "Viáticos": "viaticos.Viatico", "Controles diarios": "control_diario.ControlDiario", "Registros de kilometrajes": "kilometrajes.RegistroKilometraje"}.items():
            counts[key] = apps.get_model(model).objects.filter(fecha__range=(desde, hasta)).count()
        users = get_user_model().objects
        return Response({"desde": desde, "hasta": hasta, "registros": counts,
            "usuarios_activos": users.filter(is_active=True).count(), "usuarios_inactivos": users.filter(is_active=False).count(),
            "operaciones_auditadas": events.count(), "actividad": list(events.values("usuario", "modulo", "accion", "fecha", "referencia")[:20]),
            "nota": "Los registros se cuentan por su fecha operativa. La actividad solo incluye eventos capturados desde que se habilitó la auditoría; no mide rendimiento laboral."})


class ReporteActividadAPIView(AdministracionAPIView):
    def get(self, request):
        desde, hasta, events = actividad(request)
        rows = list(events.values("usuario", "modulo", "accion").annotate(cantidad=Count("id")).order_by("usuario", "modulo", "accion"))
        if request.query_params.get("formato") == "csv":
            response = HttpResponse(content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = 'attachment; filename="actividad-sistema.csv"'
            response.write("\ufeff")
            writer = csv.writer(response)
            writer.writerow(["Desde", "Hasta", "Usuario", "Módulo", "Acción", "Operaciones auditadas"])
            for row in rows:
                writer.writerow([csv_seguro(v) for v in [desde, hasta, row["usuario"], row["modulo"], row["accion"], row["cantidad"]]])
            return response
        return Response({"desde": desde, "hasta": hasta, "filas": rows})


class PermisosAccionesAPIView(AdministracionAPIView):
    def get(self, request):
        policies = {p.usuario_id: p.permisos for p in AccesoAcciones.objects.all()}
        return Response({"modulos": MODULOS, "acciones": ACCIONES, "usuarios": [
            {"id": u.pk, "username": u.username, "protegido": cuenta_protegida(request.user, u) or es_administrador(u),
             "modulos": list(u.groups.filter(name__in=MODULOS).values_list("name", flat=True)), "permisos": policies.get(u.pk, {})}
            for u in get_user_model().objects.prefetch_related("groups").order_by("username")]})

    def put(self, request):
        if set(request.data) != {"usuario_id", "permisos", "motivo"}:
            raise ValidationError("Enviá usuario, permisos y motivo.")
        u = get_object_or_404(get_user_model().objects.select_for_update(), pk=identificador(request.data["usuario_id"]))
        if cuenta_protegida(request.user, u) or es_administrador(u):
            raise PermissionDenied("No se restringen cuentas administrativas o protegidas desde esta pantalla.")
        rules = request.data["permisos"]
        if not isinstance(rules, dict) or set(rules) - MODULOS.keys():
            raise ValidationError("Módulos no válidos.")
        for actions in rules.values():
            if not isinstance(actions, list) or any(not isinstance(a, str) or a not in ACCIONES for a in actions):
                raise ValidationError("Acciones no válidas.")
            if actions and "consultar" not in actions:
                raise ValidationError("Para operar en un módulo también hay que permitir Consultar.")
        reason = motivo(request.data)
        obj, _ = AccesoAcciones.objects.get_or_create(usuario=u)
        before = obj.permisos
        obj.permisos = rules
        obj.save(update_fields=["permisos"])
        registrar(request.user, "ADMINISTRACION", "Permisos por acción", u.username, reason, before, rules)
        return Response({"mensaje": "Permisos guardados. No se agregaron accesos a módulos: se administran en Usuarios."})


class PreferenciasAPIView(AdministracionAPIView):
    def get(self, request):
        return Response(preferencias())

    def put(self, request):
        if set(request.data) != {"datos", "motivo"} or not isinstance(request.data["datos"], dict):
            raise ValidationError("Enviá datos y motivo.")
        data = request.data["datos"]
        if set(data) != set(DEFAULTS):
            raise ValidationError("La configuración debe contener únicamente los parámetros admitidos.")
        for field, low, high in [("dias_panel", 1, 366), ("umbral_errores", 1, 1000), ("minimo_password", 8, 128), ("sesion_horas", 1, 24)]:
            if type(data[field]) is not int or not low <= data[field] <= high:
                raise ValidationError({field: f"Ingresá un entero entre {low} y {high}."})
        for field in ["alertar_pendientes", "alertar_errores"]:
            if type(data[field]) is not bool:
                raise ValidationError("Las alertas deben ser verdaderas o falsas.")
        if not isinstance(data["nombre_plataforma"], str) or not 1 <= len(data["nombre_plataforma"].strip()) <= 100:
            raise ValidationError("El nombre debe tener entre 1 y 100 caracteres.")
        reason = motivo(request.data)
        before = preferencias()
        obj, _ = PreferenciaAdministracion.objects.get_or_create(pk=1)
        obj.datos = data
        obj.save(update_fields=["datos"])
        registrar(request.user, "ADMINISTRACION", "Configurar panel y seguridad", "preferencias", reason, before, data)
        return Response(data)


class EstadoSistemaAPIView(AdministracionAPIView):
    def get(self, request):
        start = perf_counter()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            ok = cursor.fetchone()[0] == 1
            if connection.vendor == "postgresql":
                cursor.execute("SELECT current_database(), current_schema()")
                db, schema = cursor.fetchone()
            else:
                db, schema = "Base de pruebas", "No aplica"
        from expedicion.models import RespaldoExpedicion
        backups = list(RespaldoExpedicion.objects.order_by("-fecha").values("id", "fecha", "motivo")[:10])
        return Response({"comprobado_en": timezone.now(), "base": {"motor": connection.vendor, "nombre": db, "schema": schema, "conexion": ok, "latencia_ms": round((perf_counter() - start) * 1000, 2)},
            "versiones": {"django": django.get_version(), "python": platform.python_version()},
            "servicios": [{"nombre": "Backend", "estado": "Disponible: esta solicitud fue respondida"},
                {"nombre": "PostgreSQL / base configurada", "estado": "Conexión comprobada"},
                {"nombre": "Correo", "estado": "Configurado, entrega no verificada" if settings.EMAIL_HOST else "Sin servidor configurado"},
                {"nombre": "Firebase / sistema de Pablo", "estado": "No verificado: servicio externo"}],
            "respaldos_expedicion": backups,
            "respaldo_general": "No verificado. Los respaldos de Expedición no son copias completas de PostgreSQL. Deben comprobarse con el responsable del servidor.",
            "seguridad": {"csrf": "django.middleware.csrf.CsrfViewMiddleware" in settings.MIDDLEWARE,
                "cookie_segura": settings.SESSION_COOKIE_SECURE, "debug": settings.DEBUG,
                "validadores_password": len(settings.AUTH_PASSWORD_VALIDATORS), "politica": preferencias()}})


class SesionesAPIView(AdministracionAPIView):
    def get(self, request):
        totals = {}
        for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator():
            uid = session.get_decoded().get("_auth_user_id")
            if uid:
                totals[str(uid)] = totals.get(str(uid), 0) + 1
        return Response({"usuarios": [{"id": u.pk, "username": u.username, "sesiones": totals.get(str(u.pk), 0), "protegido": cuenta_protegida(request.user, u)}
            for u in get_user_model().objects.order_by("username")],
            "nota": "Sesiones almacenadas no vencidas; no equivalen a usuarios conectados en este instante. No se muestran claves de sesión."})

    def post(self, request):
        if set(request.data) != {"usuario_id", "confirmacion", "motivo"} or request.data["confirmacion"] != "CERRAR SESIONES":
            raise ValidationError("Confirmá CERRAR SESIONES y explicá el motivo.")
        user = get_object_or_404(get_user_model(), pk=identificador(request.data["usuario_id"]))
        if cuenta_protegida(request.user, user):
            raise PermissionDenied("Esta cuenta está protegida.")
        reason = motivo(request.data)
        deleted = 0
        for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator():
            if str(session.get_decoded().get("_auth_user_id")) == str(user.pk):
                session.delete()
                deleted += 1
        registrar(request.user, "ADMINISTRACION", "Cerrar sesiones", user.username, reason, despues={"sesiones_cerradas": deleted})
        return Response({"mensaje": f"Se cerraron {deleted} sesiones almacenadas."})


class IncidenciasAPIView(AdministracionAPIView):
    def get(self, request):
        rows = IncidenciaSistema.objects.all()
        if request.query_params.get("pendientes") == "1":
            rows = rows.filter(resuelta=False)
        return Response({"total": rows.count(), "resultados": list(rows.values()[:100]),
            "nota": "Últimas 100 incidencias HTTP desde la instalación de esta versión. No incluye errores de JavaScript ni registros anteriores. No se guardan datos enviados, credenciales ni trazas sensibles."})

    def patch(self, request):
        if set(request.data) != {"id", "motivo"}:
            raise ValidationError("Enviá el identificador y el motivo de resolución.")
        row = get_object_or_404(IncidenciaSistema.objects.select_for_update(), pk=identificador(request.data["id"]))
        reason = motivo(request.data)
        row.resuelta = True
        row.resolucion = reason
        row.save(update_fields=["resuelta", "resolucion"])
        registrar(request.user, "ADMINISTRACION", "Resolver incidencia", row.pk, reason)
        return Response({"mensaje": "Incidencia marcada como revisada. No fue eliminada."})


class AlertasAPIView(AdministracionAPIView):
    def get(self, request):
        config = preferencias()
        alerts = []
        if config["alertar_pendientes"]:
            count = apps.get_model("expedicion.OrdenCarga").objects.filter(anulada=False).exclude(estado__in=["COMPLETA", "COMPLETA_CON_CAMBIO"]).count()
            if count:
                alerts.append({"tipo": "pendientes", "titulo": "Órdenes de Expedición abiertas", "cantidad": count, "destino": "/expedicion/pendientes"})
            count = apps.get_model("expedicion.ConteoExpedicion").objects.filter(tipo="Cierre de turno", corroborado_en__isnull=True).count()
            if count:
                alerts.append({"tipo": "relevos", "titulo": "Cierres pendientes de corroboración", "cantidad": count, "destino": "/expedicion/conteos"})
        if config["alertar_errores"]:
            count = IncidenciaSistema.objects.filter(resuelta=False, fecha__gte=timezone.now() - timedelta(hours=24)).count()
            if count >= config["umbral_errores"]:
                alerts.append({"tipo": "errores", "titulo": "Incidencias sin revisar en las últimas 24 horas", "cantidad": count, "destino": "/administracion/errores"})
        return Response({"alertas": alerts, "nota": "Alertas dentro de Administración. No se envían correos ni notificaciones externas."})
