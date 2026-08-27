from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import IntegerField
from django.db.models.functions import Cast

from .models import (
    Empleado,
    Vehiculo,
    Asignacion,
)

from .serializers import (
    EmpleadoSerializer,
    VehiculoSerializer,
    AsignacionSerializer,
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