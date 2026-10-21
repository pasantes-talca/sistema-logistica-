import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { respuesta } from "../api/administracion";

type Preferencias = {
  nombre_plataforma: string;
  dias_panel: number;
  alertar_pendientes: boolean;
  alertar_errores: boolean;
  umbral_errores: number;
  minimo_password: number;
  sesion_horas: number;
};
type Panel = {
  desde: string;
  hasta: string;
  registros: Record<string, number>;
  usuarios_activos: number;
  usuarios_inactivos: number;
  operaciones_auditadas: number;
  actividad: {
    usuario: string;
    modulo: string;
    accion: string;
    fecha: string;
    referencia: string;
  }[];
  nota: string;
};
type Permisos = {
  modulos: Record<string, string>;
  acciones: string[];
  usuarios: {
    id: number;
    username: string;
    protegido: boolean;
    modulos: string[];
    permisos: Record<string, string[]>;
  }[];
};
type Estado = {
  comprobado_en: string;
  base: {
    motor: string;
    nombre: string;
    schema: string;
    conexion: boolean;
    latencia_ms: number;
  };
  versiones: Record<string, string>;
  servicios: { nombre: string; estado: string }[];
  respaldos_expedicion: { id: number; fecha: string; motivo: string }[];
  respaldo_general: string;
  seguridad: {
    csrf: boolean;
    cookie_segura: boolean;
    debug: boolean;
    validadores_password: number;
    politica: Preferencias;
  };
};
type Sesiones = {
  usuarios: {
    id: number;
    username: string;
    sesiones: number;
    protegido: boolean;
  }[];
  nota: string;
};
type Errores = {
  total: number;
  resultados: {
    id: number;
    fecha: string;
    ruta: string;
    metodo: string;
    estado: number;
    categoria: string;
    usuario: string;
    resuelta: boolean;
    resolucion: string;
  }[];
  nota: string;
};
type Reporte = {
  desde: string;
  hasta: string;
  filas: {
    usuario: string;
    modulo: string;
    accion: string;
    cantidad: number;
  }[];
};
type Alertas = {
  alertas: {
    tipo: string;
    titulo: string;
    cantidad: number;
    destino: string;
  }[];
  nota: string;
};

