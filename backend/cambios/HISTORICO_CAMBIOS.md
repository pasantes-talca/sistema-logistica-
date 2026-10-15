# Recibos y resumen histórico de Cambios

> Actualización 15/10/2026: los 87 recibos ya se convirtieron a registros normales. Este documento describe la copia original conservada como respaldo; el estado vigente está en [CONVERSION_PLANILLAS.md](../core/CONVERSION_PLANILLAS.md).

## Carga real verificada

El 15/10/2026 a las 08:29 (Argentina) se importaron **87 recibos, un resumen y una plantilla** en PostgreSQL: servidor `10.242.4.13`, base `logistica`, esquema `log`.

Fuente: `https://docs.google.com/spreadsheets/d/1Z3u2Ng-doXgCHV5PgrLifnQOWYTG67Lbww5awJkYmZA/edit`.

Se leyeron las 89 pestañas completas, dentro de sus dimensiones existentes. Cada recibo conserva sus 34 filas originales; el resumen de mayo–junio conserva sus 97 filas, fecha de generación y totales. Las fechas y concesionarios internos coinciden con los títulos de los 87 recibos. No se modificó Google Sheets.

Importación ID `1`, creada a las `2026-10-15T11:29:19.319375+00:00`, huella:

```text
d52fe6e01f8ea10e245d9bed870f3e4556bcf9089581d60c193c235bd0500ab7
```

La comprobación posterior, en una transacción de solo lectura, confirmó la igualdad del JSON guardado con la fuente y de cada recibo con su hoja. También verificó la integridad de los datos operativos y catálogos, las huellas anteriores de Repartos y Rechazos y el acceso del usuario `arielgarro`.

## Dónde consultarlo

- Recibos de cambios → Historial → Histórico de planilla (abre automáticamente cuando hay una importación).
- Cada recibo tiene detalle, impresión y exportación CSV; también se pueden consultar todas sus celdas originales.
- Resumen generado original: muestra el resumen existente sin recalcularlo ni incluir recibos posteriores a su generación.
- Estadísticas → Resumen histórico de planilla: acceso directo al mismo resumen original.
- Panel principal → Recibos históricos: 87, separado del indicador operativo de los últimos siete días.

Se ofrecen filtros de fecha, concesionario literal y búsqueda de recibos/productos; descarga completa JSON, listado CSV, resumen CSV e impresión. Los nombres, presentaciones, cantidades y observaciones conservan su escritura original. Los vacíos no se sustituyen por cero y `1.03` no se interpreta como unidades ni se suma automáticamente. Las variantes de nombres no se fusionan.

## Datos operativos intactos

El archivo histórico está separado de `ReciboCambio` y `DetalleReciboCambio`. No se llama al servicio de acumulación, no se crean identidades de concesionarios/productos y no se envían correos. Las rutas, cálculos y endpoints operativos existentes no se cambiaron. Los recibos importados son de consulta, no nuevas operaciones editables.

Se agregó únicamente `log.cambios_importacion_historica`. Endpoints autenticados, de solo lectura, para el grupo `CAMBIOS` y superusuarios:

```text
GET /api/cambios/historicos/
GET /api/cambios/historicos/<id>/recibos/
GET /api/cambios/historicos/<id>/resumenes/
GET /api/cambios/historicos/<id>/anexos/
GET /api/cambios/historicos/<id>/respaldo/
```

No se agregaron dependencias.

## Respaldo privado

Fuente local: `backend/importaciones/cambios/planilla-original.json`.

Respaldo anterior de Cambios y todos sus catálogos: `backend/importaciones/cambios/antes-carga-historica-20261015-112913UTC.json`. En el momento de la carga esas tablas no tenían registros. Hash SHA-256:

```text
37517E5F3DC66819F61F5A7BB8ACE1921282415F10551D2DEFA5C3EB0985B570
```

Los archivos privados y artefactos de prueba están excluidos de Git. No publicar estos datos internos.

## Comando e instalación

Simulación sin escrituras:

```text
python manage.py importar_cambios_historicos importaciones/cambios/planilla-original.json
```

Carga utilizada después de respaldar y verificar el destino:

```text
python manage.py importar_cambios_historicos importaciones/cambios/planilla-original.json --aplicar --confirmar "IMPORTAR HISTORICO" --instalar-tabla
```

La misma fuente con igual huella no se duplica. Una versión con contenido distinto se rechaza sin sobrescribir. La creación de la tabla y la carga son transaccionales; sólo se permite esa tabla autorizada, validada y en el esquema `log`. No se escribe en `public`.

### Registro de migraciones pendiente en el servidor

El servidor contiene tablas iniciales, pero `log.django_migrations` sigue vacío. No se ejecutó `migrate`, ni `--fake`/`--fake-initial`; no se alteró ese registro. No ejecutar migraciones a ciegas. Un administrador debe contrastar tablas y revisar el plan antes de regularizarlo, con autorización independiente.

La migración `cambios.0002` puede adoptar exclusivamente la tabla histórica ya instalada después de verificar su estructura. No resuelve las migraciones iniciales pendientes.

## Validación

- 62 pruebas Django sobre SQLite en memoria, sin acceder a PostgreSQL operativo.
- Compilación TypeScript/Vite y lint de los archivos modificados.
- Prueba en navegador con la fuente real: 87 recibos idénticos, todas las celdas del detalle y del resumen, filtros, cantidades literales, CSV/JSON, impresión, panel y resoluciones 1366/1024/768/390 sin desbordes globales.
- Recibo operativo ficticio intacto y contadores anteriores de Repartos (1.031) y Rechazos (62) disponibles.
- Verificación real de PostgreSQL después de la importación con consultas de solo lectura.
