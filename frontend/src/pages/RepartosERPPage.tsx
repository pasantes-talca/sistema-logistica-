import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  catalogosERP,
  crearUnidadERP,
  importarERP,
  obtenerRepartoERP,
  obtenerRepartosERP,
  operarERP,
  planificarERP,
} from "../api/repartosErp";
import type {
  CatalogosERP,
  CobroERP,
  MedioERP,
  ParadaRepartoERP,
  PuntoERP,
  RecorridoERP,
  RepartoERPDetalle,
  RepartoERPLista,
} from "../types/repartosErp";
import MapaRepartoERP from "../components/MapaRepartoERP";
import "./RepartosERPPage.css";

const dinero = (n: string | number | null | undefined) =>
  n == null
    ? "No informado"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(Number(n));
const numero = (r: RepartoERPLista) =>
  r.nro_comprobante || "Sin número informado";
const mensajeError = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";
const hoy = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
const fechaHora = (value: string) => new Date(value).toLocaleString("es-AR");
function solicitudUUID() {
  // randomUUID requiere HTTPS; el sistema también se usa por HTTP en la intranet.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const ESTADOS: Record<string, string> = {
  entregado: "Entregado",
  no_entregado: "No entregado",
  pendiente: "Pendiente",
};
const JERARQUIAS: Record<number, string> = {
  7: "Mendoza",
  8: "San Juan",
  9: "San Luis",
  10: "Salta",
  309: "Salta PP",
  311: "San Juan PP",
  312: "San Luis PP",
};
const ALMACENES: Record<string, string> = {
  MZA_EXPEDICION: "Mendoza",
  "MZA_MERMAS PP": "Mendoza PP",
  SJ_EXPEDICION: "San Juan",
  SL_EXPEDICION: "San Luis",
  SAL_EXPEDICION: "Salta",
  "SAL_MERMAS PP": "Salta PP",
};
const ORDEN = [
  "Mendoza",
  "Mendoza PP",
  "San Juan",
  "San Juan PP",
  "San Luis",
  "San Luis PP",
  "Salta",
  "Salta PP",
];
function grupo(r: RepartoERPLista) {
  return (
    (r.cod_jerarquia && JERARQUIAS[r.cod_jerarquia]) ||
    ALMACENES[r.almacen] ||
    (r.cod_jerarquia
      ? `Jerarquía ${r.cod_jerarquia}`
      : "Sin jerarquía informada")
  );
}
function Aviso({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`erp-aviso ${error ? "erp-aviso-error" : ""}`}
    >
      {children}
    </div>
  );
}
function Indicadores({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="erp-indicadores">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function RepartosERPPage() {
  const { cod } = useParams();
  return (
    <main className="erp-page">
      {cod ? <Detalle key={cod} cod={Number(cod)} /> : <Listado />}
    </main>
  );
}

function Listado() {
  const [params, setParams] = useSearchParams();
  const fecha = params.get("fecha") || hoy();
  const [busy, setBusy] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const client = useQueryClient();
  const filtros = {
    fecha,
    chofer: params.get("chofer") || "",
    ruta: params.get("ruta") || "",
    almacen: params.get("almacen") || "",
  };
  const q = useQuery({
    queryKey: ["erp-lista", filtros],
    queryFn: ({ signal }) => obtenerRepartosERP(filtros, signal),
    retry: 1,
  });
  const grupos = new Map<string, RepartoERPLista[]>();
  for (const r of q.data?.results || []) {
    const nombre = grupo(r);
    grupos.set(nombre, [...(grupos.get(nombre) || []), r]);
  }
  const nombres = [...grupos.keys()].sort(
    (a, b) =>
      (ORDEN.includes(a) ? ORDEN.indexOf(a) : 99) -
        (ORDEN.includes(b) ? ORDEN.indexOf(b) : 99) || a.localeCompare(b),
  );
  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setParams(Object.fromEntries([...data].map(([k, v]) => [k, String(v)])));
  }
  async function importar(r: RepartoERPLista) {
    setBusy(r.cod_reparto);
    setError("");
    setMensaje("");
    try {
      const data = await importarERP(r.cod_reparto);
      setMensaje(
        data.advertencia || `Reparto ${numero(r)} importado correctamente.`,
      );
      await client.invalidateQueries({ queryKey: ["erp-lista"] });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <header className="erp-cabecera">
        <div>
          <span className="erp-eyebrow">LOGÍSTICA · INTEGRACIÓN ERP</span>
          <h1>Repartos</h1>
          <p>
            SQL Server se consulta únicamente en modo lectura. Entregas,
            secuencia, cobros y saldo operativo se guardan en PostgreSQL TALCA.
          </p>
        </div>
      </header>
      <form
        className="erp-panel erp-filtros"
        onSubmit={buscar}
        key={params.toString()}
      >
        <label>
          Fecha de salida
          <input name="fecha" type="date" required defaultValue={fecha} />
        </label>
        <label>
          Chofer SQL
          <input
            name="chofer"
            placeholder="Todos los choferes"
            defaultValue={filtros.chofer}
          />
        </label>
        <label>
          Ruta
          <input
            name="ruta"
            placeholder="Todas las rutas"
            defaultValue={filtros.ruta}
          />
        </label>
        <label>
          Almacén
          <input
            name="almacen"
            placeholder="Todos los almacenes"
            defaultValue={filtros.almacen}
          />
        </label>
        <button className="erp-primary" disabled={q.isFetching}>
          Ver repartos
        </button>
      </form>
      {q.data?.advertencia && <Aviso>{q.data.advertencia}</Aviso>}
      {error && <Aviso error>{error}</Aviso>}
      {mensaje && <Aviso>{mensaje}</Aviso>}
      {q.isPending ? (
        <p className="erp-panel" role="status">
          Consultando repartos…
        </p>
      ) : q.isError ? (
        <Aviso error>
          {mensajeError(q.error)}{" "}
          <button onClick={() => void q.refetch()}>Reintentar</button>
        </Aviso>
      ) : (
        <>
          {nombres.map((nombre) => (
            <section className="erp-panel" key={nombre}>
              <div className="erp-titulo-grupo">
                <h2>{nombre}</h2>
                <span>{grupos.get(nombre)!.length} repartos</span>
              </div>
              <div className="erp-tarjetas">
                {grupos.get(nombre)!.map((r) => (
                  <article className="erp-reparto" key={r.cod_reparto}>
                    <header>
                      <div>
                        <small>Reparto</small>
                        <h3>{numero(r)}</h3>
                      </div>
                      <span className="erp-badge">SQL {r.estado ?? "—"}</span>
                    </header>
                    <dl className="erp-meta">
                      <div>
                        <dt>Ruta</dt>
                        <dd>{r.ruta || "—"}</dd>
                      </div>
                      <div>
                        <dt>Chofer SQL</dt>
                        <dd>{r.chofer || "No informado"}</dd>
                      </div>
                      <div>
                        <dt>Almacén</dt>
                        <dd>{r.almacen || "—"}</dd>
                      </div>
                      <div>
                        <dt>Importe SQL</dt>
                        <dd>{dinero(r.monto_total)}</dd>
                      </div>
                    </dl>
                    <div className="erp-reparto-pie">
                      {r.importado ? (
                        <>
                          <p>
                            {r.resumen?.entregadas ?? 0} /{" "}
                            {r.resumen?.cantidad_paradas ?? 0} entregadas ·
                            Cobrado {dinero(r.resumen?.cobrado_local)} · Saldo{" "}
                            {dinero(r.resumen?.saldo)}
                          </p>
                          <div className="erp-herramientas">
                            <Link
                              className="erp-primary"
                              to={`/repartos/erp/${r.cod_reparto}?fecha=${fecha}`}
                            >
                              Abrir reparto
                            </Link>
                            <Link
                              className="erp-secondary"
                              to={`/repartos/erp/${r.cod_reparto}/planificacion?fecha=${fecha}`}
                            >
                              Planificación y mapa
                            </Link>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>Todavía no importado a TALCA</p>
                          {q.data.permisos.includes("crear") && (
                            <button
                              className="erp-primary"
                              disabled={busy !== null}
                              onClick={() => void importar(r)}
                            >
                              {busy === r.cod_reparto
                                ? "Importando…"
                                : "Importar a TALCA"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {!nombres.length && (
            <div className="erp-panel erp-vacio">
              No se encontraron repartos para esta fecha y estos filtros.
            </div>
          )}
        </>
      )}
    </>
  );
}

type Ejecutar = (datos: Record<string, unknown>) => Promise<void>;
function Detalle({ cod }: { cod: number }) {
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const [params] = useSearchParams();
  const client = useQueryClient();
  const mapa = location.pathname.endsWith("/planificacion");
  const q = useQuery({
    queryKey: ["erp-detalle", cod],
    queryFn: ({ signal }) => obtenerRepartoERP(cod, signal),
    retry: 1,
  });
  const cat = useQuery({
    queryKey: ["erp-catalogos"],
    queryFn: catalogosERP,
    retry: 1,
  });
  const permisos = cat.data?.permisos || [];
  const ejecutar: Ejecutar = async (datos) => {
    setBusy(true);
    setMensaje("");
    setError("");
    try {
      const data = await operarERP(cod, datos);
      client.setQueryData(["erp-detalle", cod], data);
      await client.invalidateQueries({ queryKey: ["erp-lista"] });
      setMensaje("Cambios guardados correctamente.");
    } catch (e) {
      setError(mensajeError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const r = q.data;
  return (
    <>
      <Link
        className="erp-volver"
        to={`/repartos/erp?fecha=${params.get("fecha") || hoy()}`}
      >
        ← Volver a repartos
      </Link>
      {q.isPending ? (
        <p role="status">Cargando reparto…</p>
      ) : q.isError ? (
        <Aviso error>{mensajeError(q.error)}</Aviso>
      ) : (
        r && (
          <>
            <header className="erp-panel erp-cabecera">
              <div>
                <span className="erp-eyebrow">
                  {mapa ? "TALCA / PLANIFICACIÓN" : "REPARTO"}
                </span>
                <h1>
                  {mapa ? "Reparto " : ""}
                  {numero(r)}
                </h1>
                <p>
                  {grupo(r)} · {r.ruta || "Sin ruta"} ·{" "}
                  {r.camion || "Sin camión"} · {r.almacen}
                </p>
              </div>
              <div>
                <strong>Chofer SQL</strong>
                <p>{r.chofer || "No informado"}</p>
                <small>
                  Usuario TALCA: {r.usuario_asignado_nombre || "Sin asignar"}
                </small>
              </div>
            </header>
            {error && <Aviso error>{error}</Aviso>}
            {mensaje && <Aviso>{mensaje}</Aviso>}
            {cat.isError && (
              <Aviso error>
                No se pudieron cargar los usuarios, unidades y permisos.{" "}
                <button onClick={() => void cat.refetch()}>Reintentar</button>
              </Aviso>
            )}
            <div className="erp-herramientas erp-separado">
              <Link
                className="erp-secondary"
                to={`/repartos/erp/${cod}${mapa ? "" : "/planificacion"}${location.search}`}
              >
                {mapa
                  ? "Gestión de entregas y cobros"
                  : "Ver planificación y mapa"}
              </Link>
              {permisos.includes("crear") && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const data = await importarERP(cod);
                      client.setQueryData(["erp-detalle", cod], data.reparto);
                      setMensaje(
                        data.advertencia ||
                          "Referencia del ERP actualizada. Se conservaron las operaciones locales.",
                      );
                    } catch (e) {
                      setError(mensajeError(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Actualizar desde ERP
                </button>
              )}
            </div>
            {mapa ? (
              <Planificacion
                key={`${cod}-${r.version_operativa}`}
                reparto={r}
                catalogos={cat.data}
                busy={busy}
                ejecutar={ejecutar}
              />
            ) : (
              <>
                {permisos.includes("editar") && (
                  <form
                    className="erp-panel erp-linea"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const id = new FormData(e.currentTarget).get("usuario");
                      void ejecutar({
                        accion: "asignar",
                        usuario: id ? Number(id) : null,
                      }).catch(() => {});
                    }}
                  >
                    <label>
                      Usuario que realiza el reparto
                      <select
                        name="usuario"
                        defaultValue={r.usuario_asignado || ""}
                        key={r.usuario_asignado}
                      >
                        <option value="">Sin asignar</option>
                        {cat.data?.usuarios.map((u) => (
                          <option value={u.id} key={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="erp-primary" disabled={busy}>
                      Guardar asignación
                    </button>
                  </form>
                )}
                <Indicadores
                  items={[
                    ["Paradas", r.resumen.cantidad_paradas],
                    [
                      "Entregadas",
                      `${r.resumen.entregadas}/${r.resumen.cantidad_paradas}`,
                    ],
                    ["A cobrar TALCA", dinero(r.resumen.a_cobrar)],
                    ["Cobrado", dinero(r.resumen.cobrado_local)],
                    ["Saldo", dinero(r.resumen.saldo)],
                  ]}
                />
                <Aviso>
                  El importe SQL es referencia de origen. Los saldos, cobros,
                  entregas y la secuencia son locales a TALCA; no modifican el
                  ERP. Pedidos y remitos son informativos y no duplican el saldo
                  inicial de las facturas.
                </Aviso>
                {r.paradas.map((p) => (
                  <Parada
                    key={p.id}
                    parada={p}
                    permisos={permisos}
                    busy={busy}
                    ejecutar={ejecutar}
                  />
                ))}
                {!r.paradas.length && (
                  <p className="erp-panel">
                    Este reparto no tiene paradas importadas.
                  </p>
                )}
              </>
            )}
            <details className="erp-panel">
              <summary>Actividad y trazabilidad del reparto</summary>
              <div className="erp-tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.eventos.map((ev) => (
                      <tr key={ev.id}>
                        <td>{fechaHora(ev.creado_en)}</td>
                        <td>{ev.usuario}</td>
                        <td>{ev.accion.replaceAll("_", " ")}</td>
                        <td>
                          <code>{JSON.stringify(ev.datos)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!r.eventos.length && <p>Sin actividad operativa registrada.</p>}
            </details>
          </>
        )
      )}
    </>
  );
}

function Parada({
  parada: p,
  permisos,
  busy,
  ejecutar,
}: {
  parada: ParadaRepartoERP;
  permisos: string[];
  busy: boolean;
  ejecutar: Ejecutar;
}) {
  const editar = permisos.includes("editar");
  const [nota, setNota] = useState(p.observaciones_entrega);
  return (
    <section className="erp-panel erp-parada">
      <header className="erp-parada-cabecera">
        <span className="erp-orden">{p.orden}</span>
        <div>
          <small>Parada · orden real {p.orden_real ?? "—"}</small>
          <h2>{p.cliente}</h2>
          <p>{p.codigo_cliente || "Sin código de cliente"}</p>
        </div>
        <span className={`erp-badge erp-estado-${p.estado}`}>
          {ESTADOS[p.estado] || "Pendiente"}
        </span>
        {editar && (
          <div className="erp-herramientas">
            <button
              type="button"
              aria-label={`Subir parada ${p.cliente}`}
              disabled={busy}
              onClick={() =>
                void ejecutar({
                  accion: "mover",
                  parada: p.id,
                  direccion: "arriba",
                }).catch(() => {})
              }
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Bajar parada ${p.cliente}`}
              disabled={busy}
              onClick={() =>
                void ejecutar({
                  accion: "mover",
                  parada: p.id,
                  direccion: "abajo",
                }).catch(() => {})
              }
            >
              ↓
            </button>
          </div>
        )}
      </header>
      <Indicadores
        items={[
          ["Referencia SQL", dinero(p.importe_referencia)],
          ["A cobrar TALCA", dinero(p.importe_a_cobrar)],
          ["Cobrado", dinero(p.cobrado_local)],
          ["Saldo", dinero(p.saldo)],
        ]}
      />
      {editar && (
        <form
          className="erp-linea erp-recuadro"
          onSubmit={(e) => {
            e.preventDefault();
            void ejecutar({
              accion: "importe",
              parada: p.id,
              importe: new FormData(e.currentTarget).get("importe"),
            }).catch(() => {});
          }}
        >
          <label>
            Importe a cobrar TALCA
            <input
              key={p.importe_a_cobrar}
              name="importe"
              type="number"
              min={p.cobrado_local}
              step="0.01"
              required
              defaultValue={p.importe_a_cobrar}
            />
          </label>
          <button disabled={busy} className="erp-primary">
            Actualizar saldo base
          </button>
        </form>
      )}
      {p.documentos.map((doc) => (
        <details className="erp-documento" key={doc.id}>
          <summary>
            {doc.tipo_comprobante || doc.tipo} {doc.nro_comprobante} ·{" "}
            {dinero(doc.monto)}
            {doc.tipo !== "FACTURA" ? " · Informativo" : ""}
          </summary>
          <div className="erp-tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Bultos</th>
                  <th>Unidades</th>
                </tr>
              </thead>
              <tbody>
                {doc.detalles.map((d) => (
                  <tr key={d.id}>
                    <td>{d.codigo}</td>
                    <td>{d.descripcion}</td>
                    <td>{d.cantidad ?? "—"}</td>
                    <td>{d.cantidad_bultos ?? "—"}</td>
                    <td>{d.cantidad_unidades ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!doc.detalles.length && (
              <p>Sin detalle de productos disponible.</p>
            )}
          </div>
        </details>
      ))}
      {editar ? (
        <form
          className="erp-linea erp-recuadro"
          onSubmit={(e) => {
            e.preventDefault();
            const estado = (
              e.nativeEvent as SubmitEvent
            ).submitter?.getAttribute("value");
            void ejecutar({
              accion: "estado",
              parada: p.id,
              estado,
              observaciones: nota,
            }).catch(() => {});
          }}
        >
          <label className="erp-crecer">
            Observaciones de entrega
            <textarea
              maxLength={1000}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Observaciones de entrega"
            />
          </label>
          <button className="erp-primary" value="entregado" disabled={busy}>
            Entregado
          </button>
          <button value="no_entregado" disabled={busy}>
            No entregado
          </button>
          {p.estado && p.estado !== "pendiente" && (
            <button value="pendiente" disabled={busy}>
              Volver a pendiente
            </button>
          )}
        </form>
      ) : (
        <p>{p.observaciones_entrega}</p>
      )}
      {permisos.includes("crear") && (
        <details className="erp-documento">
          <summary>Registrar cobro · Saldo {dinero(p.saldo)}</summary>
          <FormularioCobro parada={p} ejecutar={ejecutar} busy={busy} />
        </details>
      )}
      {p.cobros.length > 0 && (
        <details className="erp-documento">
          <summary>Cobros registrados ({p.cobros.length})</summary>
          {p.cobros.map((c) => (
            <CobroRegistrado
              key={c.id}
              cobro={c}
              anular={permisos.includes("anular")}
              busy={busy}
              ejecutar={ejecutar}
            />
          ))}
        </details>
      )}
    </section>
  );
}

function FormularioCobro({
  parada,
  ejecutar,
  busy,
}: {
  parada: ParadaRepartoERP;
  ejecutar: Ejecutar;
  busy: boolean;
}) {
  const [cheques, setCheques] = useState<number[]>([]);
  const [nextId, setNextId] = useState(1);
  const [error, setError] = useState("");
  const [solicitud, setSolicitud] = useState(solicitudUUID);
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const medios: MedioERP[] = [];
    const efectivo = String(d.get("efectivo") || "0"),
      transferencia = String(d.get("transferencia") || "0");
    if (Number(efectivo) > 0)
      medios.push({ medio: "efectivo", importe: efectivo });
    if (Number(transferencia) > 0)
      medios.push({
        medio: "transferencia",
        importe: transferencia,
        referencia: String(d.get("referencia") || ""),
      });
    for (const id of cheques)
      medios.push({
        medio: "cheque",
        importe: String(d.get(`importe-${id}`)),
        banco: String(d.get(`banco-${id}`)),
        numero_cheque: String(d.get(`numero-${id}`)),
        fecha_pago: String(d.get(`fecha-${id}`)),
      });
    if (!medios.length) {
      setError("Ingresá al menos un medio de cobro.");
      return;
    }
    try {
      await ejecutar({ accion: "cobro", parada: parada.id, solicitud, medios });
      form.reset();
      setCheques([]);
      setSolicitud(solicitudUUID());
      setError("");
    } catch (e) {
      setError(mensajeError(e));
    }
  }
  return (
    <form className="erp-recuadro" onSubmit={(e) => void guardar(e)}>
      {error && <Aviso error>{error}</Aviso>}
      <div className="erp-form-grid">
        <label>
          Efectivo
          <input
            type="number"
            name="efectivo"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </label>
        <label>
          Transferencia
          <input
            type="number"
            name="transferencia"
            min="0"
            step="0.01"
            defaultValue="0"
          />
        </label>
        <label>
          Referencia de transferencia
          <input name="referencia" maxLength={200} />
        </label>
      </div>
      {cheques.map((id) => (
        <fieldset className="erp-cheque" key={id}>
          <legend>Cheque</legend>
          <label>
            Importe
            <input
              name={`importe-${id}`}
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label>
            Banco
            <input name={`banco-${id}`} maxLength={120} required />
          </label>
          <label>
            Número
            <input name={`numero-${id}`} maxLength={100} required />
          </label>
          <label>
            Fecha de pago
            <input name={`fecha-${id}`} type="date" required />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCheques((v) => v.filter((x) => x !== id))}
          >
            Quitar cheque
          </button>
        </fieldset>
      ))}
      <div className="erp-herramientas erp-separado">
        <button
          type="button"
          disabled={busy || cheques.length >= 18}
          onClick={() => {
            setCheques((v) => [...v, nextId]);
            setNextId((v) => v + 1);
          }}
        >
          + Agregar cheque
        </button>
        <button
          className="erp-primary"
          disabled={busy || Number(parada.saldo) <= 0}
        >
          {busy ? "Guardando…" : "Confirmar cobro"}
        </button>
      </div>
      <p className="erp-ayuda">
        El cobro se guarda únicamente en TALCA. No puede superar el saldo
        pendiente.
      </p>
    </form>
  );
}

function CobroRegistrado({
  cobro: c,
  anular,
  busy,
  ejecutar,
}: {
  cobro: CobroERP;
  anular: boolean;
  busy: boolean;
  ejecutar: Ejecutar;
}) {
  return (
    <article className="erp-recuadro">
      <strong>
        {dinero(c.importe)} · {c.anulado_en ? "Anulado" : "Activo"}
      </strong>
      <p>
        {fechaHora(c.creado_en)} · {c.actor_nombre}
      </p>
      <ul>
        {c.medios.map((m, i) => (
          <li key={i}>
            {m.medio}: {dinero(m.importe)} {m.referencia} {m.banco}{" "}
            {m.numero_cheque} {m.fecha_pago}
          </li>
        ))}
      </ul>
      {c.anulado_en ? (
        <p>Motivo: {c.motivo_anulacion}</p>
      ) : (
        anular && (
          <form
            className="erp-linea"
            onSubmit={(e) => {
              e.preventDefault();
              void ejecutar({
                accion: "anular_cobro",
                cobro: c.id,
                motivo: new FormData(e.currentTarget).get("motivo"),
              }).catch(() => {});
            }}
          >
            <label>
              Motivo de anulación
              <input
                name="motivo"
                required
                maxLength={500}
                placeholder="Explicá la corrección"
              />
            </label>
            <button className="erp-danger" disabled={busy}>
              Anular cobro
            </button>
          </form>
        )
      )}
    </article>
  );
}

function Planificacion({
  reparto: r,
  catalogos,
  busy,
  ejecutar,
}: {
  reparto: RepartoERPDetalle;
  catalogos?: CatalogosERP;
  busy: boolean;
  ejecutar: Ejecutar;
}) {
  const [recorrido, setRecorrido] = useState<RecorridoERP | null>(null);
  const [error, setError] = useState("");
  const [calculando, setCalculando] = useState(false);
  const [salida, setSalida] = useState<PuntoERP | null>(r.origen);
  const [regreso, setRegreso] = useState(true);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const editar = catalogos?.permisos.includes("editar");
  const client = useQueryClient();
  const ubicadas = r.paradas.filter((p) => p.ubicacion.punto).length;
  const pendientes = r.paradas.filter(
    (p) => !p.estado || p.estado === "pendiente",
  );
  const faltantes = pendientes.filter((p) => !p.ubicacion.punto).length;
  const fijo =
    r.cod_jerarquia === 7 ||
    ["MZA_EXPEDICION", "MZA_MERMAS PP"].includes(r.almacen);
  const seleccionado = r.paradas.find((p) => p.id === seleccion);
  async function calcular(guardado: boolean, e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setCalculando(true);
    setError("");
    setRecorrido(null);
    try {
      const resultado = await planificarERP(r.cod_reparto, {
        accion: guardado ? "ver_recorrido" : "calcular",
        latitud: salida?.[0],
        longitud: salida?.[1],
        regreso,
      });
      setRecorrido(resultado);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCalculando(false);
    }
  }
  return (
    <>
      <Indicadores
        items={[
          ["Paradas", r.paradas.length],
          ["Geolocalizadas", `${ubicadas}/${r.paradas.length}`],
          ["Pendientes", pendientes.length],
          ["Pendientes sin ubicación", faltantes],
        ]}
      />
      <section className="erp-panel">
        <h2>Camión y capacidad</h2>
        <Indicadores
          items={[
            [
              "Capacidad",
              r.unidad_detalle
                ? `${r.unidad_detalle.capacidad} bultos`
                : "No disponible",
            ],
            ["Bultos según facturas", r.bultos ?? "No informados"],
            [
              "Ocupación informada",
              r.ocupacion
                ? `${Number(r.ocupacion).toFixed(1)} %`
                : "No evaluable",
            ],
          ]}
        />
        {!r.unidad && (
          <Aviso>
            No hay una unidad asignada en TALCA. Seleccioná el camión real para
            evaluar su capacidad.
          </Aviso>
        )}
        {editar && (
          <form
            className="erp-linea"
            onSubmit={(e) => {
              e.preventDefault();
              const unidad = new FormData(e.currentTarget).get("unidad");
              void ejecutar({
                accion: "unidad",
                unidad: unidad ? Number(unidad) : null,
              }).catch(() => {});
            }}
          >
            <label className="erp-crecer">
              Asignar unidad en TALCA
              <select name="unidad" defaultValue={r.unidad || ""}>
                <option value="">Sin unidad asignada</option>
                {catalogos?.unidades.map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.dominio} · {u.capacidad} bultos · {u.descripcion}
                  </option>
                ))}
              </select>
            </label>
            <button className="erp-primary" disabled={busy}>
              Guardar unidad
            </button>
          </form>
        )}
        {catalogos?.permisos.includes("configurar") && (
          <details className="erp-documento">
            <summary>Registrar una unidad y su capacidad</summary>
            <form
              className="erp-form-grid"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget,
                  d = new FormData(f);
                setCalculando(true);
                try {
                  await crearUnidadERP({
                    dominio: String(d.get("dominio")).toUpperCase(),
                    descripcion: String(d.get("descripcion")),
                    capacidad: Number(d.get("capacidad")),
                  });
                  await client.invalidateQueries({
                    queryKey: ["erp-catalogos"],
                  });
                  f.reset();
                  setError("");
                } catch (e) {
                  setError(mensajeError(e));
                } finally {
                  setCalculando(false);
                }
              }}
            >
              <label>
                Dominio
                <input name="dominio" maxLength={40} required />
              </label>
              <label>
                Descripción
                <input name="descripcion" maxLength={200} />
              </label>
              <label>
                Capacidad real (bultos)
                <input
                  name="capacidad"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </label>
              <button className="erp-primary" disabled={calculando}>
                Registrar unidad
              </button>
            </form>
          </details>
        )}
        <p className="erp-ayuda">
          Se suman únicamente los bultos de las facturas, sin duplicar pedidos o
          remitos.{" "}
          {r.carga_completa ? "" : "La información de carga es incompleta. "}No
          se evalúan peso, pallets ni restricciones físicas del vehículo.
        </p>
      </section>
      {error && <Aviso error>{error}</Aviso>}
      <div className="erp-plan-grid">
        <section className="erp-panel">
          <header className="erp-cabecera">
            <div>
              <h2>Mapa de clientes</h2>
              <p>
                Ubicaciones de la réplica Persat · calculá una propuesta para
                ver la ruta por calles.
              </p>
            </div>
            <button
              disabled={calculando || busy}
              onClick={() =>
                void client.invalidateQueries({
                  queryKey: ["erp-detalle", r.cod_reparto],
                })
              }
            >
              Actualizar ubicaciones
            </button>
          </header>
          <MapaRepartoERP
            paradas={r.paradas}
            origen={salida}
            recorrido={recorrido}
            seleccionar={setSeleccion}
            marcarSalida={editar && !fijo ? setSalida : undefined}
          />
        </section>
        <section className="erp-panel">
          <h2>Planificar recorrido</h2>
          <p>
            Se calcula para las paradas pendientes. No cambia la secuencia hasta
            confirmar.
          </p>
          <form
            className="erp-recuadro"
            onSubmit={(e) => void calcular(false, e)}
          >
            <div className="erp-form-grid">
              <label>
                Latitud de salida
                <input
                  type="number"
                  step="any"
                  min="-85"
                  max="85"
                  required
                  readOnly={fijo || !editar}
                  value={salida?.[0] ?? ""}
                  onChange={(e) =>
                    setSalida([Number(e.target.value), salida?.[1] ?? 0])
                  }
                />
              </label>
              <label>
                Longitud de salida
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  required
                  readOnly={fijo || !editar}
                  value={salida?.[1] ?? ""}
                  onChange={(e) =>
                    setSalida([salida?.[0] ?? 0, Number(e.target.value)])
                  }
                />
              </label>
            </div>
            <label className="erp-check">
              <input
                type="checkbox"
                checked={regreso}
                onChange={(e) => {
                  setRegreso(e.target.checked);
                  setRecorrido(null);
                }}
              />
              Regresar al mismo depósito
            </label>
            <p className="erp-ayuda">
              {fijo
                ? "Salida fija: Depósito Terrada, Mendoza. "
                : "Indicá el depósito real de salida. "}
              OSRM es obligatorio. El perfil vial es de automóvil, no de camión.
            </p>
            {editar && (
              <button
                className="erp-primary erp-ancho"
                disabled={
                  busy || calculando || faltantes > 0 || !pendientes.length
                }
              >
                {calculando ? "Calculando…" : "Calcular propuesta"}
              </button>
            )}
          </form>
          <button
            className="erp-secondary erp-separado"
            disabled={busy || calculando || faltantes > 0 || !pendientes.length}
            onClick={() => void calcular(true)}
          >
            Ver recorrido en el orden guardado
          </button>
          {faltantes > 0 && (
            <Aviso>
              Faltan ubicaciones de clientes pendientes. No se puede calcular
              una ruta completa.
            </Aviso>
          )}
          <p className="erp-ayuda">
            Persat se vincula por código exacto, nunca por nombre. “Actualizar
            ubicaciones” relee la réplica local. La sincronización horaria con
            Persat se configura en el servidor.
          </p>
          {recorrido && (
            <div className="erp-recuadro">
              <h3>
                {recorrido.firma
                  ? "Propuesta sin confirmar"
                  : "Secuencia guardada"}
              </h3>
              <p>
                {(recorrido.distancia / 1000).toFixed(1)} km ·{" "}
                {Math.round(recorrido.segundos / 60)} min de manejo
              </p>
              {recorrido.distancia_anterior != null && (
                <p>
                  Antes: {(recorrido.distancia_anterior / 1000).toFixed(1)} km ·{" "}
                  {Math.round((recorrido.segundos_anteriores || 0) / 60)} min
                </p>
              )}
              <ol>
                {recorrido.ids.map((id) => (
                  <li key={id}>
                    {r.paradas.find((p) => p.id === id)?.cliente}
                  </li>
                ))}
              </ol>
              {recorrido.firma && editar && (
                <button
                  className="erp-primary"
                  disabled={busy || calculando}
                  onClick={() =>
                    void ejecutar({
                      accion: "confirmar_plan",
                      firma: recorrido.firma,
                    })
                      .then(() => setRecorrido(null))
                      .catch(() => {})
                  }
                >
                  Confirmar nueva secuencia
                </button>
              )}
            </div>
          )}
          <div className="erp-recuadro">
            {seleccionado ? (
              <>
                <h3>{seleccionado.cliente}</h3>
                <p>
                  {seleccionado.codigo_cliente} ·{" "}
                  {ESTADOS[seleccionado.estado] || "Pendiente"}
                </p>
                <p>
                  Persat: {seleccionado.ubicacion.nombre || "Sin coincidencia"}
                </p>
                <p>Saldo TALCA: {dinero(seleccionado.saldo)}</p>
              </>
            ) : (
              "Seleccioná un marcador o una fila para ver el cliente."
            )}
          </div>
        </section>
      </div>
      <section className="erp-panel">
        <h2>Secuencia y ubicaciones</h2>
        <p>La numeración del mapa representa el orden planificado en TALCA.</p>
        <div className="erp-tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Orden TALCA</th>
                <th>Cliente</th>
                <th>Entrega</th>
                <th>Geolocalización</th>
              </tr>
            </thead>
            <tbody>
              {r.paradas.map((p) => (
                <tr key={p.id}>
                  <td>{p.orden}</td>
                  <td>
                    <button
                      className="erp-link"
                      onClick={() => setSeleccion(p.id)}
                    >
                      {p.cliente}
                    </button>
                    <small>
                      {p.codigo_cliente}{" "}
                      {p.ubicacion.nombre && `· Persat: ${p.ubicacion.nombre}`}
                    </small>
                  </td>
                  <td>{ESTADOS[p.estado] || "Pendiente"}</td>
                  <td>
                    {p.ubicacion.punto ? (
                      <>
                        <strong>Ubicado</strong>
                        <small>{p.ubicacion.punto.join(", ")}</small>
                        <small>
                          Consulta:{" "}
                          {p.ubicacion.actualizado_en &&
                            fechaHora(p.ubicacion.actualizado_en)}
                        </small>
                      </>
                    ) : (
                      "Sin ubicación disponible"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
