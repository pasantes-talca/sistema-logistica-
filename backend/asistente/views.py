from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import preguntar_gemini


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
                pregunta
            )

        except Exception as error:

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
                        mensaje
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            resultado,
            status=status.HTTP_200_OK,
        )