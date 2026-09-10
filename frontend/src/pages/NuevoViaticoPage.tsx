import { useState } from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  crearViatico,
  obtenerChoferes,
} from "../api/logistica";

import type {
  CrearViaticoPayload,
  TipoRepartoViatico,
} from "../types/logistica";


function obtenerFechaActual(): string {
  const ahora = new Date();

  const year = ahora.getFullYear();

  const month = String(
    ahora.getMonth() + 1
  ).padStart(
    2,
    "0"
  );

  const day = String(
    ahora.getDate()
  ).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}


function formatearMoneda(
  valor: number
): string {
  return valor.toLocaleString(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
    }
  );
}


export default function NuevoViaticoPage() {

  const queryClient =
    useQueryClient();


  // =========================================================
  // ESTADOS
  // =========================================================

  const [
    choferId,
    setChoferId,
  ] = useState("");


  const [
    tipoReparto,
    setTipoReparto,
  ] = useState<TipoRepartoViatico>(
    "LOCAL"
  );


  const [
    fecha,
    setFecha,
  ] = useState(
    obtenerFechaActual()
  );


  const [
    valorViatico,
    setValorViatico,
  ] = useState("");


  const [
    cantidadViaticos,
    setCantidadViaticos,
  ] = useState(
    "1"
  );


  const [
    observaciones,
    setObservaciones,
  ] = useState("");


  // =========================================================
  // CHOFERES
  // =========================================================

  const {
    data: choferes = [],
    isLoading: cargandoChoferes,
  } = useQuery({

    queryKey: [
      "choferes",
    ],

    queryFn:
      obtenerChoferes,

  });


  // =========================================================
  // MONTO AUTOMÁTICO
  // =========================================================

  const valorNumero =
    Number(
      valorViatico
    ) || 0;


  const cantidadNumero =
    Number(
      cantidadViaticos
    ) || 0;


  const montoTotal =
    valorNumero
    *
    cantidadNumero;


  // =========================================================
  // GUARDAR
  // =========================================================

  const guardarMutation =
    useMutation({

      mutationFn:
        crearViatico,


      onSuccess:
        viatico => {

          alert(
            "Viático guardado correctamente.\n\n" +
            `Chofer: ${viatico.chofer_nombre}\n` +
            `Tipo: ${viatico.tipo_reparto_nombre}\n` +
            `Cantidad: ${viatico.cantidad_viaticos}\n` +
            `Monto total: ${formatearMoneda(
              Number(
                viatico.monto_total
              )
            )}`
          );


          setChoferId(
            ""
          );

          setTipoReparto(
            "LOCAL"
          );

          setFecha(
            obtenerFechaActual()
          );

          setValorViatico(
            ""
          );

          setCantidadViaticos(
            "1"
          );

          setObservaciones(
            ""
          );


          queryClient.invalidateQueries({
            queryKey: [
              "viaticos",
            ],
          });


          queryClient.invalidateQueries({
            queryKey: [
              "resumen-viaticos",
            ],
          });

        },


      onError:
        error => {

          alert(
            "No se pudo guardar el viático.\n\n" +
            (
              error instanceof Error
                ? error.message
                : "Error desconocido."
            )
          );

        },

    });


  // =========================================================
  // SUBMIT
  // =========================================================

  function handleSubmit(
    event: React.FormEvent
  ) {

    event.preventDefault();


    if (
      !choferId
    ) {

      alert(
        "Seleccioná un chofer."
      );

      return;
    }


    if (
      !fecha
    ) {

      alert(
        "Seleccioná una fecha."
      );

      return;
    }


    if (
      !valorViatico
    ) {

      alert(
        "Ingresá el valor del viático."
      );

      return;
    }


    if (
      Number(
        valorViatico
      ) < 0
    ) {

      alert(
        "El valor del viático no puede ser negativo."
      );

      return;
    }


    if (
      !cantidadViaticos
      ||
      Number(
        cantidadViaticos
      ) <= 0
    ) {

      alert(
        "La cantidad de viáticos debe ser mayor a cero."
      );

      return;
    }


    const datos:
      CrearViaticoPayload = {

        chofer:
          Number(
            choferId
          ),

        tipo_reparto:
          tipoReparto,

        fecha,

        valor_viatico:
          Number(
            valorViatico
          ),

        cantidad_viaticos:
          Number(
            cantidadViaticos
          ),

        observaciones:
          observaciones.trim(),

      };


    guardarMutation.mutate(
      datos
    );
  }


  // =========================================================
  // CARGANDO
  // =========================================================

  if (
    cargandoChoferes
  ) {

    return (
      <div className="pagina">

        <div className="contenedor">

          <p>
            Cargando datos...
          </p>

        </div>

      </div>
    );
  }


  // =========================================================
  // PÁGINA
  // =========================================================

  return (

    <div className="pagina">

      <div className="contenedor">


        <h1>
          Nuevo viático
        </h1>


        <p className="subtitulo">
          Registro de viáticos locales
          y de larga distancia
        </p>


        <form
          onSubmit={
            handleSubmit
          }
          className="formulario"
        >


          {/* =============================================== */}
          {/* CHOFER */}
          {/* =============================================== */}

          <div className="campo">

            <label>
              Chofer *
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
              required
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


          {/* =============================================== */}
          {/* TIPO DE REPARTO */}
          {/* =============================================== */}

          <div className="campo">

            <label>
              Tipo de reparto *
            </label>


            <select
              value={tipoReparto}
              onChange={(event) => {
                const valor = event.target.value;

                if (
                  valor === "LOCAL" ||
                  valor === "LARGA_DISTANCIA"
                ) {
                  setTipoReparto(valor);
                }
              }}
              required
            >

              <option value="LOCAL">
                Local
              </option>


              <option value="LARGA_DISTANCIA">
                Larga distancia
              </option>

            </select>

          </div>


          {/* =============================================== */}
          {/* FECHA */}
          {/* =============================================== */}

          <div className="campo">

            <label>
              Fecha *
            </label>


            <input
              type="date"
              value={
                fecha
              }
              onChange={
                event =>
                  setFecha(
                    event.target.value
                  )
              }
              required
            />

          </div>


          {/* =============================================== */}
          {/* VALOR VIÁTICO */}
          {/* =============================================== */}

          <div className="campo">

            <label>
              Valor del viático *
            </label>


            <input
              type="number"
              min="0"
              step="0.01"
              value={
                valorViatico
              }
              onChange={
                event =>
                  setValorViatico(
                    event.target.value
                  )
              }
              placeholder="Ej.: 12200"
              required
            />

          </div>


          {/* =============================================== */}
          {/* CANTIDAD */}
          {/* =============================================== */}

          <div className="campo">

            <label>
              Cantidad de viáticos *
            </label>


            <input
              type="number"
              min="1"
              step="1"
              value={
                cantidadViaticos
              }
              onChange={
                event =>
                  setCantidadViaticos(
                    event.target.value
                  )
              }
              required
            />

          </div>


          {/* =============================================== */}
          {/* MONTO TOTAL */}
          {/* =============================================== */}

          <div className="campo">

            <label>
              Monto total
            </label>


            <input
              type="text"
              value={
                formatearMoneda(
                  montoTotal
                )
              }
              readOnly
            />

          </div>


          {/* =============================================== */}
          {/* OBSERVACIONES */}
          {/* =============================================== */}

          <div className="campo">

            <label>
              Observaciones / Ruta
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
              rows={
                4
              }
              placeholder={
                "Destino, ruta u observaciones"
              }
            />

          </div>


          {/* =============================================== */}
          {/* BOTÓN */}
          {/* =============================================== */}

          <button
            type="submit"
            className="boton-guardar"
            disabled={
              guardarMutation.isPending
            }
          >

            {
              guardarMutation.isPending
                ? "Guardando..."
                : "Guardar viático"
            }

          </button>


        </form>

      </div>

    </div>
  );
}