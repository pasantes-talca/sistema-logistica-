from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from core.api import APIView
from core.permissions import tiene_modulo, es_administrador
from core.models import AccesoAcciones
from .models import RepartoERP, UnidadERP, CobroERP, ClientePersatERP
from .serializers import (RepartoERPListaSerializer, RepartoERPDetalleSerializer, UnidadERPSerializer,
    EstadoEntradaSerializer, ImporteEntradaSerializer, CobroEntradaSerializer, EventoERPSerializer)
from . import origen_sqlserver as sql, sincronizacion as sync, operaciones as op, planificacion as plan


def consulta():
    return RepartoERP.objects.select_related("usuario_asignado", "unidad").prefetch_related(
        "paradas__documentos__detalles", "paradas__cobros__actor")


def capacidades(user):
    if es_administrador(user):
        return ["consultar", "crear", "editar", "anular", "configurar", "exportar"]
    policy = AccesoAcciones.objects.filter(usuario=user).first()
    return policy.permisos.get("REPARTOS", []) if policy and "REPARTOS" in policy.permisos else ["consultar", "crear", "editar", "anular", "configurar", "exportar"]


def detalle(reparto):
    r = consulta().get(pk=reparto.pk)
    data = RepartoERPDetalleSerializer(r, context={"ubicaciones": plan.ubicaciones(r)}).data
    data["origen"] = plan.origen(r)
    carga = r.documentos.filter(tipo="FACTURA").aggregate(total=Sum("detalles__cantidad_bultos"))["total"]
    data["bultos"] = str(carga) if carga is not None else None
    data["carga_completa"] = bool(r.documentos.filter(tipo="FACTURA").exists() and not
        r.documentos.filter(tipo="FACTURA").filter(Q(detalles__isnull=True) | Q(detalles__cantidad_bultos__isnull=True) | Q(detalles__cantidad_bultos__lt=0)).exists())
    data["ocupacion"] = str(carga / r.unidad.capacidad * 100) if carga is not None and r.unidad and data["carga_completa"] else None
    data["eventos"] = EventoERPSerializer(r.eventos.select_related("actor")[:100], many=True).data
    return data


class FiltroSerializer(serializers.Serializer):
    fecha = serializers.DateField(required=False)
    chofer = serializers.CharField(required=False, allow_blank=True, max_length=200)
    ruta = serializers.CharField(required=False, allow_blank=True, max_length=100)
    almacen = serializers.CharField(required=False, allow_blank=True, max_length=100)


class RepartoERPListaView(APIView):
    def get(self, request):
        filtro = FiltroSerializer(data=request.query_params)
        filtro.is_valid(raise_exception=True)
        filtros = filtro.validated_data
        fecha = filtros.get("fecha", timezone.localdate())
        locales = RepartoERP.objects.prefetch_related("paradas__cobros").filter(Q(fecha_salida=fecha) | Q(fecha_salida__isnull=True, fecha_comprobante=fecha))
        local = {r.cod_reparto: RepartoERPListaSerializer(r).data for r in locales}
        advertencia = ""
        try:
            fuentes = sql.obtener_repartos(fecha.strftime("%d/%m/%Y"))
        except Exception:
            fuentes = []
            advertencia = "SQL Server no está disponible. Se muestran únicamente los repartos ya importados; no es un listado completo del ERP."
        filas = dict(local)
        campos = {"nro_comprobante": "nrocomprobante", "almacen": "almacen", "ruta": "ruta", "transporte": "transporte",
            "chofer": "chofer", "camion": "camion", "estado": "estado", "monto_total": "montoTotal", "cod_jerarquia": "codjerarquia"}
        for raw in fuentes:
            cod = sync.entero(raw.get("codReparto"))
            if cod is None:
                continue
            fuente = {k: raw.get(v) for k, v in campos.items()}
            # La referencia comercial viene de SQL; el resumen siempre es exclusivamente local.
            filas[cod] = {**fuente, "cod_reparto": cod, "importado": cod in local,
                "resumen": local.get(cod, {}).get("resumen")}
        resultados = [r for r in filas.values() if all(str(filtros.get(c, "")).casefold() in str(r.get(c) or "").casefold()
                                                     for c in ["chofer", "ruta", "almacen"])]
        resultados.sort(key=lambda r: r["cod_reparto"], reverse=True)
        return Response({"results": resultados, "advertencia": advertencia, "fecha": str(fecha), "permisos": capacidades(request.user)})


class RepartoERPDetalleView(APIView):
    def get(self, request, cod_reparto):
        return Response(detalle(get_object_or_404(RepartoERP, cod_reparto=cod_reparto)))


