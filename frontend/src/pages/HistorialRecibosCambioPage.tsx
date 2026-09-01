import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  obtenerRecibosCambio,
} from "../api/logistica";


function formatearFecha(fecha: string) {
  const [
    year,
    month,
    day,
  ] = fecha.split("-");

  return `${day}/${month}/${year}`;
}


export default function HistorialRecibosCambioPage() {

  const {
    data: recibos = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["recibos-cambio"],
    queryFn: obtenerRecibosCambio,
  });


  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="encabezado-pagina">

          <div>

            <h1>
              Historial de recibos de cambios
            </h1>

            <p className="subtitulo">
              Recibos registrados por fecha y concesionario
            </p>

          </div>


          <div className="contador-registros">
            {recibos.length} registros
          </div>

        </div>


        {isLoading && (

          <div className="estado-vacio">
            Cargando recibos...
          </div>

        )}


        {isError && (

          <div className="estado-vacio">
            No se pudo cargar el historial.
          </div>

        )}


        {!isLoading &&
          !isError &&
          recibos.length === 0 && (

            <div className="estado-vacio">
              Todavía no hay recibos registrados.
            </div>

          )}


        {!isLoading &&
          !isError &&
          recibos.length > 0 && (

            <div className="tabla-wrapper">

              <table className="tabla-repartos">

                <thead>

                  <tr>
                    <th>Fecha</th>
                    <th>Concesionario</th>
                    <th>Productos</th>
                    <th>Pallets</th>
                    <th>Pallets descargados</th>
                    <th>Prensados</th>
                    <th>Acciones</th>
                  </tr>

                </thead>


                <tbody>

                  {recibos.map(
                    (recibo) => (

                      <tr key={recibo.id}>

                        <td>
                          {formatearFecha(
                            recibo.fecha
                          )}
                        </td>


                        <td>
                          {
                            recibo
                              .concesionario_nombre
                          }
                        </td>


                        <td>
                          {
                            recibo
                              .detalles
                              .length
                          }
                        </td>


                        <td>
                          {
                            Number(
                              recibo.pallets
                            )
                          }
                        </td>


                        <td>
                          {
                            Number(
                              recibo
                                .pallets_descargados
                            )
                          }
                        </td>


                        <td>
                          {
                            Number(
                              recibo.prensados
                            )
                          }
                        </td>


                        <td>

                          <Link
                            className="boton-editar"
                            to={
                              `/cambios/recibos/${recibo.id}`
                            }
                          >
                            Ver detalle
                          </Link>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

      </div>

    </div>
  );
}