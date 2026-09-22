import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  obtenerControlesDiarios,
} from "../api/logistica";

import "./ControlDiario.css";


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


export default function HistorialControlDiarioPage() {

  const {
    data: controles = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "controles-diarios",
    ],
    queryFn:
      () =>
        obtenerControlesDiarios(),
  });


  const cantidadMovimientos =
    controles.reduce(
      (
        acumulado,
        control
      ) =>
        acumulado
        +
        control.movimientos.length,
      0
    );


  return (

    <div className="control-diario-page">


      <div className="control-diario-header">

        <div>

          <span className="control-diario-eyebrow">
            CONTROL DIARIO DE LOGÍSTICA
          </span>

          <h1>
            Historial
          </h1>

          <p>
            Consultá los controles diarios
            registrados y accedé al detalle
            de cada jornada.
          </p>

        </div>

      </div>


      <div className="control-diario-summary-grid">

        <div className="control-diario-summary-card">

          <span>
            Controles registrados
          </span>

          <strong>
            {
              isLoading
                ? "—"
                : controles.length
            }
          </strong>

        </div>


        <div className="control-diario-summary-card">

          <span>
            Movimientos registrados
          </span>

          <strong>
            {
              isLoading
                ? "—"
                : cantidadMovimientos
            }
          </strong>

        </div>

      </div>


      <div className="control-diario-history-card">

        {
          isLoading
            ? (

              <div className="control-diario-state">
                Cargando historial...
              </div>

            )
            :
            isError
              ? (

                <div className="control-diario-state">
                  No se pudo cargar el historial.
                </div>

              )
              :
              controles.length === 0
                ? (

                  <div className="control-diario-state">
                    No hay controles diarios registrados.
                  </div>

                )
                :
                (

                  <div className="control-diario-history-table-wrapper">

                    <table className="control-diario-history-table">

                      <thead>

                        <tr>

                          <th>
                            Fecha
                          </th>

                          <th>
                            Movimientos
                          </th>

                          <th>
                            Usuario
                          </th>

                          <th>
                            Observaciones
                          </th>

                          <th>
                            Acción
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

                                  <strong className="control-diario-history-date">

                                    {
                                      formatearFecha(
                                        control.fecha
                                      )
                                    }

                                  </strong>

                                </td>


                                <td>

                                  <span className="control-diario-history-badge">

                                    {
                                      control.movimientos.length
                                    }

                                  </span>

                                </td>


                                <td>

                                  {
                                    control.creado_por_nombre
                                    ||
                                    "—"
                                  }

                                </td>


                                <td>

                                  {
                                    control.observaciones
                                    ||
                                    "Sin observaciones"
                                  }

                                </td>


                                <td>

                                  <Link
                                    className="control-diario-detail-link"
                                    to={
                                      `/control-diario/${control.id}`
                                    }
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