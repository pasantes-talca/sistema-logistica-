import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  claveOperacion,
  ejecutarOperacion,
  obtenerDiagnostico,
  type DiagnosticoExpedicion,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { fmt } from "./format";

export default function DiagnosticoStock({
  admin,
  online,
  turno,
  actualizar,
}: {
  admin: boolean;
  online: boolean;
  turno: string;
  actualizar: () => Promise<unknown>;
}) {
  const [informe, setInforme] = useState<DiagnosticoExpedicion | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lock = useRef(false);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [ordenes, setOrdenes] = useState<number[]>([]);
  const [accion, setAccion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [verificado, setVerificado] = useState(false);
  const intento = useRef<{ contenido: string; clave: string } | null>(null);
  async function ejecutar(fn: () => Promise<void>) {
    if (lock.current || !online) return;
    lock.current = true;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la solicitud.",
      );
    } finally {
      lock.current = false;
      setOcupado(false);
    }
  }
  function elegir(accion: string) {
    setAccion(accion);
    setMotivo("");
    setConfirmacion("");
    setVerificado(false);
  }
  const toggle = (ids: number[], id: number) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  return (
    <details className="eo-config-panel eo-diagnostic">
      <summary>Diagnóstico y conciliación de stock</summary>
      <div className="eo-config-backup-content" aria-busy={ocupado}>
        <p>
          La consulta no modifica datos. Las diferencias entre entregas y
          movimientos necesitan revisión individual: no se inventan salidas ni
          se descuentan dos veces.
        </p>
        <button
          type="button"
          disabled={!online || ocupado}
          onClick={() =>
            void ejecutar(async () => {
              setInforme(await obtenerDiagnostico());
              setSeleccion([]);
              setOrdenes([]);
              setAccion("");
            })
          }
        >
          Actualizar diagnóstico
        </button>
        {informe && (
          <>
            <p className="eo-notice">{informe.aviso}</p>
            <p>
              {informe.base_valida
                ? `Base verificada: ${new Date(informe.base_fecha!).toLocaleString("es-AR")}.`
                : "Sin base verificada válida: no es posible calcular el stock esperado ni habilitar calibraciones."}
            </p>
            <Table
              headers={[
                "Seleccionar",
                "Producto",
                "Actual (un.)",
                "Esperado (un.)",
                "Diferencia (un.)",
                "Sin codificar (actual / esperado)",
                "Estado",
              ]}
              rows={informe.productos.map((p) => [
                admin && p.calibrable ? (
                  <input
                    type="checkbox"
                    aria-label={`Calibrar ${p.codigo}`}
                    checked={seleccion.includes(p.producto)}
                    onChange={() => setSeleccion((v) => toggle(v, p.producto))}
                  />
                ) : (
                  "—"
                ),
                `${p.codigo} · ${p.nombre}`,
                fmt(Number(p.actual)),
                p.esperado === null ? "Sin base" : fmt(Number(p.esperado)),
                p.diferencia === null ? "—" : fmt(Number(p.diferencia)),
                `${fmt(Number(p.sin_codificar))} / ${p.sin_codificar_esperado === null ? "Sin base" : fmt(Number(p.sin_codificar_esperado))}`,
                p.ordenes_inconsistentes
                  ? "Revisar diferencias de órdenes"
                  : p.inconsistente
                    ? "Revisar saldo físico / sin codificar"
                    : p.calibrable
                      ? "Diferencia con la base"
                      : p.esperado === null
                        ? "Sin base"
                        : "Coincide",
              ])}
            />
            <h3>Órdenes que requieren revisión</h3>
            <Table
              headers={[
                "Seleccionar",
                "Orden",
                "Estado guardado",
                "Estado calculado",
                "Diferencias por producto (un.)",
                "Acción",
              ]}
              emptyMessage="No se detectaron diferencias en las órdenes."
              rows={informe.ordenes.map((o) => [
                admin && o.reparable ? (
                  <input
                    type="checkbox"
                    aria-label={`Conciliar orden ${o.numero}`}
                    checked={ordenes.includes(o.id)}
                    onChange={() => setOrdenes((v) => toggle(v, o.id))}
                  />
                ) : (
                  "—"
                ),
                o.numero,
                o.estado,
                o.esperado,
                Object.entries(o.diferencias)
                  .map(([id, q]) => `Producto #${id}: ${q}`)
                  .join(" · ") || "Sin diferencia física",
                <Link to={`/expedicion/ordenes/${o.id}`}>Revisar orden</Link>,
              ])}
            />
            {admin && (
              <div className="eo-actions">
                <button
                  type="button"
                  disabled={ocupado || !online || !seleccion.length}
                  onClick={() => elegir("calibrar_stock")}
                >
                  Calibrar productos seleccionados
                </button>
                <button
                  type="button"
                  disabled={ocupado || !online || !ordenes.length}
                  onClick={() => elegir("conciliar_estados")}
                >
                  Conciliar estados seleccionados
                </button>
                <button
                  type="button"
                  disabled={ocupado || !online}
                  onClick={() => elegir("base_conciliacion")}
                >
                  Establecer base verificada
                </button>
                <Link to="/expedicion/conteos">Registrar conteo físico</Link>
              </div>
            )}
          </>
        )}
        {accion && informe && (
          <form
            className="eo-conciliation-confirm"
            onSubmit={(e) => {
              e.preventDefault();
              void ejecutar(async () => {
                const body = {
                  accion,
                  turno,
                  motivo,
                  confirmacion,
                  fisico_verificado: verificado,
                  huella: informe.huella,
                  seleccion: accion === "calibrar_stock" ? seleccion : ordenes,
                };
                const contenido = JSON.stringify(body);
                if (intento.current?.contenido !== contenido)
                  intento.current = { contenido, clave: claveOperacion() };
                await ejecutarOperacion({
                  ...body,
                  clave: intento.current.clave,
                });
                setAccion("");
                setSeleccion([]);
                setOrdenes([]);
                setMensaje("Conciliación registrada con auditoría.");
                await actualizar();
                setInforme(await obtenerDiagnostico());
              });
            }}
          >
            <h3>
              {accion === "base_conciliacion"
                ? "Verificar base"
                : accion === "calibrar_stock"
                  ? "Confirmar calibración"
                  : "Confirmar conciliación de estados"}
            </h3>
            <p>
              {accion === "base_conciliacion"
                ? "Fija el stock actual como referencia para movimientos futuros. No corrige saldos ni demuestra que el stock sea correcto: contrastalo primero con un conteo físico."
                : accion === "calibrar_stock"
                  ? "Corrige solo los saldos seleccionados según la base y movimientos posteriores. Conserva una copia previa; no agrega salidas ni altera los pendientes manuales."
                  : "Actualiza solo el estado guardado de las órdenes seleccionadas cuya evidencia física coincide. No modifica entregas ni stock."}
            </p>
            {accion === "base_conciliacion" && (
              <label>
                <input
                  type="checkbox"
                  required
                  checked={verificado}
                  onChange={(e) => setVerificado(e.target.checked)}
                />
                Contrasté los saldos con el conteo físico y son correctos
              </label>
            )}
            <label>
              Motivo obligatorio
              <textarea
                required
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={3000}
              />
            </label>
            <label>
              Escribí CONCILIAR
              <input
                required
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="eo-actions">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setAccion("")}
              >
                Cancelar conciliación
              </button>
              <button
                type="submit"
                disabled={ocupado || !online || confirmacion !== "CONCILIAR"}
              >
                Confirmar conciliación
              </button>
            </div>
          </form>
        )}
        {mensaje && <p role="status">{mensaje}</p>}
        {error && (
          <p role="alert" className="eo-error">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
