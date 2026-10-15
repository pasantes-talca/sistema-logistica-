import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  obtenerRecibosHistoricos,
  obtenerResumenesCambios,
  obtenerAnexosCambios,
  obtenerCopiaCambios,
  type ImportacionCambios,
  type ReciboHistoricoCambio,
} from "../../api/cambiosHistoricos";
import { TablaOriginal } from "../historicos/TablaOriginal";
import { csv, descargar } from "../historicos/archivoOriginal";
import "../repartos/RecargasHistoricas.css";
import "./CambiosHistoricos.css";

const normalizar = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
type Vista = "recibos" | "resumenes" | "plantilla";

function Detalle({
  recibo,
  cerrar,
}: {
  recibo: ReciboHistoricoCambio;
  cerrar: () => void;
}) {
  return (
    <section className="hc-detalle" aria-label="Detalle del recibo histórico">
      <div className="hr-vistas">
        <button type="button" onClick={cerrar}>
          Volver al listado
        </button>
        <button type="button" onClick={() => window.print()}>
          Imprimir recibo
        </button>
        <button
          type="button"
          onClick={() =>
            csv(`recibo-${recibo.sheet_id}`, recibo.filas_originales)
          }
        >
          Exportar recibo CSV
        </button>
      </div>
      <div className="hc-print hc-recibo">
        <div className="hc-recibo-head">
          <div>
            <span className="hc-eyebrow">
              LOGÍSTICA TALCA · ARCHIVO HISTÓRICO
            </span>
            <h2>Recibo de cambios</h2>
          </div>
          <span className="hc-solo-lectura">Original importado</span>
        </div>
        <div className="hc-datos">
          <p>
            <span>Fecha original</span>
            <strong>{recibo.fecha_original || "Sin fecha"}</strong>
          </p>
          <p>
            <span>Concesionario</span>
            <strong>{recibo.concesionario || "Sin identificar"}</strong>
          </p>
        </div>
        <p className="hc-nota">
          Cantidades y presentaciones literales de la planilla. Un campo vacío
          no equivale a cero.
        </p>
        {recibo.incidencias.map((w) => (
          <p role="alert" className="hr-error" key={w}>
            {w}
          </p>
        ))}
        <div className="tabla-wrapper hc-productos">
          <table className="tabla-repartos">
            <thead>
              <tr>
                <th>Código</th>
                <th>Presentación original</th>
                <th>Sabor</th>
                <th>Cantidad original</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {recibo.productos.map((p) => (
                <tr key={p.fila}>
                  <td>{p.codigo}</td>
                  <td>{p.presentacion}</td>
                  <td>{p.sabor}</td>
                  <td className="hc-cantidad">{p.cantidad || "—"}</td>
                  <td>{p.observacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Materiales</h3>
        <div className="hc-materiales">
          {recibo.materiales.map((m) => (
            <div key={m.fila}>
              <span>{m.nombre || `Fila ${m.fila}`}</span>
              <strong>{m.cantidad || "—"}</strong>
              {m.observacion && <p>{m.observacion}</p>}
            </div>
          ))}
        </div>
        <p className="hc-nota">
          Hoja de origen: {recibo.nombre_hoja}. No es una nueva operación ni una
          copia recalculada.
        </p>
      </div>
      <details className="hc-original">
        <summary>Ver todas las celdas originales del recibo</summary>
        <TablaOriginal filas={recibo.filas_originales} />
      </details>
    </section>
  );
}

function HojasAuxiliares({
  id,
  vista,
}: {
  id: number;
  vista: "resumenes" | "plantilla";
}) {
  const query = useQuery({
    queryKey: ["cambios-historicos-hojas", id, vista],
    queryFn: () =>
      vista === "resumenes"
        ? obtenerResumenesCambios(id)
        : obtenerAnexosCambios(id),
  });
  const [elegida, setElegida] = useState("");
  const hoja = query.data?.find((s) => s.nombre === elegida) || query.data?.[0];
  return (
    <>
      <p>
        {vista === "resumenes"
          ? "Resumen original generado en Google Sheets. Se conservan sus fechas de generación, agrupaciones y totales; no se recalcula con recibos posteriores."
          : "Plantilla original conservada como referencia. No se cuenta como recibo."}
      </p>
      {query.isPending && <p role="status">Cargando hojas originales…</p>}
      {query.isError && (
        <p role="alert" className="hr-error">
          {query.error.message}
        </p>
      )}
      {query.data?.length === 0 && (
        <p>No hay hojas de este tipo en la copia importada.</p>
      )}
      {hoja && (
        <>
          <div className="hr-filtros">
            <label>
              Hoja original
              <select
                value={hoja.nombre}
                onChange={(e) => setElegida(e.target.value)}
              >
                {query.data?.map((s) => (
                  <option key={s.sheet_id}>{s.nombre}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => csv(`cambios-hoja-${hoja.sheet_id}`, hoja.filas)}
            >
              Exportar hoja CSV
            </button>
            <button type="button" onClick={() => window.print()}>
              Imprimir hoja
            </button>
          </div>
          <div className="hc-print hc-hoja-original">
            <h2>{hoja.nombre}</h2>
            {hoja.filas.length ? (
              <TablaOriginal filas={hoja.filas} />
            ) : (
              <p>La hoja original está vacía.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Contenido({
  lote,
  inicial,
}: {
  lote: ImportacionCambios;
  inicial: Vista;
}) {
  const [vista, setVista] = useState<Vista>(inicial);
  const [buscar, setBuscar] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [concesionario, setConcesionario] = useState("");
  const [detalle, setDetalle] = useState<number | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState("");
  const query = useQuery({
    queryKey: ["cambios-historicos-recibos", lote.id],
    queryFn: () => obtenerRecibosHistoricos(lote.id),
  });
  const filas = query.data || [];
  const filtrados = filas.filter(
    (r) =>
      (!desde || (!!r.fecha && r.fecha >= desde)) &&
      (!hasta || (!!r.fecha && r.fecha <= hasta)) &&
      (!concesionario || r.concesionario === concesionario) &&
      (!buscar ||
        normalizar(
          [
            r.nombre_hoja,
            ...r.productos.map(
              (p) => `${p.codigo} ${p.sabor} ${p.observacion}`,
            ),
            ...r.materiales.map((m) => m.observacion),
          ].join(" "),
        ).includes(normalizar(buscar))),
  );
  const recibo = filas.find((r) => r.sheet_id === detalle);
  async function descargarCopia() {
    setDescargando(true);
    setErrorDescarga("");
    try {
      const source = await obtenerCopiaCambios(lote.id);
      descargar(
        "recibos-cambios-originales.json",
        JSON.stringify(source, null, 2),
        "application/json;charset=utf-8",
      );
    } catch (error) {
      setErrorDescarga(
        error instanceof Error
          ? error.message
          : "No se pudo descargar la copia.",
      );
    } finally {
      setDescargando(false);
    }
  }
  return (
    <>
      <div className="hr-vistas">
        <button type="button" disabled={descargando} onClick={descargarCopia}>
          {descargando ? "Descargando…" : "Descargar copia completa JSON"}
        </button>
      </div>
      {errorDescarga && (
        <p role="alert" className="hr-error">
          {errorDescarga}
        </p>
      )}
      <div className="hr-indicadores">
        <span>
          <strong>{lote.revision.recibos}</strong>recibos originales
        </span>
        <span>
          <strong>{lote.revision.resumenes}</strong>resumen original
        </span>
        <span>
          <strong>{lote.revision.recibos_para_revisar}</strong>recibos para
          revisar
        </span>
      </div>
      <nav
        className="hr-vistas"
        aria-label="Contenido del histórico de cambios"
      >
        {(
          [
            ["recibos", "Recibos originales"],
            ["resumenes", "Resumen generado original"],
            ["plantilla", "Plantilla original"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={vista === key}
            onClick={() => {
              setVista(key);
              setDetalle(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {vista !== "recibos" ? (
        <HojasAuxiliares
          key={`${lote.id}-${vista}`}
          id={lote.id}
          vista={vista}
        />
      ) : (
        <>
          {query.isPending && <p role="status">Cargando recibos originales…</p>}
          {query.isError && (
            <p role="alert" className="hr-error">
              {query.error.message}
            </p>
          )}
          {recibo ? (
            <Detalle recibo={recibo} cerrar={() => setDetalle(null)} />
          ) : (
            <>
              <div className="hr-filtros">
                <label>
                  Buscar recibo o producto
                  <input
                    value={buscar}
                    onChange={(e) => setBuscar(e.target.value)}
                    placeholder="Concesionario, código o sabor"
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
                  Concesionario original
                  <select
                    aria-label="Concesionario original"
                    value={concesionario}
                    onChange={(e) => setConcesionario(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {[...new Set(filas.map((r) => r.concesionario))]
                      .sort()
                      .map((n) => (
                        <option key={n} value={n}>
                          {n || "Sin identificar"}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBuscar("");
                    setDesde("");
                    setHasta("");
                    setConcesionario("");
                  }}
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  onClick={() =>
                    csv("recibos-cambios-indice", [
                      [
                        "Hoja original",
                        "Fecha original",
                        "Concesionario",
                        "Productos cargados",
                        "Pallets",
                        "Pallets descargados",
                        "Prensados",
                      ],
                      ...filtrados.map((r) => [
                        r.nombre_hoja,
                        r.fecha_original,
                        r.concesionario,
                        r.productos_cargados,
                        ...r.materiales.map((m) => m.cantidad),
                      ]),
                    ])
                  }
                >
                  Exportar listado CSV
                </button>
              </div>
              {desde && hasta && desde > hasta && (
                <p role="alert" className="hr-error">
                  La fecha desde debe ser anterior o igual a la fecha hasta.
                </p>
              )}
              <p>
                {filtrados.length} de {filas.length} recibos. Los nombres y
                cantidades mantienen su escritura original.
              </p>
              <div className="tabla-wrapper hc-listado">
                <table className="tabla-repartos">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concesionario</th>
                      <th>Productos cargados</th>
                      <th>Pallets</th>
                      <th>Pallets descargados</th>
                      <th>Prensados</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((r) => (
                      <tr key={r.sheet_id}>
                        <td>{r.fecha_original || "Sin fecha"}</td>
                        <td>{r.concesionario}</td>
                        <td>{r.productos_cargados}</td>
                        {r.materiales.map((m) => (
                          <td key={m.fila}>{m.cantidad || "—"}</td>
                        ))}
                        <td>
                          <button
                            type="button"
                            aria-label={`Ver recibo ${r.nombre_hoja}`}
                            onClick={() => setDetalle(r.sheet_id)}
                          >
                            Ver recibo
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!query.isPending &&
                      !query.isError &&
                      !filtrados.length && (
                        <tr>
                          <td colSpan={7}>No hay recibos con estos filtros.</td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
      <p className="hr-procedencia">
        Importado el{" "}
        {new Date(lote.creado_en).toLocaleString("es-AR", {
          timeZone: "America/Buenos_Aires",
        })}{" "}
        ·{" "}
        <a
          href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(lote.origen_id)}/edit`}
          target="_blank"
          rel="noreferrer"
        >
          Planilla de origen
        </a>{" "}
        · Huella: {lote.huella}
      </p>
    </>
  );
}

export function ResumenCambiosGuardado({
  lotes,
}: {
  lotes: ImportacionCambios[];
}) {
  const [id, setId] = useState<number | null>(null);
  const lote = lotes.find((l) => l.id === id) || lotes[0];
  if (!lote) return <p>No hay resúmenes guardados.</p>;
  return (
    <section
      className="hr-historico hc-historico"
      aria-label="Resumen guardado de cambios"
    >
      <label>
        Planilla
        <select
          aria-label="Planilla del resumen"
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
      <HojasAuxiliares key={lote.id} id={lote.id} vista="resumenes" />
    </section>
  );
}

export default function CambiosHistoricos({
  lotes,
  inicial = "recibos",
}: {
  lotes: ImportacionCambios[];
  inicial?: Vista;
}) {
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const lote = lotes.find((l) => l.id === seleccion) || lotes[0];
  if (!lote)
    return (
      <p className="hr-aviso">
        No hay históricos importados. Los recibos operativos siguen disponibles
        en su pestaña.
      </p>
    );
  return (
    <section
      className="hr-historico hc-historico"
      aria-label="Histórico de recibos de cambios"
    >
      <div className="hr-aviso">
        <strong>Recibos y resumen históricos · Solo lectura</strong>
        <p>
          Se conservan los datos originales sin acumularlos sobre recibos
          operativos ni enviar correos. Las cantidades no se convierten y el
          resumen no se recalcula.
        </p>
      </div>
      <div className="hr-filtros">
        <label>
          Planilla importada
          <select
            value={lote.id}
            onChange={(e) => setSeleccion(Number(e.target.value))}
          >
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Contenido key={`${lote.id}-${inicial}`} lote={lote} inicial={inicial} />
    </section>
  );
}
