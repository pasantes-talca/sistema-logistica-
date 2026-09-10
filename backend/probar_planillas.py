import os
import time

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)

import django

django.setup()

from planillas_recargas.services import procesar_planillas


print("1. Iniciando prueba...", flush=True)

inicio = time.time()

print("2. Abriendo archivos...", flush=True)

with open(
    "Planilla distribucion 2026.xlsx",
    "rb",
) as archivo_rutas, open(
    "SALIDA DE PERSONAL 2026.xlsx",
    "rb",
) as archivo_salidas:

    print("3. Archivos abiertos.", flush=True)
    print("4. Procesando planillas...", flush=True)

    resultado = procesar_planillas(
        archivo_rutas=archivo_rutas,
        archivo_salidas=archivo_salidas,
    )

print(
    f"5. Procesamiento terminado en "
    f"{time.time() - inicio:.2f} segundos.",
    flush=True,
)

print("\n=== RESULTADOS ===")

for registro in resultado["registros"]:

    print(
        f"""
Carga: {registro["carga_distribucion"]}
Chofer: {registro["chofer"]}
Ayudantes: {", ".join(registro["ayudantes"])}
Bultos: {registro["bultos"]}
Recargas por persona: {registro["recargas"]}
Cantidad de personas: {registro["cantidad_personas"]}
Recargas totales: {registro["recargas_totales"]}
Estado: {registro["estado"]}
------------------------------
"""
    )


print("=== ADVERTENCIAS ===")

for advertencia in resultado["advertencias"]:
    print(
        "-",
        advertencia["mensaje"],
    )


print("\n=== ERRORES ===")

if resultado["errores"]:

    for error in resultado["errores"]:
        print(
            "-",
            error["mensaje"],
        )

else:
    print("Sin errores.")