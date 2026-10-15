import { useEffect, useRef, useState } from "react";
import type { ConteoOperativo } from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import { fmt } from "./format";
import {
  cantidadDiferencias,
  filtrarConteos,
  puedeCorroborar,
  ultimoRelevoPendiente,
  type FiltrosConteos,
} from "./conteos";

const vacios: FiltrosConteos = {
  desde: "",
  hasta: "",
  turno: "",
  busqueda: "",
};
const columnas = [
  "Fecha",
  "Turno",
  "Tipo",
  "Encargado",
  "Diferencias",
  "Estado",
];
export function ReporteConteos({
  conteos,
  seleccionar,
}: {
  conteos: ConteoOperativo[];
  seleccionar?: (id: number) => void;
}) {
  return (
    <div className="eo-orders-table eo-counts-table">
      <Table
        headers={[...columnas, ...(seleccionar ? ["Acciones"] : [])]}
        emptyMessage="No hay conteos con los filtros seleccionados."
        rows={conteos.map((c) => {
          const n = cantidadDiferencias(c);
          return [
            new Date(c.fecha).toLocaleString("es-AR"),
            c.turno || "—",
            c.tipo,
            c.usuario || "—",
            <span
              className={n ? "eo-badge eo-count-difference" : ""}
              title="Cantidad de productos con una diferencia distinta de cero"
            >
              {n}
            </span>,
            <span
              className={`eo-badge ${c.corroborado_en ? "eo-count-confirmed" : "eo-count-pending"}`}
            >
              {c.corroborado_en ? "Corroborado" : "Pendiente de corroboración"}
            </span>,
            ...(seleccionar
              ? [
                  <button type="button" onClick={() => seleccionar(c.id)}>
                    Ver detalle
                  </button>,
                ]
              : []),
          ];
        })}
      />
    </div>
  );
}
export function DetalleConteo({ conteo }: { conteo: ConteoOperativo }) {
  return (
    <>
      <p>
        {new Date(conteo.fecha).toLocaleString("es-AR")} · {conteo.usuario} ·
        Turno {conteo.turno}
      </p>
      <Table
        headers={[
          "Código",
          "Producto",
          "Sistema (un.)",
          "Físico (un.)",
          "Diferencia (un.)",
        ]}
        rows={[...conteo.lineas]
          .sort((a, b) =>
            a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
          )
          .map((l) => [
            l.codigo,
            l.nombre,
            fmt(l.sistema),
            fmt(l.fisico),
            <b className={l.diferencia ? "eo-count-difference" : ""}>
              {l.diferencia > 0 ? "+" : ""}
              {fmt(l.diferencia)}
            </b>,
          ])}
      />
      {conteo.observaciones && (
        <p>
          <b>Observaciones:</b> {conteo.observaciones}
        </p>
      )}
      <p>
        {conteo.corroborado_en
          ? `Corroborado por ${conteo.corroborado_por || "responsable no informado"} · ${new Date(conteo.corroborado_en).toLocaleString("es-AR")}`
          : "Pendiente de corroboración"}
      </p>
    </>
  );
}
export default function ListadoConteos({
  conteos,
  turno,
  online,
  nuevo,
  corroborar,
  imprimir,
  imprimirDetalle,
}: {
  conteos: ConteoOperativo[];
  turno: string;
  online: boolean;
  nuevo: () => void;
  corroborar: (c: ConteoOperativo) => void;
  imprimir: (conteos: ConteoOperativo[], filtros: FiltrosConteos) => void;
  imprimirDetalle: (c: ConteoOperativo) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosConteos>(vacios);
  const [avanzados, setAvanzados] = useState(false);
  const [selected, setSelected] = useState(0);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected)
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);
  const list = filtrarConteos(conteos, filtros);
  const c = conteos.find((c) => c.id === selected);
  const pendiente = ultimoRelevoPendiente(conteos, turno);
  return (
    <>
      <button
        type="button"
        className="eo-primary eo-orders-new"
        disabled={!online}
        onClick={nuevo}
      >
        Nuevo conteo
      </button>
      {pendiente && (
        <div className="eo-count-handover eo-notice" role="status">
          <div>
            <b>Relevo pendiente</b>
            <span>
              {pendiente.usuario || "El responsable anterior"} cerró el turno{" "}
              {pendiente.turno} con {cantidadDiferencias(pendiente)}{" "}
              diferencias. Revisá el detalle antes de corroborar.
            </span>
          </div>
          <button type="button" onClick={() => setSelected(pendiente.id)}>
            Ver detalle
          </button>
          <button
            type="button"
            className="eo-primary"
            disabled={!online}
            onClick={() => corroborar(pendiente)}
          >
            Corroborar recepción
          </button>
        </div>
      )}
      {avanzados && (
        <div
          className="eo-orders-extra-filters eo-count-filters"
          role="group"
          aria-label="Filtros de conteos"
        >
          <label>
            Buscar
            <input
              value={filtros.busqueda}
              placeholder="Encargado, tipo, producto u observaciones"
              onChange={(e) =>
                setFiltros((v) => ({ ...v, busqueda: e.target.value }))
              }
            />
          </label>
          <label>
            Desde
            <input
              type="date"
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
              value={filtros.hasta}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, hasta: e.target.value }))
              }
            />
          </label>
          <label>
            Turno
            <select
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
          <button type="button" onClick={() => setFiltros(vacios)}>
            Limpiar
          </button>
        </div>
      )}
      <ReporteConteos conteos={list} seleccionar={setSelected} />
      <div className="eo-orders-footer">
        <span>
          {list.length} conteos · Diferencias = productos con desvíos. El conteo
          no ajusta el stock físico.
        </span>
        <div className="eo-orders-filter-actions">
          <button
            type="button"
            aria-expanded={avanzados}
            onClick={() => setAvanzados(!avanzados)}
          >
            {avanzados ? "Ocultar filtros" : "Filtros adicionales"}
            {!avanzados && Object.values(filtros).some(Boolean)
              ? " · activos"
              : ""}
          </button>
          <button type="button" onClick={() => imprimir(list, filtros)}>
            Imprimir listado
          </button>
        </div>
      </div>
      {c && (
        <section
          className="eo-count-detail"
          ref={detailRef}
          aria-label="Detalle del conteo"
        >
          <div className="eo-section-title">
            <h2>
              {c.tipo} · {c.turno}
            </h2>
            <button type="button" onClick={() => setSelected(0)}>
              Cerrar detalle
            </button>
          </div>
          <DetalleConteo conteo={c} />
          <div className="eo-actions">
            <button type="button" onClick={() => imprimirDetalle(c)}>
              Imprimir detalle
            </button>
            {puedeCorroborar(c, turno) && (
              <button
                type="button"
                className="eo-primary"
                disabled={!online}
                onClick={() => corroborar(c)}
              >
                Corroborar recepción
              </button>
            )}
          </div>
        </section>
      )}
    </>
  );
}
