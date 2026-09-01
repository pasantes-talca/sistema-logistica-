import { useQuery } from "@tanstack/react-query";

import {
  Link,
  useParams,
} from "react-router-dom";

import {
  obtenerReciboCambio,
} from "../api/logistica";


function formatearFecha(fecha: string) {

  const [
    year,
    month,
    day,
  ] = fecha.split("-");

  return `${day}/${month}/${year}`;
}


export default function DetalleReciboCambioPage() {

  const { id } = useParams();

  const reciboId = Number(id);


  const {
    data: recibo,
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "recibo-cambio",
      reciboId,
    ],

    queryFn: () =>
      obtenerReciboCambio(
        reciboId
      ),

    enabled:
      Number.isFinite(
        reciboId
      ),
  });


  if (isLoading) {

    return (
      <div className="pagina">

        <div className="contenedor-grande">
          Cargando recibo...
        </div>

      </div>
    );
  }


  if (isError || !recibo) {

    return (
      <div className="pagina">

        <div className="contenedor-grande">
          No se pudo cargar el recibo.
        </div>

      </div>
    );
  }


  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="encabezado-pagina">

          <div>

            <h1>
              Recibo de cambios
            </h1>

            <p className="subtitulo">
              {
                formatearFecha(
                  recibo.fecha
                )
              }
              {" · "}
              {
                recibo
                  .concesionario_nombre
              }
            </p>

          </div>


          <div className="acciones-detalle">

            <Link
              className="boton-editar"
              to={
                `/cambios/recibos/${recibo.id}/editar`
              }
            >
              Editar recibo
            </Link>


            <Link
              className="boton-editar"
              to="/cambios"
            >
              Volver al historial
            </Link>

          </div>

        </div>


        <div className="resumen-reporte">

          <div>

            <span>
              Pallets
            </span>

            <strong>
              {
                Number(
                  recibo.pallets
                )
              }
            </strong>

            {
              recibo
                .pallets_observacion && (

                <small>
                  {
                    recibo
                      .pallets_observacion
                  }
                </small>

              )
            }

          </div>


          <div>

            <span>
              Pallets descargados
            </span>

            <strong>
              {
                Number(
                  recibo
                    .pallets_descargados
                )
              }
            </strong>

            {
              recibo
                .pallets_descargados_observacion && (

                <small>
                  {
                    recibo
                      .pallets_descargados_observacion
                  }
                </small>

              )
            }

          </div>


          <div>

            <span>
              Prensados
            </span>

            <strong>
              {
                Number(
                  recibo.prensados
                )
              }
            </strong>

            {
              recibo
                .prensados_observacion && (

                <small>
                  {
                    recibo
                      .prensados_observacion
                  }
                </small>

              )
            }

          </div>

        </div>


        <h2>
          Productos
        </h2>


        {
          recibo.detalles.length === 0
          ? (

            <div className="estado-vacio">
              Este recibo no tiene productos cargados.
            </div>

          )
          : (

            <div className="tabla-wrapper">

              <table className="tabla-repartos">

                <thead>

                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Familia</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                    <th>Observación</th>
                  </tr>

                </thead>


                <tbody>

                  {recibo.detalles.map(
                    (detalle) => (

                      <tr key={detalle.id}>

                        <td>
                          {
                            detalle
                              .producto_codigo
                          }
                        </td>


                        <td>
                          {
                            detalle
                              .producto_nombre
                          }
                        </td>


                        <td>
                          {
                            detalle
                              .producto_familia
                          }
                        </td>


                        <td>
                          {
                            Number(
                              detalle.cantidad
                            )
                          }
                        </td>


                        <td>
                          {
                            detalle
                              .motivo_nombre
                            || "Sin clasificar"
                          }
                        </td>


                        <td>
                          {
                            detalle
                              .observacion
                            || "-"
                          }
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )
        }

      </div>

    </div>
  );
}