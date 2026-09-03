import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  FormEvent,
  KeyboardEvent,
} from "react";

import {
  useMutation,
} from "@tanstack/react-query";

import {
  preguntarAsistente,
} from "../api/logistica";

import type {
  RespuestaAsistente,
} from "../types/logistica";


interface Mensaje {
  id: number;

  tipo:
    | "usuario"
    | "asistente";

  texto: string;

  datos?:
    RespuestaAsistente;
}


const preguntasSugeridas = [
  "¿Cuántos repartos hubo este mes?",
  "¿Quién tuvo más recargas este mes?",
  "¿Cuál fue el motivo de rechazo más frecuente este mes?",
  "¿Qué asignación tuvo más rechazos este mes?",
  "¿Qué concesionario tuvo más cambios este mes?",
  "¿Qué producto tuvo más cambios este mes?",
  "Dame un resumen general de Logística de este mes",
];


function formatearFecha(
  fecha: string | null | undefined
) {

  if (!fecha) {
    return "";
  }

  const partes =
    fecha.split("-");

  if (partes.length !== 3) {
    return fecha;
  }

  const [
    year,
    month,
    day,
  ] = partes;

  return `${day}/${month}/${year}`;
}


function nombreModulo(
  tipo: string | undefined
) {

  switch (tipo) {

    case "repartos":
      return "Repartos";

    case "recargas":
      return "Recargas";

    case "rechazos":
      return "Rechazos";

    case "cambios":
      return "Recibos de cambios";

    case "general":
      return "Resumen general";

    default:
      return null;
  }
}


