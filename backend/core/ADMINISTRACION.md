# Administrador operativo de Logística Talca

## Rol y límites

El grupo **ADMINISTRADOR** concede acceso a todos los módulos de la aplicación,
usuarios, catálogos y auditoría. No habilita `is_staff`, `is_superuser`, administración
técnica de Django ni restauraciones de bases. Las cuentas técnicas, superusuarios,
`arielgarro` y otros administradores están protegidos frente al administrador operativo
(incluso si están inactivos). No puede desactivarse a sí mismo ni otorgar el rol a terceros.
Solo un superusuario puede conceder o retirar ADMINISTRADOR.

Por decisión explícita, `arielgarro` no tiene acceso a la sección Administración
de Talca: el menú no aparece, la ruta React lo bloquea y las APIs responden 403.
Esto no modifica sus accesos operativos ni su rol técnico de Django.
La API de sesión expone `puede_administrar` para separar estos permisos.

La nueva sección es `/administracion/usuarios`, `/administracion/catalogos` y
`/administracion/auditoria`. Las cuentas ordinarias se crean con los grupos elegidos,
contraseñas validadas por Django y sin privilegios técnicos. Se desactivan, no se borran.
Los restablecimientos invalidan las otras sesiones; ninguna API devuelve contraseñas o hashes.
Stock de pallets sigue siendo un enlace a otro sistema, con su propia autenticación.

## Backend y compatibilidad

`core.api.APIView` agrega autorización por sección a todas las APIs operativas,
incluyendo las rutas anteriores de Expedición y los archivos importados. Los maestros
compartidos permiten lectura solo a sus módulos consumidores. Las rutas React también
están protegidas. No cambia fórmulas, cantidades, payloads de negocio ni endpoints
existentes, excepto el metadato de trazabilidad `motivo_correccion` obligatorio al editar
repartos, rechazos, cambios y viáticos. Los tres formularios de edición existentes
incluyen el campo. Expedición conserva sus motivos y anulaciones operativas.

Los cambios exitosos se registran en **auditoria_sistema**, dentro de la misma
transacción. Se guardan actor, fecha, sección, referencia, motivo y datos antes/después
cuando corresponde. No se auditan contraseñas, tokens o archivos. Es una auditoría nueva,
no una reconstrucción de operaciones anteriores. Expedición conserva además su auditoría
operativa anterior. La consulta general tiene filtros, paginación y exportación CSV.
No hay API para editar o borrar auditoría. Los catálogos se desactivan, no se eliminan.
Productos, equivalencias y fleteros se gestionan desde la configuración existente de
Expedición; no hay escritura directa de saldo de stock desde la administración general.

Los GET del frontend ahora envían la sesión y todas las escrituras existentes envían
el token CSRF, incluido cerrar sesión. Un error al cerrar sesión no simula una salida.

## Instalación en el servidor existente

La conexión verificada es PostgreSQL `10.242.4.13:5432`, base **logistica**, schema **log**.
Hay tablas existentes sin historial en `django_migrations`. **No ejecutar un `migrate`
general ni `--fake` a ciegas**. El instalador acotado crea únicamente auditoria_sistema,
con su clave, referencia a log.auth_user e índice de fecha, y valida si ya existe:

```text
python manage.py instalar_administracion
python manage.py instalar_administracion --aplicar
```

No cambia tablas operativas, credenciales existentes ni el schema public. En bases
nuevas o de pruebas se utiliza la migración `core/0002_eventoauditoria`. La tabla se
puede adoptar validándola si posteriormente se reconcilia el historial de migraciones.
No se permite una reversión que borre el historial de auditoría.

Para una cuenta existente:

```text
python manage.py configurar_administrador administrador
python manage.py configurar_administrador administrador --aplicar
```

Si falta y se quiere prepararla sin contraseña utilizable:

```text
python manage.py configurar_administrador administrador --crear-sin-clave --aplicar
python manage.py changepassword administrador
```

El comando conserva grupos y contraseñas existentes, no eleva privilegios técnicos,
es idempotente y registra quién otorgó el rol (actor técnico por defecto: arielgarro).
Una cuenta creada sin clave **no puede ingresar hasta ejecutar changepassword**.
Alternativamente, un superusuario con acceso a Administración (no `arielgarro`)
puede crearla y elegir su contraseña desde la nueva UI.

Estado verificado el 20/10/2026 en `logistica.log`: `administrador` tiene el grupo
ADMINISTRADOR y conserva su contraseña existente. Por autorización del usuario se
retiraron únicamente `is_staff` e `is_superuser`, con registro de auditoría.
No hace falta cambiar su contraseña para este ajuste. `arielgarro` no fue modificado.

Subir el backend actualizado, instalar la tabla, reiniciar el backend y recompilar/
publicar el frontend (`npm run build`). Crear el rol en PostgreSQL no actualiza por sí
solo el código del backend o los archivos servidos del frontend.

## Pruebas

```text
python manage.py test --settings=config.test_settings --noinput
python -m core.smoke_administracion
```

El smoke usa SQLite en memoria en 127.0.0.1:8770, frontend de prueba en 127.0.0.1:5180,
correo en memoria y cuentas ficticias. `frontend/scripts/administracion-smoke.cjs`
verifica las acciones completas en navegador, roles reales, protección de cuentas,
CSRF, exportación, modo oscuro, resoluciones pequeñas y acceso por URL directa.
Nunca usa PostgreSQL para estas pruebas ni envía correo real.
