from django.urls import path

from .views import (
    RepartoERPListaView,
    RepartoERPDetalleView,
    ImportarView, CatalogosView, AccionView, PlanificarView, UnidadesView,
)


urlpatterns = [
    path("catalogos/", CatalogosView.as_view()),
    path("unidades/", UnidadesView.as_view()),
    path("<int:cod_reparto>/importar/", ImportarView.as_view()),
    path("<int:cod_reparto>/acciones/", AccionView.as_view()),
    path("<int:cod_reparto>/planificar/", PlanificarView.as_view()),
    path(
        "",
        RepartoERPListaView.as_view(),
        name="repartos-erp-lista",
    ),
    path(
        "<int:cod_reparto>/",
        RepartoERPDetalleView.as_view(),
        name="repartos-erp-detalle",
    ),
]
