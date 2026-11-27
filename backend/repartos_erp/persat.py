"""Adaptación de la réplica Persat del portal. Exclusivamente GET al proveedor."""
import json
import math
import os
import requests
from django.db import transaction
from .models import ClientePersatERP
from .planificacion import punto


def sincronizar_clientes():
    clave = os.environ.get("TALCA_PERSAT_API_KEY", "").strip()
    if not clave:
        raise ValueError("Configurá TALCA_PERSAT_API_KEY en el entorno del backend. No compartas la clave en el chat.")
    offset, esperado, vistos, registros = 0, None, set(), []
    with requests.Session() as sesion:
        while True:
            try:
                with sesion.get("https://api.persat.com.ar/v1/clients", params={"limit": 100, "offset": offset},
                        headers={"Authorization": "Bearer " + clave, "Accept": "application/json"},
                        timeout=(5, 20), allow_redirects=False, stream=True) as respuesta:
                    if respuesta.status_code != 200:
                        raise ValueError("Persat rechazó la consulta o alcanzó su límite. Se conserva la réplica anterior.")
                    raw = bytearray()
                    for chunk in respuesta.iter_content(65536):
                        raw.extend(chunk)
                        if len(raw) > 12_000_000:
                            raise ValueError("Respuesta Persat demasiado grande.")
                    datos = json.loads(raw)
            except (requests.RequestException, json.JSONDecodeError):
                raise ValueError("No se pudo consultar Persat. Se conserva la réplica anterior.") from None
            if not isinstance(datos, dict) or datos.get("success") is not True:
                raise ValueError("Respuesta Persat inválida.")
            paging, items = datos.get("paging"), datos.get("data")
            if not isinstance(paging, dict) or not isinstance(items, list):
                raise ValueError("Paginación Persat inválida.")
            total, cantidad, inicio = paging.get("total"), paging.get("result"), paging.get("offset")
            if any(type(v) is not int for v in [total, cantidad, inicio]) or not 0 <= total <= 100000 or inicio != offset or cantidad != len(items) or cantidad > 100 or offset + cantidad > total:
                raise ValueError("Paginación Persat inconsistente. No se actualizó la réplica.")
            if esperado is not None and esperado != total:
                raise ValueError("Cambió el total Persat durante la consulta. Reintentá la sincronización.")
            esperado = total
            for item in items:
                if not isinstance(item, dict) or type(item.get("uid_client")) not in [int, str]:
                    raise ValueError("Cliente Persat inválido.")
                codigo = str(item["uid_client"]).strip()
                if not codigo or len(codigo) > 100 or codigo in vistos or any(ord(c) < 32 for c in codigo):
                    raise ValueError("Código Persat ausente, repetido o inválido.")
                vistos.add(codigo)
                loc = punto(item.get("latitude"), item.get("longitude"))
                servicio = item.get("service_time")
                if type(servicio) not in [int, float] or not math.isfinite(servicio) or not 0 <= servicio <= 1440:
                    servicio = None
                registros.append(ClientePersatERP(codigo=codigo, nombre=str(item.get("company_name") or "")[:250],
                    latitud=loc[0] if loc else None, longitud=loc[1] if loc else None, servicio_minutos=servicio))
            offset += cantidad
            if offset == total:
                break
            if not cantidad:
                raise ValueError("Persat devolvió una página vacía antes de terminar.")
    with transaction.atomic():
        ClientePersatERP.objects.bulk_create(registros, update_conflicts=True, unique_fields=["codigo"],
            update_fields=["nombre", "latitud", "longitud", "servicio_minutos", "actualizado_en"], batch_size=500)
        # Retener la identidad de clientes retirados, sin reutilizar sus ubicaciones viejas.
        ClientePersatERP.objects.exclude(codigo__in=vistos).update(latitud=None, longitud=None)
    return len(registros)
