from django.contrib import admin

from .models import (
    DetalleEntregaOrdenCarga,
    DetalleOrdenCarga,
    EntregaOrdenCarga,
    Fletero,
    MovimientoMaterial,
    MovimientoStock,
    OrdenCarga,
    StockProducto,
)


@admin.register(Fletero)
class FleteroAdmin(admin.ModelAdmin):

    list_display = (
        "nombre",
        "apellido",
        "empresa",
        "activo",
    )

    search_fields = (
        "nombre",
        "apellido",
        "empresa",
    )

    list_filter = (
        "activo",
    )


@admin.register(StockProducto)
class StockProductoAdmin(admin.ModelAdmin):

    list_display = (
        "producto",
        "cantidad_unidades",
        "stock_minimo",
        "stock_critico",
        "actualizado_en",
    )

    search_fields = (
        "producto__codigo",
        "producto__nombre",
    )


class DetalleOrdenCargaInline(
    admin.TabularInline
):

    model = DetalleOrdenCarga

    extra = 0


class EntregaOrdenCargaInline(
    admin.TabularInline
):

    model = EntregaOrdenCarga

    extra = 0

    show_change_link = True


@admin.register(OrdenCarga)
class OrdenCargaAdmin(admin.ModelAdmin):

    list_display = (
        "numero",
        "fecha",
        "fletero",
        "estado",
        "facturacion",
        "creado_por",
    )

    search_fields = (
        "numero",
        "fletero__nombre",
        "fletero__apellido",
        "fletero__empresa",
    )

    list_filter = (
        "estado",
        "facturacion",
        "fecha",
    )

    inlines = (
        DetalleOrdenCargaInline,
        EntregaOrdenCargaInline,
    )


class DetalleEntregaOrdenCargaInline(
    admin.TabularInline
):

    model = DetalleEntregaOrdenCarga

    extra = 0


@admin.register(EntregaOrdenCarga)
class EntregaOrdenCargaAdmin(
    admin.ModelAdmin
):

    list_display = (
        "orden",
        "fecha",
        "pallets_salida",
        "pallets_entrada",
        "chapadur_salida",
        "chapadur_entrada",
        "creado_por",
    )

    search_fields = (
        "orden__numero",
    )

    inlines = (
        DetalleEntregaOrdenCargaInline,
    )


@admin.register(MovimientoStock)
class MovimientoStockAdmin(
    admin.ModelAdmin
):

    list_display = (
        "creado_en",
        "producto",
        "tipo",
        "direccion",
        "cantidad",
        "referencia",
        "creado_por",
    )

    search_fields = (
        "producto__codigo",
        "producto__nombre",
        "referencia",
    )

    list_filter = (
        "tipo",
        "direccion",
        "creado_en",
    )


@admin.register(MovimientoMaterial)
class MovimientoMaterialAdmin(
    admin.ModelAdmin
):

    list_display = (
        "creado_en",
        "fletero",
        "referencia",
        "origen",
        "pallets_salida",
        "pallets_entrada",
        "chapadur_salida",
        "chapadur_entrada",
    )

    search_fields = (
        "fletero__nombre",
        "fletero__empresa",
        "referencia",
    )