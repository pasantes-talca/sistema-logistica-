import { useState } from "react";
import type {
  FleteroOperativo,
  MaterialOperativo,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { fmt } from "./format";
import { fechaMovimiento } from "./movimientos";
import {
  filtrarMateriales,
  nombreFletero,
  saldosMateriales,
  tiposMateriales,
  totalesMateriales,
  type FiltrosMateriales,
} from "./materiales";

const vacios: FiltrosMateriales = {
  fletero: 0,
  desde: "",
  hasta: "",
  tipo: "",
};
const saldo = (n: number) => (
  <b
    className={n > 0 ? "eo-material-owing" : n < 0 ? "eo-material-credit" : ""}
  >
    {fmt(n)}
  </b>
);

export function ReporteMateriales({
  movimientos,
  fleteros,
}: {
  movimientos: MaterialOperativo[];
  fleteros: FleteroOperativo[];
}) {
  const totals = totalesMateriales(movimientos);
  const balances = saldosMateriales(movimientos, fleteros);
  const indicadores = [
    ["Pallets entregados", totals.pallets_salida],
    ["Pallets devueltos", totals.pallets_entrada],
    ["Resultado pallets", totals.saldo_pallets],
    ["Chapadur entregado", totals.chapadur_salida],
    ["Chapadur devuelto", totals.chapadur_entrada],
    ["Resultado chapadur", totals.saldo_chapadur],
  ] as const;
  return (
    <>
      <section
        className="eo-material-summary"
        aria-label="Resumen de materiales"
      >
        <div className="eo-material-kpis">
          {indicadores.map(([label, value]) => (
            <div className="eo-material-stat" key={label}>
              <span>{label}</span>
              <strong>{fmt(value)}</strong>
            </div>
          ))}
        </div>
        <h2>Saldos de fleteros en este período</h2>
        <div className="eo-orders-table eo-material-balances">
          <Table
            headers={[
              "Fletero",
              "Pallets (sale/entra)",
              "Saldo pallets",
              "Chapadur (sale/entra)",
              "Saldo chapadur",
            ]}
            emptyMessage="No hay movimientos de materiales con los filtros seleccionados."
            rows={balances.map((b) => [
              <b>{b.nombre}</b>,
              `${fmt(b.pallets_salida)} / ${fmt(b.pallets_entrada)}`,
              saldo(b.saldo_pallets),
              `${fmt(b.chapadur_salida)} / ${fmt(b.chapadur_entrada)}`,
              saldo(b.saldo_chapadur),
            ])}
          />
        </div>
        <p className="eo-help eo-material-legend">
          Saldo = entregado − devuelto. Positivo: pendiente de devolución.
          Negativo: devolución excedente.
        </p>
      </section>
      <section
        className="eo-material-history"
        aria-label="Historial de materiales"
      >
        <h2>Movimientos de materiales</h2>
        <div className="eo-orders-table eo-material-movements">
          <Table
            headers={[
              "Fecha",
              "Fletero",
              "Referencia",
              "Origen",
              "Pallets entregados",
              "Pallets devueltos",
              "Chapadur entregado",
              "Chapadur devuelto",
              "Resultado",
            ]}
            emptyMessage="No hay movimientos de materiales con los filtros seleccionados."
            rows={movimientos.map((m) => [
              <span>
                {fechaMovimiento(m.fecha)}
                <small>{m.turno || "Sin turno registrado"}</small>
              </span>,
              nombreFletero(
                fleteros.find((f) => f.id === m.fletero),
                m.fletero,
              ),
              <span>
                {m.referencia || "—"}
                {m.observaciones && <small>{m.observaciones}</small>}
              </span>,
              m.origen,
              fmt(m.pallets_salida),
              fmt(m.pallets_entrada),
              fmt(m.chapadur_salida),
              fmt(m.chapadur_entrada),
              <span>
                Pallets: {saldo(m.pallets_salida - m.pallets_entrada)}
                <small>
                  Chapadur: {saldo(m.chapadur_salida - m.chapadur_entrada)}
                </small>
              </span>,
            ])}
          />
        </div>
      </section>
    </>
  );
}

export default function ListadoMateriales({
  movimientos,
  fleteros,
  online,
  registrar,
  imprimir,
}: {
  movimientos: MaterialOperativo[];
  fleteros: FleteroOperativo[];
  online: boolean;
  registrar: (modo: "carga" | "devolucion") => void;
  imprimir: (
    movimientos: MaterialOperativo[],
    filtros: FiltrosMateriales,
  ) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosMateriales>(vacios);
  const [avanzados, setAvanzados] = useState(false);
  const rows = filtrarMateriales(movimientos, filtros, fleteros);
  const tipos = [
    ...new Set([...tiposMateriales, ...movimientos.map((m) => m.origen)]),
  ];
  return (
    <>
      <div className="eo-material-actions">
        <button
          type="button"
          disabled={!online}
          onClick={() => registrar("devolucion")}
        >
          Registrar devolución
        </button>
        <button
          type="button"
          className="eo-primary"
          disabled={!online}
          onClick={() => registrar("carga")}
        >
          Nueva carga de materiales
        </button>
      </div>
      <div
        className="eo-orders-filters eo-material-filters"
        role="group"
        aria-label="Filtros de materiales"
      >
        <label>
          Fletero
          <select
            aria-label="Fletero"
            value={filtros.fletero}
            onChange={(e) =>
              setFiltros((v) => ({ ...v, fletero: Number(e.target.value) }))
            }
          >
            <option value="0">Todos</option>
            {fleteros.map((f) => (
              <option key={f.id} value={f.id}>
                {nombreFletero(f)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input
            type="date"
            aria-label="Desde"
            value={filtros.desde}
            onChange={(e) =>
              setFiltros((v) => ({ ...v, desde: e.target.value }))
            }
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            aria-label="Hasta"
            value={filtros.hasta}
            onChange={(e) =>
              setFiltros((v) => ({ ...v, hasta: e.target.value }))
            }
          />
        </label>
        <label>
          Tipo
          <select
            aria-label="Tipo"
            value={filtros.tipo}
            onChange={(e) =>
              setFiltros((v) => ({ ...v, tipo: e.target.value }))
            }
          >
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="eo-orders-filter-actions">
          <button type="button" onClick={() => setFiltros(vacios)}>
            Limpiar
          </button>
          <button
            type="button"
            className="eo-primary"
            onClick={() => imprimir(rows, filtros)}
          >
            Imprimir
          </button>
        </div>
      </div>
      {avanzados && (
        <div
          className="eo-orders-extra-filters eo-material-extra"
          role="group"
          aria-label="Filtros adicionales de materiales"
        >
          <label>
            Buscar
            <input
              aria-label="Buscar material"
              placeholder="Fletero, referencia u observaciones"
              value={filtros.busqueda || ""}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, busqueda: e.target.value }))
              }
            />
          </label>
          <label>
            Turno
            <select
              aria-label="Turno"
              value={filtros.turno || ""}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, turno: e.target.value }))
              }
            >
              <option value="">Todos</option>
              <option>Mañana</option>
              <option>Tarde</option>
            </select>
          </label>
        </div>
      )}
      <ReporteMateriales movimientos={rows} fleteros={fleteros} />
      <div className="eo-orders-footer">
        <span>{rows.length} movimientos en el período seleccionado</span>
        <button
          type="button"
          aria-expanded={avanzados}
          onClick={() => setAvanzados(!avanzados)}
        >
          {avanzados ? "Ocultar filtros adicionales" : "Filtros adicionales"}
          {!avanzados && (filtros.busqueda || filtros.turno)
            ? " · activos"
            : ""}
        </button>
      </div>
    </>
  );
}
