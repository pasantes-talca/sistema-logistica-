import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  MovimientoOperativo,
  ProductoOperativo,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { fmt } from "./format";
import { cantidadStock } from "./stockReporte";
import {
  agruparMovimientos,
  fechaMovimiento,
  filtrarMovimientos,
  totalesMovimientos,
  type FiltrosMovimientos,
  type GrupoMovimiento,
} from "./movimientos";

const vacios: FiltrosMovimientos = { desde: "", hasta: "", tipo: "" };
const columnas = [
  "Fecha",
  "Tipo",
  "Referencia",
  "Entrada total",
  "Salida total",
  "Sin impacto",
  "Encargado",
  "Turno",
  "Acciones",
];

export function ReporteMovimientos({
  grupos,
  productos,
  online = true,
  corregir,
  imprimible = false,
}: {
  grupos: GrupoMovimiento[];
  productos: ProductoOperativo[];
  online?: boolean;
  corregir?: (m: MovimientoOperativo) => void;
  imprimible?: boolean;
}) {
  const totales = totalesMovimientos(grupos);
  const cantidad = (g: GrupoMovimiento, q: number) =>
    !g.equivalenciasCompletas ? (
      <span title="Falta la configuración de algún producto. Consultá el detalle.">
        Sin equivalencia
      </span>
    ) : q ? (
      `${fmt(q)} fardos`
    ) : (
      ""
    );
  return (
    <div className="eo-orders-table eo-movements-table">
      <Table
        headers={imprimible ? columnas.slice(0, -1) : columnas}
        footer={[
          `TOTAL (${grupos.length} operaciones)`,
          "",
          "",
          ...[totales.entrada, totales.salida, totales.neutral].map((q) =>
            totales.completos
              ? `${fmt(q)} fardos`
              : "Sin equivalencia completa",
          ),
          "",
          "",
          ...(!imprimible ? [""] : []),
        ]}
        emptyMessage="No hay movimientos con los filtros seleccionados."
        rows={grupos.map((g) => {
          const cells = [
            fechaMovimiento(g.fecha),
            <div>
              <span>{g.tipo}</span>
              {!imprimible && (
                <details className="eo-movement-detail">
                  <summary>
                    {g.productos > 1
                      ? `${g.productos} productos`
                      : "Ver detalle"}
                  </summary>
                  <div className="eo-movement-lines">
                    {g.lineas.map((m) => {
                      const p = productos.find((p) => p.id === m.producto);
                      return (
                        <div key={m.id}>
                          <b>
                            {p
                              ? `${p.codigo} · ${p.nombre}`
                              : `Producto #${m.producto}`}
                          </b>
                          <small>
                            {fechaMovimiento(m.fecha)} ·{" "}
                            {m.usuario || "Sin encargado registrado"} ·{" "}
                            {m.turno || "Sin turno registrado"}
                          </small>
                          <span>
                            {m.sin_impacto
                              ? "Sin impacto"
                              : m.direccion === "ENTRADA"
                                ? "Entrada"
                                : "Salida"}
                            :{" "}
                            {p && p.configurado !== false
                              ? cantidadStock(m.cantidad, p)
                              : `${fmt(m.cantidad)} un.`}
                          </span>
                          {m.observaciones && <small>{m.observaciones}</small>}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>,
            g.referencia || "—",
            cantidad(g, g.entrada),
            cantidad(g, g.salida),
            cantidad(g, g.neutral),
            g.usuario || "—",
            g.turno || "—",
          ];
          return imprimible
            ? cells
            : [
                ...cells,
                g.orden ? (
                  <Link
                    className="eo-order-open"
                    to={`/expedicion/ordenes/${g.orden}`}
                  >
                    Ver orden
                  </Link>
                ) : corregir ? (
                  <button
                    type="button"
                    disabled={!online}
                    onClick={() => corregir(g.lineas[0])}
                  >
                    Corregir fecha/ref.
                  </button>
                ) : (
                  ""
                ),
              ];
        })}
      />
    </div>
  );
}

export default function ListadoMovimientos({
  movimientos,
  productos,
  online,
  nuevo,
  registrar,
  corregir,
  imprimir,
  exportar,
}: {
  movimientos: MovimientoOperativo[];
  productos: ProductoOperativo[];
  online: boolean;
  nuevo: (tipo: "REBOTE" | "DERRAME") => void;
  registrar: () => void;
  corregir: (m: MovimientoOperativo) => void;
  imprimir: (grupos: GrupoMovimiento[], filtros: FiltrosMovimientos) => void;
  exportar: (movimientos: MovimientoOperativo[]) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosMovimientos>(vacios);
  const [avanzados, setAvanzados] = useState(false);
  const grupos = agruparMovimientos(movimientos, productos);
  const list = filtrarMovimientos(grupos, filtros, productos);
  const tipos = [...new Set(grupos.map((g) => g.tipo))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  return (
    <>
      <div className="eo-movement-actions">
        <button
          type="button"
          disabled={!online}
          onClick={() => nuevo("REBOTE")}
        >
          Nuevo rebote
        </button>
        <button
          type="button"
          disabled={!online}
          onClick={() => nuevo("DERRAME")}
        >
          Nuevo derrame
        </button>
      </div>
      <div
        className="eo-orders-filters eo-movement-filters"
        role="group"
        aria-label="Filtros de movimientos"
      >
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
            <option value="Producción">
              Producción local (codificada y sin codificar)
            </option>
            <option value="Producción Mendoza">
              Ingresos de producción de Mendoza
            </option>
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
            onClick={() => imprimir(list, filtros)}
          >
            Imprimir
          </button>
        </div>
      </div>
      {avanzados && (
        <div
          className="eo-orders-extra-filters eo-movement-extra"
          role="group"
          aria-label="Filtros adicionales de movimientos"
        >
          <label>
            Buscar
            <input
              aria-label="Buscar movimiento"
              placeholder="Producto, código, referencia o encargado"
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
      <ReporteMovimientos
        grupos={list}
        productos={productos}
        online={online}
        corregir={corregir}
      />
      <div className="eo-orders-footer">
        <span>
          {list.length} registros · Totales en fardos equivalentes. El derrame
          no modifica el stock físico.
        </span>
        <div className="eo-orders-filter-actions">
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
          <button
            type="button"
            onClick={() => exportar(list.flatMap((g) => g.lineas))}
          >
            Exportar CSV
          </button>
          <button type="button" disabled={!online} onClick={registrar}>
            Registrar movimiento
          </button>
        </div>
      </div>
    </>
  );
}