function useDatos<T>(path: string) {
  return useQuery<T>({
    queryKey: ["admin-herramientas", path],
    queryFn: async () => (await respuesta(path)).json(),
    retry: false,
  });
}
function Carga<T>({
  query,
  children,
}: {
  query: ReturnType<typeof useDatos<T>>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <p role="status">Consultando información…</p>;
  if (query.error)
    return (
      <p className="login-error" role="alert">
        {query.error.message}
      </p>
    );
  return <>{children(query.data)}</>;
}
function Tabla({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="tabla-wrapper">
      <table className="tabla-repartos admin-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function fecha(value: string) {
  return new Date(value).toLocaleString("es-AR");
}
function Aviso({ mensaje }: { mensaje: string }) {
  return mensaje ? (
    <p role="status" className="admin-success">
      {mensaje}
    </p>
  ) : null;
}
function ErrorMensaje({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="login-error">
      {error}
    </p>
  ) : null;
}
function Fechas({
  desde,
  hasta,
  setDesde,
  setHasta,
}: {
  desde: string;
  hasta: string;
  setDesde: (v: string) => void;
  setHasta: (v: string) => void;
}) {
  return (
    <div className="admin-toolbar">
      <label className="campo">
        Desde
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
      </label>
      <label className="campo">
        Hasta
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
      </label>
      <span className="subtitulo">
        Sin fechas: se usa el período predeterminado del panel.
      </span>
    </div>
  );
}

function PanelControl() {
  const [desde, setDesde] = useState(""),
    [hasta, setHasta] = useState("");
  const query = useDatos<Panel>(`panel/?desde=${desde}&hasta=${hasta}`);
  return (
    <>
      <h2>Panel de control</h2>
      <Fechas {...{ desde, hasta, setDesde, setHasta }} />
      <Carga query={query}>
        {(d) => (
          <>
            <p>
              {d.desde} → {d.hasta}
            </p>
            <div className="admin-kpis">
              {Object.entries({
                ...d.registros,
                "Usuarios activos": d.usuarios_activos,
                "Usuarios inactivos": d.usuarios_inactivos,
                "Operaciones auditadas": d.operaciones_auditadas,
              }).map(([k, v]) => (
                <article className="admin-stat" key={k}>
                  <span>{k}</span>
                  <strong>{v.toLocaleString("es-AR")}</strong>
                </article>
              ))}
            </div>
            <h3>Actividad reciente del período</h3>
            <Tabla
              headers={["Fecha", "Usuario", "Módulo", "Acción", "Referencia"]}
            >
              {d.actividad.map((a, i) => (
                <tr key={i}>
                  <td>{fecha(a.fecha)}</td>
                  <td>{a.usuario}</td>
                  <td>{a.modulo}</td>
                  <td>{a.accion}</td>
                  <td>{a.referencia || "—"}</td>
                </tr>
              ))}
            </Tabla>
            {!d.actividad.length && (
              <p className="estado-vacio">
                No hay actividad auditada en este período.
              </p>
            )}
            <p className="subtitulo">{d.nota}</p>
          </>
        )}
      </Carga>
    </>
  );
}

function EditorPermisos({
  data,
  usuario,
}: {
  data: Permisos;
  usuario: Permisos["usuarios"][number];
}) {
  const [rules, setRules] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      usuario.modulos.map((m) => [m, usuario.permisos[m] ?? data.acciones]),
    ),
  );
  const [motivo, setMotivo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState("");
  const cache = useQueryClient();
  async function guardar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMensaje("");
    try {
      const result = await (
        await respuesta("permisos/", "PUT", {
          usuario_id: usuario.id,
          permisos: rules,
          motivo,
        })
      ).json();
      setMensaje(result.mensaje);
      await cache.invalidateQueries({
        queryKey: ["admin-herramientas", "permisos/"],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (usuario.protegido)
    return (
      <p className="admin-note">
        Cuenta administrativa o protegida. Sus privilegios no se modifican desde
        aquí.
      </p>
    );
  return (
    <form onSubmit={guardar}>
      <p>
        Estos permisos restringen los módulos asignados en Usuarios. No conceden
        módulos nuevos ni habilitan borrado de históricos.
      </p>
      <div className="admin-toolbar">
        <button
          type="button"
          className="boton-secundario"
          disabled={busy}
          onClick={() =>
            setRules(
              Object.fromEntries(
                usuario.modulos.map((m) => [m, ["consultar", "exportar"]]),
              ),
            )
          }
        >
          Perfil de consulta
        </button>
        <button
          type="button"
          className="boton-secundario"
          disabled={busy}
          onClick={() =>
            setRules(
              Object.fromEntries(
                usuario.modulos.map((m) => [
                  m,
                  ["consultar", "crear", "editar", "exportar"],
                ]),
              ),
            )
          }
        >
          Perfil operador
        </button>
      </div>
      <Tabla headers={["Módulo", ...data.acciones]}>
        {usuario.modulos.map((m) => (
          <tr key={m}>
            <th>{data.modulos[m]}</th>
            {data.acciones.map((a) => (
              <td key={a}>
                <input
                  type="checkbox"
                  aria-label={`${data.modulos[m]}: ${a}`}
                  disabled={busy}
                  checked={(rules[m] || []).includes(a)}
                  onChange={(e) =>
                    setRules((r) => ({
                      ...r,
                      [m]: e.target.checked
                        ? [...(r[m] || []), a]
                        : (r[m] || []).filter((v) => v !== a),
                    }))
                  }
                />
              </td>
            ))}
          </tr>
        ))}
      </Tabla>
      {!usuario.modulos.length && (
        <p>Este usuario no tiene módulos asignados.</p>
      )}
      <label className="campo">
        Motivo del cambio
        <textarea
          required
          maxLength={1000}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      <ErrorMensaje error={error} />
      <Aviso mensaje={mensaje} />
      <button
        className="boton-principal"
        disabled={busy || !usuario.modulos.length}
      >
        {busy ? "Guardando…" : "Guardar permisos por acción"}
      </button>
    </form>
  );
}
function RolesPermisos() {
  const query = useDatos<Permisos>("permisos/");
  const [id, setId] = useState("");
  return (
    <>
      <h2>Roles y permisos por acción</h2>
      <p className="subtitulo">
        El rol Administrador conserva la gestión completa. Los operadores
        mantienen sus módulos; aquí se limita qué pueden hacer en cada uno.
      </p>
      <Carga query={query}>
        {(data) => (
          <>
            <label className="campo">
              Usuario a configurar
              <select value={id} onChange={(e) => setId(e.target.value)}>
                <option value="">Seleccionar usuario</option>
                {data.usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                    {u.protegido ? " · protegido" : ""}
                  </option>
                ))}
              </select>
            </label>
            {data.usuarios
              .filter((u) => String(u.id) === id)
              .map((u) => (
                <EditorPermisos key={u.id} data={data} usuario={u} />
              ))}
          </>
        )}
      </Carga>
    </>
  );
}

function SeguridadFormulario({ initial }: { initial: Preferencias }) {
  const [data, setData] = useState(initial),
    [motivo, setMotivo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState("");
  const cache = useQueryClient();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMensaje("");
    try {
      await respuesta("preferencias/", "PUT", { datos: data, motivo });
      setMensaje("Política de seguridad guardada con auditoría.");
      await cache.invalidateQueries({ queryKey: ["admin-herramientas"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="admin-form">
      <div className="grid-dos-columnas">
        <label className="campo">
          Longitud mínima de nuevas contraseñas
          <input
            type="number"
            required
            min={8}
            max={128}
            step={1}
            value={data.minimo_password}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                minimo_password: Number(e.target.value),
              }))
            }
          />
        </label>
        <label className="campo">
          Duración máxima de sesión (horas)
          <input
            type="number"
            required
            min={1}
            max={24}
            step={1}
            value={data.sesion_horas}
            onChange={(e) =>
              setData((d) => ({ ...d, sesion_horas: Number(e.target.value) }))
            }
          />
        </label>
      </div>
      <p className="subtitulo">
        No se cambian contraseñas existentes. El límite absoluto de sesión
        aplica a ingresos realizados con esta versión; las sesiones anteriores
        pueden cerrarse abajo. Continúan los validadores de Django y el cierre
        al cerrar el navegador.
      </p>
      <label className="campo">
        Motivo de la modificación
        <textarea
          required
          maxLength={1000}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      <ErrorMensaje error={error} />
      <Aviso mensaje={mensaje} />
      <button className="boton-principal" disabled={busy}>
        {busy ? "Guardando…" : "Guardar política de seguridad"}
      </button>
    </form>
  );
}

function SesionesPanel() {
  const query = useDatos<Sesiones>("sesiones/");
  const [target, setTarget] = useState<Sesiones["usuarios"][number] | null>(
      null,
    ),
    [motivo, setMotivo] = useState(""),
    [confirmacion, setConfirmacion] = useState(""),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState(""),
    [busy, setBusy] = useState(false);
  async function cerrar(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const result = await (
        await respuesta("sesiones/", "POST", {
          usuario_id: target.id,
          confirmacion,
          motivo,
        })
      ).json();
      setMensaje(result.mensaje);
      setTarget(null);
      setConfirmacion("");
      setMotivo("");
      await query.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h3>Gestión de sesiones</h3>
      <Aviso mensaje={mensaje} />
      <Carga query={query}>
        {(d) => (
          <>
            <p className="subtitulo">{d.nota}</p>
            <Tabla headers={["Usuario", "Sesiones no vencidas", "Acción"]}>
              {d.usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.sesiones}</td>
                  <td>
                    <button
                      className="boton-secundario"
                      disabled={u.protegido || !u.sesiones || busy}
                      onClick={() => {
                        setTarget(u);
                        setError("");
                        setMensaje("");
                      }}
                    >
                      Cerrar sesiones
                    </button>
                    {u.protegido && " · Protegido"}
                  </td>
                </tr>
              ))}
            </Tabla>
          </>
        )}
      </Carga>
      {target && (
        <form onSubmit={cerrar} className="admin-access">
          <h4>Cerrar sesiones de {target.username}</h4>
          <label className="campo">
            Motivo
            <textarea
              required
              maxLength={1000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <label className="campo">
            Escribí CERRAR SESIONES
            <input
              required
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
            />
          </label>
          <ErrorMensaje error={error} />
          <div className="admin-toolbar">
            <button className="boton-principal" disabled={busy}>
              Confirmar cierre de sesiones
            </button>
            <button
              type="button"
              className="boton-secundario"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </>
  );
}
function Seguridad() {
  const query = useDatos<Preferencias>("preferencias/");
  return (
    <>
      <h2>Seguridad</h2>
      <Carga query={query}>
        {(data) => (
          <>
            <p className="admin-eyebrow">{data.nombre_plataforma}</p>
            <SeguridadFormulario initial={data} />
          </>
        )}
      </Carga>
      <SesionesPanel />
    </>
  );
}

function Diagnostico({ base = false }: { base?: boolean }) {
  const query = useDatos<Estado>("estado/");
  return (
    <>
      <div className="admin-toolbar">
        <h2>{base ? "Base de datos y respaldos" : "Estado del sistema"}</h2>
        <button
          className="boton-secundario"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Volver a comprobar
        </button>
      </div>
      <Carga query={query}>
        {(d) => (
          <>
            <p className="subtitulo">
              Comprobado: {fecha(d.comprobado_en)} · Diagnóstico de solo
              lectura, sin editor SQL ni restauración desde esta pantalla.
            </p>
            <div className="admin-kpis">
              <article className="admin-stat">
                <span>Base configurada</span>
                <strong>{d.base.nombre}</strong>
                <span>
                  Schema: {d.base.schema} · {d.base.motor}
                </span>
              </article>
              <article className="admin-stat">
                <span>Conexión</span>
                <strong>
                  {d.base.conexion ? "Disponible" : "No disponible"}
                </strong>
                <span>{d.base.latencia_ms} ms</span>
              </article>
            </div>
            {base ? (
              <>
                <h3>Respaldos generales</h3>
                <p className="admin-note">{d.respaldo_general}</p>
                <h3>Respaldos internos de Expedición</h3>
                <Tabla headers={["Identificador", "Fecha", "Motivo"]}>
                  {d.respaldos_expedicion.map((b) => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td>{fecha(b.fecha)}</td>
                      <td>{b.motivo}</td>
                    </tr>
                  ))}
                </Tabla>
                {!d.respaldos_expedicion.length && (
                  <p>No hay respaldos internos de Expedición registrados.</p>
                )}
              </>
            ) : (
              <>
                <Tabla headers={["Servicio", "Estado comprobado"]}>
                  {d.servicios.map((s) => (
                    <tr key={s.nombre}>
                      <td>{s.nombre}</td>
                      <td>{s.estado}</td>
                    </tr>
                  ))}
                </Tabla>
                <h3>Versiones</h3>
                <p>
                  {Object.entries(d.versiones)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
                <h3>Protecciones y advertencias</h3>
                <ul>
                  <li>
                    CSRF:{" "}
                    {d.seguridad.csrf ? "Habilitado" : "Revisar configuración"}
                  </li>
                  <li>
                    Validadores de contraseña:{" "}
                    {d.seguridad.validadores_password}
                  </li>
                  <li>
                    Cookie exclusiva HTTPS:{" "}
                    {d.seguridad.cookie_segura
                      ? "Sí"
                      : "No: revisar al habilitar HTTPS"}
                  </li>
                  <li>
                    Modo debug:{" "}
                    {d.seguridad.debug
                      ? "Activo: revisar antes de producción"
                      : "Desactivado"}
                  </li>
                </ul>
                <p className="subtitulo">
                  No se exponen contraseñas, variables de entorno ni claves de
                  conexión.
                </p>
              </>
            )}
          </>
        )}
      </Carga>
    </>
  );
}

function RegistroErrores() {
  const [pendientes, setPendientes] = useState(true),
    [target, setTarget] = useState<number | null>(null),
    [motivo, setMotivo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mensaje, setMensaje] = useState("");
  const query = useDatos<Errores>(
    `errores/?pendientes=${pendientes ? "1" : "0"}`,
  );
  async function resolver(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await respuesta("errores/", "PATCH", { id: target, motivo });
      setTarget(null);
      setMotivo("");
      setMensaje("Incidencia revisada y conservada en el historial.");
      await query.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2>Registros de errores e incidencias</h2>
      <label className="admin-check">
        <input
          type="checkbox"
          checked={pendientes}
          onChange={(e) => setPendientes(e.target.checked)}
        />
        Solo pendientes de revisión
      </label>
      <Aviso mensaje={mensaje} />
      <Carga query={query}>
        {(d) => (
          <>
            <p>
              {d.total} incidencias · {d.nota}
            </p>
            <Tabla
              headers={[
                "Fecha",
                "Estado HTTP",
                "Categoría",
                "Ruta / método",
                "Usuario",
                "Revisión",
              ]}
            >
              {d.resultados.map((r) => (
                <tr key={r.id}>
                  <td>{fecha(r.fecha)}</td>
                  <td>{r.estado}</td>
                  <td>{r.categoria}</td>
                  <td>
                    {r.metodo} {r.ruta}
                  </td>
                  <td>{r.usuario || "No autenticado"}</td>
                  <td>
                    {r.resuelta ? (
                      r.resolucion
                    ) : (
                      <button
                        className="boton-secundario"
                        disabled={busy}
                        onClick={() => {
                          setTarget(r.id);
                          setError("");
                        }}
                      >
                        Marcar revisada
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
            {!d.total && (
              <p className="estado-vacio">
                No hay incidencias para esta selección.
              </p>
            )}
          </>
        )}
      </Carga>
      {target !== null && (
        <form onSubmit={resolver} className="admin-access">
          <label className="campo">
            Detalle de revisión o solución
            <textarea
              required
              maxLength={1000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <ErrorMensaje error={error} />
          <div className="admin-toolbar">
            <button className="boton-principal" disabled={busy}>
              Guardar revisión
            </button>
            <button
              type="button"
              className="boton-secundario"
              disabled={busy}
              onClick={() => setTarget(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function Reportes() {
  const [desde, setDesde] = useState(""),
    [hasta, setHasta] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const path = `reportes/?desde=${desde}&hasta=${hasta}`,
    query = useDatos<Reporte>(path);
  async function descargar() {
    setBusy(true);
    setError("");
    try {
      const blob = await (await respuesta(path + "&formato=csv")).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "actividad-sistema.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h2>Reportes de operaciones y actividad</h2>
      <Fechas {...{ desde, hasta, setDesde, setHasta }} />
      <p className="subtitulo">
        Actividad registrada por usuario, módulo y acción. No se infiere
        productividad ni tiempo trabajado a partir de estos conteos.
      </p>
      <button
        className="boton-secundario"
        disabled={busy || query.isError || query.isPending}
        onClick={() => void descargar()}
      >
        Exportar actividad CSV
      </button>
      <ErrorMensaje error={error} />
      <Carga query={query}>
        {(d) => (
          <>
            <p>
              {d.desde} → {d.hasta}
            </p>
            <Tabla headers={["Usuario", "Módulo", "Acción", "Operaciones"]}>
              {d.filas.map((r, i) => (
                <tr key={i}>
                  <td>{r.usuario}</td>
                  <td>{r.modulo}</td>
                  <td>{r.accion}</td>
                  <td>{r.cantidad}</td>
                </tr>
              ))}
            </Tabla>
            {!d.filas.length && (
              <p className="estado-vacio">
                Sin actividad auditada en este período.
              </p>
            )}
          </>
        )}
      </Carga>
      <h3>Reportes operativos existentes</h3>
      <div className="admin-toolbar">
        <Link to="/repartos/recargas">Recargas</Link>
        <Link to="/rechazos/estadisticas">Rechazos</Link>
        <Link to="/cambios/estadisticas">Recibos de cambios</Link>
      </div>
    </>
  );
}
function Notificaciones() {
  const query = useDatos<Alertas>("alertas/");
  return (
    <>
      <div className="admin-toolbar">
        <h2>Notificaciones operativas</h2>
        <button
          className="boton-secundario"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Actualizar alertas
        </button>
      </div>
      <Carga query={query}>
        {(d) => (
          <>
            <p className="subtitulo">{d.nota}</p>
            <div className="admin-kpis">
              {d.alertas.map((a) => (
                <article className="admin-stat" key={a.tipo}>
                  <span>{a.titulo}</span>
                  <strong>{a.cantidad}</strong>
                  <Link to={a.destino}>Revisar registros</Link>
                </article>
              ))}
            </div>
            {!d.alertas.length && (
              <p className="estado-vacio">
                No hay alertas que cumplan las reglas habilitadas.
              </p>
            )}
          </>
        )}
      </Carga>
    </>
  );
}

export default function AdministracionHerramientas({
  section,
}: {
  section: string;
}) {
  switch (section) {
    case "panel":
      return <PanelControl />;
    case "permisos":
      return <RolesPermisos />;
    case "seguridad":
      return <Seguridad />;
    case "base-datos":
      return <Diagnostico base />;
    case "estado":
      return <Diagnostico />;
    case "errores":
      return <RegistroErrores />;
    case "reportes":
      return <Reportes />;
    case "notificaciones":
      return <Notificaciones />;
    default:
      return <p>Sección de Administración no encontrada.</p>;
  }
}
