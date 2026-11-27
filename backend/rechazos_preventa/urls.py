from django.urls import path

from .views import MapaAPIView, ResumenAPIView, RevisionAPIView

urlpatterns = [
    path("resumen/", ResumenAPIView.as_view(), name="rechazos-preventa-resumen"),
    path("revision/", RevisionAPIView.as_view(), name="rechazos-preventa-revision"),
    path("mapa/", MapaAPIView.as_view(), name="rechazos-preventa-mapa"),
]
