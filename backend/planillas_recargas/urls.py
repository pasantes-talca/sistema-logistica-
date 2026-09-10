from django.urls import path

from .views import ProcesarPlanillasAPIView


urlpatterns = [
    path(
        "procesar/",
        ProcesarPlanillasAPIView.as_view(),
        name="procesar-planillas-recargas",
    ),
]