
from django.contrib import admin
from django.urls import include, path


urlpatterns = [

    path(
        "admin/",
        admin.site.urls,
    ),

    path(
        "api/repartos/",
        include("repartos.urls"),
    ),

    path(
        "api/maestros/",
        include("maestros.urls"),
    ),

    path(
        "api/rechazos/",
        include("rechazos.urls"),
    ),

    path(
        "api/cambios/",
        include("cambios.urls"),
    ),

    path(
        "api/auth/",
        include("core.urls"),
    ),

    path(
        "api/asistente/",
        include("asistente.urls"),
    ),

    path(
        "api/asistente/",
        include("asistente.urls"),
    ),

]