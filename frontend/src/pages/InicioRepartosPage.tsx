import { Link } from "react-router-dom";


export default function InicioRepartosPage() {

  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="panel-bienvenida">

          <h1>
            Repartos y recargas
          </h1>

          <p>
            Gestión operativa de repartos
            y cálculo de recargas.
          </p>

        </div>


        <div className="panel-modulos">

          <Link
            to="/repartos/nuevo"
            className="tarjeta-modulo"
          >
            <h2>
              Nuevo reparto
            </h2>

            <p>
              Registrar un nuevo reparto
              y calcular las recargas.
            </p>
          </Link>


          <Link
            to="/repartos"
            className="tarjeta-modulo"
          >
            <h2>
              Historial
            </h2>

            <p>
              Consultar y editar
              repartos registrados.
            </p>
          </Link>


          <Link
            to="/repartos/recargas"
            className="tarjeta-modulo"
          >
            <h2>
              Reporte de recargas
            </h2>

            <p>
              Consultar las recargas
              acumuladas por empleado.
            </p>
          </Link>

        </div>

      </div>

    </div>
  );
}