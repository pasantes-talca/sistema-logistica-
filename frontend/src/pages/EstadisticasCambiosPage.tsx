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
  obtenerConcesionarios,
  obtenerEstadisticasCambios,
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
  concesionarioId: number | null;
  consulta: number;
}


export default function EstadisticasCambiosPage() {

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
    concesionarioId,
    setConcesionarioId,
  ] = useState("");

  const [
    filtros,
    setFiltros,
  ] = useState<FiltrosAplicados | null>(
    null
  );


  const {
    data: concesionarios = [],
  } = useQuery({
    queryKey: [
      "concesionarios"
    ],
    queryFn:
      obtenerConcesionarios,
  });


  const {
    data: estadisticas,
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "estadisticas-cambios",
      filtros,
    ],

    queryFn: () =>
      obtenerEstadisticasCambios(
        filtros!.desde,
        filtros!.hasta,
        filtros!.concesionarioId
      ),

    enabled:
      filtros !== null,
  });


  function generar(
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

      concesionarioId:
        concesionarioId
          ? Number(
              concesionarioId
            )
          : null,

      consulta:
        Date.now(),
    });
  }


  const datosGrafico =
    estadisticas?.modo ===
    "concesionario"

      ? estadisticas
          .por_producto
          .map(
            (item) => ({
              nombre:
                `${item.codigo} ${item.producto}`,
              cantidad:
                item.cantidad,
            })
          )

      : estadisticas
          ?.por_producto_concesionario
          .map(
            (item) => ({
              nombre:
                `${item.codigo} - ${item.concesionario}`,
              cantidad:
                item.cantidad,
            })
          )
        || [];


  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="encabezado-pagina">

          <div>

            <h1>
              Estadísticas de cambios
            </h1>

            <p className="subtitulo">
              Análisis de productos cambiados
            </p>

          </div>

        </div>


        <form
          className="filtros-reporte"
          onSubmit={generar}
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
              Concesionario
            </label>

            <select
              value={
                concesionarioId
              }
              onChange={(event) =>
                setConcesionarioId(
                  event.target.value
                )
              }
            >

              <option value="">
                Todos
              </option>


              {concesionarios.map(
                (concesionario) => (

                  <option
                    key={
                      concesionario.id
                    }
                    value={
                      concesionario.id
                    }
                  >
                    {
                      concesionario.nombre
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
                    Recibos
                  </span>

                  <strong>
                    {
                      estadisticas
                        .cantidad_recibos
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Cantidad total
                  </span>

                  <strong>
                    {
                      estadisticas
                        .total_cantidad
                    }
                  </strong>

                </div>

              </div>


              {
                estadisticas.total_cantidad === 0
                ? (

                  <div className="estado-vacio">
                    No hay datos para
                    el período seleccionado.
                  </div>

                )
                : (

                  <>

                    <h2>
                      Cantidades por producto
                    </h2>


                    <div className="grafico-rechazos">

                      <ResponsiveContainer
                        width="100%"
                        height={350}
                      >

                        <BarChart
                          data={
                            datosGrafico
                          }
                          margin={{
                            top: 20,
                            right: 30,
                            left: 10,
                            bottom: 100,
                          }}
                        >

                          <CartesianGrid
                            strokeDasharray="3 3"
                          />

                          <XAxis
                            dataKey="nombre"
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                            height={120}
                          />

                          <YAxis
                            allowDecimals={false}
                          />

                          <Tooltip />

                          <Bar
                            dataKey="cantidad"
                            name="Cantidad"
                          />

                        </BarChart>

                      </ResponsiveContainer>

                    </div>


                    {
                      estadisticas.modo ===
                      "concesionario"
                      ? (

                        <div className="tabla-wrapper">

                          <table className="tabla-repartos">

                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Familia</th>
                                <th>Cantidad</th>
                                <th>Porcentaje</th>
                              </tr>
                            </thead>


                            <tbody>

                              {
                                estadisticas
                                  .por_producto
                                  .map(
                                    (item) => (

                                      <tr
                                        key={
                                          item
                                            .producto_id
                                        }
                                      >

                                        <td>
                                          {
                                            item.codigo
                                          }
                                        </td>

                                        <td>
                                          {
                                            item.producto
                                          }
                                        </td>

                                        <td>
                                          {
                                            item.familia
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
                                              .toFixed(
                                                2
                                              )
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

                      )
                      : (

                        <div className="tabla-wrapper">

                          <table className="tabla-repartos">

                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th>Familia</th>
                                <th>Concesionario</th>
                                <th>Cantidad</th>
                                <th>Porcentaje</th>
                              </tr>
                            </thead>


                            <tbody>

                              {
                                estadisticas
                                  .por_producto_concesionario
                                  .map(
                                    (item) => (

                                      <tr
                                        key={
                                          `${item.producto_id}-${item.concesionario_id}`
                                        }
                                      >

                                        <td>
                                          {
                                            item.codigo
                                          }
                                        </td>

                                        <td>
                                          {
                                            item.producto
                                          }
                                        </td>

                                        <td>
                                          {
                                            item.familia
                                          }
                                        </td>

                                        <td>
                                          {
                                            item
                                              .concesionario
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
                                              .toFixed(
                                                2
                                              )
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

                      )
                    }

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