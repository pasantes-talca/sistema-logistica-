from django.urls import path
from .documentos_views import ExportarPlanillaAPIView, FinalizarPlanillaAPIView

from .views import (
    ControlKilometrajeDetalleAPIView,
    ControlesKilometrajeAPIView,
    DestinosKilometrajeAPIView,
    EstadisticasKilometrajeAPIView,
)


urlpatterns = [
    path("<int:pk>/exportar/<str:formato>/", ExportarPlanillaAPIView.as_view(), name="kilometrajes-exportar"),
    path("<int:pk>/finalizar/", FinalizarPlanillaAPIView.as_view(), name="kilometrajes-finalizar"),
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
