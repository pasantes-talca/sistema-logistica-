from django.urls import path

from .views import AsistenteAPIView


urlpatterns = [

    path(
        "preguntar/",
        AsistenteAPIView.as_view(),
        name="asistente-preguntar",
    ),

]