import { Link } from "react-router-dom";

import Icon from "../components/ui/Icon";


export default function InicioKilometrajesPage() {

  return (

    <div className="pagina">

      <div className="viaticos-inicio-page">

        <div className="viaticos-inicio-panel">


          <div className="viaticos-inicio-header">

            <div className="viaticos-inicio-main-icon">

              <Icon
                name="truck"
                size={30}
              />

            </div>


            <div>

              <span className="viaticos-inicio-eyebrow">
                CONTROL DE KILOMETRAJES
              </span>

              <h1>
                Kilometrajes
              </h1>

              <p>
                Registrá y consultá los kilómetros
                recorridos por cada chofer según
                destino y período.
              </p>

            </div>

          </div>


          <div className="viaticos-inicio-divider" />


          <div className="viaticos-inicio-grid">


            <Link
              to="/kilometrajes/nuevo"
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
                  Nuevo control
                </h3>

                <p>
                  Cargá los viajes realizados
                  por chofer y destino.
                </p>

                <span>
                  Abrir sección
                </span>

              </div>

            </Link>


            <Link
              to="/kilometrajes"
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
                  Consultá los controles de
                  kilometraje registrados.
                </p>

                <span>
                  Abrir sección
                </span>

              </div>


            </Link>


          </div>


        </div>

      </div>

    </div>

  );
}