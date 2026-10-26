# Planilla de kilometraje

La carga y el detalle usan la misma matriz: chofer + período identifican una única planilla. Los días son fechas reales (incluido el 31 cuando corresponda); los domingos se resaltan, pero admiten viajes. Cada celda contiene viajes enteros, y los kilómetros se calculan por destino. Enter y las flechas arriba/abajo cambian de día sin guardar.

- Guardar borrador no envía correo. El historial permite volver a abrirlo.
- Corregir requiere motivo y la versión que se abrió; si otra persona ya guardó cambios, se rechaza la sobreescritura.
- Se conservan las columnas y las distancias del control, incluso si cambia el catálogo.
- Finalizar y enviar requiere confirmación; manda dos adjuntos, XLSX y PDF, exclusivamente a pasantes@talca.com.ar. Descargar utiliza los datos guardados, no los cambios pendientes.
- Corregir una finalizada crea una nueva versión en borrador. No altera el correo anterior ni envía automáticamente otra copia.
- El servidor SMTP confirma aceptación, no recepción final. Ante error se conserva la planilla; verificar el correo antes de reintentar porque un timeout puede producirse después de la aceptación.
- ENVIANDO bloquea modificaciones y envíos simultáneos. Si el proceso termina abruptamente, no se reintenta solo: el responsable técnico debe verificar los registros SMTP y la casilla antes de resolver ese estado.

## Base operativa

La BD operativa logistica.log tiene tablas anteriores sin historial completo de migraciones. **No ejecutar migrate general ni marcar migraciones históricas como aplicadas.**

Desde backend, el comando acotado hace una simulación por defecto:

```powershell
.\.venv\Scripts\python.exe manage.py instalar_planilla_kilometraje
```

Con `--aplicar` agrega únicamente seis campos en control_kilometraje y los destinos faltantes del ejemplo. Conserva instantáneas anteriores antes de configurar Sharp / Mai-Gua a 5 km. Es transaccional, idempotente, limitado a logistica.log y no escribe el historial de migraciones. No crea choferes, controles ni viajes de ejemplo. Se aplicó el 26/10/2026: cero controles y nueve destinos activos tras la verificación.

Las migraciones 0002 y 0003 se incluyen para instalaciones nuevas con historial normal. No ejecutarlas nuevamente sobre la BD operativa actualizada con el instalador sin reconciliación técnica previa.

## Correo y publicación

Reutiliza EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS y DEFAULT_FROM_EMAIL. No incluye credenciales nuevas en el repositorio. Timeout SMTP: 30 segundos. Las pruebas usan únicamente el backend de correo en memoria; no envían correos reales.

Hay que publicar tanto frontend como backend para actualizar la instalación del servidor. La preparación de la BD no publica código.

## Verificación

```powershell
# Dentro de backend: SQLite efímero, nunca PostgreSQL operativo.
.\.venv\Scripts\python.exe manage.py test --settings=config.test_settings --noinput

# Dentro de frontend.
npm.cmd run build
```

`frontend/scripts/planilla-kilometraje-smoke.cjs` prueba la nueva carga con APIs simuladas y Vite en 5181 apuntando a 8771. Requiere Playwright instalado; PLAYWRIGHT_MODULE y PLAYWRIGHT_BROWSER permiten indicar las ubicaciones locales. Incluye guardado fallido sin pérdida, reapertura, edición, confirmación de envío, descarga y grilla sin desbordamiento global en claro/oscuro a 1440/768/390 px. Las comprobaciones antiguas del asistente de carga por día fueron reemplazadas por esta prueba.
