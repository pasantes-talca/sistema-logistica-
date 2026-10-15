import { useState } from "react";
import type { ProductoOperativo } from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { fmt } from "./format";
import {
  cantidadesStock,
  columnasPendientes,
  filtrarStock,
  totalesStock,
  type EstadoStock,
  type FiltrosStock,
} from "./stock";
import { cantidadStock, porcentajeStock as porcentaje } from "./stockReporte";

const vacios: FiltrosStock = { busqueda: "", estado: "" };
const columnas = [
  "Producto",
  "Stock físico",
  ...columnasPendientes.map(([, label]) => label),
  "Total pendiente",
  "% stock disponible",
  "Acciones",
];
export function ReporteStock({
  productos,
  pallets,
  editar,
  online = true,
}: {
  productos: ProductoOperativo[];
  pallets: boolean;
  editar?: (p: ProductoOperativo) => void;
  online?: boolean;
}) {
  const total = totalesStock(productos);
  const totalFardos = (q: number) => `${fmt(q)} fardos`;
  return (
    <div className="eo-orders-table eo-stock-table">
      <Table
        headers={editar ? columnas : columnas.slice(0, -1)}
        emptyMessage="No hay productos con los filtros seleccionados."
        rows={productos.map((p) => {
          const q = cantidadesStock(p);
          const cells = [
            <div className="eo-stock-product">
              <b>{p.codigo}</b>
              {p.alias && <span className="eo-stock-alias">{p.alias}</span>}
              <span>{p.nombre}</span>
            </div>,
            <div>
              {cantidadStock(p.stock, p, pallets)}
              <small>
                Entregable: {cantidadStock(q.entregable, p, pallets)}
              </small>
            </div>,
            ...q.pendientes.map((v) => cantidadStock(v, p, pallets)),
            <b>{cantidadStock(q.total, p, pallets)}</b>,
            q.porcentaje === null ? (
              <span className="eo-badge">Sin pendientes</span>
            ) : (
              <div>
                <span
                  className={`eo-badge eo-stock-${q.estado === "Disponible" ? "ok" : "critical"}`}
                >
                  {porcentaje(q.porcentaje)}
                </span>
                <small>{q.estado}</small>
              </div>
            ),
          ];
          return editar
            ? [
                ...cells,
                <button
                  type="button"
                  disabled={!online}
                  onClick={() => editar(p)}
                  aria-label={`Editar pendientes ${p.codigo}`}
                >
                  Editar pendientes
                </button>,
              ]
            : cells;
        })}
        footer={
          productos.length
            ? [
                <b>TOTAL</b>,
                <div>
                  {totalFardos(total.fisico)}
                  <small>Entregable: {totalFardos(total.entregable)}</small>
                </div>,
                ...total.circuitos.map(totalFardos),
                totalFardos(total.pendiente),
                total.porcentaje === null ? (
                  <span className="eo-badge">Sin pendientes</span>
                ) : (
                  <div>
                    {porcentaje(total.porcentaje)}
                    <small>Cobertura global</small>
                  </div>
                ),
                ...(editar ? [""] : []),
              ]
            : undefined
        }
      />
    </div>
  );
}

export default function ListadoStock({
  productos,
  online,
  ajustar,
  editar,
  registrar,
  exportar,
  imprimir,
}: {
  productos: ProductoOperativo[];
  online: boolean;
  ajustar: () => void;
  editar: (p: ProductoOperativo) => void;
  registrar: () => void;
  exportar: (pallets: boolean) => void;
  imprimir: (
    productos: ProductoOperativo[],
    pallets: boolean,
    filtros: FiltrosStock,
  ) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosStock>(vacios);
  const [pallets, setPallets] = useState(false);
  const list = filtrarStock(productos, filtros);
  return (
    <>
      <div className="eo-stock-actions">
        <button type="button" disabled={!online} onClick={ajustar}>
          Ajustar stock físico
        </button>
        <button
          type="button"
          title="Exportar todos los productos activos"
          onClick={() => exportar(pallets)}
        >
          Exportar CSV
        </button>
        <button
          type="button"
          className="eo-primary"
          onClick={() => imprimir(list, pallets, filtros)}
        >
          Imprimir
        </button>
      </div>
      <div
        className="eo-orders-filters eo-stock-filters"
        role="group"
        aria-label="Filtros de stock"
      >
        <label>
          Buscar producto
          <input
            type="search"
            aria-label="Buscar producto"
            placeholder="Código, alias o nombre"
            value={filtros.busqueda}
            onChange={(e) =>
              setFiltros((v) => ({ ...v, busqueda: e.target.value }))
            }
          />
        </label>
        <label>
          Estado
          <select
            aria-label="Estado"
            value={filtros.estado}
            onChange={(e) =>
              setFiltros((v) => ({
                ...v,
                estado: e.target.value as EstadoStock,
              }))
            }
          >
            <option value="">Todos</option>
            <option>Disponible</option>
            <option>Insuficiente</option>
            <option>Sin pendientes</option>
          </select>
        </label>
        <button type="button" onClick={() => setFiltros(vacios)}>
          Limpiar
        </button>
        <button
          type="button"
          className="eo-primary eo-stock-mode"
          aria-pressed={pallets}
          onClick={() => setPallets(!pallets)}
        >
          Ver en {pallets ? "fardos" : "pallets"}
        </button>
      </div>
      <ReporteStock
        productos={list}
        pallets={pallets}
        editar={editar}
        online={online}
      />
      <div className="eo-orders-footer">
        <span>
          {list.length} productos · Totales en fardos equivalentes. La
          producción sin codificar no se puede despachar.
        </span>
        <button type="button" disabled={!online} onClick={registrar}>
          Registrar movimiento
        </button>
      </div>
    </>
  );
}
