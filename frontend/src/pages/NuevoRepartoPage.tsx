import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  crearReparto,
  obtenerAsignaciones,
  obtenerAyudantes,
  obtenerChoferes,
  obtenerVehiculos,
} from "../api/logistica";


function obtenerFechaActual(): string {
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


export default function NuevoRepartoPage() {

  const [fecha, setFecha] = useState(
    obtenerFechaActual()
  );

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
  // CONSULTAS
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
  // CHOFER AUTOMÁTICO SEGÚN ASIGNACIÓN
  // =========================================================

  useEffect(() => {

    if (!asignacionId) {
      return;
    }

    const asignacion = asignaciones.find(
      item =>
        item.id === Number(asignacionId)
    );

    if (
      asignacion?.chofer_predeterminado_id
    ) {
      setChoferId(
        String(
          asignacion.chofer_predeterminado_id
        )
      );
    }

  }, [
    asignacionId,
    asignaciones,
  ]);


  // =========================================================
  // GUARDAR
  // =========================================================

  const guardarMutation = useMutation({

    mutationFn: crearReparto,

    onSuccess: reparto => {

      alert(
        `Reparto guardado correctamente.\n\n` +
        `Recargas por persona: ${reparto.recargas}\n` +
        `Recargas totales: ${reparto.recargas_totales}`
      );

      setVehiculoId("");
      setAsignacionId("");
      setChoferId("");
      setAyudantesIds([]);
      setBultos("");
      setPuntosVenta("");
      setObservaciones("");
    },

    onError: error => {
      alert(
        `No se pudo guardar el reparto.\n\n${error.message}`
      );
    },

  });


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
          (_, i) => i !== indice
        )
    );
  }


  // =========================================================
  // SUBMIT
  // =========================================================

  function handleSubmit(
    event: React.FormEvent
  ) {

    event.preventDefault();

    if (!fecha) {
      alert("Seleccioná la fecha.");
      return;
    }

    if (!choferId) {
      alert("Seleccioná un chofer.");
      return;
    }

    if (!bultos) {
      alert("Ingresá la cantidad de bultos.");
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
    cargandoChoferes ||
    cargandoAyudantes ||
    cargandoVehiculos ||
    cargandoAsignaciones;


  if (cargando) {
    return (
      <div className="pagina">
        <p>Cargando datos...</p>
      </div>
    );
  }


  return (
    <div className="pagina">

      <div className="contenedor">

        <h1>
          Nuevo reparto
        </h1>

        <p className="subtitulo">
          Carga diaria de reparto y cálculo
          automático de recargas
        </p>


        <form
          onSubmit={handleSubmit}
          className="formulario"
        >

          <div className="campo">
            <label>Fecha *</label>

            <input
              type="date"
              value={fecha}
              onChange={e =>
                setFecha(e.target.value)
              }
              required
            />
          </div>


          <div className="campo">
            <label>Patente</label>

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
            <label>Asignación</label>

            <select
              value={asignacionId}
              onChange={e =>
                setAsignacionId(
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
            <label>Chofer *</label>

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
              (ayudanteId, indice) => (

                <div
                  className="fila-ayudante"
                  key={indice}
                >

                  <select
                    value={ayudanteId}
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
            <label>Bultos *</label>

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
                : "Guardar reparto"
            }
          </button>

        </form>

      </div>

    </div>
  );
}