import {
  Link,
} from "react-router-dom";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerOrdenesCarga,
} from "../api/expedicion";

import Icon from "../components/ui/Icon";
import "./Expedicion.css";


function formatearEstado(
  estado: string
) {

  const estados:
    Record<string, string> = {

      RECIBIDA:
        "Recibida",

      CARGA_INICIADA:
        "Carga iniciada",

      PARCIAL:
        "Parcial",

      COMPLETA:
        "Completa",

      COMPLETA_CON_CAMBIO:
        "Completa con cambio",

      PENDIENTE_CONTROL:
        "Pendiente de control",

    };


  return (
    estados[estado]
    ??
    estado
  );
}


function formatearFecha(
  fecha: string
) {

  if (!fecha) {
    return "—";
  }


  const [
    anio,
    mes,
    dia,
  ] =
    fecha.split("-");


  return `${dia}/${mes}/${anio}`;
}


export default function OrdenesExpedicionPage() {

  const {
    data: ordenes = [],
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "expedicion-ordenes",
    ],

    queryFn:
      obtenerOrdenesCarga,

  });


  return (

    <div className="pagina expedicion-page">

      <div className="dashboard-container">


        {/* ===================================== */}
        {/* ENCABEZADO */}
        {/* ===================================== */}

        <div className="dashboard-bienvenida">

          <div>

            <div className="badge-panel">

              <Icon
                name="truck"
                size={16}
              />

              Expedición

            </div>


            <h1>
              Órdenes de carga
            </h1>


            <p>
              Consultá las órdenes registradas,
              su estado y los productos
              solicitados para cada carga.
            </p>

          </div>


          <div>

            <Link
              to="/expedicion/ordenes/nueva"
              className="module-enter"
            >

              Nueva orden

              <Icon
                name="plus"
                size={17}
              />

            </Link>

          </div>

        </div>


        {/* ===================================== */}
        {/* LISTADO */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                ÓRDENES
              </span>

              <h2>
                Historial de órdenes
              </h2>

            </div>


            <small>
              {
                isLoading
                  ? "Cargando..."
                  : `${ordenes.length} órdenes registradas`
              }
            </small>

          </div>


          {
            isLoading
              ? (

                  <p>
                    Cargando órdenes...
                  </p>

                )
              : isError
                ? (

                    <p>
                      No se pudieron cargar
                      las órdenes.
                    </p>

                  )
                : ordenes.length === 0
                  ? (

                      <div
                        style={{
                          padding: "40px 0",
                          textAlign: "center",
                        }}
                      >

                        <Icon
                          name="truck"
                          size={36}
                        />

                        <h3>
                          No hay órdenes
                          registradas
                        </h3>

                        <p>
                          Creá la primera orden
                          de carga de Expedición.
                        </p>

                      </div>

                    )
                  : (

                      <div
                        style={{
                          overflowX: "auto",
                        }}
                      >

                        <table>

                          <thead>

                            <tr>

                              <th>
                                Número
                              </th>

                              <th>
                                Fecha
                              </th>

                              <th>
                                Fletero
                              </th>

                              <th>
                                Estado
                              </th>

                              <th>
                                Productos
                              </th>

                              <th>
                                Entregas
                              </th>

                              <th>
                                Facturación
                              </th>

                            </tr>

                          </thead>


                          <tbody>

                            {
                              ordenes.map(
                                orden => (

                                  <tr
                                    key={
                                      orden.id
                                    }
                                  >

                                    <td>

                                      <strong>
                                        {
                                          orden.numero
                                        }
                                      </strong>

                                    </td>


                                    <td>
                                      {
                                        formatearFecha(
                                          orden.fecha
                                        )
                                      }
                                    </td>


                                    <td>
                                      {
                                        orden
                                          .fletero_nombre
                                      }
                                    </td>


                                    <td>

                                      <span>
                                        {
                                          formatearEstado(
                                            orden.estado
                                          )
                                        }
                                      </span>

                                    </td>


                                    <td>
                                      {
                                        orden
                                          .detalles
                                          .length
                                      }
                                    </td>


                                    <td>
                                      {
                                        orden
                                          .entregas
                                          .length
                                      }
                                    </td>


                                    <td>
                                      {
                                        orden
                                          .facturacion
                                      }
                                    </td>

                                  </tr>

                                )
                              )
                            }

                          </tbody>

                        </table>

                      </div>

                    )
          }

        </section>

      </div>

    </div>

  );
}