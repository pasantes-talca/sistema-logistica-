import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  obtenerEstadisticasControlDiario,
} from "../api/logistica";

import "./ControlDiario.css";


function formatearNumero(
  valor: string | number
) {
  return Number(valor).toLocaleString(
    "es-AR",
    {
      maximumFractionDigits: 2,
    }
  );
}


function formatearFecha(
  fecha: string
) {

  const [
    ,
    mes,
    dia,
  ] = fecha.split("-");

  return `${dia}/${mes}`;
}


function formatearTipo(
  tipo: string
) {

  const nombres:
    Record<string, string> = {

      DISPONIBLE: "Disponible",
      RESERVA: "Reserva",
      ASIGNACION: "Asignación",
      STOCK_DEPOSITO: "Stock depósito",
      DISTRIBUCION: "Distribución",
      PENDIENTE: "Pendiente",
      AJUSTE: "Ajuste",
    };

  return nombres[tipo] ?? tipo;
}


export default function EstadisticasControlDiarioPage() {

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
      "estadisticas-control-diario",
      desde,
      hasta,
    ],

    queryFn: () =>
      obtenerEstadisticasControlDiario(
        desde || undefined,
        hasta || undefined
      ),
  });


  const productos =
    data?.por_producto.map(
      item => ({
        nombre:
          item.producto__nombre,

        total:
          Number(item.total),
      })
    )
    ?? [];


  const distribuidores =
    data?.por_distribuidor.map(
      item => ({
        nombre:
          item.ubicacion__nombre,

        total:
          Number(item.total),
      })
    )
    ?? [];


  const evolucion =
    data?.por_fecha.map(
      item => ({
        fecha:
          formatearFecha(
            item.control__fecha
          ),

        total:
          Number(item.total),
      })
    )
    ?? [];


  if (isLoading) {
    return (
      <div className="control-diario-page">

        <div className="control-diario-state">
          Cargando estadísticas...
        </div>

      </div>
    );
  }


  if (isError || !data) {
    return (
      <div className="control-diario-page">

        <div className="control-diario-state">
          No se pudieron cargar las estadísticas.
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
            Estadísticas
          </h1>

          <p>
            Analizá movimientos,
            productos y distribución
            por período.
          </p>

        </div>

      </div>


      {/* FILTROS */}

      <div className="control-diario-stats-filter">

        <div>

          <label>
            Desde
          </label>

          <input
            type="date"
            value={desde}
            onChange={
              e =>
                setDesde(
                  e.target.value
                )
            }
          />

        </div>


        <div>

          <label>
            Hasta
          </label>

          <input
            type="date"
            value={hasta}
            onChange={
              e =>
                setHasta(
                  e.target.value
                )
            }
          />

        </div>


        <button
          type="button"
          onClick={() => {
            setDesde("");
            setHasta("");
          }}
        >
          Limpiar filtros
        </button>

      </div>


      {/* KPIS */}

      <div className="control-diario-stats-kpis">

        <div className="control-diario-stats-kpi">

          <span>
            Movimientos
          </span>

          <strong>
            {data.total_movimientos}
          </strong>

          <small>
            Registros del período
          </small>

        </div>


        <div className="control-diario-stats-kpi">

          <span>
            Cantidad total
          </span>

          <strong>
            {
              formatearNumero(
                data.total_cantidad
              )
            }
          </strong>

          <small>
            Cantidad registrada
          </small>

        </div>


        <div className="control-diario-stats-kpi">

          <span>
            Producto principal
          </span>

          <strong className="control-diario-stats-kpi-text">

            {
              data.producto_principal
                ? data.producto_principal.producto__nombre
                : "—"
            }

          </strong>

          <small>
            {
              data.producto_principal
                ? `${formatearNumero(
                    data.producto_principal.total
                  )} registrados`
                : "Sin datos"
            }
          </small>

        </div>


        <div className="control-diario-stats-kpi">

          <span>
            Distribuidor principal
          </span>

          <strong className="control-diario-stats-kpi-text">

            {
              data.distribuidor_principal
                ? data.distribuidor_principal.ubicacion__nombre
                : "—"
            }

          </strong>

          <small>
            {
              data.distribuidor_principal
                ? `${formatearNumero(
                    data.distribuidor_principal.total
                  )} registrados`
                : "Sin datos"
            }
          </small>

        </div>

      </div>


      {/* GRÁFICOS */}

      <div className="control-diario-stats-grid">


        <div className="control-diario-stats-card">

          <div className="control-diario-stats-card-header">

            <h2>
              Cantidad por producto
            </h2>

            <p>
              Comparación de cantidades registradas.
            </p>

          </div>


          <div className="control-diario-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={productos}
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
                  height={75}
                  tick={{
                    fontSize: 10,
                  }}
                />

                <YAxis
                  tick={{
                    fontSize: 10,
                  }}
                />

                <Tooltip />

                <Bar
                  dataKey="total"
                  fill="#2f80ed"
                  radius={[
                    5,
                    5,
                    0,
                    0,
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>


        <div className="control-diario-stats-card">

          <div className="control-diario-stats-card-header">

            <h2>
              Distribución por distribuidor
            </h2>

            <p>
              Cantidades acumuladas por distribuidor.
            </p>

          </div>


          <div className="control-diario-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={distribuidores}
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
                  height={75}
                  tick={{
                    fontSize: 10,
                  }}
                />

                <YAxis
                  tick={{
                    fontSize: 10,
                  }}
                />

                <Tooltip />

                <Bar
                  dataKey="total"
                  fill="#2f80ed"
                  radius={[
                    5,
                    5,
                    0,
                    0,
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>


        <div className="control-diario-stats-card control-diario-stats-card-wide">

          <div className="control-diario-stats-card-header">

            <h2>
              Evolución diaria
            </h2>

            <p>
              Cantidad registrada por fecha.
            </p>

          </div>


          <div className="control-diario-chart">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <LineChart
                data={evolucion}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="fecha"
                  tick={{
                    fontSize: 10,
                  }}
                />

                <YAxis
                  tick={{
                    fontSize: 10,
                  }}
                />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#2f80ed"
                  strokeWidth={3}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </div>


      </div>


      {/* TABLA */}

      <div className="control-diario-stats-card">

        <div className="control-diario-stats-card-header">

          <h2>
            Totales por tipo de movimiento
          </h2>

          <p>
            Resumen general de movimientos registrados.
          </p>

        </div>


        <div className="control-diario-history-table-wrapper">

          <table className="control-diario-history-table">

            <thead>

              <tr>

                <th>
                  Tipo
                </th>

                <th>
                  Cantidad
                </th>

              </tr>

            </thead>


            <tbody>

              {
                data.por_tipo.map(
                  item => (

                    <tr
                      key={
                        item.tipo_movimiento
                      }
                    >

                      <td>
                        {
                          formatearTipo(
                            item.tipo_movimiento
                          )
                        }
                      </td>

                      <td>

                        <strong>
                          {
                            formatearNumero(
                              item.total
                            )
                          }
                        </strong>

                      </td>

                    </tr>

                  )
                )
              }

            </tbody>

          </table>

        </div>

      </div>


    </div>

  );
}