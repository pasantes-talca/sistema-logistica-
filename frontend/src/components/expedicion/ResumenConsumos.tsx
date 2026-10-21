import { useState, type ReactNode } from "react";
import type { ExpedicionOperativa } from "../../api/expedicionOperativa";
import {
  categoriasConsumo,
  resumirConsumos,
  type FiltrosConsumos,
} from "./consumos";
import { Table } from "./Controles";
import { fmt } from "./format";
import { fechaMovimiento } from "./movimientos";
import { cantidadStock } from "./stockReporte";

export function ReporteConsumos({
  data,
  filtros,
}: {
  data: ExpedicionOperativa;
  filtros: FiltrosConsumos;
}) {
  const resumen = resumirConsumos(data, filtros);
  return (
    <>
      <p>
        {filtros.desde || "Desde el inicio"} → {filtros.hasta || "Hoy"} ·{" "}
        {filtros.usuario || "Todos los encargados"} ·{" "}
        {categoriasConsumo[filtros.tipo as keyof typeof categoriasConsumo] ||
          "Todos los consumos"}
      </p>
      {!resumen.completa && (
        <p role="alert" className="eo-notice">
          Hay productos sin equivalencia configurada. No se muestra un total
          incompleto como si fuera definitivo.
        </p>
      )}
      <div className="eo-kpis">
        {Object.entries(categoriasConsumo).map(([tipo, label]) => {
          const ops = resumen.operaciones.filter((g) => g.tipo === tipo);
          return (
            <article className="eo-card" key={tipo}>
              <span>{label}</span>
              <strong>
                {ops.every((g) => g.completa)
                  ? `${fmt(ops.reduce((s, g) => s + g.fardos, 0))} fardos`
                  : "Sin equivalencia"}
              </strong>
              <small>{ops.length} operaciones</small>
            </article>
          );
        })}
        <article className="eo-card">
          <span>Total egresado</span>
          <strong>
            {resumen.completa
              ? `${fmt(resumen.fardos)} fardos`
              : "Sin equivalencia"}
          </strong>
          <small>{resumen.operaciones.length} operaciones</small>
        </article>
      </div>
      <h3>Totales por producto</h3>
      <Table
        headers={["Código", "Producto", "Unidades", "Fardos equivalentes"]}
        rows={resumen.productos.map((p) => [
          p.codigo,
          p.nombre,
          fmt(p.unidades),
          p.completa ? fmt(p.fardos) : "Sin equivalencia",
        ])}
      />
      <h3>Detalle de operaciones</h3>
      <Table
        headers={[
          "Fecha",
          "Tipo",
          "Beneficiario / referencia",
          "Encargado",
          "Turno",
          "Productos",
          "Total (fardos)",
        ]}
        rows={resumen.operaciones.map((g) => [
          fechaMovimiento(g.fecha),
          categoriasConsumo[g.tipo],
          g.beneficiario,
          g.usuario || "Sin encargado registrado",
          g.turno,
          <div>
            {g.lineas.map((m) => {
              const p = data.productos.find((p) => p.id === m.producto);
              return (
                <p key={m.id}>
                  {p?.nombre || `Producto #${m.producto}`}:{" "}
                  {p && p.configurado !== false
                    ? cantidadStock(m.cantidad, p)
                    : `${fmt(m.cantidad)} un.`}
                </p>
              );
            })}
          </div>,
          g.completa ? fmt(g.fardos) : "Sin equivalencia",
        ])}
      />
    </>
  );
}

export default function ResumenConsumos({
  data,
  imprimir,
}: {
  data: ExpedicionOperativa;
  imprimir: (content: ReactNode) => void;
}) {
  const hoy = new Date().toLocaleDateString("sv-SE");
  const [filtros, setFiltros] = useState<FiltrosConsumos>({
    desde: hoy.slice(0, 7) + "-01",
    hasta: hoy,
    tipo: "",
    usuario: "",
  });
  const invalido = !!(
    filtros.desde &&
    filtros.hasta &&
    filtros.desde > filtros.hasta
  );
  const usuarios = [
    ...new Set(
      data.movimientos
        .filter((m) => Object.hasOwn(categoriasConsumo, m.tipo))
        .map((m) => m.usuario)
        .filter(Boolean),
    ),
  ].sort();
  return (
    <details className="eo-config-panel eo-consumption-summary">
      <summary>Resumen de consumos y egresos</summary>
      <div className="eo-config-backup-content">
        <div className="eo-orders-filters">
          {(["desde", "hasta"] as const).map((k) => (
            <label key={k}>
              {k === "desde" ? "Desde" : "Hasta"}
              <input
                type="date"
                value={filtros[k]}
                onChange={(e) =>
                  setFiltros((v) => ({ ...v, [k]: e.target.value }))
                }
              />
            </label>
          ))}
          <label>
            Tipo de consumo
            <select
              value={filtros.tipo}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, tipo: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {Object.entries(categoriasConsumo).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Encargado
            <select
              value={filtros.usuario}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, usuario: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={invalido}
            onClick={() =>
              imprimir(
                <>
                  <h1>Resumen de consumos y egresos</h1>
                  <ReporteConsumos data={data} filtros={filtros} />
                </>,
              )
            }
          >
            Imprimir resumen de consumos
          </button>
        </div>
        {invalido ? (
          <p role="alert" className="eo-error">
            La fecha Desde no puede ser posterior a Hasta.
          </p>
        ) : (
          <ReporteConsumos data={data} filtros={filtros} />
        )}
      </div>
    </details>
  );
}
