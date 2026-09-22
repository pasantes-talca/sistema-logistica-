from decimal import Decimal

from django.db.models import Sum

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from control_diario.models import MovimientoControlDiario


class EstadisticasControlDiarioAPIView(APIView):

    permission_classes = [
        IsAuthenticated,
    ]

    def get(self, request):

        movimientos = (
            MovimientoControlDiario.objects
            .select_related(
                "control",
                "producto",
                "ubicacion",
            )
            .all()
        )

        # ==========================================
        # FILTROS
        # ==========================================

        desde = request.query_params.get(
            "desde"
        )

        hasta = request.query_params.get(
            "hasta"
        )

        if desde:
            movimientos = movimientos.filter(
                control__fecha__gte=desde
            )

        if hasta:
            movimientos = movimientos.filter(
                control__fecha__lte=hasta
            )


        # ==========================================
        # TOTALES GENERALES
        # ==========================================

        total_movimientos = (
            movimientos.count()
        )

        total_cantidad = (
            movimientos.aggregate(
                total=Sum("cantidad")
            )["total"]
            or Decimal("0")
        )


        # ==========================================
        # POR TIPO DE MOVIMIENTO
        # ==========================================

        por_tipo = list(
            movimientos
            .values(
                "tipo_movimiento"
            )
            .annotate(
                total=Sum("cantidad")
            )
            .order_by(
                "-total"
            )
        )


        # ==========================================
        # POR PRODUCTO
        # ==========================================

        por_producto = list(
            movimientos
            .values(
                "producto_id",
                "producto__nombre",
            )
            .annotate(
                total=Sum("cantidad")
            )
            .order_by(
                "-total"
            )
        )


        # ==========================================
        # POR DISTRIBUIDOR
        # ==========================================

        por_distribuidor = list(
            movimientos
            .filter(
                tipo_movimiento="DISTRIBUCION"
            )
            .values(
                "ubicacion_id",
                "ubicacion__nombre",
            )
            .annotate(
                total=Sum("cantidad")
            )
            .order_by(
                "-total"
            )
        )


        # ==========================================
        # POR FECHA
        # ==========================================

        por_fecha = list(
            movimientos
            .values(
                "control__fecha"
            )
            .annotate(
                total=Sum("cantidad")
            )
            .order_by(
                "control__fecha"
            )
        )


        # ==========================================
        # PRINCIPALES
        # ==========================================

        producto_principal = (
            por_producto[0]
            if por_producto
            else None
        )

        distribuidor_principal = (
            por_distribuidor[0]
            if por_distribuidor
            else None
        )


        # ==========================================
        # RESPUESTA
        # ==========================================

        return Response(
            {
                "total_movimientos":
                    total_movimientos,

                "total_cantidad":
                    total_cantidad,

                "producto_principal":
                    producto_principal,

                "distribuidor_principal":
                    distribuidor_principal,

                "por_tipo":
                    por_tipo,

                "por_producto":
                    por_producto,

                "por_distribuidor":
                    por_distribuidor,

                "por_fecha":
                    por_fecha,
            }
        )