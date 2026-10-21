# Expedición: reportes y conciliación (21/10/2026)

Referencia revisada: repositorio de Pablo `villarruelmkt/talca-expedicion`,
commit `4e6d945ae5b22eda02682be59479e9f3bd85f485` (web v51).
Se adaptaron las funciones a Django/PostgreSQL, no los mecanismos de Firebase.

## Ubicación de las funciones

- Inicio, Movimientos y Empleados: desplegable **Resumen de consumos y egresos**.
  Filtros inclusivos desde/hasta, tipo y encargado, totales por categoría y
  producto, beneficiarios y reporte imprimible. Cuenta movimientos de salida,
  no vuelve a sumar comprobantes. Informa equivalencias ausentes sin inventarlas.
- Movimientos: total al pie (también en impresión), ingresos/salidas/sin impacto
  en fardos equivalentes. El filtro Mendoza incluye recepciones de Mendoza y
  producción cuya referencia contiene Mendoza; excluye envíos y los separa de
  producción local, igual que la referencia. Los filtros avanzados se conservan.
- Stock y Configuración: **Diagnóstico y conciliación de stock**.
- Configuración → Copias de seguridad: fusión conservadora de respaldos.
  Inicio incluye un acceso directo que abre esas copias.

## Diagnóstico y conciliación

GET `/api/expedicion/diagnostico/` no crea registros. Compara entregas netas
(incluidas sustituciones y correcciones compensatorias) contra movimientos
netos por orden/producto; las anuladas deben tener saldo físico neto cero.

Las órdenes con evidencias físicas inconsistentes se presentan para revisión
individual, nunca se inventan entregas o movimientos faltantes. Un administrador
puede corregir el estado guardado únicamente si coincide la evidencia física;
no cambia cantidades, pendientes ni stock. Incrementa la versión de la orden.

No hay una base inicial verificable para reconstruir automáticamente todos los
saldos importados. **Establecer base verificada** exige contrastar previamente
el stock con un conteo físico y confirmar esa verificación. Guarda una referencia
en AuditoriaExpedicion sin cambiar saldos. Nunca toma el saldo cero ni la base
fija del 16/10 del sistema original como si fueran nuestros saldos iniciales.

La base contiene el saldo físico/sin codificar y una huella de los movimientos
existentes. Para lo posterior usa el orden de inserción, no la fecha operativa:
un movimiento cargado hoy con fecha pasada también tiene impacto. Si el historial
anterior cambia, la base se invalida. Un producto sin base no se calibra.

La calibración es explícita y selectiva: solo corrige diferencias respecto de
una base válida más los movimientos posteriores, con cantidades esperadas no
negativas y sin codificar no mayor al físico. Los productos con diferencias
entre órdenes y movimientos quedan bloqueados hasta su revisión. Conserva una copia completa previa,
deja antes/después en auditoría y no crea movimientos que dupliquen salidas.

Todas las escrituras requieren administrador, motivo y CONCILIAR, huella vigente,
turno válido, bloqueo de ControlOperativa e idempotencia del comando habitual.
Los pendientes se siguen calculando desde órdenes; los manuales no se borran
como supuestas reservas fantasma. Las demás secciones no cambian.

## Fusión de respaldos

POST `/api/expedicion/respaldos/fusion/` conserva el requisito de superusuario
de las restauraciones completas. Los nuevos respaldos identifican su instalación
con una firma opaca, sin publicar nombres/conexión de BD o secretos.

Solo admite formato nativo v1, origen coincidente, identidad de productos y
usuarios conocida y esquema completo. Los respaldos antiguos sin origen y los
Firebase requieren revisión asistida; no se adivinan correspondencias de IDs.

Vista previa con conteos y conflictos por tabla/ID/campo. Compara valores
numéricos JSON equivalentes (`6.0` y `6`) como iguales. Una diferencia real en
cualquier registro (incluido stock) bloquea toda la fusión. Nunca suma stocks ni
decide por "el más reciente". Conserva todos los datos actuales y contadores.

Valida relaciones, campos y restricciones con inserciones dentro de un savepoint
que siempre revierte. No borra filas, no sobrescribe datos ni toca secuencias en
la vista previa. Aplicar exige FUSIONAR, revisión y huella vigentes; crea copia
previa, inserta solo filas ausentes, conserva contadores máximos y deja auditoría.
Los reintentos no insertan duplicados: una huella vieja se rechaza.

Archivo máximo 25 MB en la interfaz; parser acotado a 26 MB para el envoltorio
JSON de este endpoint. No se amplían los límites globales del sistema.

## Instalación y pruebas

No agrega tablas ni migraciones. Requiere publicar backend y frontend juntos y
reiniciar el backend habitual. No ejecutar migraciones generales como parte de
esta actualización. No se aplicaron conciliaciones ni importaciones sobre la BD
operativa durante el desarrollo.

```powershell
# Desde backend (SQLite efímero)
.venv/Scripts/python.exe manage.py test --settings=config.test_settings --noinput
.venv/Scripts/python.exe -m expedicion.smoke_server

# Otra terminal, desde frontend
$env:VITE_API_URL='http://127.0.0.1:8765/api'
npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort
node scripts/expedicion-novedades-smoke.cjs
node --test scripts/consumos-reference.test.mjs scripts/movimientos-reference.test.mjs
npm.cmd run build
```

El script de navegador exige los puertos locales de prueba y la cuenta ficticia
del smoke_server. PLAYWRIGHT_MODULE y PLAYWRIGHT_BROWSER permiten usar la
instalación disponible sin agregar dependencias. Verifica consumos, impresión,
filtros, totalizado, diagnóstico, base, fusión, conflictos, móvil y tema oscuro.
