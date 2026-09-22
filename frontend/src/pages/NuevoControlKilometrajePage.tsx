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

import "./Kilometrajes.css";


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
    Number.isNaN(inicio.getTime())
    ||
    Number.isNaN(fin.getTime())
    ||
    fin < inicio
  ) {
    return [];
  }

  const fechas: string[] = [];

  const actual = new Date(inicio);

  while (actual <= fin) {

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

      for (const fecha of fechas) {

        for (const destino of destinos) {

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
    destino: DestinoKilometraje
  ) => {

    let cantidadTotal = 0;

    for (const fecha of fechas) {

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
          ...anterior[fecha],

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


    for (const fecha of fechas) {

      for (const destino of destinos) {

        const cantidad =
          viajes[fecha]?.[
            destino.id
          ]
          ??
          0;


        if (cantidad > 0) {

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

    <div className="kilometrajes-page">


      <div className="kilometrajes-header">

        <div>

          <span className="kilometrajes-eyebrow">
            CONTROL DE KILOMETRAJE
          </span>

          <h1>
            Nuevo control
          </h1>

          <p>
            Registrá los viajes realizados
            por chofer y destino durante
            un período determinado.
          </p>

        </div>

      </div>


      <div className="kilometrajes-form-card">

        <div className="kilometrajes-form-grid">

          <div className="kilometrajes-form-field">

            <label>
              Chofer
            </label>

            <select
              value={choferId}
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
                      key={chofer.id}
                      value={chofer.id}
                    >
                      {chofer.nombre}
                    </option>

                  )
                )
              }

            </select>

          </div>


          <div className="kilometrajes-form-field">

            <label>
              Desde
            </label>

            <input
              type="date"
              value={fechaDesde}
              onChange={
                event =>
                  setFechaDesde(
                    event.target.value
                  )
              }
            />

          </div>


          <div className="kilometrajes-form-field">

            <label>
              Hasta
            </label>

            <input
              type="date"
              value={fechaHasta}
              onChange={
                event =>
                  setFechaHasta(
                    event.target.value
                  )
              }
            />

          </div>


          <div className="kilometrajes-form-field kilometrajes-form-observation">

            <label>
              Observaciones
            </label>

            <textarea
              value={observaciones}
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

      </div>


      {
        cargandoDestinos
        ? (

          <div className="kilometrajes-state">

            <strong>
              Cargando destinos...
            </strong>

          </div>

        )
        :
        fechas.length > 0
        ? (

          <div className="kilometrajes-grid-card">


            <div className="kilometrajes-grid-header">

              <div>

                <span>
                  CARGA DE VIAJES
                </span>

                <h2>
                  Kilómetros por destino
                </h2>

              </div>


              <small>
                Ingresá la cantidad de viajes realizados
              </small>

            </div>


            <div className="kilometrajes-grid-wrapper">

              <table className="kilometrajes-grid-table">

                <thead>

                  <tr>

                    <th className="kilometrajes-sticky-column">
                      Fecha
                    </th>

                    {
                      destinos.map(
                        destino => (

                          <th
                            key={destino.id}
                          >

                            <div className="kilometrajes-destino-header">

                              <strong>
                                {destino.nombre}
                              </strong>

                              <span>
                                {
                                  Number(
                                    destino.distancia_km
                                  )
                                } km
                              </span>

                            </div>

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
                          key={fecha}
                        >

                          <td className="kilometrajes-sticky-column kilometrajes-date-cell">

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
                                  key={destino.id}
                                  className="kilometrajes-input-cell"
                                >

                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={
                                      viajes[fecha]?.[
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
                                  />

                                </td>

                              )
                            )
                          }

                        </tr>

                      )
                    )
                  }

                </tbody>


                <tfoot>

                  <tr>

                    <td className="kilometrajes-sticky-column kilometrajes-total-label">
                      Total km
                    </td>


                    {
                      destinos.map(
                        destino => (

                          <td
                            key={destino.id}
                            className="kilometrajes-total-cell"
                          >

                            {
                              obtenerTotalDestino(
                                destino
                              )
                            }

                          </td>

                        )
                      )
                    }

                  </tr>

                </tfoot>

              </table>

            </div>


            <div className="kilometrajes-grid-footer">

              <div>

                <span>
                  Total del período
                </span>

                <strong>
                  {totalKm} km
                </strong>

              </div>


              <button
                type="button"
                className="kilometrajes-save-button"
                onClick={guardar}
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


          </div>

        )
        :
        (

          <div className="kilometrajes-empty-period">

            <strong>
              Seleccioná un período
            </strong>

            <span>
              La grilla de carga aparecerá
              cuando completes las fechas.
            </span>

          </div>

        )
      }

    </div>

  );
}