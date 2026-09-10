from django.urls import path

from .views import (
    ResumenAnualViaticosAPIView,
    ViaticoDetalleAPIView,
    ViaticosAPIView,
)


urlpatterns = [
    path(
        "",
        ViaticosAPIView.as_view(),
        name="viaticos",
    ),

    path(
        "resumen-anual/",
        ResumenAnualViaticosAPIView.as_view(),
        name="viaticos-resumen-anual",
    ),

    path(
        "<int:pk>/",
        ViaticoDetalleAPIView.as_view(),
        name="viatico-detalle",
    ),
]