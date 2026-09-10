from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
    procesar_planillas,
)


class ProcesarPlanillasAPIView(
    APIView
):

    def post(
        self,
        request,
    ):

        archivo_rutas = (
            request.FILES.get(
                "archivo_rutas"
            )
        )

        archivo_salidas = (
            request.FILES.get(
                "archivo_salidas"
            )
        )


        if not archivo_rutas:

            return Response(
                {
                    "error":
                        (
                            "Debe adjuntar la "
                            "planilla de distribución."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        if not archivo_salidas:

            return Response(
                {
                    "error":
                        (
                            "Debe adjuntar la planilla "
                            "de salida de personal."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        extensiones_validas = (
            ".xlsx",
            ".xlsm",
        )


        if not (
            archivo_rutas
            .name
            .lower()
            .endswith(
                extensiones_validas
            )
        ):

            return Response(
                {
                    "error":
                        (
                            "La planilla de distribución "
                            "debe ser .xlsx o .xlsm."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        if not (
            archivo_salidas
            .name
            .lower()
            .endswith(
                extensiones_validas
            )
        ):

            return Response(
                {
                    "error":
                        (
                            "La planilla de salida "
                            "debe ser .xlsx o .xlsm."
                        )
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        try:

            resultado = procesar_planillas(

                archivo_rutas=
                    archivo_rutas,

                archivo_salidas=
                    archivo_salidas,
            )

        except Exception as error:

            return Response(
                {
                    "error":
                        (
                            "No se pudieron procesar "
                            "las planillas."
                        ),

                    "detalle":
                        str(error),
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        return Response(
            resultado,
            status=status.HTTP_200_OK,
        )