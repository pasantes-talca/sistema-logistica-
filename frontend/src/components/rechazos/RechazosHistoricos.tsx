import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  obtenerAnexosRechazos,
  obtenerCopiaRechazos,
  obtenerRegistrosRechazos,
  type ImportacionRechazos,
  type RechazoHistorico,
} from "../../api/rechazosHistoricos";
import { TablaOriginal } from "../historicos/TablaOriginal";
import { csv, descargar } from "../historicos/archivoOriginal";
import "../repartos/RecargasHistoricas.css";
const headers = [
  "Marca temporal",
  "Fecha",
  "Asignación",
  "Punto de venta",
  "Bultos ",
  "Motivo de NO entrega ",
  "Observación",
  "Columna 7",
];
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function Anexos({ id }: { id: number }) {
  const query = useQuery({
    queryKey: ["rechazos-historicos-anexos", id],
    queryFn: () => obtenerAnexosRechazos(id),
  });
  const [nombre, setNombre] = useState("");
  const anexo = query.data?.find((s) => s.nombre === nombre) || query.data?.[0];
  return (
    <>
      <p>
        Copias originales de las hojas auxiliares. No se convierten en rechazos
        adicionales ni se recalculan sus porcentajes.
      </p>
      {query.isPending && <p role="status">Cargando anexos…</p>}
      {query.isError && (
        <p role="alert" className="hr-error">
          {query.error.message}
        </p>
      )}
      {anexo && (
        <>
          <div className="hr-filtros">
            <label>
              Hoja original
              <select
                value={anexo.nombre}
                onChange={(e) => setNombre(e.target.value)}
              >
                {query.data?.map((s) => (
                  <option key={s.nombre}>{s.nombre}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => csv("rechazos-anexo-original", anexo.filas)}
            >
              Exportar anexo CSV
            </button>
          </div>
          <h3>{anexo.nombre}</h3>
          {anexo.oculta && (
            <p>
              Esta hoja estaba oculta en el origen. Se conserva únicamente como
              referencia.
            </p>
          )}
          {anexo.filas.length ? (
            <TablaOriginal filas={anexo.filas} />
          ) : (
            <p>La hoja original no tiene celdas cargadas.</p>
          )}
        </>
      )}
    </>
  );
}
function EstadisticasOriginales({ filas }: { filas: RechazoHistorico[] }) {
  const motivos = new Map<string, number>();
  for (const r of filas)
    motivos.set(r.motivo, (motivos.get(r.motivo) || 0) + 1);
  return (
    <>
      <p>
        Conteo de los registros históricos filtrados. Los motivos mantienen su
        texto original; no se fusionan descripciones. No se suman bultos con
        unidades distintas.
      </p>
      <div className="tabla-wrapper">
        <table className="tabla-repartos">
          <thead>
            <tr>
              <th>Motivo original</th>
              <th>Rechazos</th>
              <th>Porcentaje de los registros filtrados</th>
            </tr>
          </thead>
          <tbody>
            {[...motivos]
              .sort((a, b) => b[1] - a[1])
              .map(([motivo, n]) => (
                <tr key={motivo}>
                  <td>{motivo || "Sin motivo informado"}</td>
                  <td>{n}</td>
                  <td>
                    {((n / filas.length) * 100).toLocaleString("es-AR", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </td>
                </tr>
              ))}
            {!filas.length && (
              <tr>
                <td colSpan={3}>
                  No hay rechazos con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p>
        El resumen guardado de “Porcentaje de rechazos” se encuentra en Anexos
        originales; no se reemplaza por este conteo.
      </p>
    </>
  );
}
function Contenido({
  lote,
  inicial,
}: {
  lote: ImportacionRechazos;
  inicial: "registros" | "estadisticas";
}) {
  const query = useQuery({
    queryKey: ["rechazos-historicos-registros", lote.id],
    queryFn: () => obtenerRegistrosRechazos(lote.id),
  });
  const [vista, setVista] = useState<"registros" | "estadisticas" | "anexos">(
    inicial,
  );
  const [buscar, setBuscar] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendientes, setPendientes] = useState(false);
  const [incluirSinFecha, setIncluirSinFecha] = useState(false);
  const rows = (query.data || []).filter((r) => {
    if (
      buscar &&
      !normalizar(
        r.celdas_originales.map((v) => String(v ?? "")).join(" "),
      ).includes(normalizar(buscar))
    )
      return false;
    if (motivo && r.motivo !== motivo) return false;
    if (pendientes && !r.incidencias.length) return false;
    if ((desde || hasta) && !r.fecha) return incluirSinFecha;
    return (
      (!desde || (r.fecha !== null && r.fecha >= desde)) &&
      (!hasta || (r.fecha !== null && r.fecha <= hasta))
    );
  });
  const limpiar = () => {
    setBuscar("");
    setDesde("");
    setHasta("");
    setMotivo("");
    setPendientes(false);
    setIncluirSinFecha(false);
  };
  return (
    <>
      <nav className="hr-vistas" aria-label="Contenido histórico de rechazos">
        {(
          [
            ["registros", "Rechazos originales"],
            ["estadisticas", "Estadísticas del histórico"],
            ["anexos", "Anexos originales"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={vista === key}
            onClick={() => setVista(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {vista === "anexos" ? (
        <Anexos id={lote.id} />
      ) : (
        <>
          <div className="hr-filtros">
            <label>
              Buscar en rechazos originales
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Asignación, punto de venta, motivo u observación"
              />
            </label>
            <label>
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>
            <label>
              Motivo original
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              >
                <option value="">Todos</option>
                {[...new Set((query.data || []).map((r) => r.motivo))]
                  .sort()
                  .map((m) => (
                    <option key={m} value={m}>
                      {m || "Sin motivo"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="hr-check">
              <input
                type="checkbox"
                checked={pendientes}
                onChange={(e) => setPendientes(e.target.checked)}
              />
              Sólo filas para revisar
            </label>
            <label className="hr-check">
              <input
                type="checkbox"
                checked={incluirSinFecha}
                onChange={(e) => setIncluirSinFecha(e.target.checked)}
              />
              Incluir fechas pendientes al filtrar
            </label>
            <button type="button" onClick={limpiar}>
              Limpiar filtros
            </button>
            <button
              type="button"
              disabled={!query.data}
              onClick={() =>
                csv("rechazos-originales", [
                  headers,
                  ...rows.map((r) =>
                    headers.map((_, i) => r.celdas_originales[i] ?? null),
                  ),
                ])
              }
            >
              Exportar originales CSV
            </button>
          </div>
          {query.isPending && (
            <p role="status">Cargando rechazos originales…</p>
          )}
          {query.isError && (
            <p role="alert" className="hr-error">
              {query.error.message}
            </p>
          )}
          {query.data && (
            <>
              <p>
                {rows.length} de {query.data.length} rechazos ·{" "}
                {rows.filter((r) => !r.fecha).length} con fecha pendiente en
                esta selección. La marca temporal no reemplaza la fecha de
                rechazo.
              </p>
              {(desde || hasta) && incluirSinFecha && (
                <p className="hr-aviso">
                  La selección incluye registros sin fecha confirmada; no se
                  consideran fechados dentro del período.
                </p>
              )}
              {vista === "estadisticas" ? (
                <EstadisticasOriginales filas={rows} />
              ) : (
                <div className="tabla-wrapper hr-registros">
                  <table className="tabla-repartos">
                    <thead>
                      <tr>
                        {["Fila", ...headers, "Revisión"].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.fila}>
                          <td>{r.fila}</td>
                          {headers.map((_, i) => (
                            <td key={i}>
                              {String(r.celdas_originales[i] ?? "")}
                            </td>
                          ))}
                          <td>
                            {r.incidencias.length ? (
                              <details>
                                <summary>Revisar fecha</summary>
                                <ul>
                                  {r.incidencias.map((i) => (
                                    <li key={i}>{i}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : (
                              "Sin advertencias"
                            )}
                          </td>
                        </tr>
                      ))}
                      {!rows.length && (
                        <tr>
                          <td colSpan={10}>
                            No hay registros con estos filtros.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
export default function RechazosHistoricos({
  lotes,
  inicial = "registros",
}: {
  lotes: ImportacionRechazos[];
  inicial?: "registros" | "estadisticas";
}) {
  const [id, setId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lote = lotes.find((l) => l.id === id) || lotes[0];
  if (!lote)
    return (
      <div className="estado-vacio">
        Todavía no hay una planilla histórica importada.
      </div>
    );
  return (
    <section
      className="hr-historico hr-rechazos"
      aria-label="Histórico de rechazos"
    >
      <div className="hr-aviso">
        <strong>Rechazos históricos · Sólo lectura</strong>
        <p>
          Se conservan fechas, marcas temporales, bultos, motivos y
          observaciones originales. No se corrigen automáticamente ni se
          duplican como rechazos operativos.
        </p>
      </div>
      <div className="hr-filtros">
        <label>
          Planilla importada
          <select
            value={lote.id}
            onChange={(e) => setId(Number(e.target.value))}
          >
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              descargar(
                "rechazos-historico-original.json",
                JSON.stringify(await obtenerCopiaRechazos(lote.id), null, 2),
                "application/json",
              );
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "No se pudo descargar la copia.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Descargar copia completa JSON
        </button>
      </div>
      {error && (
        <p role="alert" className="hr-error">
          {error}
        </p>
      )}
      <div className="hr-indicadores">
        <span>
          <strong>{lote.revision.registros}</strong> rechazos originales
        </span>
        <span>
          <strong>{lote.revision.fechas_para_revisar}</strong> fecha pendiente
        </span>
        <span>
          <strong>{lote.revision.anexos}</strong> anexos originales
        </span>
      </div>
      <Contenido key={lote.id} lote={lote} inicial={inicial} />
      <p className="hr-procedencia">
        Importado el {new Date(lote.creado_en).toLocaleString("es-AR")} ·{" "}
        <a
          href={`https://docs.google.com/spreadsheets/d/${lote.origen_id}/edit`}
          target="_blank"
          rel="noreferrer"
        >
          Ver planilla de origen
        </a>{" "}
        · Huella: <code>{lote.huella}</code>
      </p>
    </section>
  );
}
