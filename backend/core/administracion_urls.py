from django.urls import path
from .panel_views import PanelAPIView, ReporteActividadAPIView, PermisosAccionesAPIView, PreferenciasAPIView, EstadoSistemaAPIView, SesionesAPIView, IncidenciasAPIView, AlertasAPIView
from .administracion_views import UsuariosAPIView, UsuarioAPIView, PasswordAPIView, AuditoriaAPIView, CatalogosAPIView, CatalogoAPIView, CatalogoDetalleAPIView

urlpatterns = [
    path("panel/", PanelAPIView.as_view()),
    path("reportes/", ReporteActividadAPIView.as_view()),
    path("permisos/", PermisosAccionesAPIView.as_view()),
    path("preferencias/", PreferenciasAPIView.as_view()),
    path("estado/", EstadoSistemaAPIView.as_view()),
    path("sesiones/", SesionesAPIView.as_view()),
    path("errores/", IncidenciasAPIView.as_view()),
    path("alertas/", AlertasAPIView.as_view()),
    path("usuarios/", UsuariosAPIView.as_view()),
    path("usuarios/<int:pk>/", UsuarioAPIView.as_view()),
    path("usuarios/<int:pk>/password/", PasswordAPIView.as_view()),
    path("auditoria/", AuditoriaAPIView.as_view()),
    path("catalogos/", CatalogosAPIView.as_view()),
    path("catalogos/<str:catalogo>/", CatalogoAPIView.as_view()),
    path("catalogos/<str:catalogo>/<int:pk>/", CatalogoDetalleAPIView.as_view()),
]
