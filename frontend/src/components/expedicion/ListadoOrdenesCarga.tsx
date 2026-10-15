import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  ExpedicionOperativa,
  OrdenOperativa,
  ProductoOperativo,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { fmt } from "./format";
import {
  estiloEstadoOrden,
  filtrarOrdenes,
  resumenOrden,
  type FiltrosOrdenes,
} from "./ordenes";

const vacios: FiltrosOrdenes = {
  fletero: 0,
  dia: "",
  encargado: "",
  turno: "",
};
const columnas = [
  "Orden",
  "Fecha",
  "Fletero",
  "Tipo",
  "Encargado",
  "Turno",
  "Estado",
  "Solicitado",
  "Entregado",
  "Acciones",
];
const fardos = (value: number | null) =>
  value === null ? "Sin equivalencia" : `${fmt(value)} fardos`;

export function ReporteOrdenesCarga({
  ordenes,
  productos,
  imprimible = false,
}: {
  ordenes: OrdenOperativa[];
  productos: ProductoOperativo[];
  imprimible?: boolean;
}) {
  return (
    <div className={`eo-orders-table${imprimible ? " eo-orders-print" : ""}`}>
      <Table
        headers={imprimible ? columnas.slice(0, -1) : columnas}
        rows={ordenes.map((o) => {
          const resumen = resumenOrden(o, productos);
          const cells = [
            <b>{o.numero}</b>,
            o.fecha,
            o.fletero_nombre,
            resumen.tipo,
            resumen.encargado,
            resumen.turno,
            <span
              className={`eo-order-status eo-order-status--${estiloEstadoOrden(o.estado_operativo)}`}
            >
              {o.estado_operativo}
            </span>,
            <span className="eo-order-quantity">
              {fardos(resumen.solicitado)}
            </span>,
            <span className="eo-order-quantity">
              {fardos(resumen.entregado)}
            </span>,
          ];
          return imprimible
            ? cells
            : [
                ...cells,
                <Link
                  className="eo-order-open"
                  to={`/expedicion/ordenes/${o.id}`}
                >
                  Abrir
                </Link>,
              ];
        })}
      />
    </div>
  );
}

export default function ListadoOrdenesCarga({
  data,
  imprimir,
  exportar,
}: {
  data: ExpedicionOperativa;
  imprimir: (ordenes: OrdenOperativa[], filtros: FiltrosOrdenes) => void;
  exportar: (headers: string[], rows: unknown[][]) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosOrdenes>(vacios);
  const [avanzados, setAvanzados] = useState(false);
  const list = filtrarOrdenes(data.ordenes, filtros);
  const encargados = [
    ...new Set([
      ...data.usuarios.map((u) => u.nombre),
      ...data.ordenes.flatMap((o) => [
        o.creado_por_nombre,
        ...o.entregas.map((e) => e.creado_por_nombre),
      ]),
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "es"));
  return (
    <>
      <div
        className="eo-orders-filters"
        role="group"
        aria-label="Filtros de órdenes de carga"
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
            {data.fleteros.map((f) => (
              <option key={f.id} value={f.id}>
                {[f.nombre, f.apellido].filter(Boolean).join(" ")}
                {f.empresa ? ` · ${f.empresa}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Día
          <input
            aria-label="Día"
            type="date"
            value={filtros.dia}
            onChange={(e) => setFiltros((v) => ({ ...v, dia: e.target.value }))}
          />
        </label>
        <label>
          Encargado
          <select
            aria-label="Encargado"
            value={filtros.encargado}
            onChange={(e) =>
              setFiltros((v) => ({ ...v, encargado: e.target.value }))
            }
          >
            <option value="">Todos</option>
            {encargados.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label>
          Turno
          <select
            aria-label="Turno"
            value={filtros.turno}
            onChange={(e) =>
              setFiltros((v) => ({ ...v, turno: e.target.value }))
            }
          >
            <option value="">Todos</option>
            <option>Mañana</option>
            <option>Tarde</option>
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
          className="eo-orders-extra-filters"
          role="group"
          aria-label="Filtros adicionales"
        >
          <label>
            Buscar
            <input
              aria-label="Buscar orden"
              placeholder="Código, nombre o referencia"
              value={filtros.busqueda || ""}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, busqueda: e.target.value }))
              }
            />
          </label>
          <label>
            Desde
            <input
              type="date"
              aria-label="Desde"
              value={filtros.desde || ""}
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
              value={filtros.hasta || ""}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, hasta: e.target.value }))
              }
            />
          </label>
          <label>
            Estado
            <select
              aria-label="Estado"
              value={filtros.estado || ""}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, estado: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {[...new Set(data.ordenes.map((o) => o.estado_operativo))].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
        </div>
      )}
      <ReporteOrdenesCarga ordenes={list} productos={data.productos} />
      <div className="eo-orders-footer">
        <span>
          {list.length} {list.length === 1 ? "orden" : "órdenes"} · Totales
          expresados en fardos equivalentes
        </span>
        <button
          type="button"
          aria-expanded={avanzados}
          onClick={() => setAvanzados(!avanzados)}
        >
          {avanzados ? "Ocultar filtros adicionales" : "Filtros adicionales"}
          {!avanzados &&
          (filtros.busqueda || filtros.desde || filtros.hasta || filtros.estado)
            ? " · activos"
            : ""}
        </button>
        <button
          type="button"
          onClick={() =>
            exportar(
              columnas.slice(0, -1),
              list.map((o) => {
                const r = resumenOrden(o, data.productos);
                return [
                  o.numero,
                  o.fecha,
                  o.fletero_nombre,
                  r.tipo,
                  r.encargado,
                  r.turno,
                  o.estado_operativo,
                  r.solicitado === null ? "" : fmt(r.solicitado),
                  r.entregado === null ? "" : fmt(r.entregado),
                ];
              }),
            )
          }
        >
          Exportar CSV
        </button>
      </div>
    </>
  );
}
