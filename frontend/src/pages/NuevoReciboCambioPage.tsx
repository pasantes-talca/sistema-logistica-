import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  guardarReciboCambio,
  obtenerConcesionarios,
  obtenerMotivosCambio,
  obtenerProductos,
} from "../api/logistica";


function fechaActual() {
  const hoy = new Date();

  const year = hoy.getFullYear();
  const month = String(hoy.getMonth() + 1).padStart(2, "0");
  const day = String(hoy.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


interface FilaProducto {
  idLocal: number;
  productoId: string;
  cantidad: string;
  motivoId: string;
  observacion: string;
}


export default function NuevoReciboCambioPage() {

  const [fecha, setFecha] = useState(fechaActual());
  const [concesionarioId, setConcesionarioId] = useState("");

  const [pallets, setPallets] = useState("");
  const [palletsObservacion, setPalletsObservacion] = useState("");

  const [palletsDescargados, setPalletsDescargados] = useState("");
  const [
    palletsDescargadosObservacion,
    setPalletsDescargadosObservacion,
  ] = useState("");

  const [prensados, setPrensados] = useState("");
  const [prensadosObservacion, setPrensadosObservacion] = useState("");

  const [filas, setFilas] = useState<FilaProducto[]>([
    {
      idLocal: 1,
      productoId: "",
      cantidad: "",
      motivoId: "",
      observacion: "",
    },
  ]);


  const {
    data: concesionarios = [],
  } = useQuery({
    queryKey: ["concesionarios"],
    queryFn: obtenerConcesionarios,
  });


  const {
    data: productos = [],
  } = useQuery({
    queryKey: ["productos"],
    queryFn: obtenerProductos,
  });


  const productosPorId = useMemo(() => {
    return new Map(
      productos.map((producto) => [
        producto.id,
        producto,
      ])
    );
  }, [productos]);


  function agregarFila() {
    setFilas((actuales) => [
      ...actuales,
      {
        idLocal: Date.now(),
        productoId: "",
        cantidad: "",
        motivoId: "",
        observacion: "",
      },
    ]);
  }


  function eliminarFila(idLocal: number) {
    setFilas((actuales) =>
      actuales.filter(
        (fila) => fila.idLocal !== idLocal
      )
    );
  }


  function actualizarFila(
    idLocal: number,
    campo: keyof FilaProducto,
    valor: string
  ) {
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.idLocal === idLocal
          ? {
              ...fila,
              [campo]: valor,
              ...(campo === "productoId"
                ? { motivoId: "" }
                : {}),
            }
          : fila
      )
    );
  }


  const mutation = useMutation({
    mutationFn: guardarReciboCambio,

    onSuccess: (respuesta) => {

      const mensaje = respuesta.creado
        ? "Recibo creado correctamente."
        : "El recibo ya existía y se acumularon los nuevos datos.";

      alert(
        `${mensaje}\n\n` +
        `Recibo ID: ${respuesta.recibo.id}\n` +
        `Concesionario: ${respuesta.recibo.concesionario_nombre}`
      );

      setPallets("");
      setPalletsObservacion("");

      setPalletsDescargados("");
      setPalletsDescargadosObservacion("");

      setPrensados("");
      setPrensadosObservacion("");

      setFilas([
        {
          idLocal: Date.now(),
          productoId: "",
          cantidad: "",
          motivoId: "",
          observacion: "",
        },
      ]);
    },

    onError: (error) => {
      alert(
        `No se pudo guardar el recibo.\n\n${error.message}`
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

    if (!concesionarioId) {
      alert("Seleccioná un concesionario.");
      return;
    }

    const detalles = filas
      .filter(
        (fila) =>
          fila.productoId &&
          fila.cantidad &&
          Number(fila.cantidad) > 0
      )
      .map((fila) => ({
        producto_id: Number(fila.productoId),
        cantidad: Number(fila.cantidad),
        motivo_id: fila.motivoId
          ? Number(fila.motivoId)
          : null,
        observacion: fila.observacion.trim(),
      }));


    mutation.mutate({
      fecha,
      concesionario_id: Number(concesionarioId),

      pallets: Number(pallets || 0),
      pallets_observacion: palletsObservacion.trim(),

      pallets_descargados: Number(
        palletsDescargados || 0
      ),
      pallets_descargados_observacion:
        palletsDescargadosObservacion.trim(),

      prensados: Number(prensados || 0),
      prensados_observacion:
        prensadosObservacion.trim(),

      detalles,
    });
  }


  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="encabezado-pagina">

          <div>
            <h1>
              Nuevo recibo de cambios
            </h1>

            <p className="subtitulo">
              Registrar productos, pallets y prensados
            </p>
          </div>

        </div>


        <form
          className="formulario"
          onSubmit={enviarFormulario}
        >

          <div className="grid-dos-columnas">

            <div className="campo">

              <label>
                Fecha
              </label>

              <input
                type="date"
                value={fecha}
                onChange={(event) =>
                  setFecha(event.target.value)
                }
              />

            </div>


            <div className="campo">

              <label>
                Concesionario
              </label>

              <select
                value={concesionarioId}
                onChange={(event) =>
                  setConcesionarioId(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Seleccionar concesionario
                </option>

                {concesionarios.map(
                  (concesionario) => (

                    <option
                      key={concesionario.id}
                      value={concesionario.id}
                    >
                      {concesionario.nombre}
                    </option>

                  )
                )}

              </select>

            </div>

          </div>


          <h2>
            Productos
          </h2>


          {filas.map((fila) => {

            const producto =
              productosPorId.get(
                Number(fila.productoId)
              );

            return (
              <FilaProductoCambio
                key={fila.idLocal}
                fila={fila}
                productos={productos}
                familia={
                  producto?.familia || ""
                }
                onChange={actualizarFila}
                onEliminar={eliminarFila}
                puedeEliminar={
                  filas.length > 1
                }
              />
            );
          })}


          <button
            type="button"
            className="boton-secundario"
            onClick={agregarFila}
          >
            + Agregar producto
          </button>


          <h2>
            Otros movimientos
          </h2>


          <div className="grid-tres-columnas">

            <div className="campo">

              <label>
                Pallets
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={pallets}
                onChange={(event) =>
                  setPallets(
                    event.target.value
                  )
                }
              />

              <textarea
                rows={2}
                value={palletsObservacion}
                onChange={(event) =>
                  setPalletsObservacion(
                    event.target.value
                  )
                }
                placeholder="Observación..."
              />

            </div>


            <div className="campo">

              <label>
                Pallets descargados
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={palletsDescargados}
                onChange={(event) =>
                  setPalletsDescargados(
                    event.target.value
                  )
                }
              />

              <textarea
                rows={2}
                value={
                  palletsDescargadosObservacion
                }
                onChange={(event) =>
                  setPalletsDescargadosObservacion(
                    event.target.value
                  )
                }
                placeholder="Observación..."
              />

            </div>


            <div className="campo">

              <label>
                Prensados
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={prensados}
                onChange={(event) =>
                  setPrensados(
                    event.target.value
                  )
                }
              />

              <textarea
                rows={2}
                value={prensadosObservacion}
                onChange={(event) =>
                  setPrensadosObservacion(
                    event.target.value
                  )
                }
                placeholder="Observación..."
              />

            </div>

          </div>


          <button
            type="submit"
            className="boton-guardar"
            disabled={mutation.isPending}
          >
            {
              mutation.isPending
                ? "Guardando..."
                : "Guardar recibo"
            }
          </button>

        </form>

      </div>

    </div>
  );
}


interface FilaProductoCambioProps {
  fila: FilaProducto;

  productos: Array<{
    id: number;
    codigo: string;
    nombre: string;
  }>;

  familia: string;

  puedeEliminar: boolean;

  onChange: (
    idLocal: number,
    campo: keyof FilaProducto,
    valor: string
  ) => void;

  onEliminar: (
    idLocal: number
  ) => void;
}


function FilaProductoCambio({
  fila,
  productos,
  familia,
  puedeEliminar,
  onChange,
  onEliminar,
}: FilaProductoCambioProps) {

  const {
    data: motivos = [],
  } = useQuery({
    queryKey: [
      "motivos-cambio",
      familia,
    ],

    queryFn: () =>
      obtenerMotivosCambio(familia),

    enabled:
      Boolean(familia),
  });


  return (
    <div className="fila-producto-cambio">

      <div className="campo">

        <label>
          Producto
        </label>

        <select
          value={fila.productoId}
          onChange={(event) =>
            onChange(
              fila.idLocal,
              "productoId",
              event.target.value
            )
          }
        >

          <option value="">
            Seleccionar producto
          </option>

          {productos.map(
            (producto) => (

              <option
                key={producto.id}
                value={producto.id}
              >
                {producto.codigo}
                {" - "}
                {producto.nombre}
              </option>

            )
          )}

        </select>

      </div>


      <div className="campo">

        <label>
          Cantidad
        </label>

        <input
          type="number"
          min="0"
          step="0.01"
          value={fila.cantidad}
          onChange={(event) =>
            onChange(
              fila.idLocal,
              "cantidad",
              event.target.value
            )
          }
        />

      </div>


      <div className="campo">

        <label>
          Motivo
        </label>

        <select
          value={fila.motivoId}
          onChange={(event) =>
            onChange(
              fila.idLocal,
              "motivoId",
              event.target.value
            )
          }
          disabled={!familia}
        >

          <option value="">
            Sin clasificar
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

        <input
          type="text"
          value={fila.observacion}
          onChange={(event) =>
            onChange(
              fila.idLocal,
              "observacion",
              event.target.value
            )
          }
        />

      </div>


      {puedeEliminar && (

        <button
          type="button"
          className="boton-eliminar"
          onClick={() =>
            onEliminar(
              fila.idLocal
            )
          }
        >
          Eliminar
        </button>

      )}

    </div>
  );
}