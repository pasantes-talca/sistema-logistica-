import { useState } from "react";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  obtenerAsignaciones,
  obtenerEstadisticasRechazos,
} from "../api/logistica";


function fechaLocal(
  fecha: Date
) {

  const year =
    fecha.getFullYear();

  const month =
    String(
      fecha.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      fecha.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}


function primerDiaMes() {

  const hoy =
    new Date();

  return fechaLocal(
    new Date(
      hoy.getFullYear(),
      hoy.getMonth(),
      1
    )
  );
}


function hoy() {

  return fechaLocal(
    new Date()
  );
}


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


interface FiltrosAplicados {
  desde: string;
  hasta: string;
  asignacionId: number | null;
  consulta: number;
}


export default function EstadisticasRechazosPage() {

  const [
    desde,
    setDesde,
  ] = useState(
    primerDiaMes()
  );

  const [
    hasta,
    setHasta,
  ] = useState(
    hoy()
  );

  const [
    asignacionId,
    setAsignacionId,
  ] = useState("");

  const [
    filtros,
    setFiltros,
  ] = useState<FiltrosAplicados | null>(
    null
  );


  const {
    data: asignaciones = [],
  } = useQuery({
    queryKey: [
      "asignaciones"
    ],
    queryFn:
      obtenerAsignaciones,
  });


  const {
    data: estadisticas,
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "estadisticas-rechazos",
      filtros,
    ],

    queryFn: () =>
      obtenerEstadisticasRechazos(
        filtros!.desde,
        filtros!.hasta,
        filtros!.asignacionId
      ),

    enabled:
      filtros !== null,
  });


  function generarEstadisticas(
    event: React.FormEvent
  ) {

    event.preventDefault();


    if (!desde || !hasta) {

      alert(
        "Seleccioná ambas fechas."
      );

      return;
    }


    if (desde > hasta) {

      alert(
        "La fecha desde no puede ser posterior a la fecha hasta."
      );

      return;
    }


    setFiltros({

      desde,

      hasta,

      asignacionId:
        asignacionId
          ? Number(
              asignacionId
            )
          : null,

      consulta:
        Date.now(),
    });
  }


  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="encabezado-pagina">

          <div>

            <h1>
              Estadísticas de rechazos
            </h1>

            <p className="subtitulo">
              Análisis de entregas no realizadas
            </p>

          </div>

        </div>


        <form
          className="filtros-reporte"
          onSubmit={
            generarEstadisticas
          }
        >

          <div className="campo">

            <label>
              Desde
            </label>

            <input
              type="date"
              value={desde}
              onChange={(event) =>
                setDesde(
                  event.target.value
                )
              }
            />

          </div>


          <div className="campo">

            <label>
              Hasta
            </label>

            <input
              type="date"
              value={hasta}
              onChange={(event) =>
                setHasta(
                  event.target.value
                )
              }
            />

          </div>


          <div className="campo">

            <label>
              Asignación
            </label>

            <select
              value={
                asignacionId
              }
              onChange={(event) =>
                setAsignacionId(
                  event.target.value
                )
              }
            >

              <option value="">
                Todas
              </option>


              {asignaciones.map(
                (asignacion) => (

                  <option
                    key={
                      asignacion.id
                    }
                    value={
                      asignacion.id
                    }
                  >
                    {
                      asignacion.codigo
                    }
                  </option>

                )
              )}

            </select>

          </div>


          <button
            type="submit"
            className="boton-guardar boton-generar"
          >
            Generar estadísticas
          </button>

        </form>


        {isLoading && (

          <div className="estado-vacio">
            Generando estadísticas...
          </div>

        )}


        {isError && (

          <div className="estado-vacio">
            No se pudieron generar
            las estadísticas.
          </div>

        )}


        {
          estadisticas &&
          !isLoading &&
          !isError && (

            <>

              <div className="resumen-reporte">

                <div>

                  <span>
                    Período
                  </span>

                  <strong>
                    {
                      formatearFecha(
                        estadisticas.desde
                      )
                    }

                    {" → "}

                    {
                      formatearFecha(
                        estadisticas.hasta
                      )
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Total de rechazos
                  </span>

                  <strong>
                    {
                      estadisticas
                        .total_rechazos
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Motivos diferentes
                  </span>

                  <strong>
                    {
                      estadisticas
                        .por_motivo
                        .length
                    }
                  </strong>

                </div>

              </div>


              {
                estadisticas
                  .total_rechazos === 0
                ? (

                  <div className="estado-vacio">

                    No hay rechazos
                    registrados para
                    el período seleccionado.

                  </div>

                )
                : (

                  <>

                    <h2>
                      Rechazos por motivo
                    </h2>


                    <div className="grafico-rechazos">

                      <ResponsiveContainer
                        width="100%"
                        height={350}
                      >

                        <BarChart
                          data={
                            estadisticas
                              .por_motivo
                          }
                          margin={{
                            top: 20,
                            right: 30,
                            left: 10,
                            bottom: 80,
                          }}
                        >

                          <CartesianGrid
                            strokeDasharray="3 3"
                          />

                          <XAxis
                            dataKey="motivo"
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                            height={100}
                          />

                          <YAxis
                            allowDecimals={
                              false
                            }
                          />

                          <Tooltip />

                          <Bar
                            dataKey="cantidad"
                            name="Cantidad"
                          />

                        </BarChart>

                      </ResponsiveContainer>

                    </div>


                    <div className="tabla-wrapper">

                      <table className="tabla-repartos">

                        <thead>

                          <tr>
                            <th>
                              Motivo
                            </th>

                            <th>
                              Cantidad
                            </th>

                            <th>
                              Porcentaje
                            </th>
                          </tr>

                        </thead>


                        <tbody>

                          {
                            estadisticas
                              .por_motivo
                              .map(
                                (item) => (

                                  <tr
                                    key={
                                      item.motivo_id
                                    }
                                  >

                                    <td>
                                      {
                                        item.motivo
                                      }
                                    </td>

                                    <td>
                                      {
                                        item.cantidad
                                      }
                                    </td>

                                    <td>
                                      {
                                        item
                                          .porcentaje
                                          .toFixed(2)
                                      }
                                      %
                                    </td>

                                  </tr>

                                )
                              )
                          }

                        </tbody>

                      </table>

                    </div>


                    <h2 className="titulo-seccion-estadisticas">
                      Rechazos por asignación
                    </h2>


                    <div className="tabla-wrapper">

                      <table className="tabla-repartos">

                        <thead>

                          <tr>

                            <th>
                              Asignación
                            </th>

                            <th>
                              Cantidad
                            </th>

                          </tr>

                        </thead>


                        <tbody>

                          {
                            estadisticas
                              .por_asignacion
                              .map(
                                (item) => (

                                  <tr
                                    key={
                                      item.asignacion_id
                                      ?? item.asignacion
                                    }
                                  >

                                    <td>
                                      {
                                        item.asignacion
                                      }
                                    </td>

                                    <td>
                                      {
                                        item.cantidad
                                      }
                                    </td>

                                  </tr>

                                )
                              )
                          }

                        </tbody>

                      </table>

                    </div>

                  </>

                )
              }

            </>

          )
        }

      </div>

    </div>
  );
}