export default function AsistenteIAPage() {

  const [
    pregunta,
    setPregunta,
  ] = useState("");


  const [
    mensajes,
    setMensajes,
  ] = useState<Mensaje[]>([
    {
      id: 1,

      tipo:
        "asistente",

      texto:
        "Hola. Soy el asistente de Logística Talca. Puedo consultar la información registrada en Repartos y Recargas, Rechazos y Recibos de Cambios. Podés preguntarme usando lenguaje natural.",
    },
  ]);


  const finalChatRef =
    useRef<HTMLDivElement | null>(
      null
    );


  useEffect(
    () => {

      finalChatRef.current
        ?.scrollIntoView({
          behavior: "smooth",
        });

    },
    [
      mensajes,
    ]
  );


  const mutation =
    useMutation({

      mutationFn:
        preguntarAsistente,


      onSuccess: (
        resultado
      ) => {

        setMensajes(
          (anteriores) => [
            ...anteriores,

            {
              id:
                Date.now(),

              tipo:
                "asistente",

              texto:
                resultado.respuesta,

              datos:
                resultado,
            },
          ]
        );
      },


      onError: (
        error: Error
      ) => {

        setMensajes(
          (anteriores) => [
            ...anteriores,

            {
              id:
                Date.now(),

              tipo:
                "asistente",

              texto:
                error.message,
            },
          ]
        );
      },

    });


  function enviarPregunta(
    texto: string
  ) {

    const consulta =
      texto.trim();


    if (
      !consulta
      ||
      mutation.isPending
    ) {
      return;
    }


    setMensajes(
      (anteriores) => [
        ...anteriores,

        {
          id:
            Date.now(),

          tipo:
            "usuario",

          texto:
            consulta,
        },
      ]
    );


    setPregunta("");


    mutation.mutate(
      consulta
    );
  }


  function enviarFormulario(
    event: FormEvent
  ) {

    event.preventDefault();

    enviarPregunta(
      pregunta
    );
  }


  function manejarTeclado(
    event:
      KeyboardEvent<HTMLTextAreaElement>
  ) {

    if (
      event.key === "Enter"
      &&
      !event.shiftKey
    ) {

      event.preventDefault();

      enviarPregunta(
        pregunta
      );
    }
  }


  return (

    <div className="pagina">

      <div className="contenedor-grande">

        {/* ========================================= */}
        {/* ENCABEZADO */}
        {/* ========================================= */}

        <div className="encabezado-pagina">

          <div>

            <h1>
              Asistente IA
            </h1>

            <p className="subtitulo">
              Consultá la información
              operativa de Logística
              utilizando lenguaje natural.
            </p>

          </div>

        </div>


        {/* ========================================= */}
        {/* PREGUNTAS SUGERIDAS */}
        {/* ========================================= */}

        <div className="asistente-sugerencias">

          <span>
            Algunas consultas que podés hacer:
          </span>


          <div className="asistente-sugerencias-lista">

            {
              preguntasSugeridas.map(
                (
                  sugerencia
                ) => (

                  <button
                    key={
                      sugerencia
                    }
                    type="button"
                    onClick={() =>
                      enviarPregunta(
                        sugerencia
                      )
                    }
                    disabled={
                      mutation.isPending
                    }
                  >

                    {
                      sugerencia
                    }

                  </button>

                )
              )
            }

          </div>

        </div>


        {/* ========================================= */}
        {/* CHAT */}
        {/* ========================================= */}

        <div className="asistente-chat">

          {
            mensajes.map(
              (
                mensaje
              ) => {

                const tipoModulo =
                  mensaje
                    .datos
                    ?.interpretacion
                    ?.tipo;


                const modulo =
                  nombreModulo(
                    tipoModulo
                  );


                const desde =
                  mensaje
                    .datos
                    ?.interpretacion
                    ?.desde;


                const hasta =
                  mensaje
                    .datos
                    ?.interpretacion
                    ?.hasta;


                return (

                  <div
                    key={
                      mensaje.id
                    }
                    className={
                      mensaje.tipo ===
                      "usuario"
                        ? "mensaje mensaje-usuario"
                        : "mensaje mensaje-asistente"
                    }
                  >

                    <div className="mensaje-autor">

                      {
                        mensaje.tipo ===
                        "usuario"
                          ? "Vos"
                          : "Asistente IA"
                      }

                    </div>


                    <div className="mensaje-texto">

                      {
                        mensaje.texto
                      }

                    </div>


                    {/* ================================= */}
                    {/* INFORMACIÓN DE CONTEXTO */}
                    {/* No supone que sea Rechazos */}
                    {/* ================================= */}

                    {
                      mensaje.datos
                      &&
                      (
                        modulo
                        ||
                        desde
                        ||
                        hasta
                      )
                      &&
                      (

                        <div className="mensaje-contexto">

                          {
                            modulo
                            &&
                            (

                              <span className="mensaje-contexto-modulo">

                                {
                                  modulo
                                }

                              </span>

                            )
                          }


                          {
                            (
                              desde
                              ||
                              hasta
                            )
                            &&
                            (

                              <span className="mensaje-contexto-periodo">

                                Período:{" "}

                                {
                                  desde
                                    ? formatearFecha(
                                        desde
                                      )
                                    : "inicio"
                                }

                                {" → "}

                                {
                                  hasta
                                    ? formatearFecha(
                                        hasta
                                      )
                                    : "actualidad"
                                }

                              </span>

                            )
                          }

                        </div>

                      )
                    }

                  </div>

                );
              }
            )
          }


          {/* ========================================= */}
          {/* ESPERA */}
          {/* ========================================= */}

          {
            mutation.isPending
            &&
            (

              <div className="mensaje mensaje-asistente">

                <div className="mensaje-autor">

                  Asistente IA

                </div>

                <div className="mensaje-texto">

                  Consultando los datos
                  del sistema...

                </div>

              </div>

            )
          }


          <div
            ref={
              finalChatRef
            }
          />

        </div>


        {/* ========================================= */}
        {/* CAJA DE CONSULTA */}
        {/* ========================================= */}

        <form
          className="asistente-formulario"
          onSubmit={
            enviarFormulario
          }
        >

          <textarea
            value={
              pregunta
            }
            onChange={(
              event
            ) =>
              setPregunta(
                event.target.value
              )
            }
            onKeyDown={
              manejarTeclado
            }
            placeholder="Preguntá sobre repartos, recargas, rechazos, cambios o sobre la operación general..."
            rows={3}
            disabled={
              mutation.isPending
            }
          />


          <button
            type="submit"
            className="boton-principal"
            disabled={
              mutation.isPending
              ||
              !pregunta.trim()
            }
          >

            {
              mutation.isPending
                ? "Consultando..."
                : "Enviar"
            }

          </button>

        </form>


        <p className="asistente-ayuda">

          Enter para enviar ·
          Shift + Enter para
          escribir una nueva línea

        </p>

      </div>

    </div>

  );
}