from django.db.models import Prefetch

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ControlKilometraje,
    DestinoKilometraje,
    RegistroKilometraje,
)

from .serializers import (
    ControlKilometrajeSerializer,
    CrearControlKilometrajeSerializer,
    DestinoKilometrajeSerializer,
)

from django.db.models import (
    DecimalField,
    ExpressionWrapper,
    F,
    Sum,
)

class DestinosKilometrajeAPIView(APIView):

    def get(
        self,
        request,
    ):

        destinos = (
            DestinoKilometraje.objects
            .filter(
                activo=True
            )
            .order_by(
                "nombre"
            )
        )

        serializer = DestinoKilometrajeSerializer(
            destinos,
            many=True,
        )

        return Response(
            serializer.data
        )


class ControlesKilometrajeAPIView(APIView):

    def get(
        self,
        request,
    ):

        controles = (
            ControlKilometraje.objects
            .select_related(
                "chofer",
                "creado_por",
            )
            .prefetch_related(
                Prefetch(
                    "registros",
                    queryset=(
                        RegistroKilometraje.objects
                        .select_related(
                            "destino"
                        )
                        .order_by(
                            "fecha",
                            "destino__nombre",
                        )
                    ),
                )
            )
            .all()
        )

        chofer_id = request.query_params.get(
            "chofer"
        )

        fecha_desde = request.query_params.get(
            "fecha_desde"
        )

        fecha_hasta = request.query_params.get(
            "fecha_hasta"
        )


        if chofer_id:

            controles = controles.filter(
                chofer_id=chofer_id
            )


        if fecha_desde:

            controles = controles.filter(
                fecha_hasta__gte=fecha_desde
            )


        if fecha_hasta:

            controles = controles.filter(
                fecha_desde__lte=fecha_hasta
            )


        serializer = ControlKilometrajeSerializer(
            controles,
            many=True,
        )

        return Response(
            serializer.data
        )


    def post(
        self,
        request,
    ):

        serializer = CrearControlKilometrajeSerializer(
            data=request.data,
            context={
                "request":
                    request,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        control = serializer.save()

        salida = ControlKilometrajeSerializer(
            control
        )

        return Response(
            salida.data,
            status=
                status.HTTP_201_CREATED,
        )


class ControlKilometrajeDetalleAPIView(APIView):

    def get_object(
        self,
        pk,
    ):

        return (
            ControlKilometraje.objects
            .select_related(
                "chofer",
                "creado_por",
            )
            .prefetch_related(
                Prefetch(
                    "registros",
                    queryset=(
                        RegistroKilometraje.objects
                        .select_related(
                            "destino"
                        )
                        .order_by(
                            "fecha",
                            "destino__nombre",
                        )
                    ),
                )
            )
            .filter(
                pk=pk
            )
            .first()
        )


    def get(
        self,
        request,
        pk,
    ):

        control = self.get_object(
            pk
        )

        if control is None:

            return Response(
                {
                    "error":
                        "Control de kilometraje no encontrado."
                },
                status=
                    status.HTTP_404_NOT_FOUND,
            )


        serializer = ControlKilometrajeSerializer(
            control
        )

        return Response(
            serializer.data
        )


    def delete(
        self,
        request,
        pk,
    ):

        control = self.get_object(
            pk
        )

        if control is None:

            return Response(
                {
                    "error":
                        "Control de kilometraje no encontrado."
                },
                status=
                    status.HTTP_404_NOT_FOUND,
            )


        control.delete()

        return Response(
            status=
                status.HTTP_204_NO_CONTENT
        )

class EstadisticasKilometrajeAPIView(APIView):

    def get(
        self,
        request,
    ):

        registros = (
            RegistroKilometraje.objects
            .select_related(
                "control",
                "control__chofer",
                "destino",
            )
            .all()
        )


        fecha_desde = request.query_params.get(
            "desde"
        )

        fecha_hasta = request.query_params.get(
            "hasta"
        )


        if fecha_desde:

            registros = registros.filter(
                fecha__gte=fecha_desde
            )


        if fecha_hasta:

            registros = registros.filter(
                fecha__lte=fecha_hasta
            )


        kilometros_expr = ExpressionWrapper(
            F("distancia_km")
            *
            F("cantidad_viajes"),
            output_field=DecimalField(
                max_digits=14,
                decimal_places=2,
            ),
        )


        total_km = (
            registros
            .aggregate(
                total=Sum(
                    kilometros_expr
                )
            )
            ["total"]
            or 0
        )


        cantidad_registros = (
            registros.count()
        )


        choferes = (
            registros
            .values(
                "control__chofer_id",
                "control__chofer__nombre",
            )
            .annotate(
                kilometros=Sum(
                    kilometros_expr
                )
            )
            .order_by(
                "-kilometros"
            )
        )


        destinos = (
            registros
            .values(
                "destino_id",
                "destino__nombre",
            )
            .annotate(
                kilometros=Sum(
                    kilometros_expr
                ),
                viajes=Sum(
                    "cantidad_viajes"
                ),
            )
            .order_by(
                "-kilometros"
            )
        )


        mejor_chofer = (
            choferes.first()
            if choferes.exists()
            else None
        )


        mejor_destino = (
            destinos.first()
            if destinos.exists()
            else None
        )


        return Response(
            {
                "total_km":
                    total_km,

                "cantidad_registros":
                    cantidad_registros,

                "mejor_chofer":
                    (
                        {
                            "id":
                                mejor_chofer[
                                    "control__chofer_id"
                                ],

                            "nombre":
                                mejor_chofer[
                                    "control__chofer__nombre"
                                ],

                            "kilometros":
                                mejor_chofer[
                                    "kilometros"
                                ],
                        }
                        if mejor_chofer
                        else None
                    ),

                "mejor_destino":
                    (
                        {
                            "id":
                                mejor_destino[
                                    "destino_id"
                                ],

                            "nombre":
                                mejor_destino[
                                    "destino__nombre"
                                ],

                            "kilometros":
                                mejor_destino[
                                    "kilometros"
                                ],

                            "viajes":
                                mejor_destino[
                                    "viajes"
                                ],
                        }
                        if mejor_destino
                        else None
                    ),

                "por_chofer": [
                    {
                        "id":
                            item[
                                "control__chofer_id"
                            ],

                        "nombre":
                            item[
                                "control__chofer__nombre"
                            ],

                        "kilometros":
                            item[
                                "kilometros"
                            ],
                    }
                    for item
                    in choferes
                ],

                "por_destino": [
                    {
                        "id":
                            item[
                                "destino_id"
                            ],

                        "nombre":
                            item[
                                "destino__nombre"
                            ],

                        "kilometros":
                            item[
                                "kilometros"
                            ],

                        "viajes":
                            item[
                                "viajes"
                            ],
                    }
                    for item
                    in destinos
                ],
            }
        )