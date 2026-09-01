import { Link } from "react-router-dom";


export default function InicioRechazosPage() {

  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="panel-bienvenida">

          <h1>
            Rechazos
          </h1>

          <p>
            Gestión y análisis
            de entregas rechazadas.
          </p>

        </div>


        <div className="panel-modulos">

          <Link
            to="/rechazos/nuevo"
            className="tarjeta-modulo"
          >
            <h2>
              Nuevo rechazo
            </h2>

            <p>
              Registrar una nueva
              entrega no realizada.
            </p>
          </Link>


          <Link
            to="/rechazos"
            className="tarjeta-modulo"
          >
            <h2>
              Historial
            </h2>

            <p>
              Consultar y editar
              rechazos registrados.
            </p>
          </Link>


          <Link
            to="/rechazos/estadisticas"
            className="tarjeta-modulo"
          >
            <h2>
              Estadísticas
            </h2>

            <p>
              Analizar motivos,
              porcentajes y asignaciones.
            </p>
          </Link>

        </div>

      </div>

    </div>
  );
}