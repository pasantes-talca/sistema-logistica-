import { Link } from "react-router-dom";

import Icon from "../components/ui/Icon";

import "./Viaticos.css";


export default function InicioControlDiarioPage() {

  return (

    <div className="pagina">

      <div className="viaticos-inicio-page">

        <div className="viaticos-inicio-panel">


          <div className="viaticos-inicio-header">

            <div className="viaticos-inicio-main-icon">

              <Icon
                name="boxes"
                size={30}
              />

            </div>


            <div>

              <span className="viaticos-inicio-eyebrow">
                CONTROL DIARIO DE LOGÍSTICA
              </span>

              <h1>
                Control diario
              </h1>

              <p>
                Gestión diaria de mercadería,
                asignaciones, depósitos y distribución.
              </p>

            </div>

          </div>


          <div className="viaticos-inicio-divider" />


          <div className="viaticos-inicio-grid">


            <Link
              to="/control-diario/nuevo"
              className="viaticos-inicio-card"
            >

              <div className="viaticos-inicio-card-icon">

                <Icon
                  name="plus"
                  size={24}
                />

              </div>


              <div>

                <h3>
                  Nueva carga
                </h3>

                <p>
                  Registrá la disponibilidad,
                  asignaciones y movimientos
                  del día.
                </p>

                <span className="viaticos-inicio-card-link">

                  Abrir sección

                  <Icon
                    name="chevron"
                    size={15}
                  />

                </span>

              </div>

            </Link>


            <Link
              to="/control-diario"
              className="viaticos-inicio-card"
            >

              <div className="viaticos-inicio-card-icon">

                <Icon
                  name="history"
                  size={24}
                />

              </div>


              <div>

                <h3>
                  Historial
                </h3>

                <p>
                  Consultá los controles diarios
                  registrados y revisá su detalle.
                </p>

                <span className="viaticos-inicio-card-link">

                  Abrir sección

                  <Icon
                    name="chevron"
                    size={15}
                  />

                </span>

              </div>

            </Link>


            <Link
              to="/control-diario/estadisticas"
              className="viaticos-inicio-card"
            >

              <div className="viaticos-inicio-card-icon">

                <Icon
                  name="chart"
                  size={24}
                />

              </div>


              <div>

                <h3>
                  Estadísticas
                </h3>

                <p>
                  Analizá movimientos,
                  productos y distribución
                  por período.
                </p>

                <span className="viaticos-inicio-card-link">

                  Abrir sección

                  <Icon
                    name="chevron"
                    size={15}
                  />

                </span>

              </div>

            </Link>


          </div>


        </div>

      </div>

    </div>

  );
}