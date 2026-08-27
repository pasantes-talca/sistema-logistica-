from django.urls import path

from .views import RepartoListCreateAPIView


urlpatterns = [
    path(
        "",
        RepartoListCreateAPIView.as_view(),
        name="repartos-list-create",
    ),
]