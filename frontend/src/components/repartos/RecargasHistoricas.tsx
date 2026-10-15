import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  obtenerCopiaHistorica,
  obtenerPadronHistorico,
  obtenerRepartosHistoricos,
  obtenerResumenesHistoricos,
  type LoteHistorico,
  type RepartoHistorico,
} from "../../api/recargasHistoricas";
import "./RecargasHistoricas.css";
import { TablaOriginal } from "../historicos/TablaOriginal";
import { csv, descargar } from "../historicos/archivoOriginal";

const encabezados = [
  "FECHA",
  "PATENTE",
  "ASIGNACION",
  "CHOFER",
  "AYUDANTE 1",
  "AYUDANTE 2",
  "AYUDANTE 3",
  "BULTOS",
  "P.VENTAS",
  "RECARGAS",
  "RECARGA TOTAL",
  "OBSERVACIONES",
];
const normalizar = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
function FilasHistoricas({ lote }: { lote: LoteHistorico }) {
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pendientes, setPendientes] = useState(false);
  const [incluirFechas, setIncluirFechas] = useState(true);
  const [pagina, setPagina] = useState(1);
  const query = useQuery({
    queryKey: ["repartos-historicos-registros", lote.id],
    queryFn: () => obtenerRepartosHistoricos(lote.id),
  });
  const records = (query.data || []).filter((r) => {
    if (pendientes && !r.incidencias.length) return false;
    if (
      busqueda &&
      !normalizar(
        r.celdas_originales.map((v) => String(v ?? "")).join(" "),
      ).includes(normalizar(busqueda))
    )
      return false;
    const fechaPendiente = r.incidencias.some(
      (i) => i.startsWith("Fecha ") || i.startsWith("Año "),
    );
    if ((desde || hasta) && fechaPendiente) return incluirFechas;
    if (desde && (!r.fecha || r.fecha < desde)) return false;
    if (hasta && (!r.fecha || r.fecha > hasta)) return false;
    return true;
  });
  const paginas = Math.max(1, Math.ceil(records.length / 100));
  const actual = Math.min(pagina, paginas);
  const cambiar = (accion: () => void) => {
    accion();
    setPagina(1);
  };
  const visible = records.slice((actual - 1) * 100, actual * 100);
  return (
    <>
      <div className="hr-filtros">
        <label>
          Buscar en originales
          <input
            value={busqueda}
            onChange={(e) => cambiar(() => setBusqueda(e.target.value))}
            placeholder="Nombre, patente, asignación u observaciones"
          />
        </label>
        <label>
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => cambiar(() => setDesde(e.target.value))}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => cambiar(() => setHasta(e.target.value))}
          />
        </label>
        <label className="hr-check">
          <input
            type="checkbox"
            checked={pendientes}
            onChange={(e) => cambiar(() => setPendientes(e.target.checked))}
          />
          Sólo filas para revisar
        </label>
        <label className="hr-check">
          <input
            type="checkbox"
            checked={incluirFechas}
            onChange={(e) => cambiar(() => setIncluirFechas(e.target.checked))}
          />
          Incluir fechas pendientes al filtrar
        </label>
        <button
          type="button"
          onClick={() => {
            setBusqueda("");
            setDesde("");
            setHasta("");
            setPendientes(false);
            setIncluirFechas(true);
            setPagina(1);
          }}
        >
          Limpiar filtros
        </button>
        <button
          type="button"
          disabled={!query.data}
          onClick={() =>
            csv("repartos-originales", [
              encabezados,
              ...records.map((r) =>
                encabezados.map((_, i) => r.celdas_originales[i] ?? null),
              ),
            ])
          }
        >
          Exportar originales CSV
        </button>
      </div>
      {query.isPending && <p role="status">Cargando registros originales…</p>}
      {query.isError && (
        <p role="alert" className="hr-error">
          {query.error.message}
        </p>
      )}
      {query.data && (
        <>
          <p>
            {records.length} de {query.data.length} registros · Página {actual}{" "}
            de {paginas}. Fechas y cantidades se muestran tal como estaban
            cargadas.
          </p>
          <div className="tabla-wrapper hr-registros">
            <table className="tabla-repartos">
              <thead>
                <tr>
                  {["Fila", ...encabezados, "Revisión"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <FilaOriginal key={r.fila} registro={r} />
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={14}>No hay registros con estos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="hr-paginacion">
            <button
              type="button"
              disabled={actual <= 1}
              onClick={() => setPagina(actual - 1)}
            >
              Anterior
            </button>
            <span>
              Página {actual} de {paginas}
            </span>
            <button
              type="button"
              disabled={actual >= paginas}
              onClick={() => setPagina(actual + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </>
  );
}
function FilaOriginal({ registro: r }: { registro: RepartoHistorico }) {
  return (
    <tr>
      <td>{r.fila}</td>
      {encabezados.map((_, i) => (
        <td key={i}>{String(r.celdas_originales[i] ?? "")}</td>
      ))}
      <td>
        {r.incidencias.length ? (
          <details>
            <summary>{r.incidencias.length} advertencias</summary>
            <ul>
              {r.incidencias.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            {r.calculo_actual && (
              <p>
                Referencia del cálculo actual: {r.calculo_actual.recargas} por
                persona, {r.calculo_actual.recargas_totales} en total. No
                reemplaza los valores originales.
              </p>
            )}
          </details>
        ) : (
          "Sin advertencias"
        )}
      </td>
    </tr>
  );
}
function Resumenes({ lote }: { lote: LoteHistorico }) {
  const query = useQuery({
    queryKey: ["repartos-historicos-resumenes", lote.id],
    queryFn: () => obtenerResumenesHistoricos(lote.id),
  });
  const [periodo, setPeriodo] = useState("");
  const selected =
    query.data?.find((r) => r.nombre === periodo) || query.data?.[0];
  return (
    <>
      <p>
        Resúmenes guardados en la planilla, incluidos sus totales y notas. No se
        regeneran desde el detalle ni se suman a los repartos nuevos.
      </p>
      {query.isPending && <p role="status">Cargando resúmenes…</p>}
      {query.isError && (
        <p role="alert" className="hr-error">
          {query.error.message}
        </p>
      )}
      {query.data && !query.data.length && <p>No hay resúmenes guardados.</p>}
      {selected && (
        <>
          <div className="hr-filtros">
            <label>
              Período original
              <select
                value={selected.nombre}
                onChange={(e) => setPeriodo(e.target.value)}
              >
                {query.data?.map((p) => (
                  <option key={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => csv("recargas-resumen-original", selected.filas)}
            >
              Exportar resumen CSV
            </button>
          </div>
          <h3>{selected.nombre}</h3>
          <TablaOriginal filas={selected.filas} />
        </>
      )}
    </>
  );
}
export function ResumenesGuardados({ lotes }: { lotes: LoteHistorico[] }) {
  const [id, setId] = useState<number | null>(null);
  const lote = lotes.find((l) => l.id === id) || lotes[0];
  if (!lote) return <p>No hay resúmenes guardados.</p>;
  return (
    <section className="hr-historico" aria-label="Resúmenes guardados">
      <label>
        Planilla
        <select
          aria-label="Planilla de resúmenes"
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
      <Resumenes key={lote.id} lote={lote} />
    </section>
  );
}

function Padron({ lote }: { lote: LoteHistorico }) {
  const query = useQuery({
    queryKey: ["repartos-historicos-padron", lote.id],
    queryFn: () => obtenerPadronHistorico(lote.id),
  });
  return (
    <>
      <p>
        Padrón de la planilla original. No se inventaron legajos, no se
        fusionaron personas y no se modificó el catálogo de empleados
        operativos.
      </p>
      {query.isPending && <p role="status">Cargando padrón…</p>}
      {query.isError && (
        <p role="alert" className="hr-error">
          {query.error.message}
        </p>
      )}
      {query.data && (
        <>
          <button
            type="button"
            onClick={() => csv("empleados-padron-original", query.data)}
          >
            Exportar padrón CSV
          </button>
          <TablaOriginal filas={query.data} />
        </>
      )}
    </>
  );
}
export default function RecargasHistoricas({
  lotes,
  inicial = "registros",
}: {
  lotes: LoteHistorico[];
  inicial?: "registros" | "resumenes";
}) {
  const [id, setId] = useState(0);
  const [vista, setVista] = useState<"registros" | "resumenes" | "padron">(
    inicial,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lote = lotes.find((l) => l.id === id) || lotes[0];
  if (!lote)
    return (
      <div className="estado-vacio">
        Todavía no hay una planilla histórica importada.
      </div>
    );
  return (
    <section className="hr-historico" aria-label="Histórico de la planilla">
      <div className="hr-aviso">
        <strong>Copia histórica · Sólo lectura</strong>
        <p>
          Las recargas y los textos originales se conservan sin correcciones
          automáticas. Este histórico no se mezcla con los repartos operativos
          ni duplica sus recargas.
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
                "recargas-historico-original.json",
                JSON.stringify(await obtenerCopiaHistorica(lote.id), null, 2),
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
          <strong>{lote.revision.registros}</strong> repartos originales
        </span>
        <span>
          <strong>{lote.revision.resumenes}</strong> resúmenes de períodos
        </span>
        <span>
          <strong>{lote.revision.registros_para_revisar}</strong> filas para
          revisar
        </span>
        <span>
          <strong>{lote.revision.empleados_padron}</strong> empleados en el
          padrón
        </span>
      </div>
      <nav className="hr-vistas" aria-label="Contenido histórico">
        {(
          [
            ["registros", "Repartos originales"],
            ["resumenes", "Recargas por período"],
            ["padron", "Padrón original"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={vista === key}
            onClick={() => setVista(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {vista === "registros" && <FilasHistoricas key={lote.id} lote={lote} />}
      {vista === "resumenes" && <Resumenes key={lote.id} lote={lote} />}
      {vista === "padron" && <Padron key={lote.id} lote={lote} />}
      <p className="hr-procedencia">
        Importado el {new Date(lote.creado_en).toLocaleString("es-AR")} ·{" "}
        <a
          href={`https://docs.google.com/spreadsheets/d/${lote.origen_id}/edit`}
          target="_blank"
          rel="noreferrer"
        >
          Ver planilla de origen
        </a>{" "}
        · Huella de contenido: <code>{lote.huella}</code>
      </p>
    </section>
  );
}
