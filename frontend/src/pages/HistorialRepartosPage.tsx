import { useQuery } from "@tanstack/react-query";

import { Link } from "react-router-dom";

import {
  obtenerRepartos,
} from "../api/logistica";


function formatearFecha(
  fecha: string
) {

  const [
    year,
    month,
    day,
  ] = fecha.split("-");

  return `${day}/${month}/${year}`;
}


export default function HistorialRepartosPage() {

  const {
    data: repartos = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["repartos"],
    queryFn: obtenerRepartos,
  });


  if (isLoading) {

    return (
      <div className="pagina">

        <div className="contenedor-grande">
          <p>
            Cargando repartos...
          </p>
        </div>

      </div>
    );
  }


  if (isError) {

    return (
      <div className="pagina">

        <div className="contenedor-grande">

          <p>
            No se pudo cargar
            el historial.
          </p>

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
              Historial de repartos
            </h1>

            <p className="subtitulo">
              Repartos y recargas
              registradas
            </p>

          </div>


          <div className="contador-registros">
            {repartos.length} registros
          </div>

        </div>


        {
          repartos.length === 0
          ? (

            <div className="estado-vacio">
              Todavía no hay repartos
              cargados.
            </div>

          )
          : (

            <div className="tabla-wrapper">

              <table className="tabla-repartos">

                <thead>

                  <tr>
                    <th>Fecha</th>
                    <th>Patente</th>
                    <th>Asignación</th>
                    <th>Chofer</th>
                    <th>Ayudantes</th>
                    <th>Bultos</th>
                    <th>P. venta</th>
                    <th>Recargas</th>
                    <th>Total recargas</th>
                    <th>Observaciones</th>
                    <th>Acciones</th>
                  </tr>

                </thead>


                <tbody>

                  {
                    repartos.map(
                      reparto => {

                        const chofer =
                          reparto.personal.find(
                            persona =>
                              persona.rol
                              === "CHOFER"
                          );


                        const ayudantes =
                          reparto.personal
                            .filter(
                              persona =>
                                persona.rol
                                === "AYUDANTE"
                            )
                            .map(
                              persona =>
                                persona
                                  .empleado_nombre
                            );


                        return (

                          <tr
                            key={
                              reparto.id
                            }
                          >

                            <td>
                              {
                                formatearFecha(
                                  reparto.fecha
                                )
                              }
                            </td>


                            <td>
                              {
                                reparto.patente
                                || "-"
                              }
                            </td>


                            <td>
                              {
                                reparto
                                  .asignacion_codigo
                                || "-"
                              }
                            </td>


                            <td>
                              {
                                chofer
                                ? chofer
                                    .empleado_nombre
                                : "-"
                              }
                            </td>


                            <td>
                              {
                                ayudantes.length
                                ? ayudantes.join(
                                    ", "
                                  )
                                : "-"
                              }
                            </td>


                            <td>
                              {reparto.bultos}
                            </td>


                            <td>
                              {
                                reparto
                                  .puntos_venta
                                || "-"
                              }
                            </td>


                            <td>
                              {
                                reparto.recargas
                              }
                            </td>


                            <td>
                              {
                                reparto
                                  .recargas_totales
                              }
                            </td>


                            <td>
                              {
                                reparto
                                  .observaciones
                                || "-"
                              }
                            </td>


                            <td>

                              <Link
                                className="boton-editar"
                                to={
                                  `/repartos/${reparto.id}/editar`
                                }
                              >
                                Editar
                              </Link>

                            </td>

                          </tr>

                        );
                      }
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