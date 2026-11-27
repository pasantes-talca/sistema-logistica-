import logging

from rest_framework import status
from rest_framework.response import Response
from core.api import APIView

from .services import preguntar_gemini

logger = logging.getLogger(__name__)


class AsistenteAPIView(APIView):

    def post(self, request):

        pregunta = (
            request.data
            .get("pregunta", "")
            .strip()
        )

        if not pregunta:

            return Response(
                {
                    "error":
                        "La pregunta es obligatoria."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            resultado = preguntar_gemini(
                pregunta,
                usuario=request.user,
            )

        except Exception as error:

            # Full detail goes to the server log only, never to the client.
            logger.exception("Assistant query failed")

            mensaje = str(error)

            if "429" in mensaje or "quota" in mensaje.lower():

                return Response(
                    {
                        "error":
                            (
                                "El asistente alcanzó temporalmente "
                                "el límite de consultas. "
                                "Intentá nuevamente en unos instantes."
                            )
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            return Response(
                {
                    "error":
                        (
                            "No pudimos procesar la consulta. "
                            "Intentá nuevamente más tarde."
                        )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            resultado,
            status=status.HTTP_200_OK,
        )
