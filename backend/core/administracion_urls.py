from django.urls import path
from .administracion_views import UsuariosAPIView, UsuarioAPIView, PasswordAPIView, AuditoriaAPIView, CatalogosAPIView, CatalogoAPIView, CatalogoDetalleAPIView

urlpatterns = [
    path("usuarios/", UsuariosAPIView.as_view()),
    path("usuarios/<int:pk>/", UsuarioAPIView.as_view()),
    path("usuarios/<int:pk>/password/", PasswordAPIView.as_view()),
    path("auditoria/", AuditoriaAPIView.as_view()),
    path("catalogos/", CatalogosAPIView.as_view()),
    path("catalogos/<str:catalogo>/", CatalogoAPIView.as_view()),
    path("catalogos/<str:catalogo>/<int:pk>/", CatalogoDetalleAPIView.as_view()),
]
