from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import IntegerField
from django.db.models.functions import Cast

from .models import (
    Empleado,
    Vehiculo,
    Asignacion,
    MotivoRechazo,
    Concesionario,
    Producto,
    MotivoCambio,
    MotivoCambioFamilia,
)

from .serializers import (
    EmpleadoSerializer,
    VehiculoSerializer,
    AsignacionSerializer,
    MotivoRechazoSerializer,
    ConcesionarioSerializer,
    ProductoSerializer,
    MotivoCambioSerializer,
)


class ChoferesAPIView(APIView):

    def get(self, request):
        choferes = Empleado.objects.filter(
            puesto="Chofer 1ra. Categoria",
            disponible=True,
            activo=True,
        ).order_by("nombre")

        serializer = EmpleadoSerializer(
            choferes,
            many=True,
        )

        return Response(serializer.data)


class AyudantesAPIView(APIView):

    def get(self, request):
        puestos_permitidos = [
            "Ayudante",
            "Operario Especializado",
            "Chofer 1ra. Categoria",
        ]

        ayudantes = Empleado.objects.filter(
            puesto__in=puestos_permitidos,
            disponible=True,
            activo=True,
        ).order_by("nombre")

        serializer = EmpleadoSerializer(
            ayudantes,
            many=True,
        )

        return Response(serializer.data)


class VehiculosAPIView(APIView):

    def get(self, request):
        vehiculos = Vehiculo.objects.filter(
            activo=True,
        ).order_by("patente")

        serializer = VehiculoSerializer(
            vehiculos,
            many=True,
        )

        return Response(serializer.data)


class AsignacionesAPIView(APIView):

    def get(self, request):
        asignaciones = (
            Asignacion.objects
            .filter(activo=True)
            .select_related(
                "chofer_predeterminado"
            )
            .annotate(
                codigo_numerico=Cast(
                    "codigo",
                    IntegerField()
                )
            )
            .order_by("codigo_numerico")
        )

        serializer = AsignacionSerializer(
            asignaciones,
            many=True,
        )

        return Response(serializer.data)

        serializer = AsignacionSerializer(
            asignaciones,
            many=True,
        )

        return Response(serializer.data)

class MotivosRechazoAPIView(APIView):

    def get(self, request):

        motivos = (
            MotivoRechazo.objects
            .filter(
                activo=True
            )
            .order_by(
                "nombre"
            )
        )

        serializer = (
            MotivoRechazoSerializer(
                motivos,
                many=True,
            )
        )

        return Response(
            serializer.data
        )


class ConcesionariosAPIView(APIView):

    def get(self, request):

        concesionarios = (
            Concesionario.objects
            .filter(
                activo=True
            )
            .order_by(
                "nombre"
            )
        )

        serializer = (
            ConcesionarioSerializer(
                concesionarios,
                many=True,
            )
        )

        return Response(
            serializer.data
        )


class ProductosAPIView(APIView):

    def get(self, request):

        productos = (
            Producto.objects
            .filter(
                activo=True
            )
            .order_by(
                "codigo"
            )
        )

        serializer = (
            ProductoSerializer(
                productos,
                many=True,
            )
        )

        return Response(
            serializer.data
        )


class MotivosCambioAPIView(APIView):

    def get(self, request):

        familia = request.query_params.get(
            "familia"
        )

        motivos = (
            MotivoCambio.objects
            .filter(
                activo=True
            )
        )


        if familia:

            motivos = motivos.filter(
                familias_permitidas__familia=familia
            )


        motivos = (
            motivos
            .distinct()
            .order_by(
                "nombre"
            )
        )


        serializer = (
            MotivoCambioSerializer(
                motivos,
                many=True,
            )
        )

        return Response(
            serializer.data
        )