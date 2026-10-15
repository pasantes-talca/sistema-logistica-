import { useState } from "react";
import type {
  AuditoriaOperativa,
  ProductoOperativo,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import {
  detalleAuditoria,
  entidadAuditoria,
  filtrarAuditoria,
  usuarioAuditoria,
  type FiltrosAuditoria,
} from "./auditoria";
const vacios: FiltrosAuditoria = {
  busqueda: "",
  desde: "",
  hasta: "",
  turno: "",
  accion: "",
  entidad: "",
};

export function ReporteAuditoria({
  registros,
  productos,
  imprimible = false,
}: {
  registros: AuditoriaOperativa[];
  productos: ProductoOperativo[];
  imprimible?: boolean;
}) {
  return (
    <div className="eo-orders-table eo-audit-table">
      <Table
        headers={[
          "Fecha",
          "Usuario",
          "Acción",
          "Entidad",
          "Referencia",
          "Detalle",
        ]}
        emptyMessage="No hay registros de auditoría con los filtros seleccionados."
        rows={registros.map((a) => {
          const entidad = entidadAuditoria(a);
          return [
            new Date(a.fecha).toLocaleString("es-AR"),
            <span>
              {usuarioAuditoria(a) || "—"}
              {a.turno && <small>{a.turno}</small>}
            </span>,
            a.accion || "—",
            <span
              title={
                entidad.clasificada
                  ? "Categoría clasificada a partir de la acción registrada; no es un campo informado por la API."
                  : "Entidad informada en el registro."
              }
            >
              {entidad.texto}
            </span>,
            a.referencia || "—",
            <div className="eo-audit-description">
              <span>{detalleAuditoria(a, productos)}</span>
              {!imprimible && (
                <details>
                  <summary>Ver antes / después</summary>
                  <p>{detalleAuditoria(a, productos)}</p>
                  <pre>
                    {JSON.stringify(
                      { antes: a.antes, despues: a.despues },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              )}
            </div>,
          ];
        })}
      />
    </div>
  );
}
export default function ListadoAuditoria({
  registros,
  productos,
  exportar,
  imprimir,
}: {
  registros: AuditoriaOperativa[];
  productos: ProductoOperativo[];
  exportar: (registros: AuditoriaOperativa[]) => void;
  imprimir: (
    registros: AuditoriaOperativa[],
    filtros: FiltrosAuditoria,
  ) => void;
}) {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(vacios);
  const [avanzados, setAvanzados] = useState(false);
  const list = filtrarAuditoria(registros, filtros, productos);
  const acciones = [...new Set(registros.map((a) => a.accion))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const entidades = [
    ...new Set(registros.map((a) => entidadAuditoria(a).texto)),
  ]
    .filter((v) => v !== "—")
    .sort((a, b) => a.localeCompare(b, "es"));
  return (
    <>
      <button
        type="button"
        className="eo-orders-new"
        title="Exportar registros filtrados y sus datos de antes/después"
        onClick={() => exportar(list)}
      >
        Exportar CSV
      </button>
      {avanzados && (
        <div
          className="eo-orders-extra-filters eo-audit-filters"
          role="group"
          aria-label="Filtros de auditoría"
        >
          <label>
            Buscar
            <input
              value={filtros.busqueda}
              placeholder="Usuario, referencia, motivo o detalle"
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
          <label>
            Acción
            <select
              aria-label="Acción"
              value={filtros.accion}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, accion: e.target.value }))
              }
            >
              <option value="">Todas</option>
              {acciones.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Entidad
            <select
              aria-label="Entidad"
              value={filtros.entidad}
              onChange={(e) =>
                setFiltros((v) => ({ ...v, entidad: e.target.value }))
              }
            >
              <option value="">Todas</option>
              {entidades.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setFiltros(vacios)}>
            Limpiar
          </button>
        </div>
      )}
      <ReporteAuditoria registros={list} productos={productos} />
      <div className="eo-orders-footer">
        <span>
          {list.length} registros de solo lectura · La entidad se clasifica por
          la acción cuando no está informada.
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
    </>
  );
}
