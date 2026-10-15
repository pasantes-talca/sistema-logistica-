# Histórico de Recargas 2026

> Actualización 15/10/2026: los registros válidos ya se convirtieron a registros normales. Este documento describe la copia original conservada como respaldo; el estado vigente está en [CONVERSION_PLANILLAS.md](../core/CONVERSION_PLANILLAS.md).

## Estado de esta instalación

**El histórico fue importado y verificado en PostgreSQL el 14/10/2026, a las 11:26 (Argentina).**

Destino: servidor `10.242.4.13`, base `logistica`, esquema `log`. Importación ID `1`: 1.031 repartos, ocho resúmenes y 23 filas de padrón, con huella `08e47b0dbbd56ab349f36e4983ff7977b789b8b7f92b3dd0704edbc7cbce0fee`.

Se verificó la igualdad exacta del JSON y de cada fila con la copia de origen. Los datos anteriores de Repartos y sus catálogos coinciden con el respaldo previo `backend/importaciones/recargas-2026/antes-carga-historica-20261014-112509.json`.

La consulta del servidor `10.242.4.13`, base `logistica`, esquema `log`, mostró tablas existentes, pero `showmigrations repartos --plan` devuelve sin aplicar `maestros.0001`, `contenttypes.0001`, `auth.0001` y `repartos.0001`. El plan para `repartos.0002` incluye crear esas tablas iniciales además de la nueva. No se ejecutó ni se falsificó ninguna migración.

Por ese motivo se utilizó una instalación puntual y transaccional, exclusivamente de `log.repartos_importacion_historica`. No se registraron migraciones antiguas ni se alteraron tablas existentes. El comando valida columnas, tipos, nulabilidad, clave primaria y unicidad. Si falla la carga o la validación, PostgreSQL revierte la tabla nueva y sus datos. La misma fuente no se duplica.

El registro de migraciones iniciales sigue pendiente de revisión por un administrador con autorización independiente. No ejecutar `migrate` ni usar `--fake`/`--fake-initial` a ciegas. La existencia de tablas por sí sola no demuestra que sus columnas, restricciones e índices coincidan. La migración histórica admite adoptar esta tabla puntual sólo después de verificar su estructura; no arregla ni marca otras migraciones.

## Dónde consultar los datos

- Historial de repartos → Histórico de planilla. Abre automáticamente el histórico si existe una importación.
- Reporte de recargas → Resúmenes originales de planilla.
- Panel principal → Repartos históricos, con el total original de todos los períodos.

El KPI de repartos operativos de los últimos siete días es independiente y conserva su valor real. No se infla con registros históricos. Los registros originales no se convierten automáticamente en repartos operativos ni se vuelven a liquidar.

## Qué se agrega

- Un único modelo/tabla nueva: `repartos_importacion_historica`.
- Copia íntegra de la fuente en JSON, origen, huella de contenido, fecha de importación y revisión.
- Endpoints de consulta autenticados para usuarios del grupo `REPARTOS` y superusuarios. No hay endpoints de alta, edición ni eliminación.
- Vistas en las rutas existentes de Historial y Reporte de recargas, con datos originales, resúmenes por período y padrón original.
- CSV de las filas filtradas y descarga de la copia completa JSON.
- Importación idempotente: la misma planilla/contenido no se duplica; otra versión de la misma fuente se rechaza y no sobrescribe.

No se cambian modelos de repartos operativos, maestros, sus reglas de cálculo, endpoints existentes ni datos de otros módulos. El histórico no genera automáticamente empleados, vehículos o repartos operativos, no fusiona identidades, no modifica los totales originales y no se suma al reporte operativo.

## Copia preparada

Archivo privado local: `backend/importaciones/recargas-2026/planilla-original.json`, excluido de Git.

Contiene 1.031 repartos, ocho resúmenes de períodos y 23 filas del padrón. La copia completa conserva todas las celdas extraídas, incluidas observaciones, repeticiones y fechas no interpretables. La interfaz auxiliar oculta `Formulario` no se trata como registro de reparto.

La revisión detecta 133 registros con advertencias: 13 fechas a confirmar, tres repartos con una persona repetida, cuatro diferencias respecto al cálculo actual y cuatro diferencias de total, además de nombres sin coincidencia exacta en el padrón. Estos grupos se superponen. Las advertencias no descartan filas ni corrigen datos.

## Instalación una vez resuelto el registro inicial

1. Respaldar la base del servidor y verificar que el esquema de trabajo es `log`.
2. Verificar nuevamente el plan. Debe contener **únicamente** `repartos.0002_importacionrepartoshistoricos` y su `CreateModel`:

   ```text
   python manage.py migrate repartos 0002 --plan
   ```

3. Aplicar esa migración nueva sólo cuando el plan haya sido validado:

   ```text
   python manage.py migrate repartos 0002
   ```

4. Copiar al servidor el JSON privado fuera del repositorio publicado. Revisar sin escribir:

   ```text
   python manage.py importar_recargas_historicas importaciones/recargas-2026/planilla-original.json
   ```

5. Confirmar la importación histórica:

   ```text
   python manage.py importar_recargas_historicas importaciones/recargas-2026/planilla-original.json --aplicar --confirmar "IMPORTAR HISTORICO"
   ```

6. Verificar 1.031 repartos, ocho resúmenes, 23 filas de padrón y la huella `08e47b0dbbd56ab349f36e4983ff7977b789b8b7f92b3dd0704edbc7cbce0fee`. Comparar la descarga JSON con la copia de entrada.

La importación crea una sola fila en la tabla nueva dentro de una transacción. En PostgreSQL el comando exige `current_schema() = log`. No toca `public`. No hace migraciones ni correcciones del esquema de forma automática.

En esta instalación manual se utilizó explícitamente la opción limitada `--instalar-tabla`, tras guardar el respaldo previo:

```text
python manage.py importar_recargas_historicas importaciones/recargas-2026/planilla-original.json --aplicar --confirmar "IMPORTAR HISTORICO" --instalar-tabla
```

Esa opción sólo permite crear/verificar la tabla histórica específica en `log`; no aplica migraciones iniciales ni registra versiones falsas. La tabla y la importación se confirman juntas en una transacción. No admite otros modelos ni otros esquemas.

## Validación realizada

- 45 pruebas Django con `config.test_settings`, SQLite en memoria.
- Compilación TypeScript/Vite y lint de los archivos de frontend modificados.
- Prueba en navegador con el JSON real: cada fila idéntica al origen, ocho resúmenes con sus notas y totales intactos, padrón, filtros, CSV/JSON completos, permisos, rutas anteriores y resoluciones pequeñas sin desbordes.
- El servidor de prueba crea un reparto operativo ficticio y confirma que la importación y consulta históricas no lo modifican ni alteran sus recargas.

Se instaló la tabla histórica y se importó la copia en PostgreSQL operativo. Se verificaron la igualdad exacta con la fuente, la conservación de datos anteriores y el registro de migraciones sin cambios. No se alteró Google Sheets.
