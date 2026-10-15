from django.urls import path
from .historicos_views import ImportacionesHistoricasAPIView, HistoricoRechazosAPIView

from .views import (
    RechazoListCreateAPIView,
    RechazoDetailAPIView,
    EstadisticasRechazosAPIView,
)


urlpatterns = [
    path('historicos/', ImportacionesHistoricasAPIView.as_view(), name='rechazos-historicos'),
    path('historicos/<int:pk>/<str:contenido>/', HistoricoRechazosAPIView.as_view(), name='rechazos-historicos-contenido'),

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
