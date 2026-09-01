import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
  actualizarReciboCambio,
  obtenerConcesionarios,
  obtenerMotivosCambio,
  obtenerProductos,
  obtenerReciboCambio,
} from "../api/logistica";


interface FilaProducto {
  idLocal: number;
  productoId: string;
  cantidad: string;
  motivoId: string;
  observacion: string;
}


export default function EditarReciboCambioPage() {

  const { id } = useParams();

  const reciboId = Number(id);

  const navigate = useNavigate();

  const queryClient =
    useQueryClient();


  const [fecha, setFecha] =
    useState("");

  const [
    concesionarioId,
    setConcesionarioId,
  ] = useState("");


  const [pallets, setPallets] =
    useState("");

  const [
    palletsObservacion,
    setPalletsObservacion,
  ] = useState("");


  const [
    palletsDescargados,
    setPalletsDescargados,
  ] = useState("");

  const [
    palletsDescargadosObservacion,
    setPalletsDescargadosObservacion,
  ] = useState("");


  const [prensados, setPrensados] =
    useState("");

  const [
    prensadosObservacion,
    setPrensadosObservacion,
  ] = useState("");


  const [filas, setFilas] =
    useState<FilaProducto[]>([]);


  const {
    data: recibo,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "recibo-cambio",
      reciboId,
    ],

    queryFn: () =>
      obtenerReciboCambio(
        reciboId
      ),

    enabled:
      Number.isFinite(
        reciboId
      ),
  });


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
    data: productos = [],
  } = useQuery({
    queryKey: [
      "productos"
    ],
    queryFn:
      obtenerProductos,
  });


  const productosPorId =
    useMemo(
      () =>
        new Map(
          productos.map(
            (producto) => [
              producto.id,
              producto,
            ]
          )
        ),
      [productos]
    );


  useEffect(() => {

    if (!recibo) {
      return;
    }

    setFecha(
      recibo.fecha
    );

    setConcesionarioId(
      String(
        recibo.concesionario_id
      )
    );

    setPallets(
      String(
        Number(
          recibo.pallets
        )
      )
    );

    setPalletsObservacion(
      recibo.pallets_observacion
    );

    setPalletsDescargados(
      String(
        Number(
          recibo.pallets_descargados
        )
      )
    );

    setPalletsDescargadosObservacion(
      recibo
        .pallets_descargados_observacion
    );

    setPrensados(
      String(
        Number(
          recibo.prensados
        )
      )
    );

    setPrensadosObservacion(
      recibo
        .prensados_observacion
    );

    setFilas(
      recibo.detalles.map(
        (detalle) => ({
          idLocal:
            detalle.id,

          productoId:
            String(
              detalle.producto_id
            ),

          cantidad:
            String(
              Number(
                detalle.cantidad
              )
            ),

          motivoId:
            detalle.motivo_id
              ? String(
                  detalle.motivo_id
                )
              : "",

          observacion:
            detalle.observacion,
        })
      )
    );

  }, [recibo]);


  function agregarFila() {

    setFilas(
      (actuales) => [
        ...actuales,
        {
          idLocal:
            Date.now(),

          productoId:
            "",

          cantidad:
            "",

          motivoId:
            "",

          observacion:
            "",
        },
      ]
    );
  }


  function eliminarFila(
    idLocal: number
  ) {

    setFilas(
      (actuales) =>
        actuales.filter(
          (fila) =>
            fila.idLocal
            !== idLocal
        )
    );
  }


  function actualizarFila(
    idLocal: number,
    campo: keyof FilaProducto,
    valor: string
  ) {

    setFilas(
      (actuales) =>
        actuales.map(
          (fila) => {

            if (
              fila.idLocal
              !== idLocal
            ) {
              return fila;
            }

            return {
              ...fila,

              [campo]:
                valor,

              ...(campo ===
                "productoId"
                ? {
                    motivoId: "",
                  }
                : {}),
            };
          }
        )
    );
  }


  const mutation = useMutation({

    mutationFn: (datos: {
      fecha: string;
      concesionario_id: number;

      pallets: number;
      pallets_observacion: string;

      pallets_descargados: number;
      pallets_descargados_observacion: string;

      prensados: number;
      prensados_observacion: string;

      detalles: {
        producto_id: number;
        cantidad: number;
        motivo_id: number | null;
        observacion: string;
      }[];
    }) =>
      actualizarReciboCambio(
        reciboId,
        datos
      ),


    onSuccess: async () => {

      await queryClient.invalidateQueries({
        queryKey: [
          "recibos-cambio"
        ],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          "recibo-cambio",
          reciboId,
        ],
      });


      alert(
        "Recibo actualizado correctamente."
      );


      navigate(
        `/cambios/recibos/${reciboId}`
      );
    },


    onError: (error) => {

      alert(
        `No se pudo actualizar el recibo.\n\n${error.message}`
      );
    },
  });


  function guardar(
    event: React.FormEvent
  ) {

    event.preventDefault();


    if (!fecha) {
      alert(
        "Seleccioná una fecha."
      );

      return;
    }


    if (!concesionarioId) {
      alert(
        "Seleccioná un concesionario."
      );

      return;
    }


    const detalles =
      filas
        .filter(
          (fila) =>
            fila.productoId
            &&
            fila.cantidad
            &&
            Number(
              fila.cantidad
            ) > 0
        )
        .map(
          (fila) => ({

            producto_id:
              Number(
                fila.productoId
              ),

            cantidad:
              Number(
                fila.cantidad
              ),

            motivo_id:
              fila.motivoId
                ? Number(
                    fila.motivoId
                  )
                : null,

            observacion:
              fila
                .observacion
                .trim(),
          })
        );


    mutation.mutate({

      fecha,

      concesionario_id:
        Number(
          concesionarioId
        ),

      pallets:
        Number(
          pallets || 0
        ),

      pallets_observacion:
        palletsObservacion
          .trim(),

      pallets_descargados:
        Number(
          palletsDescargados
          || 0
        ),

      pallets_descargados_observacion:
        palletsDescargadosObservacion
          .trim(),

      prensados:
        Number(
          prensados || 0
        ),

      prensados_observacion:
        prensadosObservacion
          .trim(),

      detalles,
    });
  }


  if (isLoading) {

    return (
      <div className="pagina">
        <div className="contenedor-grande">
          Cargando recibo...
        </div>
      </div>
    );
  }


  if (
    isError ||
    !recibo
  ) {

    return (
      <div className="pagina">
        <div className="contenedor-grande">
          No se pudo cargar el recibo.
        </div>
      </div>
    );
  }


  return (
    <div className="pagina">

      <div className="contenedor-grande">

        <div className="encabezado-pagina">

          <div>

            <h1>
              Editar recibo de cambios
            </h1>

            <p className="subtitulo">
              Corregir los valores actuales del recibo
            </p>

          </div>

        </div>


        <form
          className="formulario"
          onSubmit={guardar}
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
                  setFecha(
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


          {filas.map(
            (fila) => {

              const producto =
                productosPorId.get(
                  Number(
                    fila.productoId
                  )
                );


              return (

                <FilaEditarProductoCambio
                  key={fila.idLocal}
                  fila={fila}
                  productos={productos}
                  familia={
                    producto?.familia
                    || ""
                  }
                  onChange={
                    actualizarFila
                  }
                  onEliminar={
                    eliminarFila
                  }
                />

              );
            }
          )}


          <button
            type="button"
            className="boton-secundario"
            onClick={
              agregarFila
            }
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
                value={
                  palletsObservacion
                }
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
                value={
                  palletsDescargados
                }
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
                value={
                  prensadosObservacion
                }
                onChange={(event) =>
                  setPrensadosObservacion(
                    event.target.value
                  )
                }
                placeholder="Observación..."
              />

            </div>

          </div>


          <div className="acciones-formulario">

            <button
              type="button"
              className="boton-cancelar"
              onClick={() =>
                navigate(
                  `/cambios/recibos/${reciboId}`
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


interface FilaEditarProductoCambioProps {

  fila: FilaProducto;

  productos: Array<{
    id: number;
    codigo: string;
    nombre: string;
  }>;

  familia: string;

  onChange: (
    idLocal: number,
    campo: keyof FilaProducto,
    valor: string
  ) => void;

  onEliminar: (
    idLocal: number
  ) => void;
}


function FilaEditarProductoCambio({
  fila,
  productos,
  familia,
  onChange,
  onEliminar,
}: FilaEditarProductoCambioProps) {

  const {
    data: motivos = [],
  } = useQuery({

    queryKey: [
      "motivos-cambio",
      familia,
    ],

    queryFn: () =>
      obtenerMotivosCambio(
        familia
      ),

    enabled:
      Boolean(
        familia
      ),
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

    </div>
  );
}