class ImportarView(APIView):
    def post(self, request, cod_reparto):
        try:
            fuente = sql.obtener_reparto(cod_reparto)
        except Exception:
            return Response({"detail": "No se pudo leer SQL Server. No se importó el reparto."}, status=503)
        if not fuente:
            return Response({"detail": "El reparto no existe en el ERP."}, status=404)
        # Serializar reimportaciones y modificaciones operativas del mismo reparto.
        anterior = RepartoERP.objects.select_for_update().filter(cod_reparto=cod_reparto).first()
        try:
            resultado = sync.sincronizar_reparto(fuente)
        except ValueError as exc:
            raise ValidationError(str(exc)) from None
        except Exception:
            return Response({"detail": "No se pudo completar la importación. No se guardaron cambios parciales."}, status=503)
        reparto = RepartoERP.objects.get(cod_reparto=cod_reparto)
        op.evento(reparto, request.user, "actualizar_desde_erp" if anterior else "importar", {"cod_reparto": cod_reparto})
        return Response({"reparto": detalle(reparto), "advertencia": "Los remitos no pudieron consultarse con los permisos actuales; facturas y pedidos sí se importaron."
                         if resultado.get("remitos_error") else ""})


class CatalogosView(APIView):
    def get(self, request):
        users = get_user_model().objects.filter(is_active=True).filter(Q(is_superuser=True) |
            Q(groups__name__in=["ADMINISTRADOR", "REPARTOS"])).distinct().order_by("username")
        return Response({"usuarios": [{"id": u.id, "nombre": u.get_full_name() or u.username} for u in users
            if "consultar" in capacidades(u)], "unidades": UnidadERPSerializer(UnidadERP.objects.filter(activo=True), many=True).data,
            "permisos": capacidades(request.user), "clientes_persat": ClientePersatERP.objects.count()})


class UnidadesView(APIView):
    def post(self, request):
        data = UnidadERPSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        data.save()
        return Response(data.data, status=201)


class AccionView(APIView):
    def post(self, request, cod_reparto):
        r = get_object_or_404(RepartoERP.objects.select_for_update(), cod_reparto=cod_reparto)
        accion = request.data.get("accion")
        if accion == "asignar":
            uid = serializers.IntegerField(min_value=1, allow_null=True).run_validation(request.data.get("usuario"))
            u = get_object_or_404(get_user_model(), pk=uid) if uid else None
            if u and (not tiene_modulo(u, "REPARTOS") or "consultar" not in capacidades(u)):
                raise ValidationError("El usuario debe estar activo y tener acceso a Repartos.")
            anterior = r.usuario_asignado_id
            r.usuario_asignado = u
            r.save(update_fields=["usuario_asignado"])
            op.evento(r, request.user, "asignar", {"antes": anterior, "despues": uid})
        elif accion == "unidad":
            uid = serializers.IntegerField(min_value=1, allow_null=True).run_validation(request.data.get("unidad"))
            unidad = get_object_or_404(UnidadERP, pk=uid, activo=True) if uid else None
            r.unidad = unidad
            r.save(update_fields=["unidad"])
            op.evento(r, request.user, "unidad", {"unidad": uid})
        elif accion == "confirmar_plan":
            firma = serializers.CharField(max_length=2_000_000).run_validation(request.data.get("firma"))
            plan.confirmar(r, request.user, firma)
        elif accion == "anular_cobro":
            cid = serializers.IntegerField(min_value=1).run_validation(request.data.get("cobro"))
            motivo = serializers.CharField(max_length=500).run_validation(request.data.get("motivo"))
            c = get_object_or_404(CobroERP.objects.select_for_update(), pk=cid, parada__reparto=r)
            if c.anulado_en:
                raise ValidationError("El cobro ya está anulado.")
            c.anulado_en, c.anulado_por, c.motivo_anulacion = timezone.now(), request.user, motivo
            c.save()
            op.evento(r, request.user, "anular_cobro", {"cobro": c.id, "motivo": motivo})
        elif accion in {"estado", "mover", "importe", "cobro"}:
            pid = serializers.IntegerField(min_value=1).run_validation(request.data.get("parada"))
            p = get_object_or_404(r.paradas.select_for_update(), pk=pid)
            if accion == "estado":
                data = EstadoEntradaSerializer(data=request.data)
                data.is_valid(raise_exception=True)
                op.cambiar_estado(r, p, data.validated_data, request.user)
            elif accion == "mover":
                direccion = serializers.ChoiceField(choices=["arriba", "abajo"]).run_validation(request.data.get("direccion"))
                op.mover(r, p, direccion, request.user)
            elif accion == "importe":
                data = ImporteEntradaSerializer(data=request.data)
                data.is_valid(raise_exception=True)
                op.ajustar_importe(r, p, data.validated_data["importe"], request.user)
            else:
                data = CobroEntradaSerializer(data=request.data)
                data.is_valid(raise_exception=True)
                op.registrar_cobro(r, p, data.validated_data, request.user)
        else:
            raise ValidationError("Acción no válida.")
        return Response(detalle(r))


class PlanificarView(APIView):
    def post(self, request, cod_reparto):
        r = get_object_or_404(RepartoERP, cod_reparto=cod_reparto)
        accion = serializers.ChoiceField(choices=["calcular", "ver_recorrido"]).run_validation(request.data.get("accion"))
        regreso = serializers.BooleanField().run_validation(request.data.get("regreso", True))
        return Response(plan.calcular(r, request.user, request.data.get("latitud"), request.data.get("longitud"), regreso,
            guardado=accion == "ver_recorrido"))
