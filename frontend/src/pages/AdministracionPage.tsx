import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
  type FormEvent,
} from "react";
import { Navigate, NavLink, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { obtenerUsuarioActual } from "../api/logistica";
import {
  listarUsuarios,
  guardarUsuario,
  restablecerPassword,
  listarAuditoria,
  exportarAuditoria,
  type Cuenta,
  type DatosCuenta,
  type Modulo,
  type Evento,
} from "../api/administracion";
import Icon from "../components/ui/Icon";
import "./AdministracionPage.css";
import AdministracionHerramientas from "./AdministracionHerramientas";

function Mensaje({ error, mensaje }: { error?: string; mensaje?: string }) {
  return (
    <>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="admin-success" role="status">
          {mensaje}
        </p>
      )}
    </>
  );
}
function Dialogo({
  title,
  close,
  busy,
  children,
}: {
  title: string;
  close: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="admin-dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          className="boton-secundario"
          disabled={busy}
          onClick={close}
          aria-label="Cerrar ventana"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Campo({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
function Estado({ activo }: { activo: boolean }) {
  return (
    <span className={`admin-badge ${activo ? "admin-badge-green" : ""}`}>
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

function CuentaFormulario({
  initial,
  modulos,
  superusuario,
  propioId,
  close,
  saved,
}: {
  initial: Cuenta | null;
  modulos: Modulo[];
  superusuario: boolean;
  propioId: number;
  close: () => void;
  saved: (m: string) => void;
}) {
  const [datos, setDatos] = useState<DatosCuenta>(() => ({
    username: initial?.username || "",
    nombre: initial?.nombre || "",
    apellido: initial?.apellido || "",
    activo: initial?.activo ?? true,
    modulos: initial?.modulos || [],
    ...(superusuario ? { administrador: initial?.administrador ?? false } : {}),
  }));
  const [password, setPassword] = useState(""),
    [confirmar, setConfirmar] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const cambiar = (campo: "username" | "nombre" | "apellido", valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }));
  const administra = superusuario
    ? Boolean(datos.administrador)
    : Boolean(initial?.administrador);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!initial && password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await guardarUsuario(initial?.id || null, {
        ...datos,
        ...(!initial ? { password } : {}),
      });
      saved(
        initial
          ? "Usuario actualizado."
          : "Usuario creado. Ya puede ingresar con sus accesos asignados.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialogo
      title={initial ? `Editar usuario · ${initial.username}` : "Crear usuario"}
      close={close}
      busy={busy}
    >
      <form onSubmit={submit} className="admin-form">
        <div className="grid-dos-columnas">
          <Campo label="Nombre de usuario *">
            <input
              autoComplete="off"
              required
              maxLength={150}
              value={datos.username}
              onChange={(e) => cambiar("username", e.target.value)}
            />
          </Campo>
          <Campo label="Estado">
            <select
              disabled={initial?.id === propioId}
              value={String(datos.activo)}
              onChange={(e) =>
                setDatos((d) => ({ ...d, activo: e.target.value === "true" }))
              }
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </Campo>
          <Campo label="Nombre *">
            <input
              required
              maxLength={150}
              value={datos.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
            />
          </Campo>
          <Campo label="Apellido">
            <input
              maxLength={150}
              value={datos.apellido}
              onChange={(e) => cambiar("apellido", e.target.value)}
            />
          </Campo>
        </div>
        {!initial && (
          <>
            <div className="grid-dos-columnas">
              <Campo label="Contraseña inicial *">
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Campo>
              <Campo label="Repetir contraseña *">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                />
              </Campo>
            </div>
            <p className="admin-help">
              Usá una contraseña no habitual, de al menos 8 caracteres. No debe
              ser solo numérica ni similar al usuario.
            </p>
          </>
        )}
        {superusuario && (
          <label className="admin-check">
            <input
              type="checkbox"
              checked={datos.administrador}
              onChange={(e) =>
                setDatos((d) => ({ ...d, administrador: e.target.checked }))
              }
            />
            <span>
              Administrador operativo: todos los módulos y gestión de usuarios,
              sin privilegios técnicos.
            </span>
          </label>
        )}
        <fieldset className="admin-access">
          <legend>Secciones permitidas</legend>
          <p className="admin-help">
            {administra
              ? "El administrador tiene acceso a todos los módulos."
              : "Seleccioná únicamente las secciones que necesita esta persona."}
          </p>
          <div className="admin-permissions">
            {modulos.map((m) => (
              <label className="admin-check" key={m.codigo}>
                <input
                  type="checkbox"
                  disabled={administra}
                  checked={datos.modulos.includes(m.codigo)}
                  onChange={(e) =>
                    setDatos((d) => ({
                      ...d,
                      modulos: e.target.checked
                        ? [...d.modulos, m.codigo]
                        : d.modulos.filter((k) => k !== m.codigo),
                    }))
                  }
                />
                <span>{m.nombre}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Mensaje error={error} />
        <div className="acciones-formulario">
          <button className="boton-guardar" disabled={busy}>
            {busy ? "Guardando…" : "Guardar usuario"}
          </button>
          <button
            type="button"
            className="boton-cancelar"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

function PasswordFormulario({
  cuenta,
  close,
  saved,
}: {
  cuenta: Cuenta;
  close: () => void;
  saved: (m: string) => void;
}) {
  const [password, setPassword] = useState(""),
    [confirmar, setConfirmar] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const r = await restablecerPassword(cuenta.id, password);
      saved(r.mensaje);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialogo
      title={`Restablecer contraseña · ${cuenta.username}`}
      close={close}
      busy={busy}
    >
      <form onSubmit={submit} className="admin-form">
        <p className="admin-help">
          No se puede consultar la contraseña actual. La nueva reemplazará a la
          anterior y las otras sesiones deberán volver a ingresar.
        </p>
        <Campo label="Contraseña nueva *">
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Campo>
        <Campo label="Repetir contraseña *">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </Campo>
        <Mensaje error={error} />
        <div className="acciones-formulario">
          <button className="boton-guardar" disabled={busy}>
            {busy ? "Guardando…" : "Restablecer contraseña"}
          </button>
          <button
            type="button"
            className="boton-cancelar"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

function Usuarios() {
  const cache = useQueryClient(),
    { data: actual } = useQuery({
      queryKey: ["usuario-actual"],
      queryFn: obtenerUsuarioActual,
    });
  const query = useQuery({
    queryKey: ["administracion-usuarios"],
    queryFn: listarUsuarios,
  });
  const [busqueda, setBusqueda] = useState(""),
    [editar, setEditar] = useState<Cuenta | null | undefined>(),
    [password, setPassword] = useState<Cuenta | null>(null),
    [mensaje, setMensaje] = useState("");
  async function saved(m: string) {
    setEditar(undefined);
    setPassword(null);
    setMensaje(m);
    await cache.invalidateQueries({ queryKey: ["administracion-usuarios"] });
    await cache.invalidateQueries({ queryKey: ["usuario-actual"] });
  }
  const usuarios = (query.data?.usuarios || []).filter((u) =>
    `${u.username} ${u.nombre} ${u.apellido}`
      .toLocaleLowerCase()
      .includes(busqueda.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="admin-toolbar">
        <Campo label="Buscar usuario">
          <input
            placeholder="Usuario, nombre o apellido"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Campo>
        <button
          className="boton-guardar"
          onClick={() => {
            setMensaje("");
            setEditar(null);
          }}
        >
          <Icon name="plus" size={16} />
          Crear usuario
        </button>
      </div>
      <Mensaje mensaje={mensaje} error={query.error?.message} />
      {query.isPending ? (
        <p role="status">Cargando usuarios…</p>
      ) : (
        <div className="tabla-wrapper">
          <table className="tabla-repartos">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Rol y estado</th>
                <th>Accesos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.username}</strong>
                    {u.id === actual?.id && (
                      <small className="admin-help">Tu cuenta</small>
                    )}
                  </td>
                  <td>
                    {u.nombre} {u.apellido}
                  </td>
                  <td>
                    <span className="admin-badge">
                      {u.superusuario
                        ? "Superusuario técnico"
                        : u.administrador
                          ? "Administrador"
                          : "Operador"}
                    </span>{" "}
                    <Estado activo={u.activo} />
                  </td>
                  <td>
                    {u.superusuario || u.administrador
                      ? "Todos los módulos"
                      : u.modulos
                          .map(
                            (k) =>
                              query.data?.modulos.find((m) => m.codigo === k)
                                ?.nombre || k,
                          )
                          .join(" · ") || "Sin secciones asignadas"}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="boton-editar"
                        disabled={u.protegido}
                        title={
                          u.protegido
                            ? "Cuenta protegida: requiere superusuario"
                            : "Editar datos y accesos"
                        }
                        onClick={() => setEditar(u)}
                      >
                        Editar
                      </button>
                      <button
                        className="boton-secundario"
                        disabled={u.protegido}
                        onClick={() => setPassword(u)}
                      >
                        Restablecer contraseña
                      </button>
                    </div>
                    {u.protegido && (
                      <small className="admin-help">Cuenta protegida</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!usuarios.length && (
            <div className="estado-vacio">
              No hay usuarios para esta búsqueda.
            </div>
          )}
        </div>
      )}
      <p className="admin-help">
        Las cuentas se desactivan, no se eliminan. Stock de pallets es un
        sistema externo: su enlace no crea una cuenta allí. Solo el superusuario
        puede otorgar el rol Administrador.
      </p>
      {editar !== undefined && query.data && actual && (
        <CuentaFormulario
          initial={editar}
          modulos={query.data.modulos}
          superusuario={actual.es_superusuario}
          propioId={actual.id}
          close={() => setEditar(undefined)}
          saved={saved}
        />
      )}
      {password && (
        <PasswordFormulario
          cuenta={password}
          close={() => setPassword(null)}
          saved={saved}
        />
      )}
    </>
  );
}

function Auditoria() {
  const [buscar, setBuscar] = useState(""),
    [desde, setDesde] = useState(""),
    [hasta, setHasta] = useState(""),
    [filtro, setFiltro] = useState(""),
    [pagina, setPagina] = useState(1),
    [detalle, setDetalle] = useState<Evento | null>(null),
    [error, setError] = useState(""),
    [exportando, setExportando] = useState(false);
  const params = new URLSearchParams(filtro);
  params.set("pagina", String(pagina));
  const query = useQuery({
    queryKey: ["administracion-auditoria", filtro, pagina],
    queryFn: () => listarAuditoria(params),
  });
  function filtrar(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (buscar) p.set("buscar", buscar);
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    setFiltro(p.toString());
    setPagina(1);
  }
  async function csv() {
    setError("");
    setExportando(true);
    try {
      await exportarAuditoria(params);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportando(false);
    }
  }
  return (
    <>
      <p className="admin-help">
        Historial de operaciones y cambios registrados desde la activación de
        esta función. Es de solo lectura y no almacena contraseñas.
      </p>
      <form className="admin-toolbar" onSubmit={filtrar}>
        <Campo label="Usuario, acción o referencia">
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </Campo>
        <Campo label="Desde">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </Campo>
        <Campo label="Hasta">
          <input
            type="date"
            min={desde}
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </Campo>
        <button className="boton-guardar">Filtrar</button>
        <button
          type="button"
          className="boton-secundario"
          disabled={exportando}
          onClick={csv}
        >
          {exportando ? "Exportando…" : "Exportar CSV"}
        </button>
      </form>
      <Mensaje error={error || query.error?.message} />
      {query.isPending ? (
        <p role="status">Cargando auditoría…</p>
      ) : (
        <>
          <div className="tabla-wrapper">
            <table className="tabla-repartos">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Sección</th>
                  <th>Acción</th>
                  <th>Referencia</th>
                  <th>Motivo</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.resultados.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.fecha).toLocaleString("es-AR")}</td>
                    <td>{r.usuario}</td>
                    <td>{r.modulo}</td>
                    <td>{r.accion}</td>
                    <td>{r.referencia || "—"}</td>
                    <td>{r.motivo || "—"}</td>
                    <td>
                      <button
                        className="boton-secundario"
                        onClick={() => setDetalle(r)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data?.resultados.length && (
              <div className="estado-vacio">
                No hay eventos para estos filtros.
              </div>
            )}
          </div>
          <div className="admin-pagination">
            <span>
              {query.data?.total || 0} eventos · Página {pagina}
            </span>
            <button
              className="boton-secundario"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              className="boton-secundario"
              disabled={
                !query.data || pagina * query.data.tamano >= query.data.total
              }
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
      {detalle && (
        <Dialogo
          title={`${detalle.accion} · ${detalle.usuario}`}
          close={() => setDetalle(null)}
          busy={false}
        >
          <p>{detalle.motivo}</p>
          <h3>Antes</h3>
          <pre>{JSON.stringify(detalle.antes, null, 2)}</pre>
          <h3>Después</h3>
          <pre>{JSON.stringify(detalle.despues, null, 2)}</pre>
        </Dialogo>
      )}
    </>
  );
}

export default function AdministracionPage() {
  const location = useLocation(),
    section = location.pathname.split("/")[2] || "usuarios";
  if (section === "catalogos" || section === "configuracion") {
    return <Navigate to="/administracion/panel" replace />;
  }
  return (
    <div className="pagina admin-page">
      <div className="contenedor-grande">
        <div className="encabezado-pagina">
          <div>
            <span className="admin-eyebrow">GESTIÓN Y CONTROL DE ACCESOS</span>
            <h1>Administración</h1>
            <p className="subtitulo">
              Usuarios, permisos y trazabilidad de Logística Talca.
            </p>
          </div>
          <Icon name="shield" size={32} />
        </div>
        <nav className="admin-tabs" aria-label="Administración">
          <NavLink to="/administracion/panel">Panel de control</NavLink>
          <NavLink to="/administracion/usuarios">Usuarios y accesos</NavLink>
          <NavLink to="/administracion/permisos">Roles y permisos</NavLink>
          <NavLink to="/administracion/auditoria">Auditoría general</NavLink>
          <NavLink to="/administracion/base-datos">Base de datos</NavLink>
          <NavLink to="/administracion/errores">Registros de errores</NavLink>
          <NavLink to="/administracion/reportes">Reportes</NavLink>
          <NavLink to="/administracion/notificaciones">Notificaciones</NavLink>
          <NavLink to="/administracion/seguridad">Seguridad</NavLink>
          <NavLink to="/administracion/estado">Estado del sistema</NavLink>
        </nav>
        {section === "auditoria" ? (
          <Auditoria />
        ) : section === "usuarios" ? (
          <Usuarios />
        ) : (
          <AdministracionHerramientas key={section} section={section} />
        )}
      </div>
    </div>
  );
}
