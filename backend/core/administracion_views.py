import csv
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from .api import APIView
from .models import EventoAuditoria
from .permissions import MODULOS, ADMINISTRADOR
from .cuentas import datos_cuenta, guardar_cuenta, restablecer_password
from .auditoria import registrar
from maestros.models import Empleado, Vehiculo, Asignacion, Concesionario, MotivoRechazo, MotivoCambio, MotivoCambioFamilia, Producto


class AdministracionAPIView(APIView):
    auditoria_explicita = True


class UsuariosAPIView(AdministracionAPIView):
    def get(self, request):
        users = get_user_model().objects.prefetch_related("groups").order_by("username")
        return Response({"modulos": [{"codigo": k, "nombre": v} for k, v in MODULOS.items()],
                         "usuarios": [datos_cuenta(u, request.user) for u in users]})

    def post(self, request):
        allowed = {"username", "nombre", "apellido", "password", "modulos", "activo", "administrador", "motivo"}
        if set(request.data) - allowed:
            raise ValidationError("Hay campos de usuario no admitidos.")
        user = guardar_cuenta(request.user, request.data, request=request)
        return Response(datos_cuenta(user, request.user), status=201)


class UsuarioAPIView(AdministracionAPIView):
    def patch(self, request, pk):
        allowed = {"username", "nombre", "apellido", "modulos", "activo", "administrador", "motivo"}
        if set(request.data) - allowed:
            raise ValidationError("Hay campos de usuario no admitidos. Usá Restablecer contraseña para cambiarla.")
        user = guardar_cuenta(request.user, request.data, pk, request)
        return Response(datos_cuenta(user, request.user))


class PasswordAPIView(AdministracionAPIView):
    def post(self, request, pk):
        if set(request.data) != {"password"}:
            raise ValidationError("Enviá únicamente la contraseña nueva.")
        user = restablecer_password(request.user, pk, request.data.get("password"), request)
        return Response({"mensaje": f"Contraseña de {user.username} restablecida. Las otras sesiones deberán volver a ingresar."})


def entero_param(request, name, default, maximo):
    try:
        value = int(request.query_params.get(name, default))
        if value < 1 or value > maximo:
            raise ValueError
        return value
    except (ValueError, TypeError):
        raise ValidationError({name: "Ingresá un número válido."})


def fecha_param(request, name):
    value = request.query_params.get(name)
    return serializers.DateField().run_validation(value) if value else None


def csv_seguro(value):
    text = str(value or "")
    return "'" + text if text.lstrip().startswith(("=", "+", "-", "@")) else text


class AuditoriaAPIView(AdministracionAPIView):
    def get(self, request):
        rows = EventoAuditoria.objects.select_related("actor").all()
        desde, hasta = fecha_param(request, "desde"), fecha_param(request, "hasta")
        if desde and hasta and desde > hasta:
            raise ValidationError("Desde no puede ser posterior a Hasta.")
        if desde:
            rows = rows.filter(fecha__date__gte=desde)
        if hasta:
            rows = rows.filter(fecha__date__lte=hasta)
        search = request.query_params.get("buscar", "")[:150]
        if search:
            rows = rows.filter(Q(usuario__icontains=search) | Q(accion__icontains=search) | Q(referencia__icontains=search))
        modulo = request.query_params.get("modulo", "")
        if modulo:
            rows = rows.filter(modulo=modulo)
        if request.query_params.get("formato") == "csv":
            response = HttpResponse(content_type="text/csv; charset=utf-8")
            response["Content-Disposition"] = 'attachment; filename="auditoria-sistema.csv"'
            response.write("\ufeff")
            writer = csv.writer(response)
            writer.writerow(["Fecha", "Usuario", "Sección", "Acción", "Referencia", "Motivo"])
            for event in rows.iterator():
                writer.writerow([csv_seguro(v) for v in [event.fecha.isoformat(), event.usuario, event.modulo, event.accion, event.referencia, event.motivo]])
            return response
        page = entero_param(request, "pagina", 1, 1000000)
        size = entero_param(request, "tamano", 30, 100)
        total = rows.count()
        return Response({"total": total, "pagina": page, "tamano": size,
            "resultados": [dict(id=r.pk, fecha=r.fecha, usuario=r.usuario, modulo=r.modulo,
                accion=r.accion, referencia=r.referencia, motivo=r.motivo, antes=r.antes, despues=r.despues)
                for r in rows[(page - 1) * size:page * size]]})


