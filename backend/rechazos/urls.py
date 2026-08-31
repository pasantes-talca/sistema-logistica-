from django.urls import path

from .views import (
    RechazoListCreateAPIView,
    RechazoDetailAPIView,
    EstadisticasRechazosAPIView,
)


urlpatterns = [

    path(
        "",
        RechazoListCreateAPIView.as_view(),
        name="rechazos-list-create",
    ),

    path(
        "estadisticas/",
        EstadisticasRechazosAPIView.as_view(),
        name="rechazos-estadisticas",
    ),

    path(
        "<int:pk>/",
        RechazoDetailAPIView.as_view(),
        name="rechazos-detail",
    ),

]