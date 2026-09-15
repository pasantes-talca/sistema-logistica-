import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
  obtenerEstadisticasKilometrajes,
} from "../api/logistica";

import "./Kilometrajes.css";


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


export default function EstadisticasKilometrajesPage() {

  const [
    desde,
    setDesde,
  ] = useState("");


  const [
    hasta,
    setHasta,
  ] = useState("");


  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "estadisticas-kilometrajes",
      desde,
      hasta,
    ],

    queryFn: () =>
      obtenerEstadisticasKilometrajes(
        desde || undefined,
        hasta || undefined
      ),
  });


  const datosChoferes = useMemo(
    () =>
      (
        data?.por_chofer
        ??
        []
      ).map(
        item => ({
          nombre:
            item.nombre,

          kilometros:
            Number(
              item.kilometros
            ),
        })
      ),
    [
      data,
    ]
  );


  const datosDestinos = useMemo(
    () =>
      (
        data?.por_destino
        ??
        []
      ).map(
        item => ({
          nombre:
            item.nombre,

          kilometros:
            Number(
              item.kilometros
            ),

          viajes:
            item.viajes,
        })
      ),
    [
      data,
    ]
  );


  return (

    <div className="kilometrajes-page">


      {/* ==================================== */}
      {/* ENCABEZADO */}
      {/* ==================================== */}

      <div className="kilometrajes-header">

        <div>

          <span className="kilometrajes-eyebrow">
            ANÁLISIS DE KILOMETRAJES
          </span>

          <h1>
            Estadísticas de kilometrajes
          </h1>

          <p>
            Analizá kilómetros recorridos,
            choferes y destinos durante
            el período seleccionado.
          </p>

        </div>

      </div>


      {/* ==================================== */}
      {/* FILTROS */}
      {/* ==================================== */}

      <div className="kilometrajes-filter-card">

        <div className="kilometrajes-filter-title">

          <span>
            FILTROS
          </span>

          <strong>
            Período de análisis
          </strong>

        </div>


        <div className="kilometrajes-filter-grid">

          <div className="kilometrajes-filter-field">

            <label>
              Desde
            </label>

            <input
              type="date"
              value={
                desde
              }
              onChange={
                event =>
                  setDesde(
                    event.target.value
                  )
              }
            />

          </div>


          <div className="kilometrajes-filter-field">

            <label>
              Hasta
            </label>

            <input
              type="date"
              value={
                hasta
              }
              onChange={
                event =>
                  setHasta(
                    event.target.value
                  )
              }
            />

          </div>


          <button
            type="button"
            className="kilometrajes-clear-filter"
            onClick={
              () => {

                setDesde("");
                setHasta("");

              }
            }
          >
            Limpiar filtros
          </button>

        </div>

      </div>


      {
        isLoading
        ? (

          <div className="kilometrajes-state">

            <strong>
              Cargando estadísticas...
            </strong>

          </div>

        )
        :
        isError
        ? (

          <div className="kilometrajes-state error">

            <strong>
              No se pudieron cargar las estadísticas
            </strong>

            <span>
              Revisá la conexión con el servidor.
            </span>

          </div>

        )
        :
        data
        ? (

          <>


            {/* ==================================== */}
            {/* KPI */}
            {/* ==================================== */}

            <div className="kilometrajes-summary-grid">

              <div className="kilometrajes-summary-card">

                <span>
                  Kilómetros totales
                </span>

                <strong>
                  {
                    formatearNumero(
                      data.total_km
                    )
                  } km
                </strong>

                <small>
                  Dentro del período
                </small>

              </div>


              <div className="kilometrajes-summary-card">

                <span>
                  Registros
                </span>

                <strong>
                  {
                    data.cantidad_registros
                  }
                </strong>

                <small>
                  Movimientos cargados
                </small>

              </div>


              <div className="kilometrajes-summary-card">

                <span>
                  Chofer con más km
                </span>

                <strong className="kilometrajes-summary-name">

                  {
                    data.mejor_chofer
                      ?
                        data.mejor_chofer.nombre
                      :
                        "—"
                  }

                </strong>

                <small>

                  {
                    data.mejor_chofer
                      ?
                        `${formatearNumero(
                          data.mejor_chofer.kilometros
                        )} km`
                      :
                        "Sin datos"
                  }

                </small>

              </div>


              <div className="kilometrajes-summary-card">

                <span>
                  Destino principal
                </span>

                <strong className="kilometrajes-summary-name">

                  {
                    data.mejor_destino
                      ?
                        data.mejor_destino.nombre
                      :
                        "—"
                  }

                </strong>

                <small>

                  {
                    data.mejor_destino
                      ?
                        `${formatearNumero(
                          data.mejor_destino.kilometros
                        )} km`
                      :
                        "Sin datos"
                  }

                </small>

              </div>

            </div>


            {/* ==================================== */}
            {/* GRÁFICO CHOFERES */}
            {/* ==================================== */}

            <div className="kilometrajes-chart-card">

              <div className="kilometrajes-card-header">

                <div>

                  <span>
                    CHOFERES
                  </span>

                  <h2>
                    Kilómetros por chofer
                  </h2>

                </div>

              </div>


              {
                datosChoferes.length === 0
                ? (

                  <div className="kilometrajes-state">

                    <strong>
                      No hay datos para mostrar
                    </strong>

                  </div>

                )
                : (

                  <div className="kilometrajes-chart">

                    <ResponsiveContainer
                      width="100%"
                      height={330}
                    >

                      <BarChart
                        data={
                          datosChoferes
                        }
                        margin={{
                          top: 20,
                          right: 20,
                          left: 10,
                          bottom: 60,
                        }}
                      >

                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="nombre"
                          angle={-20}
                          textAnchor="end"
                          interval={0}
                          height={80}
                          tick={{
                            fontSize: 11,
                          }}
                        />

                        <YAxis
                          tick={{
                            fontSize: 11,
                          }}
                        />

                        <Tooltip
                          formatter={
                            value => [
                              `${formatearNumero(
                                Number(value)
                              )} km`,
                              "Kilómetros",
                            ]
                          }
                        />

                        <Bar
                          dataKey="kilometros"
                          fill="#2f80ed"
                          radius={[
                            6,
                            6,
                            0,
                            0,
                          ]}
                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                )
              }

            </div>


            {/* ==================================== */}
            {/* GRÁFICO DESTINOS */}
            {/* ==================================== */}

            <div className="kilometrajes-chart-card">

              <div className="kilometrajes-card-header">

                <div>

                  <span>
                    DESTINOS
                  </span>

                  <h2>
                    Kilómetros por destino
                  </h2>

                </div>

              </div>


              {
                datosDestinos.length === 0
                ? (

                  <div className="kilometrajes-state">

                    <strong>
                      No hay datos para mostrar
                    </strong>

                  </div>

                )
                : (

                  <div className="kilometrajes-chart">

                    <ResponsiveContainer
                      width="100%"
                      height={330}
                    >

                      <BarChart
                        data={
                          datosDestinos
                        }
                        margin={{
                          top: 20,
                          right: 20,
                          left: 10,
                          bottom: 70,
                        }}
                      >

                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="nombre"
                          angle={-25}
                          textAnchor="end"
                          interval={0}
                          height={90}
                          tick={{
                            fontSize: 11,
                          }}
                        />

                        <YAxis
                          tick={{
                            fontSize: 11,
                          }}
                        />

                        <Tooltip
                          formatter={
                            (
                              value,
                              name
                            ) => {

                              if (
                                name ===
                                "kilometros"
                              ) {

                                return [
                                  `${formatearNumero(
                                    Number(value)
                                  )} km`,
                                  "Kilómetros",
                                ];
                              }

                              return [
                                value,
                                name,
                              ];
                            }
                          }
                        />

                        <Bar
                          dataKey="kilometros"
                          fill="#2f80ed"
                          radius={[
                            6,
                            6,
                            0,
                            0,
                          ]}
                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </div>

                )
              }

            </div>


            {/* ==================================== */}
            {/* RANKING */}
            {/* ==================================== */}

            <div className="kilometrajes-card">

              <div className="kilometrajes-card-header">

                <div>

                  <span>
                    RANKING
                  </span>

                  <h2>
                    Resumen por destino
                  </h2>

                </div>

              </div>


              {
                data.por_destino.length === 0
                ? (

                  <div className="kilometrajes-state">

                    <strong>
                      No hay destinos registrados
                    </strong>

                  </div>

                )
                : (

                  <div className="kilometrajes-table-wrapper">

                    <table className="kilometrajes-table">

                      <thead>

                        <tr>

                          <th>
                            Posición
                          </th>

                          <th>
                            Destino
                          </th>

                          <th>
                            Viajes
                          </th>

                          <th>
                            Kilómetros
                          </th>

                          <th>
                            Participación
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {
                          data.por_destino.map(
                            (
                              destino,
                              index
                            ) => {

                              const porcentaje =
                                Number(
                                  data.total_km
                                ) > 0
                                  ?
                                    (
                                      Number(
                                        destino.kilometros
                                      )
                                      /
                                      Number(
                                        data.total_km
                                      )
                                    )
                                    *
                                    100
                                  :
                                    0;


                              return (

                                <tr
                                  key={
                                    destino.id
                                  }
                                >

                                  <td>

                                    <span className="kilometrajes-ranking">

                                      {
                                        index + 1
                                      }

                                    </span>

                                  </td>


                                  <td>

                                    <strong>
                                      {
                                        destino.nombre
                                      }
                                    </strong>

                                  </td>


                                  <td>

                                    <span className="kilometrajes-badge">

                                      {
                                        destino.viajes
                                      }

                                      {
                                        destino.viajes === 1
                                          ? " viaje"
                                          : " viajes"
                                      }

                                    </span>

                                  </td>


                                  <td>

                                    <div className="kilometrajes-total">

                                      <strong>

                                        {
                                          formatearNumero(
                                            destino.kilometros
                                          )
                                        }

                                      </strong>

                                      <span>
                                        km
                                      </span>

                                    </div>

                                  </td>


                                  <td>

                                    <div className="kilometrajes-progress-row">

                                      <div className="kilometrajes-progress">

                                        <div
                                          className="kilometrajes-progress-value"
                                          style={{
                                            width:
                                              `${Math.min(
                                                porcentaje,
                                                100
                                              )}%`,
                                          }}
                                        />

                                      </div>

                                      <span>

                                        {
                                          porcentaje.toFixed(
                                            1
                                          )
                                        }%

                                      </span>

                                    </div>

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

          </>

        )
        :
        null
      }

    </div>

  );
}