# Catálogos compartidos. No permite borrar registros, mover stock ni cambiar equivalencias.
# Las equivalencias y fleteros se gestionan con la operativa auditada de Expedición.
CATALOGOS = {
    "empleados": (Empleado, "Empleados de logística", ["legajo", "nombre", "puesto", "disponible", "activo"]),
    "vehiculos": (Vehiculo, "Vehículos", ["patente", "descripcion", "tipo", "activo"]),
    "asignaciones": (Asignacion, "Asignaciones", ["codigo", "descripcion", "chofer_predeterminado", "activo"]),
    "concesionarios": (Concesionario, "Concesionarios", ["nombre", "activo"]),
    "motivos-rechazo": (MotivoRechazo, "Motivos de rechazo", ["nombre", "activo"]),
    "motivos-cambio": (MotivoCambio, "Motivos de cambio", ["nombre", "activo"]),
}


def serializer_catalogo(key):
    model, label, fields = CATALOGOS[key]
    meta = type("Meta", (), {"model": model, "fields": ["id", *fields], "read_only_fields": ["id"]})
    return type("CatalogoSerializer", (serializers.ModelSerializer,), {"Meta": meta})


class CatalogosAPIView(AdministracionAPIView):
    def get(self, request):
        catalogs = []
        for key, (model, name, fields) in CATALOGOS.items():
            descriptions = []
            for field in fields:
                f = model._meta.get_field(field)
                descriptions.append({"clave": field, "tipo": "boolean" if f.get_internal_type() == "BooleanField" else "empleado" if f.is_relation else "text",
                                     "requerido": not f.blank and not f.has_default(), "maximo": f.max_length})
            catalogs.append({"clave": key, "nombre": name, "campos": descriptions})
        return Response({"catalogos": catalogs,
                         "empleados": list(Empleado.objects.filter(activo=True).values("id", "nombre")),
                         "familias": list(Producto.Familia.values)})


class CatalogoAPIView(AdministracionAPIView):
    def get(self, request, catalogo):
        if catalogo not in CATALOGOS:
            raise ValidationError("Catálogo no permitido.")
        serializer = serializer_catalogo(catalogo)
        rows = serializer.Meta.model.objects.all().order_by("id")
        data = list(serializer(rows, many=True).data)
        if catalogo == "motivos-cambio":
            familias = {}
            for item in MotivoCambioFamilia.objects.values("motivo_id", "familia"):
                familias.setdefault(item["motivo_id"], []).append(item["familia"])
            for row in data:
                row["familias"] = familias.get(row["id"], [])
        return Response(data)

    def post(self, request, catalogo):
        return self.guardar(request, catalogo)

    def guardar(self, request, catalogo, pk=None):
        if catalogo not in CATALOGOS:
            raise ValidationError("Catálogo no permitido.")
        cls = serializer_catalogo(catalogo)
        instance = get_object_or_404(cls.Meta.model.objects.select_for_update(), pk=pk) if pk else None
        before = dict(cls(instance).data) if instance else {}
        allowed = set(CATALOGOS[catalogo][2]) | {"motivo"} | ({"familias"} if catalogo == "motivos-cambio" else set())
        if set(request.data) - allowed:
            raise ValidationError("Hay campos no permitidos.")
        reason = str(request.data.get("motivo", "")).strip()
        if pk and (not reason or len(reason) > 2000):
            raise ValidationError({"motivo": "Indicá el motivo de la modificación."})
        if catalogo == "asignaciones" and (not pk or "codigo" in request.data):
            codigo = request.data.get("codigo", instance.codigo if instance else "")
            if not isinstance(codigo, str) or not codigo.isdecimal() or int(codigo) > 2147483647:
                raise ValidationError({"codigo": "Usá un código numérico válido para las asignaciones."})
        families = request.data.get("familias", None)
        if families is not None and (not isinstance(families, list) or any(f not in Producto.Familia.values for f in families)):
            raise ValidationError({"familias": "Seleccioná familias válidas."})
        if catalogo == "motivos-cambio" and not pk and not families:
            raise ValidationError({"familias": "Seleccioná al menos una familia para el motivo."})
        serializer = cls(instance, data={k: v for k, v in request.data.items() if k in CATALOGOS[catalogo][2]}, partial=bool(pk))
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        if catalogo == "motivos-cambio" and families is not None:
            before["familias"] = list(obj.familias_permitidas.values_list("familia", flat=True))
            obj.familias_permitidas.all().delete()
            MotivoCambioFamilia.objects.bulk_create([MotivoCambioFamilia(motivo=obj, familia=f) for f in sorted(set(families))])
        after = dict(cls(obj).data)
        if catalogo == "motivos-cambio":
            after["familias"] = list(obj.familias_permitidas.values_list("familia", flat=True))
        registrar(request.user, "CONFIGURACION", "Modificar catálogo" if pk else "Crear catálogo", f"{catalogo}:{obj.pk}", reason, before, after)
        return Response(after, status=200 if pk else 201)


class CatalogoDetalleAPIView(CatalogoAPIView):
    def patch(self, request, catalogo, pk):
        return self.guardar(request, catalogo, pk)

    # Un detalle no permite POST ni GET del listado: sólo modificación explícita.
    http_method_names = ["patch", "options"]
