import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  ExpedicionOperativa,
  OrdenOperativa,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { tiposOrden } from "./ordenes";
import { filtrarPendientes, type FiltrosPendientes } from "./pendientes";

const vacios: FiltrosPendientes = { fletero: 0, desde: "" };
const columnas = ["Orden", "Fecha", "Fletero", "Tipo", "Acciones"];

export function ReportePendientes({
  ordenes,
  imprimible = false,
}: {
  ordenes: OrdenOperativa[];
  imprimible?: boolean;
}) {
  return (
    <div className="eo-orders-table eo-pending-table">
      <Table
        headers={imprimible ? columnas.slice(0, -1) : columnas}
        emptyMessage="No hay órdenes pendientes con los filtros seleccionados."
        rows={ordenes.map((o) => {
          const cells = [
            <b>{o.numero}</b>,
            o.fecha,
            o.fletero_nombre,
            tiposOrden[o.circuito] || "Pendiente",
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

export default function ListadoPendientes({
  data,
  imprimir,
}: {
  data: ExpedicionOperativa;
  imprimir: (ordenes: OrdenOperativa[], filtros: FiltrosPendientes) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosPendientes>(vacios);
  const [avanzados, setAvanzados] = useState(false);
  const list = filtrarPendientes(data.ordenes, filtros);
  return (
    <>
      <div
        className="eo-orders-filters eo-pending-filters"
        role="group"
        aria-label="Filtros de pendientes"
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
        <button
          type="button"
          className="eo-primary"
          onClick={() => imprimir(list, filtros)}
        >
          Imprimir
        </button>
      </div>
      {avanzados && (
        <div
          className="eo-orders-extra-filters"
          role="group"
          aria-label="Filtros adicionales de pendientes"
        >
          <label>
            Buscar
            <input
              aria-label="Buscar pendiente"
              value={filtros.busqueda || ""}
              placeholder="Orden, código o producto"
              onChange={(e) =>
                setFiltros((v) => ({ ...v, busqueda: e.target.value }))
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
          <label>
            Producto
            <select
              aria-label="Producto"
              value={filtros.producto || 0}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, producto: Number(e.target.value) }))
              }
            >
              <option value="0">Todos</option>
              {data.productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} · {p.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <ReportePendientes ordenes={list} />
      <div className="eo-orders-footer">
        <span>
          {list.length}{" "}
          {list.length === 1 ? "orden pendiente" : "órdenes pendientes"} · El
          detalle de productos se consulta en Abrir.
        </span>
        <div className="eo-orders-filter-actions">
          <button
            type="button"
            aria-expanded={avanzados}
            onClick={() => setAvanzados(!avanzados)}
          >
            {avanzados ? "Ocultar filtros adicionales" : "Filtros adicionales"}
            {!avanzados &&
            (filtros.busqueda ||
              filtros.hasta ||
              filtros.turno ||
              filtros.estado ||
              filtros.producto)
              ? " · activos"
              : ""}
          </button>
          <button type="button" onClick={() => setFiltros(vacios)}>
            Limpiar
          </button>
        </div>
      </div>
    </>
  );
}
