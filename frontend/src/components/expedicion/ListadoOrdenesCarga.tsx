import { useState, type SetStateAction } from "react";
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
  hayFiltrosDespacho,
  totalizarProductosOrdenes,
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
  "Fecha despacho",
  "Fletero",
  "Tipo",
  "Encargado despacho",
  "Turno despacho",
  "Estado",
  "Solicitado (orden)",
  "Despachado",
  "Acciones",
];
const fardos = (value: number | null) =>
  value === null ? "Sin equivalencia" : `${fmt(value)} fardos`;

export function ReporteOrdenesCarga({
  ordenes,
  productos,
  imprimible = false,
  filtros,
  seleccionados,
  seleccionar,
}: {
  ordenes: OrdenOperativa[];
  productos: ProductoOperativo[];
  imprimible?: boolean;
  filtros?: FiltrosOrdenes;
  seleccionados?: number[];
  seleccionar?: (id: number) => void;
}) {
  return (
    <div className={`eo-orders-table${imprimible ? " eo-orders-print" : ""}`}>
      <Table
        headers={imprimible ? columnas.slice(0, -1) : columnas}
        rows={ordenes.map((o) => {
          const resumen = resumenOrden(o, productos, filtros);
          const cells = [
            <label className="eo-order-select">
              {!imprimible && seleccionar && (
                <input
                  type="checkbox"
                  aria-label={`Seleccionar orden ${o.numero}`}
                  checked={seleccionados?.includes(o.id) || false}
                  onChange={() => seleccionar(o.id)}
                  disabled={o.anulada}
                />
              )}
              <b>{o.numero}</b>
            </label>,
            <span title={`Fecha de carga: ${o.fecha}`}>{resumen.fecha}</span>,
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

const cantidadProducto = (unidades: number, pack: number | null) => {
  if (!pack) return `${fmt(unidades)} un. · Sin equivalencia`;
  const absoluto = Math.abs(unidades),
    fardos = Math.floor(absoluto / pack),
    sueltas = absoluto % pack;
  return `${unidades < 0 ? "−" : ""}${fardos} fardos${sueltas ? ` + ${fmt(sueltas)} un.` : ""}`;
};

export function TotalesProductosOrdenes({
  ordenes,
  productos,
  filtros,
}: {
  ordenes: OrdenOperativa[];
  productos: ProductoOperativo[];
  filtros?: FiltrosOrdenes;
}) {
  const despacho = hayFiltrosDespacho(filtros);
  const totales = totalizarProductosOrdenes(ordenes, productos, filtros).filter(
    (p) => !despacho || p.despachado !== 0,
  );
  return (
    <section className="eo-orders-product-totals">
      <h3>Totales por producto</h3>
      <p>
        {despacho
          ? "Solo mercadería despachada en las entregas que coinciden con el día, período, encargado y turno elegidos."
          : "Solicitado: orden completa. Despachado: entregas registradas. Las sustituciones se suman al producto que realmente salió."}
      </p>
      {ordenes.some((o) => o.anulada) && (
        <p>Las órdenes anuladas no participan en los totales.</p>
      )}
      <Table
        headers={[
          "Código",
          "Producto",
          ...(!despacho ? ["Solicitado (orden completa)"] : []),
          "Despachado",
          "Unidades despachadas",
        ]}
        rows={totales.map((p) => [
          p.codigo,
          p.nombre,
          ...(!despacho
            ? [cantidadProducto(p.solicitado, p.unidades_pack)]
            : []),
          cantidadProducto(p.despachado, p.unidades_pack),
          fmt(p.despachado),
        ])}
        emptyMessage="No hay productos despachados para esta selección y estos filtros."
      />
    </section>
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
  const [filtros, setEstadoFiltros] = useState<FiltrosOrdenes>(vacios);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  function setFiltros(valor: SetStateAction<FiltrosOrdenes>) {
    setSeleccionados([]);
    setEstadoFiltros(valor);
  }
  const [avanzados, setAvanzados] = useState(false);
  const list = filtrarOrdenes(data.ordenes, filtros);
  const elegidas = list.filter(
    (o) => seleccionados.includes(o.id) && !o.anulada,
  );
  const seleccionables = list.filter((o) => !o.anulada);
  const encargados = [
    ...new Set(
      data.ordenes.flatMap((o) => o.entregas.map((e) => e.creado_por_nombre)),
    ),
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
          Día de despacho
          <input
            aria-label="Día"
            type="date"
            value={filtros.dia}
            onChange={(e) => setFiltros((v) => ({ ...v, dia: e.target.value }))}
          />
        </label>
        <label>
          Encargado del despacho
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
          Turno del despacho
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
            disabled={!list.length}
            title="Imprimir todas las órdenes visibles y sus totales"
            onClick={() => imprimir(list, filtros)}
          >
            Imprimir listado
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
      <p className="eo-help">
        Día, período, encargado y turno corresponden al despacho, no a la carga
        de la orden. Si elegís estos filtros, se muestran y totalizan únicamente
        las entregas coincidentes. Sin esos filtros también podés ver las
        órdenes sin despachar.
      </p>
      <div
        className="eo-orders-selection"
        role="group"
        aria-label="Impresión conjunta de órdenes"
      >
        <label>
          <input
            type="checkbox"
            aria-label="Seleccionar todas las órdenes visibles"
            disabled={!seleccionables.length}
            checked={
              !!seleccionables.length &&
              elegidas.length === seleccionables.length
            }
            ref={(el) => {
              if (el)
                el.indeterminate =
                  elegidas.length > 0 &&
                  elegidas.length < seleccionables.length;
            }}
            onChange={(e) =>
              setSeleccionados(
                e.target.checked ? seleccionables.map((o) => o.id) : [],
              )
            }
          />
          Seleccionar todas las visibles
        </label>
        <span role="status">
          {elegidas.length}{" "}
          {elegidas.length === 1
            ? "orden seleccionada"
            : "órdenes seleccionadas"}
        </span>
        <button
          type="button"
          onClick={() => setSeleccionados([])}
          disabled={!elegidas.length}
        >
          Quitar selección
        </button>
        <button
          type="button"
          className="eo-primary"
          disabled={!elegidas.length}
          onClick={() => imprimir(elegidas, filtros)}
        >
          Imprimir seleccionadas ({elegidas.length})
        </button>
      </div>
      <ReporteOrdenesCarga
        ordenes={list}
        productos={data.productos}
        filtros={filtros}
        seleccionados={elegidas.map((o) => o.id)}
        seleccionar={(id) =>
          setSeleccionados((ids) =>
            ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
          )
        }
      />
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
                const r = resumenOrden(o, data.productos, filtros);
                return [
                  o.numero,
                  r.fecha,
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
