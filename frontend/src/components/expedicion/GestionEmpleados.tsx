import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  claveOperacion,
  type ComprobanteOperativo,
  type EmpleadoOperativo,
  type ExpedicionOperativa,
  type LineaCarga,
  type ProductoOperativo,
} from "../../api/expedicionOperativa";
import { Lines, SearchSelect, Table } from "./Controles";
import { fmt, normalizar } from "./format";
import {
  buscarEmpleados,
  primerEmpleado,
  validarOperacionEmpleado,
} from "./empleados";

type OperacionEmpleado = {
  empleado: number;
  tipo: "CONSUMO" | "ANTICIPO";
  lineas: LineaCarga[];
  observaciones: string;
  justificacion: string;
  clave: string;
};
type Guardar = (operacion: OperacionEmpleado) => Promise<ComprobanteOperativo>;

function FormularioEmpleado({
  empleado,
  productos,
  tipo,
  disabled,
  guardar,
  bloquear,
  mostrarComprobante,
}: {
  empleado: EmpleadoOperativo;
  productos: ProductoOperativo[];
  tipo: "CONSUMO" | "ANTICIPO";
  disabled: boolean;
  guardar: Guardar;
  bloquear: (busy: boolean) => void;
  mostrarComprobante: (c: ComprobanteOperativo) => void;
}) {
  const beneficio = tipo === "CONSUMO";
  const disponibles = productos.filter(
    (p) => p.activo && (!beneficio || p.beneficio_empleado),
  );
  const iniciales = (): LineaCarga[] =>
    beneficio && disponibles[0]
      ? [{ producto: disponibles[0].id, packs: 1, unidades: 0 }]
      : [];
  const [lineas, setLineas] = useState<LineaCarga[]>(iniciales);
  const [observaciones, setObservaciones] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const intento = useRef<{ body: string; clave: string } | null>(null);
  const total = lineas.reduce((sum, l) => sum + l.packs, 0);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled || lock.current) return;
    setError("");
    try {
      validarOperacionEmpleado(empleado, tipo, lineas, productos);
      lock.current = true;
      bloquear(true);
      const payload = {
        empleado: empleado.id,
        tipo,
        lineas,
        observaciones,
        justificacion,
      };
      const body = JSON.stringify(payload);
      if (intento.current?.body !== body)
        intento.current = { body, clave: claveOperacion() };
      const c = await guardar({ ...payload, clave: intento.current.clave });
      mostrarComprobante(c);
      setLineas([]);
      setObservaciones("");
      setJustificacion("");
      intento.current = null;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar. Tus datos siguen en el formulario.",
      );
    } finally {
      lock.current = false;
      bloquear(false);
    }
  }
  return (
    <form
      className="eo-employee-form"
      aria-label={beneficio ? "Consumo de empleado" : "Anticipo empleado"}
      onSubmit={submit}
      onChange={() => setError("")}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          e.key === "Enter" &&
          target.tagName !== "TEXTAREA" &&
          target.tagName !== "BUTTON"
        )
          e.preventDefault();
      }}
    >
      <h3>{beneficio ? "Consumo de empleado" : "Anticipo empleado"}</h3>
      <p className="eo-help">
        {beneficio
          ? "Combiná productos habilitados en un único consumo y comprobante. Solo fardos completos."
          : "Compra de mercadería: afecta el stock, pero no el saldo del beneficio."}
      </p>
      <fieldset disabled={disabled}>
        {beneficio ? (
          <>
            <div className="eo-benefit-lines">
              {lineas.map((l, i) => (
                <div className="eo-benefit-line" key={i}>
                  <SearchSelect
                    label={`Producto ${i + 1}`}
                    options={disponibles.map((p) => ({
                      id: p.id,
                      label: `${p.codigo} · ${p.nombre}`,
                    }))}
                    value={l.producto}
                    onChange={(producto) =>
                      setLineas((rows) =>
                        rows.map((x, j) => (j === i ? { ...x, producto } : x)),
                      )
                    }
                  />
                  <label>
                    Fardos
                    <input
                      aria-label={`Fardos ${i + 1}`}
                      type="number"
                      step="1"
                      min="1"
                      value={l.packs}
                      onChange={(e) =>
                        setLineas((rows) =>
                          rows.map((x, j) =>
                            j === i
                              ? { ...x, packs: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setLineas((rows) => rows.filter((_, j) => i !== j))
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={!disponibles.length}
              onClick={() =>
                setLineas((rows) => [
                  ...rows,
                  { producto: disponibles[0].id, packs: 1, unidades: 0 },
                ])
              }
            >
              Agregar producto
            </button>
            <div className="eo-benefit-summary">
              <div>
                <span>Total seleccionado</span>
                <b>{fmt(total)} fardos</b>
              </div>
              <div>
                <span>Saldo actual</span>
                <b>{fmt(empleado.saldo_fardos)} fardos</b>
              </div>
              <div>
                <span>Saldo después del consumo</span>
                <b
                  className={
                    total > empleado.saldo_fardos ? "eo-material-owing" : ""
                  }
                >
                  {fmt(empleado.saldo_fardos - total)} fardos
                </b>
              </div>
            </div>
          </>
        ) : (
          <Lines productos={disponibles} value={lineas} change={setLineas} />
        )}
        {!disponibles.length && (
          <p className="eo-notice">
            No hay productos habilitados para esta operación.
          </p>
        )}
        <label>
          Observaciones
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </label>
        <details
          className="eo-employee-justification"
          open={error.toLowerCase().includes("stock") || undefined}
        >
          <summary>
            Justificación por stock insuficiente (si corresponde)
          </summary>
          <label>
            Motivo
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
            />
          </label>
        </details>
        {error && (
          <p className="eo-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="eo-primary"
          disabled={disabled || !lineas.length || !disponibles.length}
        >
          {disabled
            ? "Operación no disponible"
            : "Confirmar y generar comprobantes"}
        </button>
      </fieldset>
    </form>
  );
}

function HistorialEmpleado({
  data,
  empleado,
  imprimir,
}: {
  data: ExpedicionOperativa;
  empleado?: number;
  imprimir: (id: number) => void;
}) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [turno, setTurno] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(20);
  const rows = data.comprobantes.filter(
    (c) =>
      (!empleado || c.empleado === empleado) &&
      (!desde || c.fecha.slice(0, 10) >= desde) &&
      (!hasta || c.fecha.slice(0, 10) <= hasta) &&
      (!turno || c.turno === turno) &&
      normalizar(
        `${c.numero} ${data.empleados.find((e) => e.id === c.empleado)?.legajo || ""} ${data.empleados.find((e) => e.id === c.empleado)?.nombre || ""} ${data.empleados.find((e) => e.id === c.empleado)?.apellido || ""}`,
      ).includes(normalizar(busqueda)),
  );
  return (
    <section className="eo-employee-history">
      <h3>
        {empleado
          ? "Historial de consumo y anticipo"
          : "Comprobantes e historial general"}
      </h3>
      <details>
        <summary>Filtros de historial</summary>
        <div className="eo-filters">
          <label>
            Buscar comprobante
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
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
            Turno
            <select value={turno} onChange={(e) => setTurno(e.target.value)}>
              <option value="">Todos</option>
              <option>Mañana</option>
              <option>Tarde</option>
            </select>
          </label>
          <button
            onClick={() => {
              setDesde("");
              setHasta("");
              setTurno("");
              setBusqueda("");
            }}
          >
            Limpiar
          </button>
        </div>
      </details>
      <Table
        headers={[
          "Comprobante",
          "Fecha",
          ...(!empleado ? ["Empleado"] : []),
          "Tipo",
          "Productos",
          "Acción",
        ]}
        emptyMessage="Todavía no registra consumos ni anticipos con estos filtros."
        rows={rows.slice(0, limite).map((c) => [
          c.numero,
          <span>
            {new Date(c.fecha).toLocaleString("es-AR")}
            <small>
              {c.usuario} · {c.turno}
            </small>
          </span>,
          ...(!empleado
            ? [
                data.empleados.find((e) => e.id === c.empleado)?.nombre ||
                  `Empleado #${c.empleado}`,
              ]
            : []),
          c.tipo === "CONSUMO" ? "Consumo" : "Anticipo",
          c.lineas
            .map(
              (l) =>
                `${l.nombre}: ${Math.floor(l.unidades / l.pack)} fardos${l.unidades % l.pack ? ` + ${l.unidades % l.pack} un.` : ""}`,
            )
            .join(" · "),
          <button onClick={() => imprimir(c.id)}>Imprimir dos copias</button>,
        ])}
      />
      {rows.length > limite && (
        <button type="button" onClick={() => setLimite(rows.length)}>
          Ver historial completo ({rows.length})
        </button>
      )}
    </section>
  );
}

export default function GestionEmpleados({
  data,
  online,
  acreditar,
  editar,
  operarModal,
  guardar,
  imprimir,
  imprimirPadron,
}: {
  data: ExpedicionOperativa;
  online: boolean;
  acreditar: () => void;
  editar: (empleado?: EmpleadoOperativo) => void;
  operarModal: (e: EmpleadoOperativo, tipo: "CONSUMO" | "ANTICIPO") => void;
  guardar: Guardar;
  imprimir: (id: number) => void;
  imprimirPadron: (empleados: EmpleadoOperativo[]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(0);
  const [padron, setPadron] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comprobante, setComprobante] = useState<ComprobanteOperativo | null>(
    null,
  );
  const receiptRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (comprobante)
      receiptRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [comprobante]);
  const matches = buscarEmpleados(data.empleados, busqueda);
  const empleado = data.empleados.find((e) => e.id === seleccionado);
  const disabled = busy || !online;
  function select(id: number) {
    if (busy) return;
    setSeleccionado(id);
    setComprobante(null);
  }
  return (
    <>
      <div className="eo-employee-actions">
        <button
          type="button"
          className="eo-primary"
          disabled={disabled}
          onClick={acreditar}
        >
          Acreditar +2 fardos a activos
        </button>
        <button
          type="button"
          disabled={busy}
          aria-expanded={padron}
          onClick={() => setPadron(!padron)}
        >
          {padron ? "Volver a gestión" : "Administrar padrón"}
        </button>
      </div>
      {padron ? (
        <section className="eo-employee-roster">
          <div className="eo-section-title">
            <h2>Padrón de empleados</h2>
            <button disabled={disabled} onClick={() => editar()}>
              Nuevo empleado
            </button>
            <button
              type="button"
              onClick={() =>
                imprimirPadron(buscarEmpleados(data.empleados, busqueda, false))
              }
            >
              Imprimir padrón
            </button>
          </div>
          <label>
            Buscar en padrón
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Legajo, nombre o apellido"
            />
          </label>
          <Table
            headers={[
              "Legajo",
              "Empleado",
              "Estado",
              "Saldo beneficio",
              "Acciones",
            ]}
            rows={buscarEmpleados(data.empleados, busqueda, false).map((e) => [
              e.legajo,
              `${e.nombre} ${e.apellido}`,
              e.activo ? "Activo" : "Inactivo",
              `${fmt(e.saldo_fardos)} fardos`,
              <div className="eo-actions">
                <button disabled={disabled} onClick={() => editar(e)}>
                  Editar
                </button>
                {e.activo && (
                  <>
                    <button
                      disabled={disabled}
                      onClick={() => operarModal(e, "CONSUMO")}
                    >
                      Consumo
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => operarModal(e, "ANTICIPO")}
                    >
                      Anticipo
                    </button>
                  </>
                )}
              </div>,
            ])}
          />
          <HistorialEmpleado data={data} imprimir={imprimir} />
        </section>
      ) : (
        <div className="eo-employee-layout">
          <aside className="eo-employee-search" aria-label="Buscar empleado">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const first = primerEmpleado(data.empleados, busqueda);
                if (first) select(first.id);
              }}
            >
              <div>
                <label htmlFor="eo-employee-search-input">
                  Legajo o nombre
                </label>
                <div className="eo-employee-searchbar">
                  <input
                    id="eo-employee-search-input"
                    disabled={busy}
                    value={busqueda}
                    placeholder="Ej.: 11607 o Martínez"
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                  <button
                    className="eo-primary"
                    type="submit"
                    disabled={busy || !matches.length}
                  >
                    Buscar
                  </button>
                </div>
              </div>
            </form>
            <div className="eo-employee-results">
              {matches.slice(0, 30).map((e) => (
                <button
                  type="button"
                  className={seleccionado === e.id ? "selected" : ""}
                  aria-pressed={seleccionado === e.id}
                  disabled={busy}
                  key={e.id}
                  onClick={() => select(e.id)}
                >
                  <b>{e.legajo}</b> · {e.nombre} {e.apellido}
                  <small>Saldo beneficio: {fmt(e.saldo_fardos)} fardos</small>
                </button>
              ))}
              {!matches.length && (
                <p className="eo-help" role="status">
                  No se encontraron empleados activos.
                </p>
              )}
            </div>
            {matches.length > 30 && (
              <small>
                Mostrando 30 de {matches.length}. Refiná la búsqueda para
                encontrar al empleado.
              </small>
            )}
          </aside>
          <div className="eo-employee-workbench">
            {!empleado ? (
              <div className="eo-employee-placeholder">
                Seleccioná un empleado para consultar su saldo, historial y
                registrar operaciones.
              </div>
            ) : (
              <>
                <section className="eo-employee-profile">
                  <div>
                    <h2>
                      {empleado.nombre} {empleado.apellido}
                    </h2>
                    <p>
                      Legajo {empleado.legajo} ·{" "}
                      {empleado.activo ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <div>
                    <span>Saldo beneficio</span>
                    <strong>{fmt(empleado.saldo_fardos)} fardos</strong>
                  </div>
                </section>
                {!empleado.activo ? (
                  <p className="eo-notice">
                    El empleado está inactivo. Sus comprobantes permanecen
                    disponibles en el historial.
                  </p>
                ) : (
                  <div className="eo-employee-operations">
                    <FormularioEmpleado
                      key={`consumo-${empleado.id}`}
                      empleado={empleado}
                      productos={data.productos}
                      tipo="CONSUMO"
                      disabled={disabled}
                      bloquear={setBusy}
                      guardar={guardar}
                      mostrarComprobante={setComprobante}
                    />
                    <FormularioEmpleado
                      key={`anticipo-${empleado.id}`}
                      empleado={empleado}
                      productos={data.productos}
                      tipo="ANTICIPO"
                      disabled={disabled}
                      bloquear={setBusy}
                      guardar={guardar}
                      mostrarComprobante={setComprobante}
                    />
                  </div>
                )}
                {comprobante && (
                  <section
                    className="eo-employee-receipt"
                    ref={receiptRef}
                    role="status"
                  >
                    <h3>Operación registrada correctamente</h3>
                    <p>
                      {comprobante.tipo === "CONSUMO" ? "Consumo" : "Anticipo"}{" "}
                      · Comprobante {comprobante.numero}
                    </p>
                    <button
                      type="button"
                      className="eo-primary"
                      onClick={() => imprimir(comprobante.id)}
                    >
                      Imprimir dos copias
                    </button>
                    <button type="button" onClick={() => setComprobante(null)}>
                      Cerrar comprobante
                    </button>
                  </section>
                )}
                <HistorialEmpleado
                  key={empleado.id}
                  data={data}
                  empleado={empleado.id}
                  imprimir={imprimir}
                />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
