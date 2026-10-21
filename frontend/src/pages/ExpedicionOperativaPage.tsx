import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTurnoExpedicion } from "../components/expedicion/turnoExpedicion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claveOperacion,
  ejecutarOperacion,
  obtenerOperativa,
  importarRespaldo,
  type ExpedicionOperativa,
  type ProductoOperativo,
  type OrdenOperativa,
  type LineaCarga,
  type MovimientoOperativo,
} from "../api/expedicionOperativa";
import { Table, SearchSelect, Lines } from "../components/expedicion/Controles";
import { fmt, normalizar } from "../components/expedicion/format";
import ListadoPendientes, {
  ReportePendientes,
} from "../components/expedicion/ListadoPendientes";
import { filtrarPendientes } from "../components/expedicion/pendientes";
import { tiposOrden } from "../components/expedicion/ordenes";
import ListadoStock, {
  ReporteStock,
} from "../components/expedicion/ListadoStock";
import {
  columnasStockCSV,
  filasStockCSV,
} from "../components/expedicion/stockReporte";
import ListadoOrdenesCarga, {
  ReporteOrdenesCarga,
} from "../components/expedicion/ListadoOrdenesCarga";
import "./ExpedicionOperativa.css";
import ListadoMateriales, {
  ReporteMateriales,
} from "../components/expedicion/ListadoMateriales";
import ListadoMovimientos, {
  ReporteMovimientos,
} from "../components/expedicion/ListadoMovimientos";
import GestionEmpleados from "../components/expedicion/GestionEmpleados";
import ListadoConteos, {
  DetalleConteo,
  ReporteConteos,
} from "../components/expedicion/ListadoConteos";
import FormularioConteo from "../components/expedicion/FormularioConteo";
import ListadoAuditoria, {
  ReporteAuditoria,
} from "../components/expedicion/ListadoAuditoria";
import ConfiguracionExpedicion, {
  ReporteConfiguracion,
} from "../components/expedicion/ConfiguracionExpedicion";
import CopiasSeguridad from "../components/expedicion/CopiasSeguridad";
import ResumenConsumos from "../components/expedicion/ResumenConsumos";
import DiagnosticoStock from "../components/expedicion/DiagnosticoStock";
import {
  detalleAuditoria,
  entidadAuditoria,
  usuarioAuditoria,
} from "../components/expedicion/auditoria";

