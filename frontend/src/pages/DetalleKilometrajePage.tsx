import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  obtenerControlKilometraje,
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


function formatearNumero(
  valor: string | number
): string {

  return new Intl.NumberFormat(
    "es-AR",
    {
      maximumFractionDigits: 2,
    }
  ).format(
    Number(valor)
  );
}


export default function DetalleKilometrajePage() {

  const {
    id,
  } = useParams();


  const controlId =
    Number(id);


  const {
    data: control,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "control-kilometraje",
      controlId,
    ],

    queryFn: () =>
      obtenerControlKilometraje(
        controlId
      ),

    enabled:
      Number.isFinite(
        controlId
      ),
  });


  if (isLoading) {

    return (

      <div className="kilometrajes-page">

        <div className="kilometrajes-state">

          <strong>
            Cargando detalle...
          </strong>

        </div>

      </div>

    );
  }


  if (
    isError
    ||
    !control
  ) {

    return (

      <div className="kilometrajes-page">

        <div className="kilometrajes-state error">

          <strong>
            No se pudo cargar el control
          </strong>

          <span>
            Revisá la conexión con el servidor.
          </span>

        </div>

      </div>

    );
  }


  return (

    <div className="kilometrajes-page">


      <div className="kilometrajes-detail-top">

        <div>

          <span className="kilometrajes-eyebrow">
            CONTROL DE KILOMETRAJE
          </span>

          <h1>
            {control.chofer_nombre}
          </h1>

          <p>
            Detalle completo de los viajes
            registrados durante el período.
          </p>

        </div>


        <Link
          to="/kilometrajes"
          className="kilometrajes-back"
        >
          ← Volver al historial
        </Link>

      </div>


      <div className="kilometrajes-summary-grid">

        <div className="kilometrajes-summary-card">

          <span>
            Desde
          </span>

          <strong>
            {
              formatearFecha(
                control.fecha_desde
              )
            }
          </strong>

          <small>
            Inicio del período
          </small>

        </div>


        <div className="kilometrajes-summary-card">

          <span>
            Hasta
          </span>

          <strong>
            {
              formatearFecha(
                control.fecha_hasta
              )
            }
          </strong>

          <small>
            Fin del período
          </small>

        </div>


        <div className="kilometrajes-summary-card">

          <span>
            Kilómetros totales
          </span>

          <strong>
            {
              formatearNumero(
                control.total_km
              )
            } km
          </strong>

          <small>
            Total del control
          </small>

        </div>


        <div className="kilometrajes-summary-card">

          <span>
            Registros
          </span>

          <strong>
            {
              control.registros.length
            }
          </strong>

          <small>
            Movimientos cargados
          </small>

        </div>

      </div>


      {
        control.observaciones
        &&
        (

          <div className="kilometrajes-detail-observation">

            <span>
              OBSERVACIONES
            </span>

            <p>
              {
                control.observaciones
              }
            </p>

          </div>

        )
      }


      <div className="kilometrajes-card">

        <div className="kilometrajes-card-header">

          <div>

            <span>
              DETALLE
            </span>

            <h2>
              Viajes registrados
            </h2>

          </div>


          <div className="kilometrajes-counter">

            {
              control.registros.length
            }

            {
              control.registros.length === 1
                ? " registro"
                : " registros"
            }

          </div>

        </div>


        {
          control.registros.length === 0
          ? (

            <div className="kilometrajes-state">

              <strong>
                No hay viajes registrados
              </strong>

            </div>

          )
          : (

            <div className="kilometrajes-table-wrapper">

              <table className="kilometrajes-table">

                <thead>

                  <tr>

                    <th>
                      Fecha
                    </th>

                    <th>
                      Destino
                    </th>

                    <th>
                      Viajes
                    </th>

                    <th>
                      Distancia
                    </th>

                    <th>
                      Kilómetros
                    </th>

                    <th>
                      Observaciones
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {
                    control.registros.map(
                      registro => (

                        <tr
                          key={
                            registro.id
                          }
                        >

                          <td>

                            <strong>
                              {
                                formatearFecha(
                                  registro.fecha
                                )
                              }
                            </strong>

                          </td>


                          <td>

                            <span className="kilometrajes-destination">

                              {
                                registro.destino_nombre
                              }

                            </span>

                          </td>


                          <td>

                            <span className="kilometrajes-badge">

                              {
                                registro.cantidad_viajes
                              }

                              {
                                registro.cantidad_viajes === 1
                                  ? " viaje"
                                  : " viajes"
                              }

                            </span>

                          </td>


                          <td>

                            {
                              formatearNumero(
                                registro.distancia_km
                              )
                            } km

                          </td>


                          <td>

                            <div className="kilometrajes-total">

                              <strong>
                                {
                                  formatearNumero(
                                    registro.kilometros
                                  )
                                }
                              </strong>

                              <span>
                                km
                              </span>

                            </div>

                          </td>


                          <td>

                            <span className="kilometrajes-observacion">

                              {
                                registro.observaciones
                                ||
                                "—"
                              }

                            </span>

                          </td>

                        </tr>

                      )
                    )
                  }

                </tbody>


                <tfoot>

                  <tr>

                    <td
                      colSpan={4}
                      className="kilometrajes-detail-total-label"
                    >
                      TOTAL DEL PERÍODO
                    </td>

                    <td
                      colSpan={2}
                      className="kilometrajes-detail-total-value"
                    >

                      {
                        formatearNumero(
                          control.total_km
                        )
                      } km

                    </td>

                  </tr>

                </tfoot>

              </table>

            </div>

          )
        }

      </div>

    </div>

  );
}