import { useEffect, useState } from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  actualizarRechazo,
  obtenerAsignaciones,
  obtenerMotivosRechazo,
  obtenerRechazo,
} from "../api/logistica";


export default function EditarRechazoPage() {

  const { id } = useParams();

  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const rechazoId = Number(id);


  const [fecha, setFecha] =
    useState("");

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
    data: rechazo,
    isLoading: cargandoRechazo,
    isError: errorRechazo,
  } = useQuery({

    queryKey: [
      "rechazo",
      rechazoId,
    ],

    queryFn: () =>
      obtenerRechazo(
        rechazoId
      ),

    enabled:
      Number.isFinite(rechazoId),
  });


  const {
    data: asignaciones = [],
  } = useQuery({
    queryKey: ["asignaciones"],
    queryFn: obtenerAsignaciones,
  });


  const {
    data: motivos = [],
  } = useQuery({
    queryKey: ["motivos-rechazo"],
    queryFn: obtenerMotivosRechazo,
  });


  useEffect(() => {

    if (!rechazo) {
      return;
    }


    setFecha(
      rechazo.fecha
    );

    setAsignacionId(
      rechazo.asignacion_id
        ? String(
            rechazo.asignacion_id
          )
        : ""
    );

    setPuntoVenta(
      rechazo.punto_venta
    );

    setBultos(
      rechazo.bultos
    );

    setMotivoId(
      String(
        rechazo.motivo_id
      )
    );

    setObservacion(
      rechazo.observacion
    );

  }, [rechazo]);


  const mutation = useMutation({

    mutationFn: (datos: {
      fecha: string;
      asignacion_id: number | null;
      punto_venta: string;
      bultos: string;
      motivo_id: number;
      observacion: string;
    }) =>
      actualizarRechazo(
        rechazoId,
        datos
      ),


    onSuccess: async () => {

      await queryClient.invalidateQueries({
        queryKey: ["rechazos"],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          "rechazo",
          rechazoId,
        ],
      });


      alert(
        "Rechazo actualizado correctamente."
      );


      navigate(
        "/rechazos"
      );
    },


    onError: (error) => {

      alert(
        `No se pudo actualizar el rechazo.\n\n${error.message}`
      );
    },

  });


  function enviarFormulario(
    event: React.FormEvent
  ) {

    event.preventDefault();


    if (!fecha) {
      alert(
        "Seleccioná una fecha."
      );
      return;
    }


    if (!asignacionId) {
      alert(
        "Seleccioná una asignación."
      );
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
        Number(
          asignacionId
        ),

      punto_venta:
        puntoVenta.trim(),

      bultos:
        bultos.trim(),

      motivo_id:
        Number(
          motivoId
        ),

      observacion:
        observacion.trim(),
    });
  }


  if (cargandoRechazo) {

    return (
      <div className="pagina">

        <div className="contenedor">

          Cargando rechazo...

        </div>

      </div>
    );
  }


  if (errorRechazo) {

    return (
      <div className="pagina">

        <div className="contenedor">

          No se pudo cargar el rechazo.

        </div>

      </div>
    );
  }


  return (
    <div className="pagina">

      <div className="contenedor">

        <h1>
          Editar rechazo
        </h1>

        <p className="subtitulo">
          Modificar una entrega no realizada
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
              required
            >

              <option value="">
                Seleccionar asignación
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
              required
            >

              <option value="">
                Seleccionar motivo
              </option>


              {motivos.map(
                (motivo) => (

                  <option
                    key={
                      motivo.id
                    }
                    value={
                      motivo.id
                    }
                  >
                    {
                      motivo.nombre
                    }
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
            />

          </div>


          <div className="acciones-formulario">

            <button
              type="button"
              className="boton-cancelar"
              onClick={() =>
                navigate(
                  "/rechazos"
                )
              }
            >
              Cancelar
            </button>


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
                  : "Guardar cambios"
              }

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}