const circuitos: Record<string, string> = {
  administrative: "Pendiente administrativo",
  preventa: "Preventa",
  distriC: "Distri C",
  distriInterior: "Distri Interior",
  oesteMendoza: "Oeste Mendoza",
  oesteJeremias: "Oeste Jeremías",
  immediate: "Salida inmediata",
};
const tabs: Record<string, string> = {
  inicio: "Resumen del turno",
  ordenes: "Órdenes de carga",
  pendientes: "Pendientes y cambios",
  stock: "Stock y pendientes",
  movimientos: "Libro de movimientos",
  materiales: "Pallets y chapadur",
  empleados: "Gestión de empleados",
  conteos: "Conteos y relevo",
  auditoria: "Auditoría",
  configuracion: "Configuración",
  fleteros: "Fleteros",
};
const tipos = {
  PRODUCCION: "Producción codificada",
  PRODUCCION_SIN_CODIFICAR: "Producción sin codificar",
  REBOTE: "Rebote",
  DERRAME: "Derrame (sin impacto físico)",
  AJUSTE: "Ajuste de inventario",
  BUFFET: "Consumo interno / Buffet",
  TRANSFERENCIA: "Mendoza / San Juan",
};
function tipoMovimiento(m: MovimientoOperativo): string {
  if (m.tipo === "TRANSFERENCIA" && m.destino)
    return `${m.direccion === "ENTRADA" ? "Recepción desde" : "Envío a"} ${m.destino}`;
  return (
    (
      {
        ...tipos,
        ORDEN_CARGA: "Orden de carga",
        CORRECCION: "Corrección de orden",
        ANULACION: "Anulación de orden",
        INGRESO: "Ingreso",
        CONSUMO_EMPLEADO: "Consumo de empleado",
        ANTICIPO_EMPLEADO: "Anticipo de empleado",
      } as Record<string, string>
    )[m.tipo] || m.tipo
  );
}
const mf = [
  "pallets_salida",
  "pallets_entrada",
  "chapadur_salida",
  "chapadur_entrada",
] as const;
const ml = [
  "Pallets entregados",
  "Pallets devueltos",
  "Chapadur entregado",
  "Chapadur devuelto",
];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function equivalente(
  qty: number,
  p?: ProductoOperativo,
  pallets = false,
): string {
  if (!p) return `${fmt(qty)} un.`;
  const sign = qty < 0 ? "−" : "";
  qty = Math.abs(qty);
  const per = p.unidades_pack * p.packs_corte * p.cortes_pallet;
  const pl = pallets ? Math.floor(qty / per) : 0;
  const rest = qty - pl * per;
  return (
    sign +
    [
      pl ? `${pl} pallets` : "",
      `${Math.floor(rest / p.unidades_pack)} packs`,
      rest % p.unidades_pack ? `${fmt(rest % p.unidades_pack)} un.` : "",
    ]
      .filter(Boolean)
      .join(" + ")
  );
}
function csv(name: string, headers: string[], rows: unknown[][]) {
  const safe = (v: unknown) => {
    const s = String(v ?? "");
    return `"${(/^[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
  };
  download(
    name + ".csv",
    "\ufeff" +
      [headers, ...rows].map((r) => r.map(safe).join(";")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type FormValues = Record<string, string | number | boolean>;
type Dialog = {
  accion: string;
  title: string;
  values: FormValues;
  lines?: LineaCarga[];
  materialesModo?: "carga" | "devolucion";
};

export default function ExpedicionOperativaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["expedicion-operativa"],
    queryFn: obtenerOperativa,
    refetchInterval: 30000,
  });
  const data = query.data;
  const parts = location.pathname.split("/");
  const section = parts[2] || "inicio";
  const selectedOrder = data?.ordenes.find((o) => o.id === Number(parts[3]));
  const esListadoOrdenes = section === "ordenes" && !selectedOrder;
  const esListadoPendientes = section === "pendientes";
  const esListadoStock = section === "stock";
  const esListadoMateriales = section === "materiales";
  const esListadoMovimientos = section === "movimientos";
  const esGestionEmpleados = section === "empleados";
  const esListadoConteos = section === "conteos";
  const esListadoAuditoria = section === "auditoria";
  const esConfiguracion = section === "configuracion";
  const esListadoCompacto =
    esListadoOrdenes ||
    esListadoPendientes ||
    esListadoStock ||
    esListadoMateriales ||
    esListadoMovimientos ||
    esGestionEmpleados ||
    esListadoConteos ||
    esListadoAuditoria ||
    esConfiguracion;
  const { turno } = useTurnoExpedicion();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [carrier, setCarrier] = useState(0);
  const [status, setStatus] = useState("");
  const [filterShift, setFilterShift] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [lines, setLines] = useState<LineaCarga[]>([]);
  const [actual, setActual] = useState<LineaCarga[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const operationKey = useRef("");
  const attempted = useRef<{ body: string; key: string } | null>(null);
  const [print, setPrint] = useState<ReactNode>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [inlineCarrier, setInlineCarrier] = useState(false);
  const [restore, setRestore] = useState<{
    archivo: unknown;
    revision: number;
    cantidades: Record<string, number>;
  } | null>(null);
  const [copiasAbiertas, setCopiasAbiertas] = useState(false);
  const [filterProduct, setFilterProduct] = useState(0);
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const product = (id: number) => data?.productos.find((p) => p.id === id);
  const carrierName = (id: number) => {
    const f = data?.fleteros.find((f) => f.id === id);
    return f ? `${f.nombre} ${f.apellido} · ${f.empresa}` : "—";
  };
  const qtyLine = (id: number, quantity: number): LineaCarga => {
    const size = product(id)?.unidades_pack || 1;
    return {
      producto: id,
      packs: Math.floor(quantity / size),
      unidades: quantity % size,
    };
  };
  function open(d: Dialog) {
    opener.current = document.activeElement as HTMLElement;
    setDialog(d);
    setValues({ fecha: today(), ...d.values });
    setLines(d.lines || []);
    setActual([]);
    setError("");
    setMessage("");
    operationKey.current = claveOperacion();
    attempted.current = null;
    setInlineCarrier(false);
  }
  function close() {
    if (!busy) {
      setDialog(null);
      setError("");
      opener.current?.focus();
      if (parts[3] === "nueva" || parts[4] === "editar")
        navigate(
          selectedOrder
            ? `/expedicion/ordenes/${selectedOrder.id}`
            : "/expedicion/ordenes",
        );
    }
  }
  function editOrder(o?: OrdenOperativa) {
    open({
      accion: "orden",
      title: o ? `Corregir orden ${o.numero}` : "Nueva orden de carga",
      values: o
        ? {
            id: o.id,
            numero: o.numero,
            fecha: o.fecha,
            fletero: o.fletero,
            circuito: o.circuito,
            version: o.version,
            facturacion: o.facturacion,
            observaciones: o.observaciones,
          }
        : { circuito: "administrative", facturacion: "NO_APLICA" },
      lines: o?.detalles.map((l) =>
        qtyLine(l.producto, Number(l.cantidad_solicitada)),
      ),
    });
    if (o?.circuito === "immediate") {
      const totals = new Map<number, number>();
      o.entregas.forEach((e) =>
        e.detalles.forEach((l) =>
          totals.set(
            l.producto,
            (totals.get(l.producto) || 0) + l.cantidad_entregada,
          ),
        ),
      );
      setActual(
        [...totals].filter(([, q]) => q > 0).map(([p, q]) => qtyLine(p, q)),
      );
      const ms = data?.materiales.filter((m) => m.orden === o.id) || [];
      const po = ms.reduce(
          (s, m) => s + m.pallets_salida - m.pallets_entrada,
          0,
        ),
        co = ms.reduce((s, m) => s + m.chapadur_salida - m.chapadur_entrada, 0);
      setValues((v) => ({
        ...v,
        pallets_salida: Math.max(0, po),
        pallets_entrada: Math.max(0, -po),
        chapadur_salida: Math.max(0, co),
        chapadur_entrada: Math.max(0, -co),
      }));
    }
  }
  useEffect(() => {
    setSearch("");
    setFrom("");
    setTo("");
    setStatus("");
    setCarrier(0);
    setFilterShift("");
    setFilterProduct(0);
    setFilterUser("");
    setFilterType("");
  }, [section]);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, []);
  useEffect(() => {
    if (dialog)
      modalRef.current
        ?.querySelector<HTMLElement>("input,select,button")
        ?.focus();
  }, [dialog]);
  useEffect(() => {
    if (!print) return;
    const done = () => setPrint(null);
    window.addEventListener("afterprint", done);
    const timer = setTimeout(() => window.print(), 150);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [print]);
  // Las URL históricas siguen abriendo la misma orden/formulario.
  const routedForm = useRef("");
  useEffect(() => {
    if (!data || routedForm.current === location.pathname) return;
    if (
      section === "ordenes" &&
      (parts[3] === "nueva" || (parts[4] === "editar" && selectedOrder))
    ) {
      routedForm.current = location.pathname;
      editOrder(selectedOrder);
    }
  });
  function field(name: string, label: string, type = "text", required = false) {
    return (
      <label>
        {label}
        <input
          name={name}
          type={type}
          required={required}
          readOnly={
            dialog?.accion === "producto" &&
            Boolean(values.id) &&
            name === "codigo"
          }
          value={String(values[name] ?? "")}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "1" : undefined}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              [name]:
                type === "number" ? Number(e.target.value) : e.target.value,
            }))
          }
        />
      </label>
    );
  }
  function select(
    name: string,
    label: string,
    options: Record<string, string>,
  ) {
    return (
      <label>
        {label}
        <select
          aria-label={label}
          value={String(values[name] ?? Object.keys(options)[0])}
          onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
        >
          {Object.entries(options).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
    );
  }
  function check(name: string, label: string, defaultValue = false) {
    return (
      <label className="eo-check">
        <input
          type="checkbox"
          checked={Boolean(values[name] ?? defaultValue)}
          onChange={(e) =>
            setValues((v) => ({ ...v, [name]: e.target.checked }))
          }
        />
        {label}
      </label>
    );
  }
  const carrierField = () => (
    <SearchSelect
      label="Fletero"
      options={
        data?.fleteros
          .filter((f) => f.activo)
          .map((f) => ({ id: f.id, label: carrierName(f.id) })) || []
      }
      value={Number(values.fletero || 0)}
      onChange={(id) => setValues((v) => ({ ...v, fletero: id }))}
    />
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dialog || busy || !online) return;
    setBusy(true);
    setError("");
    try {
      if (dialog.accion === "restaurar" && restore) {
        if (values.confirmacion !== "RESTAURAR")
          throw new Error("Escribí RESTAURAR para confirmar.");
        await importarRespaldo(
          restore.archivo,
          restore.revision,
          String(values.confirmacion),
        );
        setRestore(null);
        setDialog(null);
        await cache.invalidateQueries({
          predicate: (q) => String(q.queryKey[0]).startsWith("expedicion"),
        });
        setMessage(
          "Respaldo restaurado. Se guardó una copia previa en el servidor.",
        );
        return;
      }
      const payload: Record<string, unknown> = {
        ...values,
        accion: dialog.accion,
        turno,
        lineas: lines,
      };
      if (
        dialog.accion === "orden" &&
        values.circuito === "immediate" &&
        actual.length
      )
        payload.entregado = actual;
      if (dialog.accion === "pendientes")
        payload.pendientes = Object.fromEntries(
          Object.keys(circuitos)
            .filter((k) => !["administrative", "immediate"].includes(k))
            .map((k) => [k, Number(values[k] || 0)]),
        );
      const body = JSON.stringify(payload);
      if (attempted.current?.body !== body)
        attempted.current = { body, key: claveOperacion() };
      payload.clave = attempted.current.key;
      const result = await ejecutarOperacion(payload);
      await cache.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith("expedicion"),
      });
      setDialog(null);
      setMessage("Operación guardada correctamente.");
      if (result.id && ["orden", "entrega"].includes(dialog.accion))
        navigate(`/expedicion/ordenes/${result.id}`);
      if (result.comprobante) {
        const fresh = await obtenerOperativa();
        showReceipt(fresh, result.comprobante);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar. Tus datos siguen en el formulario.",
      );
    } finally {
      setBusy(false);
    }
  }
  function showReceipt(d: ExpedicionOperativa, id: number) {
    const c = d.comprobantes.find((c) => c.id === id);
    if (!c) return;
    const e = d.empleados.find((e) => e.id === c.empleado);
    setPrint(
      <>
        {["Facturación", "Guardia"].map((copy) => (
          <article className="eo-receipt" key={copy}>
            <h2>Logística Talca · {c.numero}</h2>
            <p>
              {copy} · {c.tipo} · {new Date(c.fecha).toLocaleString("es-AR")}
            </p>
            <p>
              Legajo {e?.legajo} · {e?.nombre} {e?.apellido}
            </p>
            <Table
              headers={["Código", "Producto", "Cantidad"]}
              rows={c.lineas.map((l) => [
                l.codigo,
                l.nombre,
                `${Math.floor(l.unidades / l.pack)} packs + ${l.unidades % l.pack} un.`,
              ])}
            />
            <p>{c.observaciones}</p>
            <p>
              {c.usuario} · Turno {c.turno}
            </p>
            <p className="eo-sign">
              Firma empleado ____________________ Firma responsable
              ____________________
            </p>
          </article>
        ))}
      </>,
    );
  }
  const matches = (value: string) =>
    normalizar(value).includes(normalizar(search));
  const button = (label: string, d: Dialog) => (
    <button type="button" disabled={!online} onClick={() => open(d)}>
      {label}
    </button>
  );
  const movementButton = () =>
    button("Registrar movimiento", {
      accion: "movimiento",
      title: "Movimiento de mercadería",
      values: { tipo: "PRODUCCION", direccion: "ENTRADA", destino: "Mendoza" },
    });
  function orderDetail(o: OrdenOperativa) {
    return (
      <>
        <div className="eo-section-title">
          <div>
            <h2>Orden {o.numero}</h2>
            <p>
              {o.fecha} · {o.fletero_nombre} · {circuitos[o.circuito]} ·{" "}
              {o.facturacion}
            </p>
          </div>
          <span className="eo-badge">{o.estado_operativo}</span>
        </div>
        <p>{o.observaciones}</p>
        <Table
          headers={[
            "Código",
            "Producto",
            "Solicitado",
            "Resuelto",
            "Pendiente",
          ]}
          rows={o.detalles.map((l) => [
            l.codigo,
            l.producto_nombre,
            equivalente(Number(l.cantidad_solicitada), product(l.producto)),
            equivalente(l.resuelto, product(l.producto)),
            equivalente(l.pendiente, product(l.producto)),
          ])}
        />
        <div className="eo-actions no-print">
          <Link to="/expedicion/ordenes">Volver a órdenes</Link>
          <button onClick={() => setPrint(orderDetail(o))}>
            Imprimir orden
          </button>
          {!o.anulada && (
            <>
              <button onClick={() => editOrder(o)}>Corregir orden</button>
              {o.circuito !== "immediate" &&
                o.detalles.some((l) => l.pendiente > 0) &&
                button("Confirmar salida", {
                  accion: "entrega",
                  title: `Salida de orden ${o.numero}`,
                  values: { id: o.id, version: o.version },
                  lines: o.detalles
                    .filter((l) => l.pendiente > 0)
                    .map((l) => ({
                      ...qtyLine(l.producto, l.pendiente),
                      solicitado: l.producto,
                    })),
                })}
              {button("Anular con reversión", {
                accion: "anular",
                title: `Anular orden ${o.numero}`,
                values: { id: o.id, version: o.version },
              })}
            </>
          )}
        </div>
        <h3>Entregas y correcciones</h3>
        {o.entregas.map((e) => (
          <article className="eo-card" key={e.id}>
            <p>
              {new Date(e.fecha).toLocaleString("es-AR")} ·{" "}
              {e.creado_por_nombre} · Turno {e.turno || "Histórico"} ·{" "}
              {e.observaciones}
            </p>
            <Table
              headers={["Producto entregado", "Cantidad", "Corresponde a"]}
              rows={e.detalles.map((l) => [
                l.producto_nombre,
                equivalente(l.cantidad_entregada, product(l.producto)),
                product(l.solicitado)?.nombre,
              ])}
            />
          </article>
        ))}
        <h3>Historial de cambios</h3>
        <Table
          headers={["Fecha", "Responsable", "Acción", "Motivo"]}
          rows={(data?.auditoria || [])
            .filter(
              (a) =>
                a.antes.id === o.id ||
                a.despues.id === o.id ||
                a.referencia === o.numero,
            )
            .map((a) => [
              new Date(a.fecha).toLocaleString("es-AR"),
              a.usuario,
              a.accion,
              a.motivo,
            ])}
        />
      </>
    );
  }
  if (query.isPending)
    return (
      <div className="eo">
        <p role="status">Cargando Expedición…</p>
      </div>
    );
  if (!data)
    return (
      <div className="eo">
        <p role="alert">
          {query.error?.message || "No se pudo cargar Expedición."}
        </p>
        <button onClick={() => query.refetch()}>Reintentar</button>
      </div>
    );

  const shiftMoves = data.movimientos.filter(
    (m) => m.fecha === today() && m.turno === turno,
  );
  const shiftMaterials = data.materiales.filter(
    (m) => m.fecha === today() && m.turno === turno,
  );
  const shiftSummary = (
    <>
      <h2>Logística Talca · Resumen del turno</h2>
      <p>
        {today()} · {turno} · {data.usuario}
      </p>
      <Table
        headers={[
          "Operación",
          "Referencia",
          "Producto",
          "Dirección",
          "Cantidad",
        ]}
        rows={shiftMoves.map((m) => [
          tipoMovimiento(m),
          m.referencia,
          product(m.producto)?.nombre,
          m.sin_impacto ? "Sin impacto" : m.direccion,
          equivalente(m.cantidad, product(m.producto)),
        ])}
      />
      <h3>Pallets y chapadur</h3>
      <Table
        headers={["Fletero", ...ml]}
        rows={shiftMaterials.map((m) => [
          carrierName(m.fletero),
          ...mf.map((k) => m[k]),
        ])}
      />
    </>
  );
  const shiftOrders = data.ordenes.filter(
    (o) =>
      (o.creado_en.slice(0, 10) === today() && o.turno === turno) ||
      o.entregas.some(
        (e) => e.fecha_operativa === today() && e.turno === turno,
      ) ||
      data.auditoria.some(
        (a) =>
          a.accion === "Corregir orden" &&
          a.despues.id === o.id &&
          a.fecha.slice(0, 10) === today() &&
          a.turno === turno,
      ),
  );
  const fullShiftSummary = (
    <>
      <div className="eo-print-brand">
        <img src="/logo-talca.png" alt="Talca" />
        <h2>
          Resumen operativo · {today()} · {turno}
        </h2>
      </div>
      <h3>Órdenes trabajadas en el turno</h3>
      {shiftOrders.length ? (
        shiftOrders.map((o) => (
          <article key={o.id}>
            <h3>
              {o.numero} · {o.fletero_nombre}
            </h3>
            <p>
              {o.estado_operativo} · {circuitos[o.circuito]}
            </p>
            <Table
              headers={[
                "Producto",
                "Solicitado",
                "Entregado en turno",
                "Pendiente actual",
              ]}
              rows={o.detalles.map((l) => [
                l.producto_nombre,
                equivalente(Number(l.cantidad_solicitada), product(l.producto)),
                equivalente(
                  o.entregas
                    .filter(
                      (e) => e.fecha_operativa === today() && e.turno === turno,
                    )
                    .reduce(
                      (s, e) =>
                        s +
                        e.detalles
                          .filter((d) => d.producto === l.producto)
                          .reduce((q, d) => q + d.cantidad_entregada, 0),
                      0,
                    ),
                  product(l.producto),
                ),
                equivalente(l.pendiente, product(l.producto)),
              ])}
            />
          </article>
        ))
      ) : (
        <p>No se trabajaron órdenes en este turno.</p>
      )}
      {shiftSummary}
    </>
  );
  const renderContent = () => {
    if (selectedOrder && section === "ordenes")
      return orderDetail(selectedOrder);
    if (
      section === "ordenes" &&
      parts[3] &&
      !["nueva"].includes(parts[3]) &&
      !selectedOrder
    )
      return <p>La orden solicitada no existe.</p>;
    switch (section) {
      case "inicio":
        return (
          <>
            <div className="eo-kpis">
              {[
                [
                  "Órdenes con pendientes",
                  data.ordenes.filter(
                    (o) =>
                      !o.anulada && o.detalles.some((l) => l.pendiente > 0),
                  ).length,
                ],
                ["Movimientos del turno", shiftMoves.length],
                [
                  "Productos sin stock",
                  data.productos.filter((p) => p.activo && p.stock <= 0).length,
                ],
                [
                  "Relevos por corroborar",
                  data.conteos.filter((c) => !c.corroborado_en).length,
                ],
              ].map(([label, value]) => (
                <article className="eo-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <div className="eo-actions">
              <button onClick={() => editOrder()}>Nueva orden</button>
              {movementButton()}
              {button("Devolución de materiales", {
                accion: "materiales",
                title: "Devolución de materiales",
                values: { origen: "Devolución general" },
              })}
              <Link to="/expedicion/empleados">Consumos y anticipos</Link>
              <button onClick={() => setPrint(fullShiftSummary)}>
                Imprimir resumen de turno
              </button>
            </div>
            {data.conteos
              .filter((c) => !c.corroborado_en && c.turno !== turno)
              .map((c) => (
                <p className="eo-notice" key={c.id}>
                  Relevo pendiente: turno {c.turno} · {c.usuario}.{" "}
                  <Link to="/expedicion/conteos">Revisar conteo</Link>
                </p>
              ))}
            {fullShiftSummary}
          </>
        );
      case "ordenes":
        return (
          <ListadoOrdenesCarga
            data={data}
            imprimir={(ordenes, filtros) =>
              setPrint(
                <>
                  <h2>Reporte de órdenes de carga</h2>
                  <p>
                    {filtros.dia ? `Día: ${filtros.dia} · ` : ""}
                    {filtros.encargado
                      ? `Encargado: ${filtros.encargado} · `
                      : ""}
                    {filtros.turno ? `Turno: ${filtros.turno} · ` : ""}
                    {filtros.fletero
                      ? `Fletero: ${carrierName(filtros.fletero)} · `
                      : ""}
                    {ordenes.length} órdenes
                  </p>
                  <ReporteOrdenesCarga
                    ordenes={ordenes}
                    productos={data.productos}
                    imprimible
                  />
                </>,
              )
            }
            exportar={(headers, rows) => csv("ordenes", headers, rows)}
          />
        );
      case "pendientes":
        return (
          <ListadoPendientes
            data={data}
            imprimir={(ordenes, filtros) =>
              setPrint(
                <>
                  <h2>Pendientes y cambios</h2>
                  <p>
                    {filtros.desde ? `Desde: ${filtros.desde} · ` : ""}
                    {filtros.fletero
                      ? `Fletero: ${carrierName(filtros.fletero)} · `
                      : ""}
                    {ordenes.length} órdenes pendientes
                  </p>
                  <ReportePendientes ordenes={ordenes} imprimible />
                </>,
              )
            }
          />
        );
      case "stock":
        return (
          <ListadoStock
            productos={data.productos}
            online={online}
            ajustar={() =>
              open({
                accion: "movimiento",
                title: "Ajustar stock físico",
                values: { tipo: "AJUSTE", direccion: "ENTRADA" },
              })
            }
            registrar={() =>
              open({
                accion: "movimiento",
                title: "Registrar movimiento",
                values: { tipo: "PRODUCCION", direccion: "ENTRADA" },
              })
            }
            editar={(p) =>
              open({
                accion: "pendientes",
                title: `Pendientes adicionales · ${p.nombre}`,
                values: { producto: p.id, ...p.pendientes_manuales },
              })
            }
            exportar={(pallets) =>
              csv(
                "stock_y_pendientes",
                columnasStockCSV,
                filasStockCSV(data.productos, pallets),
              )
            }
            imprimir={(productos, pallets, filtros) =>
              setPrint(
                <>
                  <h2>Stock y pendientes</h2>
                  <p>
                    {pallets ? "Vista en pallets" : "Vista en fardos"}
                    {filtros.busqueda ? ` · Buscar: ${filtros.busqueda}` : ""}
                    {filtros.estado
                      ? ` · Estado: ${filtros.estado}`
                      : ""} · {productos.length} productos
                  </p>
                  <ReporteStock productos={productos} pallets={pallets} />
                  <p className="eo-help">Totales en fardos equivalentes.</p>
                </>,
              )
            }
          />
        );
      case "movimientos":
        return (
          <ListadoMovimientos
            movimientos={data.movimientos}
            productos={data.productos}
            online={online}
            nuevo={(tipo) =>
              open({
                accion: "movimiento",
                title: tipo === "REBOTE" ? "Nuevo rebote" : "Nuevo derrame",
                values: { tipo, direccion: "ENTRADA" },
              })
            }
            registrar={() =>
              open({
                accion: "movimiento",
                title: "Registrar movimiento",
                values: { tipo: "PRODUCCION", direccion: "ENTRADA" },
              })
            }
            corregir={(m) =>
              open({
                accion: "corregir_movimiento",
                title: "Corregir movimiento",
                values: {
                  operacion: m.operacion,
                  referencia: m.referencia,
                  fecha: m.fecha,
                },
              })
            }
            imprimir={(grupos, filtros) =>
              setPrint(
                <>
                  <h2>Libro de movimientos</h2>
                  <p>
                    {filtros.desde ? `Desde: ${filtros.desde} · ` : ""}
                    {filtros.hasta ? `Hasta: ${filtros.hasta} · ` : ""}
                    {filtros.tipo ? `Tipo: ${filtros.tipo} · ` : ""}
                    {grupos.length} registros · Totales en fardos equivalentes
                  </p>
                  <ReporteMovimientos
                    grupos={grupos}
                    productos={data.productos}
                    imprimible
                  />
                </>,
              )
            }
            exportar={(lineas) =>
              csv(
                "movimientos",
                [
                  "Fecha",
                  "Tipo",
                  "Referencia",
                  "Producto",
                  "Cantidad (un.)",
                  "Dirección",
                  "Turno",
                  "Usuario",
                ],
                lineas.map((m) => [
                  m.fecha,
                  tipoMovimiento(m),
                  m.referencia,
                  product(m.producto)?.nombre,
                  m.cantidad,
                  m.sin_impacto ? "Sin impacto" : m.direccion,
                  m.turno,
                  m.usuario,
                ]),
              )
            }
          />
        );
      case "materiales":
        return (
          <ListadoMateriales
            movimientos={data.materiales}
            fleteros={data.fleteros}
            online={online}
            registrar={(modo) =>
              open({
                accion: "materiales",
                title:
                  modo === "carga"
                    ? "Nueva carga de materiales por turno"
                    : "Devolución general de materiales",
                materialesModo: modo,
                values: {
                  origen:
                    modo === "carga" ? "Carga por turno" : "Devolución general",
                  referencia:
                    modo === "carga" ? `Turno ${turno}` : "Devolución general",
                  pallets_salida: 0,
                  pallets_entrada: 0,
                  chapadur_salida: 0,
                  chapadur_entrada: 0,
                },
              })
            }
            imprimir={(movimientos, filtros) =>
              setPrint(
                <>
                  <h2>Pallets y chapadur</h2>
                  <p>
                    {filtros.desde ? `Desde: ${filtros.desde} · ` : ""}
                    {filtros.hasta ? `Hasta: ${filtros.hasta} · ` : ""}
                    {filtros.fletero
                      ? `Fletero: ${carrierName(filtros.fletero)} · `
                      : ""}
                    {filtros.tipo ? `Tipo: ${filtros.tipo} · ` : ""}
                    {movimientos.length} movimientos
                  </p>
                  <ReporteMateriales
                    movimientos={movimientos}
                    fleteros={data.fleteros}
                  />
                </>,
              )
            }
          />
        );
      case "empleados":
        return (
          <GestionEmpleados
            data={data}
            online={online}
            acreditar={() =>
              open({
                accion: "acreditar",
                title: "Acreditar beneficio",
                values: {},
              })
            }
            editar={(e) =>
              open({
                accion: "empleado",
                title: e ? "Modificar empleado" : "Empleado",
                values: e ? { ...e } : { activo: true },
              })
            }
            operarModal={(e, tipo) =>
              open({
                accion: "consumo",
                title: `${tipo === "CONSUMO" ? "Consumo" : "Anticipo"} · ${e.nombre}`,
                values: { empleado: e.id, tipo },
              })
            }
            guardar={async (operacion) => {
              const result = await ejecutarOperacion({
                accion: "consumo",
                turno,
                ...operacion,
              });
              await cache.invalidateQueries({
                predicate: (q) =>
                  String(q.queryKey[0]).startsWith("expedicion"),
              });
              const fresh = await obtenerOperativa();
              cache.setQueryData(["expedicion-operativa"], fresh);
              const c = fresh.comprobantes.find(
                (c) => c.id === result.comprobante,
              );
              if (!c)
                throw new Error(
                  "La operación fue registrada, pero no se pudo recuperar el comprobante. Reintentá para consultarlo sin duplicar la operación.",
                );
              return c;
            }}
            imprimir={(id) => showReceipt(data, id)}
            imprimirPadron={(empleados) =>
              setPrint(
                <>
                  <h2>Padrón de empleados</h2>
                  <Table
                    headers={[
                      "Legajo",
                      "Empleado",
                      "Estado",
                      "Saldo beneficio",
                    ]}
                    rows={empleados.map((e) => [
                      e.legajo,
                      `${e.nombre} ${e.apellido}`,
                      e.activo ? "Activo" : "Inactivo",
                      `${fmt(e.saldo_fardos)} fardos`,
                    ])}
                  />
                  <h3>Comprobantes e historial</h3>
                  <Table
                    headers={["Comprobante", "Fecha", "Tipo", "Productos"]}
                    rows={data.comprobantes
                      .filter((c) => empleados.some((e) => e.id === c.empleado))
                      .map((c) => [
                        c.numero,
                        new Date(c.fecha).toLocaleString("es-AR"),
                        c.tipo,
                        c.lineas
                          .map((l) => `${l.nombre}: ${l.unidades} un.`)
                          .join(" · "),
                      ])}
                  />
                </>,
              )
            }
          />
        );
      case "conteos":
        return (
          <ListadoConteos
            conteos={data.conteos}
            turno={turno}
            online={online}
            nuevo={() =>
              open({
                accion: "conteo",
                title: `Conteo físico · ${turno}`,
                values: { tipo: "Cierre de turno" },
                lines: data.productos
                  .filter((p) => p.activo)
                  .map((p) => qtyLine(p.id, Math.max(0, p.stock))),
              })
            }
            corroborar={(c) =>
              open({
                accion: "corroborar",
                title: "Confirmar recepción del turno anterior",
                values: { id: c.id },
              })
            }
            imprimir={(conteos, filtros) =>
              setPrint(
                <>
                  <h2>Conteos y relevo</h2>
                  <p>
                    {filtros.desde ? `Desde: ${filtros.desde} · ` : ""}
                    {filtros.hasta ? `Hasta: ${filtros.hasta} · ` : ""}
                    {filtros.turno ? `Turno: ${filtros.turno} · ` : ""}
                    {conteos.length} conteos · El conteo no ajusta el stock
                    físico.
                  </p>
                  <ReporteConteos conteos={conteos} />
                </>,
              )
            }
            imprimirDetalle={(c) =>
              setPrint(
                <>
                  <h2>
                    {c.tipo} · {c.turno}
                  </h2>
                  <DetalleConteo conteo={c} />
                </>,
              )
            }
          />
        );
      case "auditoria":
        return (
          <ListadoAuditoria
            registros={data.auditoria}
            productos={data.productos}
            exportar={(registros) =>
              csv(
                "auditoria",
                [
                  "Fecha",
                  "Usuario",
                  "Acción",
                  "Entidad",
                  "Referencia",
                  "Detalle",
                  "Turno",
                  "Motivo",
                  "Antes",
                  "Después",
                  "Entidad clasificada",
                ],
                registros.map((a) => [
                  a.fecha,
                  usuarioAuditoria(a),
                  a.accion,
                  entidadAuditoria(a).texto,
                  a.referencia,
                  detalleAuditoria(a, data.productos),
                  a.turno,
                  a.motivo,
                  JSON.stringify(a.antes),
                  JSON.stringify(a.despues),
                  entidadAuditoria(a).clasificada ? "Sí" : "No",
                ]),
              )
            }
            imprimir={(registros, filtros) =>
              setPrint(
                <>
                  <h2>Auditoría</h2>
                  <p>
                    {filtros.desde ? `Desde: ${filtros.desde} · ` : ""}
                    {filtros.hasta ? `Hasta: ${filtros.hasta} · ` : ""}
                    {filtros.turno ? `Turno: ${filtros.turno} · ` : ""}
                    {filtros.accion ? `Acción: ${filtros.accion} · ` : ""}
                    {registros.length} registros de solo lectura
                  </p>
                  <ReporteAuditoria
                    registros={registros}
                    productos={data.productos}
                    imprimible
                  />
                  <p>
                    La entidad se clasifica por la acción cuando no está
                    informada.
                  </p>
                </>,
              )
            }
          />
        );
      case "fleteros":
        return (
          <>
            <div className="eo-actions">
              {button("Nuevo fletero", {
                accion: "fletero",
                title: "Fletero",
                values: { activo: true },
              })}
            </div>
            <Table
              headers={["Nombre", "Apellido", "Empresa", "Estado", "Acción"]}
              rows={data.fleteros
                .filter((f) =>
                  matches(`${f.nombre} ${f.apellido} ${f.empresa}`),
                )
                .map((f) => [
                  f.nombre,
                  f.apellido,
                  f.empresa,
                  f.activo ? "Activo" : "Inactivo",
                  button("Modificar", {
                    accion: "fletero",
                    title: "Modificar fletero",
                    values: { ...f },
                  }),
                ])}
            />
          </>
        );
      case "configuracion":
        return (
          <ConfiguracionExpedicion
            data={data}
            online={online}
            imprimir={(usuarios, fleteros, productos) =>
              setPrint(
                <>
                  <h2>Configuración de Expedición</h2>
                  <p>
                    {today()} · {data.usuario} · Listados según los filtros
                    seleccionados.
                  </p>
                  <ReporteConfiguracion
                    usuarios={usuarios}
                    fleteros={fleteros}
                    productos={productos}
                    admin={data.admin}
                  />
                </>,
              )
            }
            nuevoUsuario={() =>
              open({
                accion: "usuario",
                title: "Usuario de Expedición",
                values: { activo: true },
              })
            }
            modificarUsuario={(u) =>
              open({
                accion: "usuario",
                title: "Modificar usuario",
                values: { ...u },
              })
            }
            nuevoFletero={() =>
              open({
                accion: "fletero",
                title: "Fletero",
                values: { activo: true },
              })
            }
            modificarFletero={(f) =>
              open({
                accion: "fletero",
                title: "Modificar fletero",
                values: { ...f },
              })
            }
            nuevoProducto={() =>
              open({
                accion: "producto",
                title: "Producto",
                values: {
                  activo: true,
                  unidades_pack: 6,
                  packs_corte: 20,
                  cortes_pallet: 4,
                },
              })
            }
            configurarProducto={(p) =>
              open({
                accion: "producto",
                title: `Configurar ${p.nombre}`,
                values: {
                  id: p.id,
                  codigo: p.codigo,
                  nombre: p.nombre,
                  alias: p.alias,
                  activo: p.activo,
                  unidades_pack: p.unidades_pack,
                  packs_corte: p.packs_corte,
                  cortes_pallet: p.cortes_pallet,
                  beneficio_empleado: p.beneficio_empleado,
                  minimo: p.minimo,
                  critico: p.critico,
                },
              })
            }
            copias={
              <CopiasSeguridad
                data={data}
                online={online}
                abierto={copiasAbiertas}
                cambiarAbierto={setCopiasAbiertas}
                descargar={download}
                actualizar={() =>
                  cache.invalidateQueries({
                    queryKey: ["expedicion-operativa"],
                  })
                }
                revisar={(preview) => {
                  setRestore(preview);
                  open({
                    accion: "restaurar",
                    title: "Restaurar respaldo de Expedición",
                    values: {},
                  });
                }}
              />
            }
          />
        );
      default:
        return <p>Seleccioná una sección de Expedición.</p>;
    }
  };
  const currentOrder = data.ordenes.find((o) => o.id === Number(values.id));
  return (
    <div
      className={`eo${esListadoCompacto ? " eo-orders-page" : ""}${esListadoPendientes ? " eo-pending-page" : ""}${esListadoStock ? " eo-stock-page" : ""}${esListadoMateriales ? " eo-material-page" : ""}${esListadoMovimientos ? " eo-movement-page" : ""}${esGestionEmpleados ? " eo-employee-page" : ""}${esListadoConteos ? " eo-counts-page" : ""}${esListadoAuditoria ? " eo-audit-page" : ""}${esConfiguracion ? " eo-config-page" : ""}`}
    >
      <div className="eo-screen">
        <header className="eo-header">
          <div>
            <span className="eo-eyebrow">CONTROL OPERATIVO · EXPEDICIÓN</span>
            <h1>{tabs[section] || "Expedición"}</h1>
            <p>
              {esListadoOrdenes
                ? "Una orden puede tener varias entregas, pendientes y cambios."
                : esListadoPendientes
                  ? "Órdenes operativas con mercadería pendiente o sustituciones por definir."
                  : esListadoStock
                    ? "El stock físico conserva los valores ya cargados. Los pendientes se administran por producto."
                    : esListadoMateriales
                      ? "Cuenta corriente por fletero. Mendoza y San Juan también generan movimientos."
                      : esListadoMovimientos
                        ? "Trazabilidad de ingresos, salidas y movimientos sin impacto físico."
                        : esGestionEmpleados
                          ? "Buscá por legajo, nombre o apellido y gestioná consumo y anticipo desde la misma pantalla."
                          : esListadoConteos
                            ? "El cierre de un turno pasa al siguiente, que debe corroborarlo."
                            : esListadoAuditoria
                              ? "Historial de altas, modificaciones, anulaciones y operaciones."
                              : esConfiguracion
                                ? "Usuarios, fleteros, productos y resguardo de la información operativa."
                                : "Mercadería, entregas y trazabilidad en una misma operación."}
            </p>
          </div>
        </header>
        {esListadoOrdenes && (
          <button
            type="button"
            className="eo-primary eo-orders-new"
            disabled={!online}
            onClick={() => editOrder()}
          >
            Nueva orden
          </button>
        )}
        {esListadoPendientes && (
          <button
            type="button"
            className="eo-orders-new"
            title="Exportar todas las órdenes pendientes"
            onClick={() =>
              csv(
                "pendientes_por_orden",
                ["Orden", "Fecha", "Fletero", "Tipo"],
                filtrarPendientes(data.ordenes, { fletero: 0, desde: "" }).map(
                  (o) => [
                    o.numero,
                    o.fecha,
                    o.fletero_nombre,
                    tiposOrden[o.circuito] || "Pendiente",
                  ],
                ),
              )
            }
          >
            Exportar CSV
          </button>
        )}
        {esConfiguracion && (
          <button
            type="button"
            className="eo-primary eo-orders-new"
            aria-expanded={copiasAbiertas}
            aria-controls="eo-config-backups"
            onClick={() => setCopiasAbiertas(!copiasAbiertas)}
          >
            Copias de seguridad
          </button>
        )}
        {!esListadoCompacto && (
          <nav className="eo-tabs" aria-label="Secciones de Expedición">
            {Object.entries(tabs)
              .filter(([key]) => key !== "fleteros")
              .map(([key, label]) => (
                <Link
                  className={section === key ? "active" : ""}
                  key={key}
                  to={`/expedicion/${key}`}
                >
                  {label}
                </Link>
              ))}
          </nav>
        )}
        {!online && (
          <p role="alert" className="eo-error">
            Sin conexión. Podés consultar los datos cargados; las operaciones se
            habilitan al reconectar.
          </p>
        )}
        {query.isError && (
          <p className="eo-error" role="alert">
            No se pudo actualizar la información: {query.error.message}
          </p>
        )}
        {message && (
          <p role="status" className="eo-success">
            {message}
          </p>
        )}
        {!selectedOrder &&
          ![
            "inicio",
            "ordenes",
            "pendientes",
            "stock",
            "materiales",
            "movimientos",
            "empleados",
            "conteos",
            "auditoria",
            "configuracion",
          ].includes(section) && (
            <div className="eo-filters">
              <label>
                Buscar
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Código, nombre o referencia"
                />
              </label>
              {!["stock", "configuracion", "fleteros"].includes(section) && (
                <>
                  <label>
                    Desde
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  <label>
                    Turno
                    <select
                      value={filterShift}
                      onChange={(e) => setFilterShift(e.target.value)}
                    >
                      <option value="">Todos</option>
                      <option>Mañana</option>
                      <option>Tarde</option>
                    </select>
                  </label>
                </>
              )}
              {["ordenes", "pendientes", "materiales"].includes(section) && (
                <SearchSelect
                  label="Filtrar fletero"
                  required={false}
                  value={carrier}
                  onChange={setCarrier}
                  options={data.fleteros.map((f) => ({
                    id: f.id,
                    label: carrierName(f.id),
                  }))}
                />
              )}
              {["ordenes", "pendientes"].includes(section) && (
                <label>
                  Estado
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {[
                      ...new Set(data.ordenes.map((o) => o.estado_operativo)),
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
              {section === "ordenes" && (
                <label>
                  Responsable
                  <select
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {[
                      ...new Set(
                        data.ordenes.flatMap((o) => [
                          o.creado_por_nombre,
                          ...o.entregas.map((e) => e.creado_por_nombre),
                        ]),
                      ),
                    ]
                      .filter(Boolean)
                      .map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                  </select>
                </label>
              )}
              {section === "pendientes" && (
                <SearchSelect
                  label="Producto"
                  required={false}
                  value={filterProduct}
                  onChange={setFilterProduct}
                  options={data.productos.map((p) => ({
                    id: p.id,
                    label: `${p.codigo} · ${p.nombre}`,
                  }))}
                />
              )}
              {["movimientos", "materiales"].includes(section) && (
                <label>
                  Tipo
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {[
                      ...new Set(
                        section === "movimientos"
                          ? data.movimientos.map(tipoMovimiento)
                          : data.materiales.map((m) => m.origen),
                      ),
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                onClick={() => {
                  setSearch("");
                  setFrom("");
                  setTo("");
                  setCarrier(0);
                  setStatus("");
                  setFilterShift("");
                  setFilterProduct(0);
                  setFilterUser("");
                  setFilterType("");
                }}
              >
                Limpiar
              </button>
              <button
                onClick={() =>
                  setPrint(
                    <>
                      <h2>{tabs[section]}</h2>
                      {renderContent()}
                    </>,
                  )
                }
              >
                Imprimir
              </button>
            </div>
          )}
        <main className="eo-content">
          {["inicio", "movimientos", "empleados"].includes(section) && (
            <ResumenConsumos data={data} imprimir={setPrint} />
          )}
          {["stock", "configuracion"].includes(section) && (
            <DiagnosticoStock
              admin={data.admin}
              online={online}
              turno={turno}
              actualizar={() =>
                cache.invalidateQueries({ queryKey: ["expedicion-operativa"] })
              }
            />
          )}
          {renderContent()}
          {section === "inicio" && (
            <Link
              to="/expedicion/configuracion#eo-config-backups"
              onClick={() => setCopiasAbiertas(true)}
            >
              Copias de seguridad de Expedición
            </Link>
          )}
        </main>
        {dialog && (
          <div
            className="eo-overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              className="eo-dialog"
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="eo-dialog-title"
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Tab") {
                  const nodes = [
                    ...(modalRef.current?.querySelectorAll<HTMLElement>(
                      "input,select,textarea,button,a[href]",
                    ) || []),
                  ].filter(
                    (n) =>
                      !n.hasAttribute("disabled") && n.offsetParent !== null,
                  );
                  const first = nodes[0],
                    last = nodes[nodes.length - 1];
                  if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                  }
                }
              }}
            >
              <form
                onSubmit={submit}
                onKeyDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    e.key === "Enter" &&
                    target.tagName !== "TEXTAREA" &&
                    (target.tagName !== "BUTTON" ||
                      (target as HTMLButtonElement).type === "submit")
                  )
                    e.preventDefault();
                }}
              >
                <div className="eo-section-title">
                  <div>
                    <span className="eo-eyebrow">
                      {turno} · {data.usuario}
                    </span>
                    <h2 id="eo-dialog-title">{dialog.title}</h2>
                  </div>
                  <button type="button" onClick={close} disabled={busy}>
                    Cerrar
                  </button>
                </div>
                <div className="eo-form-grid">
                  {dialog.accion === "restaurar" && (
                    <>
                      <p>
                        Esta acción reemplaza los datos de Expedición. Se
                        guardará una copia previa. No cambia contraseñas ni
                        elimina los productos compartidos.
                      </p>
                      {field("confirmacion", "Escribí RESTAURAR", "text", true)}
                      <pre>{JSON.stringify(restore?.cantidades, null, 2)}</pre>
                    </>
                  )}
                  {[
                    "orden",
                    "movimiento",
                    "materiales",
                    "corregir_movimiento",
                  ].includes(dialog.accion) &&
                    field("fecha", "Fecha", "date", true)}
                  {dialog.accion === "orden" && (
                    <>
                      {field("numero", "Número de orden", "text", true)}
                      {select("circuito", "Circuito", circuitos)}
                      {select("facturacion", "Facturación", {
                        NO_APLICA: "No aplica",
                        PENDIENTE: "Pendiente",
                        PAGADA: "Pagada",
                        PENDIENTE_AVISO: "Pendiente de aviso",
                        AVISADA: "Avisada",
                        CORREGIDA: "Corregida",
                      })}
                      {carrierField()}
                      <button
                        type="button"
                        onClick={() => setInlineCarrier(!inlineCarrier)}
                      >
                        Registrar nuevo fletero
                      </button>
                    </>
                  )}
                  {dialog.accion === "movimiento" && (
                    <>
                      {select("tipo", "Tipo de movimiento", tipos)}
                      {select(
                        "direccion",
                        "Dirección (ajuste / transferencia)",
                        { ENTRADA: "Entrada", SALIDA: "Salida" },
                      )}
                      {values.tipo === "TRANSFERENCIA" && (
                        <>
                          {select("destino", "Provincia", {
                            Mendoza: "Mendoza",
                            "San Juan": "San Juan",
                          })}
                          {carrierField()}
                        </>
                      )}
                    </>
                  )}
                  {["movimiento", "corregir_movimiento", "materiales"].includes(
                    dialog.accion,
                  ) &&
                    field(
                      "referencia",
                      values.tipo === "TRANSFERENCIA"
                        ? "Número de remito"
                        : "Referencia",
                      "text",
                      values.tipo === "TRANSFERENCIA",
                    )}
                  {dialog.accion === "materiales" && (
                    <>
                      {carrierField()}
                      {dialog.materialesModo ? (
                        <label>
                          Origen
                          <span className="eo-badge">
                            {String(values.origen)}
                          </span>
                        </label>
                      ) : (
                        select("origen", "Origen", {
                          "Carga por turno": "Carga por turno",
                          "Devolución general": "Devolución general",
                        })
                      )}
                    </>
                  )}
                  {["fletero", "empleado", "producto", "usuario"].includes(
                    dialog.accion,
                  ) && (
                    <>
                      {field("nombre", "Nombre", "text", true)}
                      {check("activo", "Activo", true)}
                    </>
                  )}
                  {["fletero", "empleado"].includes(dialog.accion) &&
                    field("apellido", "Apellido")}
                  {dialog.accion === "fletero" && field("empresa", "Empresa")}
                  {dialog.accion === "empleado" &&
                    field("legajo", "Legajo", "text", true)}
                  {dialog.accion === "usuario" && (
                    <>
                      {field("username", "Usuario", "text", true)}
                      {field(
                        "password",
                        values.id
                          ? "Contraseña nueva (opcional)"
                          : "Contraseña",
                        "password",
                        !values.id,
                      )}
                    </>
                  )}
                  {dialog.accion === "producto" && (
                    <>
                      {field("codigo", "Código", "text", true)}
                      {field("alias", "Alias de búsqueda")}
                      {field(
                        "unidades_pack",
                        "Unidades por pack",
                        "number",
                        true,
                      )}
                      {field("packs_corte", "Packs por corte", "number", true)}
                      {field(
                        "cortes_pallet",
                        "Cortes por pallet",
                        "number",
                        true,
                      )}
                      {field("minimo", "Stock mínimo (unidades)", "number")}
                      {field("critico", "Stock crítico (unidades)", "number")}
                      {check(
                        "beneficio_empleado",
                        "Habilitado para beneficio empleado",
                      )}
                    </>
                  )}
                  {dialog.accion === "pendientes" &&
                    Object.entries(circuitos)
                      .filter(
                        ([k]) => !["administrative", "immediate"].includes(k),
                      )
                      .map(([k, name]) => (
                        <div key={k}>
                          {field(k, name + " (unidades adicionales)", "number")}
                        </div>
                      ))}
                  {dialog.accion === "conteo" &&
                    select("tipo", "Tipo de conteo", {
                      "Cierre de turno": "Cierre de turno",
                      "Apertura / corroboración": "Apertura / corroboración",
                    })}
                  {dialog.accion === "entrega" && (
                    <>
                      {field(
                        "inicio_carga",
                        "Inicio de carga",
                        "datetime-local",
                      )}
                      {field("fin_carga", "Fin de carga", "datetime-local")}
                    </>
                  )}
                </div>
                {inlineCarrier && (
                  <div className="eo-card">
                    <h3>Alta rápida de fletero</h3>
                    <div className="eo-form-grid">
                      {field("nuevo_nombre", "Nombre fletero", "text", true)}
                      {field("nuevo_apellido", "Apellido")}
                      {field("nuevo_empresa", "Empresa")}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                          const r = await ejecutarOperacion({
                            accion: "fletero",
                            turno,
                            clave: claveOperacion(),
                            nombre: values.nuevo_nombre,
                            apellido: values.nuevo_apellido || "",
                            empresa: values.nuevo_empresa || "",
                          });
                          await query.refetch();
                          setValues((v) => ({ ...v, fletero: r.id || 0 }));
                          setInlineCarrier(false);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Guardar y seleccionar fletero
                    </button>
                  </div>
                )}
                {dialog.accion === "anular" && (
                  <p className="eo-notice">
                    Se revertirá el stock neto y los materiales de esta orden.
                    Las entregas y la auditoría permanecerán disponibles.
                  </p>
                )}
                {dialog.accion === "acreditar" && (
                  <p className="eo-notice">
                    Se sumarán dos fardos al saldo de cada empleado activo. Esta
                    acreditación es manual y acumulativa.
                  </p>
                )}
                {dialog.accion === "corroborar" && (
                  <p>
                    Confirmá que recibís el conteo del turno anterior. Esta
                    acción no ajusta el stock.
                  </p>
                )}
                {dialog.accion === "movimiento" &&
                  values.tipo === "PRODUCCION_SIN_CODIFICAR" && (
                    <p className="eo-notice">
                      Aumenta el físico y “Sin codificar”. Esta mercadería no
                      estará habilitada para despacho.
                    </p>
                  )}
                {dialog.accion === "conteo" && (
                  <FormularioConteo
                    productos={data.productos}
                    value={lines}
                    change={setLines}
                  />
                )}
                {["orden", "entrega", "movimiento", "consumo"].includes(
                  dialog.accion,
                ) && (
                  <Lines
                    productos={
                      dialog.accion === "consumo" && values.tipo === "CONSUMO"
                        ? data.productos.filter((p) => p.beneficio_empleado)
                        : data.productos
                    }
                    value={lines}
                    change={setLines}
                    sources={
                      dialog.accion === "entrega"
                        ? currentOrder?.detalles
                            .filter((l) => l.pendiente > 0)
                            .map((l) => ({
                              id: l.producto,
                              label: `${l.codigo} · ${l.producto_nombre} · pendiente ${equivalente(l.pendiente, product(l.producto))}`,
                            }))
                        : undefined
                    }
                  />
                )}
                {dialog.accion === "orden" &&
                  values.circuito === "immediate" && (
                    <section>
                      <h3>Entrega real</h3>
                      <p className="eo-help">
                        Si no cargás diferencias, se entrega todo lo solicitado.
                      </p>
                      <Lines
                        productos={data.productos}
                        value={actual}
                        change={setActual}
                      />
                    </section>
                  )}
                {(dialog.accion === "materiales" ||
                  dialog.accion === "entrega" ||
                  (dialog.accion === "orden" &&
                    values.circuito === "immediate") ||
                  (dialog.accion === "movimiento" &&
                    values.tipo === "TRANSFERENCIA")) && (
                  <section>
                    <h3>Pallets y chapadur</h3>
                    {["orden", "entrega"].includes(dialog.accion) && (
                      <p className="eo-help">
                        Sugerencia por composición:{" "}
                        {Math.ceil(
                          (actual.length && dialog.accion === "orden"
                            ? actual
                            : lines
                          ).reduce((s, l) => {
                            const p = product(l.producto);
                            return (
                              s +
                              (p
                                ? (l.packs * p.unidades_pack + l.unidades) /
                                  (p.unidades_pack *
                                    p.packs_corte *
                                    p.cortes_pallet)
                                : 0)
                            );
                          }, 0),
                        )}{" "}
                        pallets ·{" "}
                        {(actual.length && dialog.accion === "orden"
                          ? actual
                          : lines
                        ).reduce((s, l) => {
                          const p = product(l.producto);
                          return (
                            s +
                            (p
                              ? Math.ceil(
                                  (l.packs * p.unidades_pack + l.unidades) /
                                    (p.unidades_pack * p.packs_corte),
                                )
                              : 0)
                          );
                        }, 0)}{" "}
                        chapadur. Registrá las cantidades reales.
                      </p>
                    )}
                    <div
                      className="eo-form-grid"
                      onKeyDown={(e) => {
                        if (
                          dialog.accion !== "materiales" ||
                          e.key !== "Enter" ||
                          !(e.target instanceof HTMLInputElement)
                        )
                          return;
                        e.preventDefault();
                        const inputs = [
                          ...e.currentTarget.querySelectorAll<HTMLInputElement>(
                            'input[type="number"]',
                          ),
                        ];
                        const next = inputs[inputs.indexOf(e.target) + 1];
                        if (next) {
                          next.focus();
                          next.select();
                        } else
                          modalRef.current
                            ?.querySelector<HTMLTextAreaElement>("textarea")
                            ?.focus();
                      }}
                    >
                      {mf
                        .filter(
                          (k) =>
                            dialog.materialesModo !== "devolucion" ||
                            k.endsWith("entrada"),
                        )
                        .map((k) => (
                          <div key={k}>
                            {field(k, ml[mf.indexOf(k)], "number")}
                          </div>
                        ))}
                    </div>
                  </section>
                )}
                {[
                  "orden",
                  "entrega",
                  "movimiento",
                  "consumo",
                  "conteo",
                  "materiales",
                ].includes(dialog.accion) && (
                  <label>
                    Observaciones
                    <textarea
                      value={String(values.observaciones || "")}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          observaciones: e.target.value,
                        }))
                      }
                    />
                  </label>
                )}
                {["orden", "entrega", "movimiento", "consumo"].includes(
                  dialog.accion,
                ) && (
                  <label>
                    Justificación de stock insuficiente
                    {values.tipo === "AJUSTE"
                      ? " / motivo del ajuste *"
                      : " (si corresponde)"}
                    <textarea
                      required={values.tipo === "AJUSTE"}
                      value={String(values.justificacion || "")}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          justificacion: e.target.value,
                        }))
                      }
                    />
                  </label>
                )}
                {([
                  "anular",
                  "pendientes",
                  "acreditar",
                  "corregir_movimiento",
                ].includes(dialog.accion) ||
                  (dialog.accion === "orden" && values.id)) && (
                  <label>
                    Motivo obligatorio
                    <textarea
                      required
                      value={String(values.motivo || "")}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, motivo: e.target.value }))
                      }
                    />
                  </label>
                )}
                {error && (
                  <p role="alert" className="eo-error">
                    {error}
                  </p>
                )}
                <div className="eo-dialog-actions">
                  <button type="button" disabled={busy} onClick={close}>
                    Cancelar
                  </button>
                  <button
                    className="eo-primary"
                    type="submit"
                    disabled={busy || !online || inlineCarrier}
                  >
                    {busy ? "Guardando…" : "Confirmar operación"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      {print &&
        createPortal(
          <div id="eo-print-document" className="eo">
            <div className="eo-print-brand">
              <img src="/logo-talca.png" alt="Talca" />
              <span>Sistema de gestión logística</span>
            </div>
            {print}
          </div>,
          document.body,
        )}
    </div>
  );
}
