from django.contrib.auth import authenticate, login, logout

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class LoginAPIView(APIView):

    authentication_classes = []
    permission_classes = []

    def post(self, request):

        username = request.data.get(
            "username"
        )

        password = request.data.get(
            "password"
        )

        if not username or not password:

            return Response(
                {
                    "error":
                        "Usuario y contraseña son obligatorios."
                },
                status=
                    status.HTTP_400_BAD_REQUEST,
            )


        user = authenticate(
            request,
            username=username,
            password=password,
        )


        if user is None:

            return Response(
                {
                    "error":
                        "Usuario o contraseña incorrectos."
                },
                status=
                    status.HTTP_401_UNAUTHORIZED,
            )


        login(
            request,
            user,
        )


        return Response(
            {
                "id":
                    user.id,

                "username":
                    user.username,

                "first_name":
                    user.first_name,

                "last_name":
                    user.last_name,

                "nombre_completo":
                    user.get_full_name()
                    or user.username,
            }
        )


class LogoutAPIView(APIView):

    def post(self, request):

        logout(
            request
        )

        return Response(
            {
                "mensaje":
                    "Sesión cerrada correctamente."
            }
        )


class UsuarioActualAPIView(APIView):

    def get(self, request):

        if not request.user.is_authenticated:

            return Response(
                {
                    "autenticado":
                        False
                },
                status=
                    status.HTTP_401_UNAUTHORIZED,
            )


        user = request.user


        return Response(
            {
                "autenticado":
                    True,

                "id":
                    user.id,

                "username":
                    user.username,

                "first_name":
                    user.first_name,

                "last_name":
                    user.last_name,

                "nombre_completo":
                    user.get_full_name()
                    or user.username,
            }
        )