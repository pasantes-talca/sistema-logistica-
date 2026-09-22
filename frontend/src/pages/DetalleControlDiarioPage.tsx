import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  obtenerControlDiario,
  obtenerResumenControlDiario,
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


export default function DetalleControlDiarioPage() {

  const {
    id,
  } = useParams();


  const controlId =
    Number(id);


  const {
    data: control,
    isLoading:
      cargandoControl,
  } = useQuery({
    queryKey: [
      "control-diario",
      controlId,
    ],
    queryFn:
      () =>
        obtenerControlDiario(
          controlId
        ),
    enabled:
      Number.isFinite(
        controlId
      ),
  });


  const {
    data: resumen,
    isLoading:
      cargandoResumen,
  } = useQuery({
    queryKey: [
      "control-diario-resumen",
      controlId,
    ],
    queryFn:
      () =>
        obtenerResumenControlDiario(
          controlId
        ),
    enabled:
      Number.isFinite(
        controlId
      ),
  });


  if (
    cargandoControl
    ||
    cargandoResumen
  ) {

    return (

      <div className="control-diario-page">

        <div className="control-diario-state">
          Cargando detalle...
        </div>

      </div>

    );
  }


  if (!control) {

    return (

      <div className="control-diario-page">

        <div className="control-diario-state">
          No se encontró el control diario.
        </div>

      </div>

    );
  }


  return (

    <div className="control-diario-page">


      <div className="control-diario-header">

        <div>

          <span className="control-diario-eyebrow">
            CONTROL DIARIO DE LOGÍSTICA
          </span>

          <h1>
            Detalle del día
          </h1>

          <p>
            Consulta completa de movimientos
            y cantidades registradas.
          </p>

        </div>

      </div>


      <div className="control-diario-detail-summary">

        <div>

          <span>
            Fecha
          </span>

          <strong>
            {
              formatearFecha(
                control.fecha
              )
            }
          </strong>

        </div>


        <div>

          <span>
            Movimientos
          </span>

          <strong>
            {
              control.movimientos.length
            }
          </strong>

        </div>


        <div>

          <span>
            Registrado por
          </span>

          <strong>
            {
              control.creado_por_nombre
              ||
              "—"
            }
          </strong>

        </div>

      </div>


      {
        control.observaciones
        && (

          <div className="control-diario-detail-observation">

            <span>
              Observaciones
            </span>

            <p>
              {
                control.observaciones
              }
            </p>

          </div>

        )
      }


      <div className="control-diario-history-card">

        <div className="control-diario-section-header">

          <div>

            <h2>
              Movimientos registrados
            </h2>

            <p>
              Detalle completo por producto,
              ubicación y tipo de movimiento.
            </p>

          </div>

        </div>


        <div className="control-diario-history-table-wrapper">

          <table className="control-diario-history-table">

            <thead>

              <tr>

                <th>
                  Producto
                </th>

                <th>
                  Ubicación
                </th>

                <th>
                  Tipo
                </th>

                <th>
                  Cantidad
                </th>

                <th>
                  Observaciones
                </th>

              </tr>

            </thead>


            <tbody>

              {
                control.movimientos.map(
                  movimiento => (

                    <tr
                      key={
                        movimiento.id
                      }
                    >

                      <td>

                        <strong>
                          {
                            movimiento.producto_nombre
                          }
                        </strong>

                      </td>


                      <td>
                        {
                          movimiento.ubicacion_nombre
                        }
                      </td>


                      <td>

                        <span className="control-diario-history-badge">

                          {
                            movimiento.tipo_movimiento_nombre
                          }

                        </span>

                      </td>


                      <td>

                        <strong className="control-diario-detail-quantity">

                          {
                            Number(
                              movimiento.cantidad
                            ).toLocaleString(
                              "es-AR",
                              {
                                maximumFractionDigits: 2,
                              }
                            )
                          }

                        </strong>

                      </td>


                      <td>
                        {
                          movimiento.observaciones
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

      </div>


      {
        resumen
        &&
        resumen.resumen.length > 0
        && (

          <div className="control-diario-history-card">

            <div className="control-diario-section-header">

              <div>

                <h2>
                  Resumen por producto
                </h2>

                <p>
                  Totales agrupados por
                  tipo de movimiento.
                </p>

              </div>

            </div>


            <div className="control-diario-history-table-wrapper">

              <table className="control-diario-history-table">

                <thead>

                  <tr>

                    <th>
                      Producto
                    </th>

                    <th>
                      Disponible
                    </th>

                    <th>
                      Reserva
                    </th>

                    <th>
                      Asignación
                    </th>

                    <th>
                      Stock depósitos
                    </th>

                    <th>
                      Distribución
                    </th>

                    <th>
                      Pendiente
                    </th>

                    <th>
                      Ajuste
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {
                    resumen.resumen.map(
                      item => (

                        <tr
                          key={
                            item.producto_id
                          }
                        >

                          <td>

                            <strong>
                              {
                                item.producto_nombre
                              }
                            </strong>

                          </td>


                          <td>
                            {
                              item.disponible
                            }
                          </td>


                          <td>
                            {
                              item.reserva
                            }
                          </td>


                          <td>
                            {
                              item.asignacion
                            }
                          </td>


                          <td>
                            {
                              item.stock_deposito
                            }
                          </td>


                          <td>
                            {
                              item.distribucion
                            }
                          </td>


                          <td>
                            {
                              item.pendiente
                            }
                          </td>


                          <td>
                            {
                              item.ajuste
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

        )
      }


    </div>

  );
}