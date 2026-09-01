from django.urls import path

from .views import (
    LoginAPIView,
    LogoutAPIView,
    UsuarioActualAPIView,
)


urlpatterns = [

    path(
        "login/",
        LoginAPIView.as_view(),
        name="login",
    ),

    path(
        "logout/",
        LogoutAPIView.as_view(),
        name="logout",
    ),

    path(
        "usuario/",
        UsuarioActualAPIView.as_view(),
        name="usuario-actual",
    ),

]