import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  obtenerRechazos,
} from "../api/logistica";


function formatearFecha(fecha: string) {
  const [year, month, day] =
    fecha.split("-");

  return `${day}/${month}/${year}`;
}


export default function HistorialRechazosPage() {

  const {
    data: rechazos = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["rechazos"],
    queryFn: obtenerRechazos,
  });


  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="encabezado-pagina">

          <div>

            <h1>
              Historial de rechazos
            </h1>

            <p className="subtitulo">
              Entregas no realizadas registradas
            </p>

          </div>


          <div className="contador-registros">
            {rechazos.length} registros
          </div>

        </div>


        {isLoading && (

          <div className="estado-vacio">
            Cargando rechazos...
          </div>

        )}


        {isError && (

          <div className="estado-vacio">
            No se pudo cargar el historial.
          </div>

        )}


        {
          !isLoading &&
          !isError &&
          rechazos.length === 0 && (

            <div className="estado-vacio">
              Todavía no hay rechazos registrados.
            </div>

          )
        }


        {
          !isLoading &&
          !isError &&
          rechazos.length > 0 && (

            <div className="tabla-wrapper">

              <table className="tabla-repartos">

                <thead>

                  <tr>
                    <th>Fecha</th>
                    <th>Asignación</th>
                    <th>Punto de venta</th>
                    <th>Bultos</th>
                    <th>Motivo</th>
                    <th>Observación</th>
                    <th>Acciones</th>
                  </tr>

                </thead>


                <tbody>

                  {rechazos.map(
                    (rechazo) => (

                      <tr key={rechazo.id}>

                        <td>
                          {formatearFecha(
                            rechazo.fecha
                          )}
                        </td>


                        <td>
                          {
                            rechazo.asignacion_codigo
                            || "-"
                          }
                        </td>


                        <td>
                          {rechazo.punto_venta}
                        </td>


                        <td>
                          {rechazo.bultos}
                        </td>


                        <td>
                          {rechazo.motivo_nombre}
                        </td>


                        <td>
                          {
                            rechazo.observacion
                            || "-"
                          }
                        </td>


                        <td>

                          <Link
                            className="boton-editar"
                            to={`/rechazos/${rechazo.id}/editar`}
                          >
                            Editar
                          </Link>

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