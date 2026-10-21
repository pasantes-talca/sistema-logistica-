# Importación del respaldo de Pablo

Archivo: `talca_backup_2026-10-20T15-45-55.272Z.json`, exportado por Talca Expedición,
schemaVersion 1. SHA256:
`a5776a3c617d09ac0111c4f40c3511dc83c27fa23075036bd711fdbf33fe69d9`.

El archivo original contiene contraseñas de origen: no subirlo a Git, no publicarlo
ni servirlo desde el frontend. El importador elimina claves sensibles recursivamente;
no crea cuentas ni traslada contraseñas, roles o permisos de Firebase.

## Tratamiento de referencias

- Se conservan los 21 productos del catálogo fuente. Los ya existentes en `producto`
  mantienen código, nombre, familia, presentación, sabor y estado, para no afectar
  Recibos de cambios u otros módulos. Solo se agregan los que faltan.
- Se recuperan `4171` (Soda 500 ml, 12 unidades/pack, 20 packs/corte, 7 cortes/pallet)
  y `BIDON` (Bidón de agua, 1 unidad/pack, 42 packs/corte, 2 cortes/pallet).
  Estas equivalencias existen en la migración histórica `expedicion/0003` y en
  `operativa.configuracion`. Se conservan como códigos separados, inactivos para
  nuevas operaciones. No se crea stock para ellos: el respaldo no lo informa.
- Los 46 fleteros ausentes se recuperan de `carrierSnapshot` de las 110 órdenes
  afectadas. Si cambió su descripción, se usa el snapshot con fecha de creación
  más reciente. Se marcan inactivos porque no estaban en el padrón vigente.
  Todos los snapshots originales quedan en la copia de origen sanitizada.
- El legajo `00001` corresponde a dos registros con igual nombre y apellido:
  uno inactivo de saldo 0 y otro activo de saldo 2. Se conserva el activo con
  saldo 2, sin sumar ni recalcular. Una duplicidad ambigua aborta la importación.
- Autores originales sin cuenta Django se preservan en observaciones y auditoría,
  con fallback visual para órdenes, entregas, movimientos, comprobantes y conteos.
  Esto no concede accesos ni atribuye las operaciones al usuario que importa.
- Las fechas y cantidades persistidas se comparan campo a campo. No se llama a
  `mover` ni a comandos de entrega: el stock es el informado en el archivo y no
  se vuelve a descontar al insertar los movimientos históricos.
- Se conservan movimientos, entregas, versiones corregidas y auditoría fuente;
  además se agregan eventos de historial de edición y el evento de restauración.
  Los contadores CE=33 y AE=55 se mantienen. El archivo permite reconstruir solo
  dos comprobantes (cuatro líneas); no se inventan los comprobantes anteriores
  que los numeradores sugieren, pero que no están incluidos en el respaldo.

## Ensayo y aplicación

```text
python manage.py importar_respaldo_pablo RUTA_AL_ARCHIVO --ensayo --settings=config.test_settings
python manage.py importar_respaldo_pablo RUTA_AL_ARCHIVO
python manage.py importar_respaldo_pablo RUTA_AL_ARCHIVO --aplicar --sha256 HUELLA_ENSAYADA
```

El ensayo solo funciona sobre SQLite `:memory:` y nunca conecta a PostgreSQL.
La simulación operativa es de solo lectura. La aplicación exige PostgreSQL
`logistica.log`, actor técnico activo y superusuario (por defecto `arielgarro`),
SHA exacto y tablas operativas de Expedición vacías. No ejecutar `migrate` general
sobre la BD existente con historial de migraciones incompleto.

Dentro de una transacción se bloquean las tablas del módulo, se verifica que no
hubo nuevas cargas y se realiza la importación. Se valida cada campo y relación,
stocks, materiales, saldos, numeradores y restricciones. Cualquier diferencia
revierte la carga. No reemplaza datos si Expedición ya contiene registros, y no
repite una importación cuyo SHA ya figura como aplicada.

Se guardan en `expedicion_respaldoexpedicion` la copia previa del destino y una copia
de origen sin credenciales, con SHA, decisiones y validaciones. La copia de origen
es trazabilidad, no un respaldo portable Django para restauración directa.
También queda un evento en la auditoría general.

## Resultado esperado del archivo ensayado

| Entidad | Registros |
|---|---:|
| Órdenes | 564 |
| Detalles solicitados | 2902 |
| Entregas | 530 |
| Detalles entregados | 2794 |
| Stock actual informado | 21 |
| Configuraciones de producto | 23 |
| Fleteros (incluye recuperados) | 119 |
| Empleados consolidados | 80 |
| Movimientos de stock | 790 |
| Movimientos de materiales | 132 |
| Comprobantes reconstruibles | 2 |
| Conteos | 1 |
| Auditoría fuente e historiales de edición | 1382 |

Los registros se cargan en las tablas normales, no en una sección de históricos.
El código del backend actualizado debe publicarse/reiniciarse para que se vean
los nombres de autores originales cuando no tengan una cuenta Django asociada.

## Aplicación verificada el 21/10/2026

La carga fue confirmada en PostgreSQL `logistica.log` y comprobada desde una segunda
conexión de solo lectura. Estados de las 564 órdenes: 529 despachadas, 12 pendientes
de despacho, 13 pendientes administrativos, 1 parcial y 9 anuladas, coincidentes
con el origen. Hay 1383 eventos de auditoría de Expedición (incluye restauración),
dos respaldos internos, 24 productos compartidos (se agregaron cuatro sin modificar
los 20 anteriores) y las mismas cuatro cuentas Django. Las 118 pruebas del backend
pasaron; no se requirieron cambios de esquema ni migraciones para esta importación.
