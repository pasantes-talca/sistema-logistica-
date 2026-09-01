from django.urls import path

from .views import (
    EstadisticasCambiosAPIView,
    ReciboCambioDetailAPIView,
    ReciboCambioListCreateAPIView,
)


urlpatterns = [

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