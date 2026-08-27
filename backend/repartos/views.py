from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Reparto
from .serializers import (
    RepartoSerializer,
    RepartoCreateSerializer,
)


class RepartoListCreateAPIView(APIView):

    def get(self, request):
        repartos = (
            Reparto.objects
            .select_related(
                "vehiculo",
                "asignacion",
                "creado_por",
            )
            .prefetch_related(
                "personal__empleado"
            )
            .all()
        )

        serializer = RepartoSerializer(
            repartos,
            many=True
        )

        return Response(
            serializer.data
        )

    def post(self, request):
        serializer = RepartoCreateSerializer(
            data=request.data,
            context={
                "request": request
            }
        )

        serializer.is_valid(
            raise_exception=True
        )

        reparto = serializer.save()

        respuesta = RepartoSerializer(
            reparto
        )

        return Response(
            respuesta.data,
            status=status.HTTP_201_CREATED
        )