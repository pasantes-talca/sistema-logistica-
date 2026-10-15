from django.urls import path

from .views import (
    RepartoListCreateAPIView,
    RepartoDetailAPIView,
    ReporteRecargasAPIView,
)
from .historicos_views import ImportacionesHistoricasAPIView, HistoricoRepartosAPIView


urlpatterns = [
    path("historicos/", ImportacionesHistoricasAPIView.as_view(), name="repartos-historicos"),
    path("historicos/<int:pk>/<str:contenido>/", HistoricoRepartosAPIView.as_view(), name="repartos-historicos-contenido"),
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
