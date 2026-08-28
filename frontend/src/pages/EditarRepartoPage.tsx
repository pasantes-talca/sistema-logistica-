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
  actualizarReparto,
  obtenerAsignaciones,
  obtenerAyudantes,
  obtenerChoferes,
  obtenerReparto,
  obtenerVehiculos,
} from "../api/logistica";


export default function EditarRepartoPage() {

  const { id } = useParams();

  const repartoId = Number(id);

  const navigate = useNavigate();

  const queryClient = useQueryClient();


  const [fecha, setFecha] = useState("");

  const [vehiculoId, setVehiculoId] =
    useState("");

  const [asignacionId, setAsignacionId] =
    useState("");

  const [choferId, setChoferId] =
    useState("");

  const [ayudantesIds, setAyudantesIds] =
    useState<string[]>([]);

  const [bultos, setBultos] =
    useState("");

  const [puntosVenta, setPuntosVenta] =
    useState("");

  const [observaciones, setObservaciones] =
    useState("");


  // =========================================================
  // CONSULTAR REPARTO
  // =========================================================

  const {
    data: reparto,
    isLoading: cargandoReparto,
    isError: errorReparto,
  } = useQuery({
    queryKey: [
      "reparto",
      repartoId,
    ],

    queryFn: () =>
      obtenerReparto(repartoId),

    enabled:
      Number.isInteger(repartoId)
      && repartoId > 0,
  });


  // =========================================================
  // MAESTROS
  // =========================================================

  const {
    data: choferes = [],
    isLoading: cargandoChoferes,
  } = useQuery({
    queryKey: ["choferes"],
    queryFn: obtenerChoferes,
  });


  const {
    data: ayudantes = [],
    isLoading: cargandoAyudantes,
  } = useQuery({
    queryKey: ["ayudantes"],
    queryFn: obtenerAyudantes,
  });


  const {
    data: vehiculos = [],
    isLoading: cargandoVehiculos,
  } = useQuery({
    queryKey: ["vehiculos"],
    queryFn: obtenerVehiculos,
  });


  const {
    data: asignaciones = [],
    isLoading: cargandoAsignaciones,
  } = useQuery({
    queryKey: ["asignaciones"],
    queryFn: obtenerAsignaciones,
  });


  // =========================================================
  // CARGAR DATOS EXISTENTES EN EL FORMULARIO
  // =========================================================

  useEffect(() => {

    if (!reparto) {
      return;
    }

    setFecha(
      reparto.fecha
    );

    setVehiculoId(
      reparto.vehiculo_id
        ? String(reparto.vehiculo_id)
        : ""
    );

    setAsignacionId(
      reparto.asignacion_id
        ? String(reparto.asignacion_id)
        : ""
    );


    const chofer =
      reparto.personal.find(
        persona =>
          persona.rol === "CHOFER"
      );


    setChoferId(
      chofer
        ? String(chofer.empleado_id)
        : ""
    );


    const idsAyudantes =
      reparto.personal
        .filter(
          persona =>
            persona.rol === "AYUDANTE"
        )
        .map(
          persona =>
            String(persona.empleado_id)
        );


    setAyudantesIds(
      idsAyudantes
    );

    setBultos(
      String(reparto.bultos)
    );

    setPuntosVenta(
      reparto.puntos_venta || ""
    );

    setObservaciones(
      reparto.observaciones || ""
    );

  }, [reparto]);


  // =========================================================
  // CAMBIO DE ASIGNACIÓN
  // =========================================================

  function cambiarAsignacion(
    valor: string
  ) {

    setAsignacionId(valor);

    if (!valor) {
      return;
    }

    const asignacion =
      asignaciones.find(
        item =>
          item.id === Number(valor)
      );


    if (
      asignacion?.chofer_predeterminado_id
    ) {
      setChoferId(
        String(
          asignacion
            .chofer_predeterminado_id
        )
      );
    }
  }


  // =========================================================
  // AYUDANTES
  // =========================================================

  function agregarAyudante() {

    setAyudantesIds(
      anteriores => [
        ...anteriores,
        "",
      ]
    );
  }


  function cambiarAyudante(
    indice: number,
    valor: string
  ) {

    setAyudantesIds(
      anteriores =>
        anteriores.map(
          (item, i) =>
            i === indice
              ? valor
              : item
        )
    );
  }


  function eliminarAyudante(
    indice: number
  ) {

    setAyudantesIds(
      anteriores =>
        anteriores.filter(
          (_, i) =>
            i !== indice
        )
    );
  }


  // =========================================================
  // GUARDAR CAMBIOS
  // =========================================================

  const guardarMutation = useMutation({

    mutationFn: (datos: {
      fecha: string;
      vehiculo_id: number | null;
      asignacion_id: number | null;
      chofer_id: number;
      ayudantes_ids: number[];
      bultos: number;
      puntos_venta: string;
      observaciones: string;
    }) =>
      actualizarReparto(
        repartoId,
        datos
      ),


    onSuccess: async repartoActualizado => {

      await queryClient.invalidateQueries({
        queryKey: ["repartos"],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          "reparto",
          repartoId,
        ],
      });


      alert(
        `Reparto actualizado correctamente.\n\n` +
        `Recargas por persona: ${repartoActualizado.recargas}\n` +
        `Recargas totales: ${repartoActualizado.recargas_totales}`
      );


      navigate(
        "/repartos"
      );
    },


    onError: error => {

      alert(
        `No se pudo actualizar el reparto.\n\n${error.message}`
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


    if (!fecha) {
      alert(
        "Seleccioná la fecha."
      );

      return;
    }


    if (!choferId) {
      alert(
        "Seleccioná un chofer."
      );

      return;
    }


    if (!bultos) {
      alert(
        "Ingresá la cantidad de bultos."
      );

      return;
    }


    guardarMutation.mutate({

      fecha,

      vehiculo_id:
        vehiculoId
          ? Number(vehiculoId)
          : null,

      asignacion_id:
        asignacionId
          ? Number(asignacionId)
          : null,

      chofer_id:
        Number(choferId),

      ayudantes_ids:
        ayudantesIds
          .filter(Boolean)
          .map(Number),

      bultos:
        Number(bultos),

      puntos_venta:
        puntosVenta,

      observaciones,
    });
  }


  const cargando =
    cargandoReparto ||
    cargandoChoferes ||
    cargandoAyudantes ||
    cargandoVehiculos ||
    cargandoAsignaciones;


  if (cargando) {

    return (
      <div className="pagina">

        <div className="contenedor">
          <p>
            Cargando reparto...
          </p>
        </div>

      </div>
    );
  }


  if (
    errorReparto ||
    !reparto
  ) {

    return (
      <div className="pagina">

        <div className="contenedor">

          <h1>
            Reparto no encontrado
          </h1>

          <button
            type="button"
            className="boton-guardar"
            onClick={() =>
              navigate("/repartos")
            }
          >
            Volver al historial
          </button>

        </div>

      </div>
    );
  }


  return (
    <div className="pagina">

      <div className="contenedor">

        <h1>
          Editar reparto
        </h1>

        <p className="subtitulo">
          Reparto #{reparto.id}
        </p>


        <form
          onSubmit={handleSubmit}
          className="formulario"
        >

          <div className="campo">

            <label>
              Fecha *
            </label>

            <input
              type="date"
              value={fecha}
              onChange={e =>
                setFecha(
                  e.target.value
                )
              }
              required
            />

          </div>


          <div className="campo">

            <label>
              Patente
            </label>

            <select
              value={vehiculoId}
              onChange={e =>
                setVehiculoId(
                  e.target.value
                )
              }
            >

              <option value="">
                Seleccionar vehículo
              </option>

              {vehiculos.map(
                vehiculo => (

                  <option
                    key={vehiculo.id}
                    value={vehiculo.id}
                  >
                    {vehiculo.patente}
                  </option>

                )
              )}

            </select>

          </div>


          <div className="campo">

            <label>
              Asignación
            </label>

            <select
              value={asignacionId}
              onChange={e =>
                cambiarAsignacion(
                  e.target.value
                )
              }
            >

              <option value="">
                Seleccionar asignación
              </option>

              {asignaciones.map(
                asignacion => (

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
              Chofer *
            </label>

            <select
              value={choferId}
              onChange={e =>
                setChoferId(
                  e.target.value
                )
              }
              required
            >

              <option value="">
                Seleccionar chofer
              </option>

              {choferes.map(
                chofer => (

                  <option
                    key={chofer.id}
                    value={chofer.id}
                  >
                    {chofer.nombre}
                  </option>

                )
              )}

            </select>

          </div>


          <div className="campo">

            <div className="titulo-ayudantes">

              <label>
                Ayudantes
              </label>

              <button
                type="button"
                className="boton-secundario"
                onClick={
                  agregarAyudante
                }
              >
                + Agregar
              </button>

            </div>


            {ayudantesIds.map(
              (
                ayudanteId,
                indice
              ) => (

                <div
                  className="fila-ayudante"
                  key={indice}
                >

                  <select
                    value={
                      ayudanteId
                    }
                    onChange={e =>
                      cambiarAyudante(
                        indice,
                        e.target.value
                      )
                    }
                  >

                    <option value="">
                      Seleccionar ayudante
                    </option>

                    {ayudantes
                      .filter(
                        empleado =>
                          String(
                            empleado.id
                          ) !== choferId
                      )
                      .map(
                        empleado => (

                          <option
                            key={
                              empleado.id
                            }
                            value={
                              empleado.id
                            }
                          >
                            {
                              empleado.nombre
                            }
                          </option>

                        )
                      )}

                  </select>


                  <button
                    type="button"
                    className="boton-eliminar"
                    onClick={() =>
                      eliminarAyudante(
                        indice
                      )
                    }
                  >
                    Quitar
                  </button>

                </div>

              )
            )}

          </div>


          <div className="campo">

            <label>
              Bultos *
            </label>

            <input
              type="number"
              min="0"
              value={bultos}
              onChange={e =>
                setBultos(
                  e.target.value
                )
              }
              required
            />

          </div>


          <div className="campo">

            <label>
              Puntos de venta
            </label>

            <input
              type="text"
              value={puntosVenta}
              onChange={e =>
                setPuntosVenta(
                  e.target.value
                )
              }
            />

          </div>


          <div className="campo">

            <label>
              Observaciones
            </label>

            <textarea
              value={observaciones}
              onChange={e =>
                setObservaciones(
                  e.target.value
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
                  "/repartos"
                )
              }
            >
              Cancelar
            </button>


            <button
              type="submit"
              className="boton-guardar"
              disabled={
                guardarMutation
                  .isPending
              }
            >
              {
                guardarMutation
                  .isPending
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