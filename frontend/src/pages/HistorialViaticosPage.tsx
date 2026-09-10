import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerViaticos,
} from "../api/logistica";

import "./Viaticos.css";


function formatearFecha(
  fecha: string
): string {

  const [
    anio,
    mes,
    dia,
  ] = fecha.split("-");

  return `${dia}/${mes}/${anio}`;
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


export default function HistorialViaticosPage() {

  const {
    data: viaticos = [],
    isLoading,
    isError,
    error,
  } = useQuery({

    queryKey: [
      "viaticos",
    ],

    queryFn:
      obtenerViaticos,

  });


  if (isLoading) {

    return (
      <div className="viaticos-page">

        <div className="viaticos-card">

          <p>
            Cargando viáticos...
          </p>

        </div>

      </div>
    );
  }


  if (isError) {

    return (
      <div className="viaticos-page">

        <div className="viaticos-header">

          <h1>
            Historial de viáticos
          </h1>

          <p>
            Consulta de viáticos registrados
            en el sistema.
          </p>

        </div>


        <div className="viaticos-card">

          <p>
            No se pudo cargar la información.
          </p>

          <p>
            {
              error instanceof Error
                ? error.message
                : "Error desconocido."
            }
          </p>

        </div>

      </div>
    );
  }


  return (

    <div className="viaticos-page">


      {/* ===================================== */}
      {/* ENCABEZADO */}
      {/* ===================================== */}

      <div className="viaticos-header">

        <h1>
          Historial de viáticos
        </h1>

        <p>
          Consulta y seguimiento de los
          viáticos registrados en el sistema.
        </p>

      </div>


      {/* ===================================== */}
      {/* CONTENIDO */}
      {/* ===================================== */}

      <div className="viaticos-card">

        {
          viaticos.length === 0
            ? (

                <div className="viaticos-empty">

                  <p>
                    Todavía no hay viáticos registrados.
                  </p>

                </div>

              )
            : (

                <div className="viaticos-table-wrapper">

                  <table className="viaticos-table">

                    <thead>

                      <tr>

                        <th>
                          Fecha
                        </th>

                        <th>
                          Mes
                        </th>

                        <th>
                          Chofer
                        </th>

                        <th>
                          Tipo de reparto
                        </th>

                        <th>
                          Valor viático
                        </th>

                        <th>
                          Cantidad
                        </th>

                        <th>
                          Monto total
                        </th>

                        <th>
                          Observaciones / Ruta
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {
                        viaticos.map(
                          viatico => (

                            <tr
                              key={
                                viatico.id
                              }
                            >


                              {/* FECHA */}

                              <td>
                                {
                                  formatearFecha(
                                    viatico.fecha
                                  )
                                }
                              </td>


                              {/* MES */}

                              <td>
                                {
                                  viatico.mes
                                }
                              </td>


                              {/* CHOFER */}

                              <td>
                                <strong>
                                  {
                                    viatico.chofer_nombre
                                  }
                                </strong>
                              </td>


                              {/* TIPO */}

                              <td>

                                <span
                                  className={
                                    viatico.tipo_reparto
                                    ===
                                    "LOCAL"
                                      ? (
                                          "viaticos-badge " +
                                          "viaticos-badge-local"
                                        )
                                      : (
                                          "viaticos-badge " +
                                          "viaticos-badge-larga"
                                        )
                                  }
                                >
                                  {
                                    viatico
                                      .tipo_reparto_nombre
                                  }
                                </span>

                              </td>


                              {/* VALOR */}

                              <td>
                                {
                                  formatearMoneda(
                                    viatico.valor_viatico
                                  )
                                }
                              </td>


                              {/* CANTIDAD */}

                              <td>
                                {
                                  viatico
                                    .cantidad_viaticos
                                }
                              </td>


                              {/* MONTO TOTAL */}

                              <td className="viaticos-money">

                                {
                                  formatearMoneda(
                                    viatico.monto_total
                                  )
                                }

                              </td>


                              {/* OBSERVACIONES */}

                              <td>
                                {
                                  viatico.observaciones
                                  ||
                                  "-"
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

      </div>

    </div>

  );
}