# Administrador operativo de Logística Talca

## Simplificación de la interfaz (21/10/2026)

Por solicitud del usuario se retiraron de Administración las pantallas Catálogos y
Configuración general, sus enlaces y formularios. Las rutas anteriores redirigen al
panel administrativo. No se eliminaron registros, tablas, endpoints ni preferencias
persistidas; se mantienen por compatibilidad y para no afectar los módulos operativos.
Seguridad conserva únicamente el formulario de políticas de contraseñas/sesiones,
y Notificaciones sigue mostrando las alertas sin enlaces a Configuración eliminada.
La configuración propia de Expedición no cambió. Las secciones descritas más abajo
como Catálogos/Configuración corresponden a la implementación anterior del backend.

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

## Panel administrativo ampliado (sin sucursales)

Se agregaron rutas de Administración para panel, permisos por acción, configuración,
base de datos, incidencias, reportes, notificaciones, seguridad y estado. Conservan
la restricción de acceso del módulo, incluida la exclusión de `arielgarro`.

Las tablas nuevas son `administracion_preferencias`, `administracion_acceso_acciones`
y `administracion_incidencia`. El 20/10/2026 se instalaron y validaron en `logistica.log`
mediante el instalador aditivo; no se alteraron tablas de negocio ni credenciales.
Para otra instalación equivalente, **antes de reiniciar el backend actualizado**:

```text
python manage.py instalar_panel_control
python manage.py instalar_panel_control --aplicar
```

No ejecutar migraciones generales sobre esta BD con historial incompleto. En pruebas
o instalaciones nuevas se usa `core/0003`. Las tres tablas existentes se validan y se
adoptan sin alterarlas si posteriormente se reconcilia el historial de migraciones.

- Los grupos actuales siguen otorgando módulos. Los perfiles de consulta u operador
  son plantillas para restricciones individuales por acción, persistidas y auditadas.
  Sin restricciones explícitas se conserva el acceso anterior; el panel no reduce
  permisos automáticamente. Una política no concede módulos ni evita las protecciones
  originales de cada API. No habilita borrado de históricos. Exportar restringe descargas
  identificadas en el backend; no impide copiar información que el usuario puede consultar.
- Configurar controla los comandos de catálogos y parámetros de Expedición; editar,
  las correcciones y órdenes existentes; anular, las anulaciones. Los endpoints anteriores
  también están sujetos a la verificación central. Se conservan fórmulas y estados del negocio.
- El panel cuenta registros por fecha operativa de siete módulos y actividad auditada.
  El reporte CSV agrupa por usuario, módulo y acción, con neutralización de fórmulas.
  No reconstruye auditoría anterior ni infiere productividad laboral.
- Preferencias: nombre del panel, período predeterminado, alertas, umbral de incidencias,
  longitud mínima de nuevas contraseñas y duración absoluta de sesiones. Se exige motivo.
  No admite editar SQL, tipos de negocio, fórmulas, variables de entorno ni secretos.
- La política de longitud adicional se aplica al crear/restablecer contraseñas en Talca;
  los comandos técnicos de Django mantienen sus propios validadores. El límite absoluto
  de sesión se verifica para ingresos realizados con esta versión. Las sesiones anteriores
  pueden revocarse explícitamente. No se muestran claves de sesión ni se permite cerrar
  las de cuentas protegidas. El conteo de sesiones no significa presencia en línea.
- Se registran respuestas HTTP de API con estado >=400 desde esta versión, incluidas
  autenticaciones rechazadas. Solo ruta del resolver, método, código, categoría y usuario
  autenticado; no cuerpos, consultas, credenciales ni mensajes/trazas de excepción.
  La lista muestra las últimas 100, permite marcar revisión con motivo y conserva el historial.
  No captura consola del navegador ni errores previos. Si no puede guardar una incidencia,
  deja una advertencia técnica sin reemplazar la respuesta original.
- Alertas internas: órdenes abiertas, cierres pendientes y umbral de incidencias sin revisar
  de las últimas 24 horas. Son calculadas al consultar; no hay envío de correos ni procesos
  programados externos. Se activan/desactivan en Configuración.
- Diagnóstico: conexión con SELECT 1, base/schema, latencia, versiones y banderas de seguridad.
  No expone hosts/credenciales ni permite modificaciones directas. Lista respaldos internos
  de Expedición sin leer su contenido. El respaldo completo de PostgreSQL y servicios
  externos figuran como **no verificados** hasta integrarlos con el responsable del servidor.

La prueba `frontend/scripts/administracion-herramientas-smoke.cjs` usa exclusivamente
el servidor efímero para recorrer las nueve pantallas nuevas, configurar accesos y
preferencias, exportar CSV y comprobar el bloqueo de APIs, tema oscuro y responsive.
