import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  obtenerControlesKilometraje,
} from "../api/logistica";

import "./Kilometrajes.css";


function formatearFecha(
  fecha: string
): string {

  if (!fecha) {
    return "—";
  }

  const [
    anio,
    mes,
    dia,
  ] = fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}


function formatearKilometros(
  valor: string | number
): string {

  const numero =
    Number(valor);

  return new Intl.NumberFormat(
    "es-AR",
    {
      maximumFractionDigits: 2,
    }
  ).format(numero);
}


export default function HistorialKilometrajesPage() {

  const {
    data: controles = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "controles-kilometraje",
    ],
    queryFn:
      obtenerControlesKilometraje,
  });


  const resumen = useMemo(
    () => {

      const kilometrosTotales =
        controles.reduce(
          (
            acumulado,
            control
          ) =>
            acumulado
            +
            Number(
              control.total_km
            ),
          0
        );


      const movimientosTotales =
        controles.reduce(
          (
            acumulado,
            control
          ) =>
            acumulado
            +
            control.registros.length,
          0
        );


      const choferes =
        new Set(
          controles.map(
            control =>
              control.chofer
          )
        );


      return {
        controles:
          controles.length,

        kilometros:
          kilometrosTotales,

        movimientos:
          movimientosTotales,

        choferes:
          choferes.size,
      };

    },
    [
      controles,
    ]
  );


  return (

    <div className="kilometrajes-page">

      <div className="kilometrajes-header">

        <div>

          <span className="kilometrajes-eyebrow">
            CONTROL DE KILOMETRAJES
          </span>

          <h1>
            Historial de kilometrajes
          </h1>

          <p>
            Consultá los recorridos registrados,
            períodos trabajados y kilómetros
            acumulados por chofer.
          </p>

        </div>

      </div>


      <div className="kilometrajes-summary-grid">

        <div className="kilometrajes-summary-card">

          <span>
            Controles registrados
          </span>

          <strong>
            {
              isLoading
                ? "—"
                : resumen.controles
            }
          </strong>

          <small>
            Períodos cargados
          </small>

        </div>


        <div className="kilometrajes-summary-card">

          <span>
            Kilómetros acumulados
          </span>

          <strong>
            {
              isLoading
                ? "—"
                : `${formatearKilometros(
                    resumen.kilometros
                  )} km`
            }
          </strong>

          <small>
            Total registrado
          </small>

        </div>


        <div className="kilometrajes-summary-card">

          <span>
            Choferes
          </span>

          <strong>
            {
              isLoading
                ? "—"
                : resumen.choferes
            }
          </strong>

          <small>
            Con controles cargados
          </small>

        </div>


        <div className="kilometrajes-summary-card">

          <span>
            Movimientos
          </span>

          <strong>
            {
              isLoading
                ? "—"
                : resumen.movimientos
            }
          </strong>

          <small>
            Viajes registrados
          </small>

        </div>

      </div>


      <div className="kilometrajes-card">

        <div className="kilometrajes-card-header">

          <div>

            <span>
              REGISTROS
            </span>

            <h2>
              Controles cargados
            </h2>

          </div>


          {
            !isLoading
            &&
            !isError
            &&
            (

              <div className="kilometrajes-counter">

                {
                  controles.length
                }

                {
                  controles.length === 1
                    ? " control"
                    : " controles"
                }

              </div>

            )
          }

        </div>


        {
          isLoading
          ? (

            <div className="kilometrajes-state">

              <strong>
                Cargando historial...
              </strong>

              <span>
                Obteniendo controles de kilometraje.
              </span>

            </div>

          )
          :
          isError
          ? (

            <div className="kilometrajes-state error">

              <strong>
                No se pudo cargar el historial
              </strong>

              <span>
                Revisá la conexión con el servidor.
              </span>

            </div>

          )
          :
          controles.length === 0
          ? (

            <div className="kilometrajes-state">

              <strong>
                Todavía no hay controles registrados
              </strong>

              <span>
                Los controles nuevos aparecerán
                automáticamente en esta sección.
              </span>

            </div>

          )
          : (

            <div className="kilometrajes-table-wrapper">

              <table className="kilometrajes-table">

                <thead>

                  <tr>

                    <th>
                      Chofer
                    </th>

                    <th>
                      Período
                    </th>

                    <th>
                      Kilómetros
                    </th>

                    <th>
                      Movimientos
                    </th>

                    <th>
                      Observaciones
                    </th>

                    <th>
                        Detalle
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {
                    controles.map(
                      control => (

                        <tr
                          key={
                            control.id
                          }
                        >

                          <td>

                            <div className="kilometrajes-driver">

                              <div className="kilometrajes-avatar">

                                {
                                  control
                                    .chofer_nombre
                                    ?.charAt(0)
                                    .toUpperCase()
                                }

                              </div>


                              <div>

                                <strong>
                                  {
                                    control.chofer_nombre
                                  }
                                </strong>

                                <span>
                                  Chofer
                                </span>

                              </div>

                            </div>

                          </td>


                          <td>

                            <div className="kilometrajes-periodo">

                              <strong>
                                {
                                  formatearFecha(
                                    control.fecha_desde
                                  )
                                }
                              </strong>

                              <span>
                                hasta
                              </span>

                              <strong>
                                {
                                  formatearFecha(
                                    control.fecha_hasta
                                  )
                                }
                              </strong>

                            </div>

                          </td>


                          <td>

                            <div className="kilometrajes-total">

                              <strong>
                                {
                                  formatearKilometros(
                                    control.total_km
                                  )
                                }
                              </strong>

                              <span>
                                km
                              </span>

                            </div>

                          </td>


                          <td>

                            <span className="kilometrajes-badge">

                              {
                                control.registros.length
                              }

                              {
                                control.registros.length === 1
                                  ? " registro"
                                  : " registros"
                              }

                            </span>

                          </td>


                          <td>

                            <span className="kilometrajes-observacion">

                              {
                                control.observaciones
                                ||
                                "Sin observaciones"
                              }

                            </span>

                          </td>

                            <td>

                            <Link
                                to={`/kilometrajes/${control.id}`}
                                className="kilometrajes-detail-button"
                            >
                                Ver detalle
                            </Link>

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