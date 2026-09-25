import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerMovimientosMaterial,
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


export default function MaterialesExpedicionPage() {

  const {
    data: movimientos = [],
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "expedicion-materiales",
    ],

    queryFn:
      obtenerMovimientosMaterial,

  });


  const totalPalletsSalida =
    movimientos.reduce(
      (
        acumulado,
        movimiento
      ) =>
        acumulado
        +
        Number(
          movimiento.pallets_salida
        ),
      0
    );


  const totalPalletsEntrada =
    movimientos.reduce(
      (
        acumulado,
        movimiento
      ) =>
        acumulado
        +
        Number(
          movimiento.pallets_entrada
        ),
      0
    );


  const totalChapadurSalida =
    movimientos.reduce(
      (
        acumulado,
        movimiento
      ) =>
        acumulado
        +
        Number(
          movimiento.chapadur_salida
        ),
      0
    );


  const totalChapadurEntrada =
    movimientos.reduce(
      (
        acumulado,
        movimiento
      ) =>
        acumulado
        +
        Number(
          movimiento.chapadur_entrada
        ),
      0
    );


  const saldoPallets =
    totalPalletsSalida
    -
    totalPalletsEntrada;


  const saldoChapadur =
    totalChapadurSalida
    -
    totalChapadurEntrada;


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
                name="boxes"
                size={16}
              />

              Expedición

            </div>


            <h1>
              Pallets y chapadur
            </h1>


            <p>
              Consultá las salidas,
              devoluciones y saldos
              de materiales asociados
              a las órdenes de carga.
            </p>

          </div>


          <div className="dashboard-status">

            <span />

            <div>

              <strong>
                Control de materiales
              </strong>

              <small>
                Movimientos por fletero
                y orden
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
                Balance general
              </h2>

            </div>

          </div>


          <div className="dashboard-kpis">


            <div className="kpi-card">

              <div className="kpi-icon blue">

                <Icon
                  name="boxes"
                />

              </div>

              <div>

                <span>
                  Pallets entregados
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : totalPalletsSalida
                          .toLocaleString(
                            "es-AR"
                          )
                  }
                </strong>

                <small>
                  Salidas acumuladas
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon green">

                <Icon
                  name="activity"
                />

              </div>

              <div>

                <span>
                  Pallets devueltos
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : totalPalletsEntrada
                          .toLocaleString(
                            "es-AR"
                          )
                  }
                </strong>

                <small>
                  Entradas acumuladas
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon amber">

                <Icon
                  name="history"
                />

              </div>

              <div>

                <span>
                  Saldo pallets
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : saldoPallets
                          .toLocaleString(
                            "es-AR"
                          )
                  }
                </strong>

                <small>
                  Pendientes de devolución
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon blue">

                <Icon
                  name="boxes"
                />

              </div>

              <div>

                <span>
                  Chapadur entregado
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : totalChapadurSalida
                          .toLocaleString(
                            "es-AR"
                          )
                  }
                </strong>

                <small>
                  Salidas acumuladas
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon green">

                <Icon
                  name="activity"
                />

              </div>

              <div>

                <span>
                  Chapadur devuelto
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : totalChapadurEntrada
                          .toLocaleString(
                            "es-AR"
                          )
                  }
                </strong>

                <small>
                  Entradas acumuladas
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon amber">

                <Icon
                  name="history"
                />

              </div>

              <div>

                <span>
                  Saldo chapadur
                </span>

                <strong>
                  {
                    isLoading
                      ? "—"
                      : saldoChapadur
                          .toLocaleString(
                            "es-AR"
                          )
                  }
                </strong>

                <small>
                  Pendientes de devolución
                </small>

              </div>

            </div>

          </div>

        </section>


        {/* ===================================== */}
        {/* MOVIMIENTOS */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                HISTORIAL
              </span>

              <h2>
                Movimientos de materiales
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
                          name="boxes"
                          size={36}
                        />

                        <h3>
                          No hay movimientos
                        </h3>

                        <p>
                          Todavía no se registraron
                          movimientos de pallets
                          o chapadur.
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
                                Fletero
                              </th>

                              <th>
                                Referencia
                              </th>

                              <th>
                                Origen
                              </th>

                              <th>
                                Pallets salida
                              </th>

                              <th>
                                Pallets entrada
                              </th>

                              <th>
                                Chapadur salida
                              </th>

                              <th>
                                Chapadur entrada
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
                                          movimiento
                                            .fletero_nombre
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
                                          .origen
                                        ||
                                        "—"
                                      }
                                    </td>


                                    <td>
                                      {
                                        Number(
                                          movimiento
                                            .pallets_salida
                                        )
                                          .toLocaleString(
                                            "es-AR"
                                          )
                                      }
                                    </td>


                                    <td>
                                      {
                                        Number(
                                          movimiento
                                            .pallets_entrada
                                        )
                                          .toLocaleString(
                                            "es-AR"
                                          )
                                      }
                                    </td>


                                    <td>
                                      {
                                        Number(
                                          movimiento
                                            .chapadur_salida
                                        )
                                          .toLocaleString(
                                            "es-AR"
                                          )
                                      }
                                    </td>


                                    <td>
                                      {
                                        Number(
                                          movimiento
                                            .chapadur_entrada
                                        )
                                          .toLocaleString(
                                            "es-AR"
                                          )
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