import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  crearRechazo,
  obtenerAsignaciones,
  obtenerMotivosRechazo,
} from "../api/logistica";


function obtenerFechaActual() {
  const ahora = new Date();

  const year = ahora.getFullYear();

  const month = String(
    ahora.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    ahora.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


export default function NuevoRechazoPage() {

  const [fecha, setFecha] =
    useState(obtenerFechaActual());

  const [asignacionId, setAsignacionId] =
    useState("");

  const [puntoVenta, setPuntoVenta] =
    useState("");

  const [bultos, setBultos] =
    useState("");

  const [motivoId, setMotivoId] =
    useState("");

  const [observacion, setObservacion] =
    useState("");


  const {
    data: asignaciones = [],
    isLoading: cargandoAsignaciones,
  } = useQuery({
    queryKey: ["asignaciones"],
    queryFn: obtenerAsignaciones,
  });


  const {
    data: motivos = [],
    isLoading: cargandoMotivos,
  } = useQuery({
    queryKey: ["motivos-rechazo"],
    queryFn: obtenerMotivosRechazo,
  });


  const mutation = useMutation({

    mutationFn: crearRechazo,

    onSuccess: (rechazo) => {

      alert(
        `Rechazo guardado correctamente.\n` +
        `ID: ${rechazo.id}\n` +
        `Motivo: ${rechazo.motivo_nombre}`
      );

      setPuntoVenta("");
      setBultos("");
      setMotivoId("");
      setObservacion("");
    },

    onError: (error) => {

      alert(
        `No se pudo guardar el rechazo.\n\n${error.message}`
      );
    },
  });


  function enviarFormulario(
    event: React.FormEvent
  ) {

    event.preventDefault();


    if (!fecha) {
      alert("Seleccioná una fecha.");
      return;
    }


    if (!asignacionId) {
      alert("Seleccioná una asignación.");
      return;
    }


    if (!puntoVenta.trim()) {
      alert(
        "Ingresá el punto de venta."
      );
      return;
    }


    if (!bultos.trim()) {
      alert(
        "Ingresá los bultos."
      );
      return;
    }


    if (!motivoId) {
      alert(
        "Seleccioná el motivo de NO entrega."
      );
      return;
    }


    mutation.mutate({

      fecha,

      asignacion_id:
        Number(asignacionId),

      punto_venta:
        puntoVenta.trim(),

      bultos:
        bultos.trim(),

      motivo_id:
        Number(motivoId),

      observacion:
        observacion.trim(),
    });
  }


  return (
    <div className="pagina">

      <div className="contenedor">

        <h1>
          Nuevo rechazo
        </h1>

        <p className="subtitulo">
          Registrar una entrega no realizada
        </p>


        <form
          className="formulario"
          onSubmit={enviarFormulario}
        >

          <div className="campo">

            <label>
              Fecha
            </label>

            <input
              type="date"
              value={fecha}
              onChange={(event) =>
                setFecha(
                  event.target.value
                )
              }
              required
            />

          </div>


          <div className="campo">

            <label>
              Asignación
            </label>

            <select
              value={asignacionId}
              onChange={(event) =>
                setAsignacionId(
                  event.target.value
                )
              }
              disabled={
                cargandoAsignaciones
              }
              required
            >

              <option value="">
                Seleccionar asignación
              </option>

              {asignaciones.map(
                (asignacion) => (

                  <option
                    key={asignacion.id}
                    value={asignacion.id}
                  >
                    {asignacion.codigo}
                  </option>

                )
              )}

            </select>

          </div>


          <div className="campo">

            <label>
              Punto de venta
            </label>

            <input
              type="text"
              value={puntoVenta}
              onChange={(event) =>
                setPuntoVenta(
                  event.target.value
                )
              }
              placeholder="Ej: Vea 34"
              required
            />

          </div>


          <div className="campo">

            <label>
              Bultos
            </label>

            <input
              type="text"
              value={bultos}
              onChange={(event) =>
                setBultos(
                  event.target.value
                )
              }
              placeholder="Ej: 54"
              required
            />

          </div>


          <div className="campo">

            <label>
              Motivo de NO entrega
            </label>

            <select
              value={motivoId}
              onChange={(event) =>
                setMotivoId(
                  event.target.value
                )
              }
              disabled={
                cargandoMotivos
              }
              required
            >

              <option value="">
                Seleccionar motivo
              </option>

              {motivos.map(
                (motivo) => (

                  <option
                    key={motivo.id}
                    value={motivo.id}
                  >
                    {motivo.nombre}
                  </option>

                )
              )}

            </select>

          </div>


          <div className="campo">

            <label>
              Observación
            </label>

            <textarea
              value={observacion}
              onChange={(event) =>
                setObservacion(
                  event.target.value
                )
              }
              rows={4}
              placeholder="Observación opcional..."
            />

          </div>


          <button
            type="submit"
            className="boton-guardar"
            disabled={
              mutation.isPending
            }
          >

            {
              mutation.isPending
                ? "Guardando..."
                : "Guardar rechazo"
            }

          </button>

        </form>

      </div>

    </div>
  );
}