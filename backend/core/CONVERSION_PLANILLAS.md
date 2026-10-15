# Planillas convertidas a registros normales

## Resultado real y criterio autorizado

El 15/10/2026, entre las 09:06 y 09:08 (Argentina), se convirtió la copia de las tres planillas ya importadas en el servidor `10.242.4.13`, base `logistica`, esquema `log`:

| Módulo | Creados en sus tablas normales | Omitidos |
| --- | ---: | ---: |
| Repartos | 905 | 126 |
| Rechazos | 61 | 1 |
| Recibos de cambios | 87 | 0 |

Son **1.053 registros normales, editables**, con fechas y relaciones propias. Se consultan en los listados y reportes habituales; ya no se presentan como archivos históricos separados. El panel cuenta los registros normales de todas las fechas, además de sus indicadores por período.

El usuario indicó expresamente no cargar casos dudosos y conservar las recargas del Drive porque contienen ajustes autorizados por el jefe de Logística. Por eso:

- No se corrigen fechas, se infieren personas ni se inventan legajos o categorías. Los nombres se cotejan con el padrón y los maestros existentes, sin coincidencias aproximadas.
- Las personas repetidas y fechas de otros años o inválidas se omiten. Un rechazo sin fecha no toma automáticamente la marca temporal como fecha de operación.
- Una diferencia de recargas respecto de la fórmula **no** es un motivo de exclusión.
- Los importes por persona y la columna `Recarga total` se conservan independientemente, incluidos los ceros. Nunca se fuerza `recargas × participantes` cuando Drive tiene otro total.
- Los maestros necesarios se crean a partir de los datos explícitos de la fuente, sin sobrescribir maestros existentes ni fusionar identidades dudosas. Los recibos se guardan con el servicio normal, pero sin pasar por el envío de correo.
- No se reemplazan recibos ya existentes para la misma fecha/concesionario ni posibles registros manuales duplicados.

## Recargas autorizadas y edición

La tabla interna `log.registro_importacion` enlaza cada fila de origen con su registro normal y conserva la huella, datos originales, aprobación de recargas y total autorizado. No es un segundo listado de trabajo.

`Reparto.recargas` contiene el valor por persona de Drive. La propiedad `recargas_totales` usa el total autorizado del registro importado. Al editar los demás datos de estos repartos, el servicio conserva ambos valores. La pantalla informa esa protección.

La fórmula habitual no cambia para repartos nuevos cargados manualmente. No se añadió un mecanismo de cambio de importes desde el formulario.

Para los 905 repartos convertidos:

- Total autorizado de Drive: **2.711**.
- Suma de valores por persona × participantes: **2.693**.
- Diferencia conservada: **18**, sin distribución inventada entre empleados.

El reporte muestra el total autorizado, mantiene el desglose individual original y explica explícitamente cualquier diferencia mediante `total_por_empleados` y `diferencia_autorizada`. Los reportes de repartos manuales sin ajustes siguen dando los mismos resultados que antes.

## Resúmenes guardados

Los ocho resúmenes de recargas y el resumen de cambios de mayo–junio siguen disponibles como **resúmenes guardados de Drive**, con sus celdas originales. No son movimientos adicionales ni se recalculan silenciosamente. Las estadísticas normales trabajan sobre los registros convertidos válidos, excluyendo los omitidos.

Las tres copias íntegras originales se conservaron internamente, con sus huellas intactas. No se cambió Google Drive.

## Respaldo e informe

Archivos privados excluidos de Git:

- `backend/importaciones/operativos/antes-conversion-final-20261015-120651UTC.json`: respaldo inmediato anterior. Los modelos operativos, maestros y trazabilidad estaban vacíos.
- `backend/importaciones/operativos/resultado-conversion.json`: claves de origen → IDs normales y motivos concretos de los 127 omitidos.

Huella SHA-256 del informe:

```text
3BF1342D5074C593F76E3CCC593B7A0E2D6441B945FA9C588F1E4F60837DD33F
```

No publicar fuentes, respaldos ni informes con información interna. Los archivos originales de cada módulo siguen en `backend/importaciones/`.

## Comando e idempotencia

Consulta sin escrituras:

```text
python manage.py convertir_planillas_operativas
```

La conversión ejecutada fue:

```text
python manage.py convertir_planillas_operativas --aplicar --confirmar "CONVERTIR SIN RECALCULAR" --detalle
```

La conversión es transaccional y mantiene una clave única por módulo, archivo y fila/hoja. Repetirla no duplica ni sobrescribe registros editados. Si cambia el contenido de una fila ya convertida o se elimina su destino, se detiene para revisión en lugar de sobrescribirlo o recrearlo.

Los casos dudosos no tienen registro normal ni entrada de importación aplicada; sólo figuran en el informe de exclusiones y en el respaldo original.

## Instalación y migraciones

Se agregó exclusivamente `log.registro_importacion`, sin alterar tablas operativas existentes ni escribir en `public`. La instalación puntual validó columnas, tipos, nulabilidad, referencias y unicidad. La migración `core.0001` puede adoptar esa tabla específica después de verificar su estructura.

El registro de migraciones iniciales del servidor sigue vacío, igual que antes: **no se ejecutó `migrate`, ni `--fake`/`--fake-initial`**. No aplicar migraciones iniciales a ciegas: el administrador debe contrastar las tablas existentes y revisar el plan antes de regularizarlo.

## Cambios de código y pruebas

- `core`: trazabilidad, instalación limitada, conversión, comando, migración y pruebas.
- `repartos`: lectura del total autorizado y protección al editar; la fórmula para registros manuales no cambió. El endpoint de reporte incorpora dos campos informativos sin quitar los existentes.
- Frontend: listados normales para los tres módulos, estadísticas normales de Rechazos, resumen guardado de Cambios/Recargas, totales del panel y aviso de recargas autorizadas al editar.
- Sin rutas React modificadas, sin cambios de payload de alta/edición y sin dependencias nuevas.
- 74 pruebas Django en SQLite en memoria, compilación TypeScript/Vite y prueba en navegador de los listados 905/61/87, edición real preservando importes, reportes, resumen guardado, panel, consola y tamaños de pantalla pequeños.
- Lint correcto en los componentes y páginas intervenidos; `EditarRepartoPage` conserva un aviso preexistente de `react-hooks/set-state-in-effect` en la inicialización del formulario, fuera del cambio de recargas. Se verificó el resto del archivo sin desactivar reglas en el código.
- Verificación posterior real de los 1.053 registros en una transacción PostgreSQL de sólo lectura: fechas, participantes, importes, detalles, exclusión de los 127 casos, huellas originales y registro de migraciones sin cambios.
