import {
  Link,
} from "react-router-dom";

import Icon from "../components/ui/Icon";

import "./Viaticos.css";


export default function InicioViaticosPage() {

  return (

    <div className="viaticos-inicio-page">

      <section className="viaticos-inicio-panel">


        {/* ===================================== */}
        {/* ENCABEZADO */}
        {/* ===================================== */}

        <div className="viaticos-inicio-header">

          <div className="viaticos-inicio-main-icon">

            <Icon
              name="truck"
              size={25}
            />

          </div>


          <div className="viaticos-inicio-title">

            <span className="viaticos-inicio-eyebrow">
              CONTROL DE VIÁTICOS
            </span>

            <h1>
              Viáticos
            </h1>

            <p>
              Gestión de viáticos locales
              y de larga distancia.
            </p>

          </div>

        </div>


        {/* DIVISOR */}

        <div className="viaticos-inicio-divider" />


        {/* ===================================== */}
        {/* OPCIONES */}
        {/* ===================================== */}

        <div className="viaticos-inicio-grid">


          {/* NUEVO */}

          <Link
            to="/viaticos/nuevo"
            className="viaticos-inicio-card"
          >

            <div className="viaticos-inicio-card-icon">

              <Icon
                name="plus"
                size={22}
              />

            </div>


            <h2>
              Nuevo registro
            </h2>


            <p>
              Registrá un nuevo viático
              local o de larga distancia.
            </p>


            <div className="viaticos-inicio-card-link">

              <span>
                Abrir sección
              </span>

              <Icon
                name="chevron"
                size={14}
              />

            </div>

          </Link>



          {/* HISTORIAL */}

          <Link
            to="/viaticos"
            className="viaticos-inicio-card"
          >

            <div className="viaticos-inicio-card-icon">

              <Icon
                name="history"
                size={22}
              />

            </div>


            <h2>
              Historial
            </h2>


            <p>
              Consultá los viáticos
              registrados y su detalle.
            </p>


            <div className="viaticos-inicio-card-link">

              <span>
                Abrir sección
              </span>

              <Icon
                name="chevron"
                size={14}
              />

            </div>

          </Link>



          {/* RESUMEN */}

          <Link
            to="/viaticos/resumen"
            className="viaticos-inicio-card"
          >

            <div className="viaticos-inicio-card-icon">

              <Icon
                name="chart"
                size={22}
              />

            </div>


            <h2>
              Resumen anual
            </h2>


            <p>
              Analizá cantidades y montos
              por mes y tipo de reparto.
            </p>


            <div className="viaticos-inicio-card-link">

              <span>
                Abrir sección
              </span>

              <Icon
                name="chevron"
                size={14}
              />

            </div>

          </Link>


        </div>

      </section>

    </div>

  );
}