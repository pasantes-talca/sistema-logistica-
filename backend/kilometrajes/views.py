from django.db.models import Prefetch
from django.db import IntegrityError, transaction

from rest_framework import status
from rest_framework.response import Response
from core.api import APIView

from .models import (
    ControlKilometraje,
    RegistroKilometraje,
)

from .serializers import (
    ControlKilometrajeSerializer,
    CrearControlKilometrajeSerializer,
)
from .planilla import columnas_actuales

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

        return Response(columnas_actuales())


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

        try:
            with transaction.atomic():
                control = serializer.save()
        except IntegrityError:
            if ControlKilometraje.objects.filter(chofer=serializer.validated_data["chofer"],
                    fecha_desde=serializer.validated_data["fecha_desde"], fecha_hasta=serializer.validated_data["fecha_hasta"]).exists():
                return Response({"error": "Ya existe esa planilla. Abrila desde el historial para continuar."}, status=409)
            raise

        salida = ControlKilometrajeSerializer(
            control
        )

        return Response(
            salida.data,
            status=
                status.HTTP_201_CREATED,
        )


class ControlKilometrajeDetalleAPIView(APIView):

    def put(self, request, pk):
        control = ControlKilometraje.objects.select_for_update().filter(pk=pk).first()
        if control is None:
            return Response({"error": "Planilla no encontrada."}, status=404)
        if request.data.get("version") != control.version:
            return Response({"error": "Otra persona modificó esta planilla. Volvé a abrirla; no se sobrescribió nada."}, status=409)
        serializer = CrearControlKilometrajeSerializer(control, data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        self.antes_auditoria["registros"] = list(control.registros.values())
        return Response(ControlKilometrajeSerializer(serializer.save()).data)

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
