# Rechazos Preventa — design and scope

Status: implemented (backend, assistant, frontend). Cutover pending.

## Operations

Environment variables (`backend/.env`):

| Variable | Purpose |
|---|---|
| `PERSAT_API_KEY` | Persat API bearer key (same value as the old service). |
| `PERSAT_WEBHOOK_TOKEN` | Secret path segment for the webhook, at least 32 characters. |

Commands (from `backend/`):

```bash
python manage.py migrate rechazos_preventa
# Dry run first, then apply. Source = old DB "rechazos".
python manage.py importar_entregas_persat --origen "postgresql://USER:PASS@10.242.4.13:5432/rechazos"
python manage.py importar_entregas_persat --origen "postgresql://USER:PASS@10.242.4.13:5432/rechazos" --aplicar
# Every 5 minutes (Windows Task Scheduler or equivalent):
python manage.py sincronizar_persat
```

Webhook URL to configure in Persat: `https://<host>/api/webhooks/persat/<PERSAT_WEBHOOK_TOKEN>/`
(event `delivery.finished`). Grant access by adding users to the `RECHAZOS_PREVENTA` module
from the administration panel.

## Goal

Port the standalone `rechazos` project (FastAPI, port 8003) into the logistics app as a new
module **Rechazos Preventa**, placed right below **Rechazos** in the sidebar. It must show the
same content (department heat map of Mendoza, reasons breakdown) plus AI assistant knowledge
of preventa rejections. Only the visual design changes, matching the logistics assistant.
After cutover, the 8003 service is shut down.

## Scope

In:
- Persat `NOT_DELIVERED` deliveries (source of the map, reasons and AI answers).
- One-time migration of historical data from DB `rechazos`, table `rechazo.entregas_persat`.
- Persat periodic sync and Persat webhook, both moved to Django.
- Live map updates.
- Extending the existing `asistente` app.

Out (verified unused by the map and the AI in the source project):
- `no_entregas_form`: Form data is already ingested by the `Rechazos` module.
- `actividad_diaria`, `webhook_eventos`, SQLite storage, Excel/CSV exporters, legacy `http.server` page.

## Backend — new Django app `rechazos_preventa`

| Piece | Detail |
|---|---|
| Model `EntregaPersat` | Table `log.entrega_persat`. Same fields as `entregas_persat`: `id_entrega` (unique), `uid_client`, `nombre_cliente`, `estado_persat`, `estado_final`, dates, `fecha_ruta`, `movil_asignado`, `comentarios_observaciones`, `causa_no_entrega`, `otro_motivo`, `direccion`, `departamento`, `actualizado_en`. |
| `persat.py` | Ported Persat client (`api.py`, `domain.py`, cause extraction). `PERSAT_API_KEY` and `PERSAT_MOBILE_FILTER` via `django-environ`. |
| `geografia.py` | Point-in-polygon department lookup with `mendoza.geojson` bundled in the app (no Georef call at runtime). |
| `sincronizar_persat` command | Full paging, upsert on `id_entrega`. Scheduled every 5 minutes (same cadence as today). |
| `importar_entregas_persat` command | One-shot migration from the `rechazos` DB (`RECHAZOS_DATABASE_URL`). Idempotent upsert, `--dry-run`, prints counts. |
| Webhook | `POST /api/webhooks/persat/<token>/`. Outside `AccesoSistema`, CSRF exempt, constant-time token check, fetches the delivery from Persat and upserts it. |
| Read API | `/api/rechazos-preventa/resumen/` (by department, reason and mobile, with date range), `/detalle/`, `/revision/` (last change marker for live updates). |
| Permissions | New group `RECHAZOS_PREVENTA` in `MODULOS`, prefix `rechazos-preventa` in `PREFIJOS`. Action policy via the existing panel (`consultar`). |

Reason rule (ported as is): `causa_no_entrega`; if it is "otro" and `otro_motivo` is set, then `"Otro: " + otro_motivo`; if empty, "Sin razón informada".

## AI assistant

- New tool `consultar_rechazos_preventa` in `asistente/tools.py` + declaration in `gemini_tools.py`.
- Covers the source project's queries: totals, by department, by reason, by mobile, by period, client detail.
- Offered to Gemini only when the user has the `RECHAZOS_PREVENTA` module (no data leakage).

## Frontend

- Sidebar entry **Rechazos Preventa** below **Rechazos** (`AppLayout.tsx`), permission `RECHAZOS_PREVENTA`.
- Page with: date filters, SVG heat map from the geojson (no new map library, same as source), ranking by department, reasons breakdown, detail table.
- Assistant panel reusing the logistics assistant components and styles.

## Live updates

Decision: short polling. The page checks `/revision/` every 10 s (react-query) and refetches only
when it changes. Works on the current deployment without ASGI. SSE is possible later but needs
Django served via ASGI and holds one connection per open tab.

## Tests (TDD)

- Reason rule and department lookup (pure functions).
- Persat payload mapping to `EntregaPersat` and idempotent upsert (Persat API mocked).
- Migration command: idempotency and `--dry-run`.
- Webhook: valid token, invalid token, unknown delivery.
- Read API: aggregates and permission (`RECHAZOS_PREVENTA` vs other groups).
- Assistant tool: results and module gating.

## Cutover order

1. Deploy the module and run `importar_entregas_persat`.
2. Schedule `sincronizar_persat`; compare counts against the 8003 service for a few days.
3. Change the webhook URL in Persat to the Django endpoint; confirm events arrive.
4. Stop the 8003 service and remove its scheduled task `Persat-Rechazos-CadaHora`.

## Open items

- Who changes the webhook URL in the Persat console.
- How Django runs in production (WSGI/ASGI, scheduler) to schedule `sincronizar_persat`.
