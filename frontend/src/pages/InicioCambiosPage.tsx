import { Link } from "react-router-dom";


export default function InicioCambiosPage() {

  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="panel-bienvenida">

          <h1>
            Recibos de cambios
          </h1>

          <p>
            Gestión de mercadería
            recibida por cambios.
          </p>

        </div>


        <div className="panel-modulos">

          <Link
            to="/cambios/nuevo"
            className="tarjeta-modulo"
          >
            <h2>
              Nuevo recibo
            </h2>

            <p>
              Registrar productos,
              pallets y observaciones.
            </p>
          </Link>


          <Link
            to="/cambios"
            className="tarjeta-modulo"
          >
            <h2>
              Historial
            </h2>

            <p>
              Consultar y editar
              recibos existentes.
            </p>
          </Link>


          <Link
            to="/cambios/estadisticas"
            className="tarjeta-modulo"
          >
            <h2>
              Estadísticas
            </h2>

            <p>
              Analizar productos
              y concesionarios.
            </p>
          </Link>

        </div>

      </div>

    </div>
  );
}