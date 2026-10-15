# Histórico de Rechazos

> Actualización 15/10/2026: los registros válidos ya se convirtieron a registros normales. Este documento describe la copia original conservada como respaldo; el estado vigente está en [CONVERSION_PLANILLAS.md](../core/CONVERSION_PLANILLAS.md).

## Importación verificada

El 14/10/2026 a las 11:54 (Argentina) se importó la planilla `18XNFASCFr0HFB4Os7LxI4_2D-Usi7glLMlvxP6VzpB0` en el servidor `10.242.4.13`, base `logistica`, esquema `log`.

Importación ID `1`: **62 rechazos y tres anexos originales**. Huella del contenido:

```text
81e3313a795a5dfe786fcb5e3336b078d7110f810fcfd81c804f4b4261d5eaf2
```

Se comparó el JSON guardado y cada fila con la fuente: son idénticos. Se conserva un registro sin fecha; su marca temporal no reemplaza la fecha ausente. Los bultos conservan su texto original, incluidos decimales y textos con unidades. No se convierten ni se suman valores ambiguos.

Los anexos son `Porcentaje de rechazos`, `Preventa` (vacío) y `Hoja 1 (no tocar)` (oculta en el origen). Sus celdas originales se conservan sin convertirlas en nuevos rechazos. No se modificó la planilla de Google.

## Respaldo y protección de datos

Fuente privada: `backend/importaciones/rechazos/planilla-original.json`.

Respaldo de los datos anteriores de Rechazos y sus catálogos: `backend/importaciones/rechazos/antes-carga-historica-20261014-115440.json`.

SHA-256 del respaldo:

```text
F171C90E5540D56F6269F2D6A10364FE37FD6C1FDE6AED83A83E61EAC125DD7B
```

Ambos archivos contienen información interna y están excluidos de Git. La verificación posterior confirmó que los datos operativos y catálogos coinciden con el respaldo; el histórico de Repartos anterior conserva su huella. El usuario `arielgarro` tiene acceso a la consulta.

Se agregó exclusivamente `log.rechazos_importacion_historica`, dentro de una transacción. No se escribió en `public`, no se crearon usuarios y no se modificaron los rechazos operativos ni sus reglas.

## Consulta en la aplicación

- Rechazos → Historial → Histórico de planilla. Abre el histórico automáticamente cuando existe una importación.
- Rechazos → Estadísticas → Estadísticas del histórico.
- Panel principal → Rechazos históricos: total de todas las fechas, separado del indicador operativo de los últimos siete días.

Hay filtros, revisión de fechas, exportación CSV y descarga del JSON completo. Los motivos se cuentan según su texto literal: no se fusionan variantes ni se cambian los porcentajes guardados en el anexo.

Los endpoints nuevos son de solo lectura, para usuarios del grupo `RECHAZOS` y superusuarios:

```text
GET /api/rechazos/historicos/
GET /api/rechazos/historicos/<id>/registros/
GET /api/rechazos/historicos/<id>/anexos/
GET /api/rechazos/historicos/<id>/respaldo/
```

Las rutas operativas de alta, historial, edición y estadísticas se conservan.

## Comando de importación

Por defecto sólo valida y muestra la revisión, sin escribir:

```text
python manage.py importar_rechazos_historicos importaciones/rechazos/planilla-original.json
```

Después de validar destino y respaldo, esta instalación utilizó:

```text
python manage.py importar_rechazos_historicos importaciones/rechazos/planilla-original.json --aplicar --confirmar "IMPORTAR HISTORICO" --instalar-tabla
```

La misma fuente con igual huella no se duplica. Una versión diferente de la misma fuente se rechaza: no sobrescribe el archivo existente.

### Advertencia sobre las migraciones del servidor

El servidor ya contiene tablas, pero `log.django_migrations` no registra las migraciones iniciales. No se ejecutó `migrate`, `--fake` ni `--fake-initial`. La opción limitada `--instalar-tabla` sólo crea o verifica la nueva tabla histórica autorizada en `log`, validando tipos, nulabilidad y claves. Tabla y datos se confirman juntos; un error revierte ambos.

La migración `rechazos.0004` puede adoptar esta tabla puntual únicamente tras validar su estructura. No resuelve el registro inicial pendiente. Antes de migrar el servidor, un administrador debe contrastar las tablas existentes y revisar el plan con autorización independiente. No aplicar ni falsificar migraciones a ciegas.

## Pruebas

- 53 pruebas Django usando `config.test_settings`, sin tocar PostgreSQL operativo.
- Compilación TypeScript/Vite y lint de los archivos modificados.
- Prueba en navegador: 62 filas idénticas, fecha vacía conservada, filtros, 13 registros fechados en junio, anexos íntegros, CSV/JSON, permisos, rutas operativas, panel y tamaños de pantalla pequeños.
- Regresión del histórico de Repartos: 1.031 filas y ocho resúmenes disponibles.
- Verificación final del servidor con una transacción de solo lectura.

No se agregaron dependencias.
