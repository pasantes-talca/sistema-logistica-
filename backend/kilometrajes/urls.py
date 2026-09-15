from django.urls import path

from .views import (
    ControlKilometrajeDetalleAPIView,
    ControlesKilometrajeAPIView,
    DestinosKilometrajeAPIView,
    EstadisticasKilometrajeAPIView,
)


urlpatterns = [
    path(
        "destinos/",
        DestinosKilometrajeAPIView.as_view(),
        name="kilometrajes-destinos",
    ),

    path(
        "",
        ControlesKilometrajeAPIView.as_view(),
        name="kilometrajes-listado",
    ),

    path(
        "estadisticas/",
        EstadisticasKilometrajeAPIView.as_view(),
        name="kilometrajes-estadisticas",
    ),

    path(
        "<int:pk>/",
        ControlKilometrajeDetalleAPIView.as_view(),
        name="kilometrajes-detalle",
    ),
]