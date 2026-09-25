from django.urls import path

from .views import (
    CrearEntregaOrdenAPIView,
    FleteroListCreateAPIView,
    MovimientoMaterialListAPIView,
    MovimientoStockListCreateAPIView,
    OrdenCargaDetailAPIView,
    OrdenCargaListCreateAPIView,
    StockProductoListAPIView,
)


urlpatterns = [
    path(
        "fleteros/",
        FleteroListCreateAPIView.as_view(),
        name="expedicion-fleteros",
    ),

    path(
        "stock/",
        StockProductoListAPIView.as_view(),
        name="expedicion-stock",
    ),

    path(
        "movimientos/",
        MovimientoStockListCreateAPIView.as_view(),
        name="expedicion-movimientos-stock",
    ),

    path(
        "materiales/",
        MovimientoMaterialListAPIView.as_view(),
        name="expedicion-materiales",
    ),

    path(
        "ordenes/",
        OrdenCargaListCreateAPIView.as_view(),
        name="expedicion-ordenes",
    ),

    path(
        "ordenes/<int:pk>/",
        OrdenCargaDetailAPIView.as_view(),
        name="expedicion-orden-detalle",
    ),

    path(
        "ordenes/<int:pk>/entregas/",
        CrearEntregaOrdenAPIView.as_view(),
        name="expedicion-orden-entregas",
    ),
]