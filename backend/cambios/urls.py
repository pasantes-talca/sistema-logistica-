from django.urls import path
from .historicos_views import ImportacionesHistoricasAPIView, HistoricoCambiosAPIView

from .views import (
    EstadisticasCambiosAPIView,
    ReciboCambioDetailAPIView,
    ReciboCambioListCreateAPIView,
)


urlpatterns = [
    path('historicos/', ImportacionesHistoricasAPIView.as_view(), name='cambios-historicos'),
    path('historicos/<int:pk>/<str:contenido>/', HistoricoCambiosAPIView.as_view(), name='cambios-historico-contenido'),

    path(
        "recibos/",
        ReciboCambioListCreateAPIView.as_view(),
        name="cambios-recibos-list-create",
    ),

    path(
        "recibos/<int:pk>/",
        ReciboCambioDetailAPIView.as_view(),
        name="cambios-recibos-detail",
    ),

    path(
        "estadisticas/",
        EstadisticasCambiosAPIView.as_view(),
        name="cambios-estadisticas",
    ),

]
