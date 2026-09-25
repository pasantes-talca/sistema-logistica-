import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerMovimientosStock,
} from "../api/expedicion";

import Icon from "../components/ui/Icon";
import "./Expedicion.css";

function formatearFechaHora(
  valor: string
) {

  if (!valor) {
    return "—";
  }

  return new Date(
    valor
  ).toLocaleString(
    "es-AR"
  );
}


function formatearTipo(
  tipo: string
) {

  const tipos:
    Record<string, string> = {

      INGRESO:
        "Ingreso",

      ORDEN_CARGA:
        "Orden de carga",

      AJUSTE:
        "Ajuste",

      REBOTE:
        "Rebote",

      DERRAME:
        "Derrame",

      CONSUMO_EMPLEADO:
        "Consumo empleado",

      ANTICIPO_EMPLEADO:
        "Anticipo empleado",

    };


  return (
    tipos[tipo]
    ??
    tipo
  );
}


function formatearDireccion(
  direccion: string
) {

  if (
    direccion === "ENTRADA"
  ) {

    return "Entrada";
  }


  if (
    direccion === "SALIDA"
  ) {

    return "Salida";
  }


  return direccion;
}


export default function MovimientosExpedicionPage() {

  const {
    data: movimientos = [],
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "expedicion-movimientos-stock",
    ],

    queryFn:
      obtenerMovimientosStock,

  });


  const entradas =
    movimientos.filter(
      item =>
        item.direccion === "ENTRADA"
    );


  const salidas =
    movimientos.filter(
      item =>
        item.direccion === "SALIDA"
    );


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
                name="history"
                size={16}
              />

              Expedición

            </div>


            <h1>
              Movimientos de stock
            </h1>


            <p>
              Consultá todos los ingresos,
              salidas, ajustes y movimientos
              generados por órdenes de carga.
            </p>

          </div>


          <div className="dashboard-status">

            <span />

            <div>

              <strong>
                Historial operativo
              </strong>

              <small>
                Movimientos registrados
                en PostgreSQL
              </small>

            </div>

          </div>

        </div>


        {/* ===================================== */}
        {/* RESUMEN */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                RESUMEN
              </span>

              <h2>
                Actividad de stock
              </h2>

            </div>

          </div>


          <div className="dashboard-kpis">


            <div className="kpi-card">

              <div className="kpi-icon blue">

                <Icon
                  name="activity"
                />

              </div>

              <div>

                <span>
                  Movimientos totales
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : movimientos.length
                  }
                </strong>

                <small>
                  Registros
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon green">

                <Icon
                  name="plus"
                />

              </div>

              <div>

                <span>
                  Entradas
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : entradas.length
                  }
                </strong>

                <small>
                  Movimientos de ingreso
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon amber">

                <Icon
                  name="truck"
                />

              </div>

              <div>

                <span>
                  Salidas
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : salidas.length
                  }
                </strong>

                <small>
                  Movimientos de egreso
                </small>

              </div>

            </div>

          </div>

        </section>


        {/* ===================================== */}
        {/* HISTORIAL */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                HISTORIAL
              </span>

              <h2>
                Movimientos registrados
              </h2>

            </div>


            <small>
              {
                isLoading
                  ? "Cargando..."
                  : `${movimientos.length} registros`
              }
            </small>

          </div>


          {
            isLoading
              ? (

                  <p>
                    Cargando movimientos...
                  </p>

                )
              : isError
                ? (

                    <p>
                      No se pudieron cargar
                      los movimientos.
                    </p>

                  )
                : movimientos.length === 0
                  ? (

                      <div
                        style={{
                          padding: "40px",
                          textAlign: "center",
                        }}
                      >

                        <Icon
                          name="history"
                          size={36}
                        />

                        <h3>
                          No hay movimientos
                        </h3>

                        <p>
                          Todavía no se registraron
                          movimientos de stock.
                        </p>

                      </div>

                    )
                  : (

                      <div
                        style={{
                          overflowX:
                            "auto",
                        }}
                      >

                        <table>

                          <thead>

                            <tr>

                              <th>
                                Fecha
                              </th>

                              <th>
                                Código
                              </th>

                              <th>
                                Producto
                              </th>

                              <th>
                                Tipo
                              </th>

                              <th>
                                Dirección
                              </th>

                              <th>
                                Cantidad
                              </th>

                              <th>
                                Referencia
                              </th>

                              <th>
                                Usuario
                              </th>

                            </tr>

                          </thead>


                          <tbody>

                            {
                              movimientos.map(
                                movimiento => (

                                  <tr
                                    key={
                                      movimiento.id
                                    }
                                  >

                                    <td>
                                      {
                                        formatearFechaHora(
                                          movimiento
                                            .creado_en
                                        )
                                      }
                                    </td>


                                    <td>

                                      <strong>
                                        {
                                          movimiento.codigo
                                        }
                                      </strong>

                                    </td>


                                    <td>
                                      {
                                        movimiento
                                          .producto_nombre
                                      }
                                    </td>


                                    <td>
                                      {
                                        formatearTipo(
                                          movimiento.tipo
                                        )
                                      }
                                    </td>


                                    <td>
                                      {
                                        formatearDireccion(
                                          movimiento
                                            .direccion
                                        )
                                      }
                                    </td>


                                    <td>

                                      <strong>
                                        {
                                          Number(
                                            movimiento
                                              .cantidad
                                          )
                                            .toLocaleString(
                                              "es-AR"
                                            )
                                        }
                                      </strong>

                                    </td>


                                    <td>
                                      {
                                        movimiento
                                          .referencia
                                        ||
                                        "—"
                                      }
                                    </td>


                                    <td>
                                      {
                                        movimiento
                                          .creado_por_nombre
                                        ||
                                        "—"
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