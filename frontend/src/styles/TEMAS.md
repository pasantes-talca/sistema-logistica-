# Temas visuales de Logística Talca

El selector compartido `ThemeToggle` está en `AppLayout` junto al usuario y en el login.
`src/theme.ts` mantiene una única preferencia en `localStorage` (`talca-tema`), notifica a
React y sincroniza pestañas. No depende de la autenticación ni hace llamadas a APIs.
`index.html` la aplica antes del primer pintado y reconoce la preferencia anterior de Expedición.
Si el navegador bloquea el almacenamiento, el selector funciona durante la visita.

La paleta se define en `theme.css` mediante `:root[data-theme="dark"]`, sólo para
pantalla. Las hojas de cada módulo usan variables semánticas con su color claro
original como fallback: `var(--theme-surface, #fff)`, `--theme-input`, `--theme-text`,
`--theme-muted`, `--theme-border`, `--theme-accent`, y variantes de éxito, alerta y error.
Así, el modo claro y los formatos de impresión conservan sus colores. No usar filtros
de inversión ni estilos de tema independientes por módulo.

Para componentes nuevos, usar estas variables para superficies, texto, bordes y estados.
Reservar blanco fijo para el texto sobre botones principales o fondos de identidad
oscuros. Las series de los gráficos conservan sus colores; sus ejes, grillas, tooltips y
controles se adaptan globalmente.

Verificación: `npm run build` y `scripts/tema-global-smoke.cjs` con Playwright y el servidor
aislado `backend/core/smoke_conversion.py` (SQLite en memoria; nunca la base real).
El smoke recorre módulos, edición y detalle sin guardar operaciones, verifica persistencia,
sincronización, migración de preferencia, bloqueo de almacenamiento, modal, gráfico,
impresión y tamaños de escritorio/tablet/teléfono. Guarda capturas y un diagnóstico de
contraste en `test-artifacts/` (archivos locales ignorados).
