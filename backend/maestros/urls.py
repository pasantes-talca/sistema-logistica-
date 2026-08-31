from django.urls import path

from .views import (
    ChoferesAPIView,
    AyudantesAPIView,
    VehiculosAPIView,
    AsignacionesAPIView,
    MotivosRechazoAPIView,
)


urlpatterns = [
    path(
        "choferes/",
        ChoferesAPIView.as_view(),
        name="maestros-choferes",
    ),

    path(
        "ayudantes/",
        AyudantesAPIView.as_view(),
        name="maestros-ayudantes",
    ),

    path(
        "vehiculos/",
        VehiculosAPIView.as_view(),
        name="maestros-vehiculos",
    ),

    path(
        "asignaciones/",
        AsignacionesAPIView.as_view(),
        name="maestros-asignaciones",
    ),

    path(
        "motivos-rechazo/",
        MotivosRechazoAPIView.as_view(),
        name="maestros-motivos-rechazo",
    ),
]