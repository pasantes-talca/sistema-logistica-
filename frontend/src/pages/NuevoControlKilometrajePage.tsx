import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  crearControlKilometraje,
  obtenerChoferes,
  obtenerDestinosKilometraje,
} from "../api/logistica";

import type {
  CrearControlKilometrajePayload,
  DestinoKilometraje,
  RegistroKilometrajeEntrada,
} from "../types/logistica";


type ViajesPorFecha = Record<
  string,
  Record<number, number>
>;


function generarFechas(
  desde: string,
  hasta: string
): string[] {

  if (!desde || !hasta) {
    return [];
  }

  const inicio = new Date(
    `${desde}T00:00:00`
  );

  const fin = new Date(
    `${hasta}T00:00:00`
  );

  if (
    Number.isNaN(
      inicio.getTime()
    )
    ||
    Number.isNaN(
      fin.getTime()
    )
    ||
    fin < inicio
  ) {
    return [];
  }

  const fechas: string[] = [];

  const actual = new Date(
    inicio
  );

  while (
    actual <= fin
  ) {

    const anio =
      actual.getFullYear();

    const mes =
      String(
        actual.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const dia =
      String(
        actual.getDate()
      ).padStart(
        2,
        "0"
      );

    fechas.push(
      `${anio}-${mes}-${dia}`
    );

    actual.setDate(
      actual.getDate() + 1
    );
  }

  return fechas;
}


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


export default function NuevoControlKilometrajePage() {

  const queryClient =
    useQueryClient();


  const {
    data: choferes = [],
  } = useQuery({
    queryKey: [
      "choferes",
    ],
    queryFn:
      obtenerChoferes,
  });


  const {
    data: destinos = [],
    isLoading:
      cargandoDestinos,
  } = useQuery({
    queryKey: [
      "destinos-kilometraje",
    ],
    queryFn:
      obtenerDestinosKilometraje,
  });


  const [
    choferId,
    setChoferId,
  ] = useState("");


  const [
    fechaDesde,
    setFechaDesde,
  ] = useState("");


  const [
    fechaHasta,
    setFechaHasta,
  ] = useState("");


  const [
    observaciones,
    setObservaciones,
  ] = useState("");


  const [
    viajes,
    setViajes,
  ] = useState<ViajesPorFecha>({});


  const fechas = useMemo(
    () =>
      generarFechas(
        fechaDesde,
        fechaHasta
      ),
    [
      fechaDesde,
      fechaHasta,
    ]
  );


  const totalKm = useMemo(
    () => {

      let total = 0;

      for (
        const fecha of fechas
      ) {

        for (
          const destino of destinos
        ) {

          const cantidad =
            viajes[fecha]?.[
              destino.id
            ]
            ??
            0;

          total +=
            cantidad
            *
            Number(
              destino.distancia_km
            );
        }
      }

      return total;

    },
    [
      fechas,
      destinos,
      viajes,
    ]
  );


  const obtenerTotalDestino = (
    destino:
      DestinoKilometraje
  ) => {

    let cantidadTotal = 0;

    for (
      const fecha of fechas
    ) {

      cantidadTotal +=
        viajes[fecha]?.[
          destino.id
        ]
        ??
        0;
    }

    return (
      cantidadTotal
      *
      Number(
        destino.distancia_km
      )
    );
  };


  const actualizarViaje = (
    fecha: string,
    destinoId: number,
    valor: string
  ) => {

    const numero =
      valor === ""
        ? 0
        : Math.max(
            0,
            Number(valor)
          );

    setViajes(
      anterior => ({
        ...anterior,

        [fecha]: {
          ...anterior[
            fecha
          ],

          [destinoId]:
            numero,
        },
      })
    );
  };


  const mutation =
    useMutation({
      mutationFn:
        crearControlKilometraje,

      onSuccess:
        async () => {

          await queryClient
            .invalidateQueries({
              queryKey: [
                "controles-kilometraje",
              ],
            });

          alert(
            "Control de kilometraje guardado correctamente."
          );

          setChoferId("");
          setFechaDesde("");
          setFechaHasta("");
          setObservaciones("");
          setViajes({});
        },

      onError:
        (error: Error) => {

          alert(
            error.message
          );
        },
    });


  const guardar = () => {

    if (!choferId) {

      alert(
        "Seleccioná un chofer."
      );

      return;
    }


    if (
      !fechaDesde
      ||
      !fechaHasta
    ) {

      alert(
        "Seleccioná el período."
      );

      return;
    }


    if (
      fechaHasta
      <
      fechaDesde
    ) {

      alert(
        "La fecha hasta no puede ser anterior a la fecha desde."
      );

      return;
    }


    const registros:
      RegistroKilometrajeEntrada[]
      = [];


    for (
      const fecha of fechas
    ) {

      for (
        const destino
        of destinos
      ) {

        const cantidad =
          viajes[fecha]?.[
            destino.id
          ]
          ??
          0;


        if (
          cantidad > 0
        ) {

          registros.push({
            fecha:
              fecha,

            destino:
              destino.id,

            cantidad_viajes:
              cantidad,

            observaciones:
              "",
          });
        }
      }
    }


    const payload:
      CrearControlKilometrajePayload
      = {

        chofer:
          Number(
            choferId
          ),

        fecha_desde:
          fechaDesde,

        fecha_hasta:
          fechaHasta,

        observaciones:
          observaciones,

        registros:
          registros,
      };


    mutation.mutate(
      payload
    );
  };


  return (

    <div className="pagina">

      <div className="contenedor">

        <div className="subtitulo">

          <h1>
            Nuevo control de kilometraje
          </h1>

          <p>
            Registrá los viajes realizados
            por chofer y destino durante
            un período determinado.
          </p>

        </div>


        <div className="formulario">

          <div className="campo">

            <label>
              Chofer
            </label>

            <select
              value={
                choferId
              }
              onChange={
                event =>
                  setChoferId(
                    event.target.value
                  )
              }
            >

              <option value="">
                Seleccionar chofer
              </option>

              {
                choferes.map(
                  chofer => (

                    <option
                      key={
                        chofer.id
                      }
                      value={
                        chofer.id
                      }
                    >
                      {
                        chofer.nombre
                      }
                    </option>

                  )
                )
              }

            </select>

          </div>


          <div className="campo">

            <label>
              Desde
            </label>

            <input
              type="date"
              value={
                fechaDesde
              }
              onChange={
                event =>
                  setFechaDesde(
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
              value={
                fechaHasta
              }
              onChange={
                event =>
                  setFechaHasta(
                    event.target.value
                  )
              }
            />

          </div>


          <div className="campo">

            <label>
              Observaciones
            </label>

            <textarea
              value={
                observaciones
              }
              onChange={
                event =>
                  setObservaciones(
                    event.target.value
                  )
              }
              placeholder="Observaciones generales del período"
            />

          </div>

        </div>


        {
          cargandoDestinos
          ? (

            <p>
              Cargando destinos...
            </p>

          )
          :
          fechas.length > 0
          ? (

            <div
              style={{
                marginTop:
                  "28px",
                overflowX:
                  "auto",
              }}
            >

              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "1100px",
                }}
              >

                <thead>

                  <tr>

                    <th>
                      Fecha
                    </th>

                    {
                      destinos.map(
                        destino => (

                          <th
                            key={
                              destino.id
                            }
                          >
                            {
                              destino.nombre
                            }
                          </th>

                        )
                      )
                    }

                  </tr>


                  <tr>

                    <th>
                      Distancia
                    </th>

                    {
                      destinos.map(
                        destino => (

                          <th
                            key={
                              destino.id
                            }
                          >
                            {
                              Number(
                                destino.distancia_km
                              )
                            } km
                          </th>

                        )
                      )
                    }

                  </tr>

                </thead>


                <tbody>

                  {
                    fechas.map(
                      fecha => (

                        <tr
                          key={
                            fecha
                          }
                        >

                          <td>
                            {
                              formatearFecha(
                                fecha
                              )
                            }
                          </td>

                          {
                            destinos.map(
                              destino => (

                                <td
                                  key={
                                    destino.id
                                  }
                                >

                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={
                                      viajes[
                                        fecha
                                      ]?.[
                                        destino.id
                                      ]
                                      ??
                                      ""
                                    }
                                    onChange={
                                      event =>
                                        actualizarViaje(
                                          fecha,
                                          destino.id,
                                          event.target.value
                                        )
                                    }
                                    style={{
                                      width:
                                        "70px",
                                    }}
                                  />

                                </td>

                              )
                            )
                          }

                        </tr>

                      )
                    )
                  }


                  <tr>

                    <td>
                      <strong>
                        Total km
                      </strong>
                    </td>

                    {
                      destinos.map(
                        destino => (

                          <td
                            key={
                              destino.id
                            }
                          >

                            <strong>
                              {
                                obtenerTotalDestino(
                                  destino
                                )
                              }
                            </strong>

                          </td>

                        )
                      )
                    }

                  </tr>

                </tbody>

              </table>

            </div>

          )
          :
          (

            <p
              style={{
                marginTop:
                  "24px",
              }}
            >
              Seleccioná un período para
              cargar los viajes.
            </p>

          )
        }


        {
          fechas.length > 0
          &&
          (

            <div
              style={{
                marginTop:
                  "24px",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap:
                  "20px",
              }}
            >

              <div>

                <span>
                  Total del período
                </span>

                <h2>
                  {
                    totalKm
                  } km
                </h2>

              </div>


              <button
                className="boton-guardar"
                type="button"
                onClick={
                  guardar
                }
                disabled={
                  mutation.isPending
                }
              >

                {
                  mutation.isPending
                    ?
                      "Guardando..."
                    :
                      "Guardar control"
                }

              </button>

            </div>

          )
        }

      </div>

    </div>

  );
}