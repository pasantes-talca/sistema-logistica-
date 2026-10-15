import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  ExpedicionOperativa,
  FleteroOperativo,
  ProductoOperativo,
} from "../../api/expedicionOperativa";
import { Table } from "./Controles";
import {
  coincidenciasFleteros,
  filtrarFleteros,
  filtrarProductos,
  filtrarUsuarios,
  nombreFletero,
  type EstadoConfiguracion,
} from "./configuracion";

function FiltroPadron({
  nombre,
  busqueda,
  buscar,
  estado,
  cambiarEstado,
}: {
  nombre: string;
  busqueda: string;
  buscar: (v: string) => void;
  estado: EstadoConfiguracion;
  cambiarEstado: (v: EstadoConfiguracion) => void;
}) {
  return (
    <div className="eo-config-filters">
      <label>
        Buscar {nombre}
        <input
          value={busqueda}
          onChange={(e) => buscar(e.target.value)}
          placeholder={
            nombre === "usuarios"
              ? "Nombre o usuario"
              : nombre === "fleteros"
                ? "Nombre, apellido o empresa"
                : "Código, alias o nombre"
          }
        />
      </label>
      <label>
        Estado de {nombre}
        <select
          value={estado}
          onChange={(e) => cambiarEstado(e.target.value as EstadoConfiguracion)}
        >
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </label>
    </div>
  );
}
function Estado({ activo }: { activo: boolean }) {
  return (
    <span className={`eo-config-status${activo ? "" : " eo-config-inactive"}`}>
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}
export function ReporteConfiguracion({
  usuarios,
  fleteros,
  productos,
  admin,
}: {
  usuarios: ExpedicionOperativa["usuarios"];
  fleteros: FleteroOperativo[];
  productos: ProductoOperativo[];
  admin: boolean;
}) {
  return (
    <>
      {admin && (
        <>
          <h3>Usuarios</h3>
          <Table
            headers={["Nombre", "Usuario", "Estado"]}
            rows={usuarios.map((u) => [
              u.nombre,
              u.username,
              u.activo ? "Activo" : "Inactivo",
            ])}
          />
        </>
      )}
      <h3>Fleteros</h3>
      <Table
        headers={["Nombre", "Empresa", "Estado"]}
        rows={fleteros.map((f) => [
          nombreFletero(f),
          f.empresa || "Sin empresa indicada",
          f.activo ? "Activo" : "Inactivo",
        ])}
      />
      <h3>Productos y equivalencias</h3>
      <Table
        headers={[
          "Código / alias",
          "Producto",
          "Un./fardo",
          "Fardos/corte",
          "Cortes/pallet",
          "Beneficio",
          "Estado",
        ]}
        rows={productos.map((p) => [
          p.codigo + (p.alias ? " / " + p.alias : ""),
          p.nombre,
          p.unidades_pack,
          p.packs_corte,
          p.cortes_pallet,
          p.beneficio_empleado ? "Sí" : "No",
          p.activo ? "Activo" : "Inactivo",
        ])}
      />
    </>
  );
}
export default function ConfiguracionExpedicion({
  data,
  online,
  nuevoUsuario,
  modificarUsuario,
  nuevoFletero,
  modificarFletero,
  nuevoProducto,
  configurarProducto,
  copias,
  imprimir,
}: {
  data: ExpedicionOperativa;
  online: boolean;
  nuevoUsuario: () => void;
  modificarUsuario: (u: ExpedicionOperativa["usuarios"][number]) => void;
  nuevoFletero: () => void;
  modificarFletero: (f: FleteroOperativo) => void;
  nuevoProducto: () => void;
  configurarProducto: (p: ProductoOperativo) => void;
  copias: ReactNode;
  imprimir: (
    usuarios: ExpedicionOperativa["usuarios"],
    fleteros: FleteroOperativo[],
    productos: ProductoOperativo[],
  ) => void;
}) {
  const [usuariosBusqueda, setUsuariosBusqueda] = useState("");
  const [fleterosBusqueda, setFleterosBusqueda] = useState("");
  const [productosBusqueda, setProductosBusqueda] = useState("");
  const [usuariosEstado, setUsuariosEstado] = useState<EstadoConfiguracion>("");
  const [fleterosEstado, setFleterosEstado] = useState<EstadoConfiguracion>("");
  const [productosEstado, setProductosEstado] =
    useState<EstadoConfiguracion>("");
  const [revisar, setRevisar] = useState(false);
  const usuarios = filtrarUsuarios(
    data.usuarios,
    usuariosBusqueda,
    usuariosEstado,
  );
  const fleteros = filtrarFleteros(
    data.fleteros,
    fleterosBusqueda,
    fleterosEstado,
  );
  const productos = filtrarProductos(
    data.productos,
    productosBusqueda,
    productosEstado,
  );
  const coincidencias = coincidenciasFleteros(data.fleteros);
  return (
    <>
      {copias}
      <div className="eo-config-grid">
        <section
          className="eo-config-panel"
          aria-labelledby="eo-config-users-title"
        >
          <div className="eo-config-panel-heading">
            <h2 id="eo-config-users-title">Usuarios</h2>
            {data.admin && (
              <button type="button" disabled={!online} onClick={nuevoUsuario}>
                Agregar usuario
              </button>
            )}
          </div>
          {data.admin ? (
            <>
              <FiltroPadron
                nombre="usuarios"
                busqueda={usuariosBusqueda}
                buscar={setUsuariosBusqueda}
                estado={usuariosEstado}
                cambiarEstado={setUsuariosEstado}
              />
              <ul
                className="eo-config-list"
                aria-label="Usuarios de Expedición"
              >
                {usuarios.map((u) => (
                  <li key={u.id}>
                    <div>
                      <strong>{u.nombre || u.username}</strong>
                      <small>
                        @{u.username} · <Estado activo={u.activo} />
                      </small>
                    </div>
                    <button
                      type="button"
                      disabled={!online}
                      aria-label={`Modificar usuario ${u.username}`}
                      onClick={() => modificarUsuario(u)}
                    >
                      Modificar
                    </button>
                  </li>
                ))}
              </ul>
              {!usuarios.length && (
                <p className="eo-empty">No hay usuarios con estos filtros.</p>
              )}
              <p className="eo-config-caption">
                {usuarios.length} de {data.usuarios.length} usuarios. Las
                contraseñas no se muestran; pueden renovarse al modificar.
              </p>
            </>
          ) : (
            <p className="eo-config-caption">
              La gestión de usuarios está disponible únicamente para
              administradores.
            </p>
          )}
        </section>
        <section
          className="eo-config-panel"
          aria-labelledby="eo-config-carriers-title"
        >
          <div className="eo-config-panel-heading">
            <h2 id="eo-config-carriers-title">Fleteros</h2>
            <div className="eo-config-buttons">
              <button
                type="button"
                aria-expanded={revisar}
                aria-controls="eo-carrier-duplicates"
                onClick={() => setRevisar(!revisar)}
              >
                Revisar duplicados
              </button>
              <button type="button" disabled={!online} onClick={nuevoFletero}>
                Agregar fletero
              </button>
            </div>
          </div>
          <FiltroPadron
            nombre="fleteros"
            busqueda={fleterosBusqueda}
            buscar={setFleterosBusqueda}
            estado={fleterosEstado}
            cambiarEstado={setFleterosEstado}
          />
          {revisar && (
            <div id="eo-carrier-duplicates" className="eo-config-duplicates">
              <h3>Coincidencias para revisar</h3>
              <p>
                Coincidencias de nombre y apellido, no duplicados confirmados.
                No se fusionan ni eliminan registros. Para dar de baja, desmarcá
                “Activo” al modificar; se conserva el historial.
              </p>
              {!coincidencias.length ? (
                <p>No hay coincidencias de nombre y apellido.</p>
              ) : (
                <ul>
                  {coincidencias.map((g) => (
                    <li key={g[0].id}>
                      <strong>{nombreFletero(g[0])}</strong>
                      <ul>
                        {g.map((f) => (
                          <li key={f.id}>
                            <span>
                              ID {f.id} · {f.empresa || "Sin empresa indicada"}{" "}
                              · {f.activo ? "Activo" : "Inactivo"}
                            </span>
                            <button
                              type="button"
                              disabled={!online}
                              aria-label={`Revisar fletero ${f.id}`}
                              onClick={() => modificarFletero(f)}
                            >
                              Modificar
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <ul className="eo-config-list" aria-label="Fleteros de Expedición">
            {fleteros.map((f) => (
              <li key={f.id}>
                <div>
                  <strong>{nombreFletero(f)}</strong>
                  <small>
                    {f.empresa || "Sin empresa indicada"}
                    {!f.activo && (
                      <>
                        {" "}
                        · <Estado activo={false} />
                      </>
                    )}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={!online}
                  aria-label={`Modificar fletero ${nombreFletero(f)} ${f.id}`}
                  onClick={() => modificarFletero(f)}
                >
                  Modificar
                </button>
              </li>
            ))}
          </ul>
          {!fleteros.length && (
            <p className="eo-empty">No hay fleteros con estos filtros.</p>
          )}
          <p className="eo-config-caption">
            {fleteros.length} de {data.fleteros.length} fleteros. La baja es por
            estado, sin borrar órdenes ni movimientos.
          </p>
        </section>
      </div>
      <section
        className="eo-config-panel eo-config-products"
        aria-labelledby="eo-config-products-title"
      >
        <div className="eo-config-panel-heading">
          <div>
            <h2 id="eo-config-products-title">Productos y equivalencias</h2>
            <p className="eo-config-caption">
              Configurá unidades por fardo, cortes y pallets. Los umbrales de
              stock se expresan en unidades.
            </p>
          </div>
          <button type="button" disabled={!online} onClick={nuevoProducto}>
            Nuevo producto
          </button>
        </div>
        <FiltroPadron
          nombre="productos"
          busqueda={productosBusqueda}
          buscar={setProductosBusqueda}
          estado={productosEstado}
          cambiarEstado={setProductosEstado}
        />
        <Table
          headers={[
            "Código / alias",
            "Producto",
            "Un./fardo",
            "Fardos/corte",
            "Cortes/pallet",
            "Beneficio",
            "Estado",
            "Acción",
          ]}
          rows={productos.map((p) => [
            <span>
              <strong>{p.codigo}</strong>
              {p.alias && <small>{p.alias}</small>}
            </span>,
            p.nombre,
            p.unidades_pack,
            p.packs_corte,
            p.cortes_pallet,
            p.beneficio_empleado ? "Sí" : "No",
            <Estado activo={p.activo} />,
            <button
              type="button"
              disabled={!online}
              aria-label={`Configurar ${p.nombre}`}
              onClick={() => configurarProducto(p)}
            >
              Configurar
            </button>,
          ])}
          emptyMessage="No hay productos con estos filtros."
        />
        <div className="eo-config-bottom">
          <p className="eo-config-caption">
            {productos.length} de {data.productos.length} productos.
          </p>
          <div className="eo-actions">
            <button
              type="button"
              onClick={() => {
                setUsuariosBusqueda("");
                setFleterosBusqueda("");
                setProductosBusqueda("");
                setUsuariosEstado("");
                setFleterosEstado("");
                setProductosEstado("");
              }}
            >
              Limpiar filtros
            </button>
            <button
              type="button"
              onClick={() => imprimir(usuarios, fleteros, productos)}
            >
              Imprimir configuración
            </button>
            <Link to="/expedicion/fleteros">Administrar fleteros</Link>
            <Link to="/expedicion/empleados">Administrar empleados</Link>
          </div>
        </div>
      </section>
    </>
  );
}
