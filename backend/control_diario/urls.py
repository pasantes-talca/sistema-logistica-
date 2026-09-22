from django.urls import path

from control_diario.estadisticas import (
    EstadisticasControlDiarioAPIView,
)

from control_diario.views import (
    ControlDiarioDetalleAPIView,
    ControlDiarioResumenAPIView,
    ControlesDiariosAPIView,
    ProductosControlDiarioAPIView,
    UbicacionesControlDiarioAPIView,
)


urlpatterns = [

    path(
        "productos/",
        ProductosControlDiarioAPIView.as_view(),
        name="control-diario-productos",
    ),

    path(
        "ubicaciones/",
        UbicacionesControlDiarioAPIView.as_view(),
        name="control-diario-ubicaciones",
    ),

    path(
        "estadisticas/",
        EstadisticasControlDiarioAPIView.as_view(),
        name="control-diario-estadisticas",
    ),

    path(
        "",
        ControlesDiariosAPIView.as_view(),
        name="control-diario-lista",
    ),

    path(
        "<int:pk>/resumen/",
        ControlDiarioResumenAPIView.as_view(),
        name="control-diario-resumen",
    ),

    path(
        "<int:pk>/",
        ControlDiarioDetalleAPIView.as_view(),
        name="control-diario-detalle",
    ),

]