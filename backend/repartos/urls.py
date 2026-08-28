from django.urls import path

from .views import (
    RepartoListCreateAPIView,
    RepartoDetailAPIView,
    ReporteRecargasAPIView,
)


urlpatterns = [
    path(
        "",
        RepartoListCreateAPIView.as_view(),
        name="repartos-list-create",
    ),

    path(
        "reporte-recargas/",
        ReporteRecargasAPIView.as_view(),
        name="reporte-recargas",
    ),

    path(
        "<int:pk>/",
        RepartoDetailAPIView.as_view(),
        name="repartos-detail",
    ),
]