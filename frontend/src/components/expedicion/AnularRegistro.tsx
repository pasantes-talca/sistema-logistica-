import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ejecutarOperacion,
  claveOperacion,
  type ExpedicionOperativa,
} from "../../api/expedicionOperativa";
import { useEliminarHistorial } from "../ui/useEliminarHistorial";
import { mensajeCarga } from "../ui/mensajeCarga";
import { useTurnoExpedicion } from "./turnoExpedicion";
import "../ui/EliminarRegistroHistorial.css";

export default function AnularRegistro({
  tipo,
  id,
  descripcion,
  huella,
  version,
  anulado,
  reversion,
  orden,
  referencia,
  movimientoTipo,
}: {
  tipo: "orden" | "movimiento" | "material" | "comprobante" | "conteo";
  id: number | string;
  descripcion: string;
  huella?: string;
  version?: number;
  anulado?: boolean;
  reversion?: boolean;
  orden?: number | null;
  referencia?: string;
  movimientoTipo?: string;
}) {
  const admin = useEliminarHistorial(),
    cache = useQueryClient(),
    { turno } = useTurnoExpedicion();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bloqueo = useRef(false);
  if (!admin || reversion) return null;
  if (anulado) return <span className="eo-badge">Anulado</span>;
  async function anular() {
    if (bloqueo.current) return;
    const data = cache.getQueryData<ExpedicionOperativa>([
      "expedicion-operativa",
    ]);
    const padre = orden ? data?.ordenes.find((o) => o.id === orden) : undefined;
    const comprobante =
      tipo === "movimiento" &&
      ["CONSUMO_EMPLEADO", "ANTICIPO_EMPLEADO"].includes(movimientoTipo || "")
        ? data?.comprobantes.find((c) => c.numero === referencia)
        : undefined;
    if (padre?.anulada || comprobante?.anulado) {
      setError("La operación principal ya está anulada.");
      return;
    }
    if (orden && !padre) {
      setError("Actualizá la pantalla para identificar la orden.");
      return;
    }
    const nombre = padre
      ? `la orden completa ${padre.numero}, con todas sus entregas y materiales`
      : comprobante
        ? `el comprobante completo ${comprobante.numero}, incluyendo el beneficio del empleado`
        : descripcion;
    if (
      !window.confirm(
        `¿Anular ${nombre}? Se revertirán sus efectos y se conservará la trazabilidad. No se borrarán auditorías ni correos enviados.`,
      )
    )
      return;
    const motivo = window
      .prompt("Motivo de la anulación (obligatorio, hasta 2000 caracteres):")
      ?.trim();
    if (!motivo) return;
    if (motivo.length > 2000) {
      setError("El motivo no puede superar 2000 caracteres.");
      return;
    }
    bloqueo.current = true;
    setBusy(true);
    setError("");
    try {
      const target = padre ? "orden" : comprobante ? "comprobante" : tipo;
      await ejecutarOperacion({
        clave: claveOperacion(),
        turno,
        motivo,
        confirmar: true,
        ...(target === "orden"
          ? {
              accion: "anular",
              id: padre?.id ?? id,
              version: padre?.version ?? version,
            }
          : {
              accion: "anular_registro",
              tipo_registro: target,
              registro: comprobante?.id ?? id,
              huella: comprobante?.huella ?? huella,
            }),
      });
      await cache.invalidateQueries({
        predicate: (q) =>
          /expedicion|auditoria|dashboard/.test(String(q.queryKey[0])),
      });
    } catch (e) {
      setError(
        e instanceof Error ? mensajeCarga(e) : "No se pudo anular el registro.",
      );
    } finally {
      bloqueo.current = false;
      setBusy(false);
    }
  }
  return (
    <span>
      <button
        type="button"
        className="historial-eliminar"
        disabled={busy || (tipo !== "orden" && !huella)}
        aria-label={`Anular y revertir ${descripcion}`}
        onClick={() => void anular()}
      >
        {busy ? "Anulando…" : "Anular y revertir"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
