# Reabrir una orden anulada

Desde Expedición → Órdenes de carga, abrir una orden anulada y elegir
**Reabrir orden**. Indicar el circuito para el próximo despacho, explicar el
motivo y confirmar que la mercadería todavía debe salir.

- Conserva número, fecha original del pedido, fletero y cantidades solicitadas.
- Vuelve a pendiente por el pedido completo; no recupera el despacho revertido.
- No crea movimientos de stock ni de materiales al reabrir.
- El nuevo despacho se registra por separado con su fecha, turno y encargado.
- Las entregas revertidas siguen visibles como anuladas, pero quedan fuera de
  los pendientes, filtros de despacho, impresión conjunta y totales vigentes.
- Se exige acceso a Expedición y la misma acción autorizada que para anular.
- Confirma la versión actual de la orden y usa la clave de idempotencia común.
- Impide reabrir automáticamente si no hay una anulación verificable o si la
  reversión dejó un saldo neto de stock/materiales distinto de cero.
- Una salida inmediata debe pasar a un circuito pendiente de despacho.

La auditoría `Reabrir orden` guarda los límites de entregas y movimientos del
ciclo revertido. Forma parte de los respaldos internos y no se elimina ni edita.
No requiere migraciones, limpieza de tablas ni cambios manuales de estado en SQL.
Publicar backend y frontend juntos y reiniciar el backend antes de utilizarlo.

Pruebas específicas (BD SQLite de prueba, sin correos ni BD operativa):

```text
python manage.py test expedicion.test_reapertura --settings=config.test_settings --noinput
```

Interfaz con API simulada: `frontend/scripts/reabrir-orden-smoke.cjs`.
