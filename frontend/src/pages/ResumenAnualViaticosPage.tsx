import {
  useState,
} from "react";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerResumenAnualViaticos,
} from "../api/logistica";

import "./Viaticos.css";


function obtenerAnioActual(): number {
  return new Date().getFullYear();
}


function formatearMoneda(
  valor: number | string
): string {
  return Number(valor).toLocaleString(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
    }
  );
}


export default function ResumenAnualViaticosPage() {

  const [
    anio,
    setAnio,
  ] = useState(
    obtenerAnioActual()
  );


  const {
    data: resumen,
    isLoading,
    isError,
    error,
  } = useQuery({

    queryKey: [
      "resumen-viaticos",
      anio,
    ],

    queryFn: () =>
      obtenerResumenAnualViaticos(
        anio
      ),

  });


  return (

    <div className="viaticos-page">


      {/* ===================================== */}
      {/* ENCABEZADO */}
      {/* ===================================== */}

      <div className="viaticos-header">

        <h1>
          Resumen anual de viáticos
        </h1>

        <p>
          Totales mensuales de viáticos
          locales y de larga distancia.
        </p>

      </div>


      {/* ===================================== */}
      {/* FILTRO DE AÑO */}
      {/* ===================================== */}

      <div className="viaticos-card">

        <div className="viaticos-filter">

          <div className="campo">

            <label>
              Año
            </label>

            <input
              type="number"
              min="2020"
              max="2100"
              value={
                anio
              }
              onChange={
                event =>
                  setAnio(
                    Number(
                      event.target.value
                    )
                  )
              }
            />

          </div>

        </div>

      </div>


      {/* ===================================== */}
      {/* CARGANDO */}
      {/* ===================================== */}

      {
        isLoading
        &&
        (

          <div className="viaticos-card">

            <p>
              Cargando resumen...
            </p>

          </div>

        )
      }


      {/* ===================================== */}
      {/* ERROR */}
      {/* ===================================== */}

      {
        isError
        &&
        (

          <div className="viaticos-card">

            <p>
              No se pudo cargar
              el resumen anual.
            </p>

            <p>
              {
                error instanceof Error
                  ? error.message
                  : "Error desconocido."
              }
            </p>

          </div>

        )
      }


      {/* ===================================== */}
      {/* RESUMEN */}
      {/* ===================================== */}

      {
        resumen
        &&
        (

          <>


            {/* TARJETAS PRINCIPALES */}

            <div className="viaticos-summary-grid">


              <div className="viaticos-summary-card">

                <span>
                  Viáticos locales
                </span>

                <strong>
                  {
                    resumen
                      .totales
                      .local
                      .cantidad
                  }
                </strong>

                <small>
                  {
                    formatearMoneda(
                      resumen
                        .totales
                        .local
                        .monto
                    )
                  }
                </small>

              </div>


              <div className="viaticos-summary-card">

                <span>
                  Viáticos larga distancia
                </span>

                <strong>
                  {
                    resumen
                      .totales
                      .larga_distancia
                      .cantidad
                  }
                </strong>

                <small>
                  {
                    formatearMoneda(
                      resumen
                        .totales
                        .larga_distancia
                        .monto
                    )
                  }
                </small>

              </div>


              <div className="viaticos-summary-card">

                <span>
                  Monto total anual
                </span>

                <strong>
                  {
                    formatearMoneda(
                      resumen
                        .totales
                        .monto_total
                    )
                  }
                </strong>

                <small>
                  {
                    resumen
                      .totales
                      .cantidad_total
                  }{" "}
                  viáticos en total
                </small>

              </div>

            </div>


            {/* ================================= */}
            {/* TABLA MENSUAL */}
            {/* ================================= */}

            <div className="viaticos-card">

              <div className="viaticos-table-wrapper">

                <table className="viaticos-table">

                  <thead>

                    <tr>

                      <th>
                        Mes
                      </th>

                      <th>
                        Cant. local
                      </th>

                      <th>
                        Monto local
                      </th>

                      <th>
                        Cant. larga distancia
                      </th>

                      <th>
                        Monto larga distancia
                      </th>

                      <th>
                        Total mes
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {
                      resumen
                        .meses
                        .map(
                          mes => (

                            <tr
                              key={
                                mes.numero_mes
                              }
                            >

                              <td>
                                <strong>
                                  {
                                    mes.mes
                                  }
                                </strong>
                              </td>


                              <td>
                                {
                                  mes.local
                                    .cantidad
                                }
                              </td>


                              <td>
                                {
                                  formatearMoneda(
                                    mes.local.monto
                                  )
                                }
                              </td>


                              <td>
                                {
                                  mes
                                    .larga_distancia
                                    .cantidad
                                }
                              </td>


                              <td>
                                {
                                  formatearMoneda(
                                    mes
                                      .larga_distancia
                                      .monto
                                  )
                                }
                              </td>


                              <td className="viaticos-money">

                                {
                                  formatearMoneda(
                                    mes.total_mes
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

            </div>


            {/* ================================= */}
            {/* TOTALES DETALLADOS */}
            {/* ================================= */}

            <div className="viaticos-summary-grid">


              <div className="viaticos-summary-card">

                <span>
                  Total local
                </span>

                <strong>
                  {
                    resumen
                      .totales
                      .local
                      .cantidad
                  }
                </strong>

                <small>
                  {
                    formatearMoneda(
                      resumen
                        .totales
                        .local
                        .monto
                    )
                  }
                </small>

              </div>


              <div className="viaticos-summary-card">

                <span>
                  Total larga distancia
                </span>

                <strong>
                  {
                    resumen
                      .totales
                      .larga_distancia
                      .cantidad
                  }
                </strong>

                <small>
                  {
                    formatearMoneda(
                      resumen
                        .totales
                        .larga_distancia
                        .monto
                    )
                  }
                </small>

              </div>


              <div className="viaticos-summary-card">

                <span>
                  Total general
                </span>

                <strong>
                  {
                    resumen
                      .totales
                      .cantidad_total
                  }
                </strong>

                <small>
                  {
                    formatearMoneda(
                      resumen
                        .totales
                        .monto_total
                    )
                  }
                </small>

              </div>

            </div>


          </>

        )
      }

    </div>

  );
}