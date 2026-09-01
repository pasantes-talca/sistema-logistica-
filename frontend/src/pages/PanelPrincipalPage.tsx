import { Link } from "react-router-dom";

function obtenerNombreUsuario() {
  try {
    const raw = localStorage.getItem("usuario");

    if (!raw) {
      return "Ariel Garro";
    }

    const data = JSON.parse(raw);

    if (data.nombre_completo) {
      return data.nombre_completo;
    }

    if (data.first_name || data.last_name) {
      return `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
    }

    if (data.username) {
      return data.username;
    }

    return "Ariel Garro";
  } catch {
    return "Ariel Garro";
  }
}

export default function PanelInicioPage() {
  const nombreUsuario = obtenerNombreUsuario();

  return (
    <div className="pagina">
      <div className="contenedor-grande">
        <div className="dashboard-bienvenida">
          <div>
            <div className="badge-panel">
              Panel central
            </div>

            <h1>Logística Talca</h1>

            <p>
              Bienvenido, <strong>{nombreUsuario}</strong>. Desde acá podés
              entrar a los tres sistemas principales de la operación.
            </p>
          </div>
        </div>

        <div className="dashboard-kpis">
          <div className="kpi-card">
            <span>Sistemas</span>
            <strong>3</strong>
          </div>

          <div className="kpi-card">
            <span>Módulos disponibles</span>
            <strong>9</strong>
          </div>

          <div className="kpi-card">
            <span>Usuario activo</span>
            <strong>1</strong>
          </div>

          <div className="kpi-card">
            <span>Estado</span>
            <strong>OK</strong>
          </div>
        </div>

        <div className="grid-modulos">
          <div className="modulo-card">
            <h3>Repartos y recargas</h3>

            <p>
              Gestión de repartos diarios, edición de registros e informe de
              recargas por empleado.
            </p>

            <div className="modulo-links">
              <Link className="modulo-link" to="/repartos/nuevo">
                Nuevo reparto
              </Link>

              <Link className="modulo-link" to="/repartos">
                Historial
              </Link>

              <Link className="modulo-link" to="/repartos/recargas">
                Reporte recargas
              </Link>
            </div>
          </div>

          <div className="modulo-card">
            <h3>Rechazos</h3>

            <p>
              Registro de entregas no concretadas, historial editable y
              estadísticas de causas de no entrega.
            </p>

            <div className="modulo-links">
              <Link className="modulo-link" to="/rechazos/nuevo">
                Nuevo rechazo
              </Link>

              <Link className="modulo-link" to="/rechazos">
                Historial
              </Link>

              <Link className="modulo-link" to="/rechazos/estadisticas">
                Estadísticas
              </Link>
            </div>
          </div>

          <div className="modulo-card">
            <h3>Recibos de cambios</h3>

            <p>
              Carga, consulta, edición y estadísticas de recibos de cambios
              agrupados por fecha y concesionario.
            </p>

            <div className="modulo-links">
              <Link className="modulo-link" to="/cambios/nuevo">
                Nuevo recibo
              </Link>

              <Link className="modulo-link" to="/cambios">
                Historial
              </Link>

              <Link className="modulo-link" to="/cambios/estadisticas">
                Estadísticas
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}