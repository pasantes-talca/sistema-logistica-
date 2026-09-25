import {
  useState,
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  useNavigate,
} from "react-router-dom";

import {
  crearOrdenCarga,
  obtenerFleteros,
} from "../api/expedicion";

import {
  obtenerProductos,
} from "../api/logistica";

import Icon from "../components/ui/Icon";

import "./Expedicion.css";


type FilaProducto = {
  productoId: string;
  cantidad: string;
};


function obtenerFechaActual() {

  const ahora =
    new Date();

  const anio =
    ahora.getFullYear();

  const mes =
    String(
      ahora.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      ahora.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${anio}-${mes}-${dia}`;
}


export default function NuevaOrdenExpedicionPage() {

  const navigate =
    useNavigate();


  const queryClient =
    useQueryClient();


  const [
    numero,
    setNumero,
  ] = useState("");


  const [
    fecha,
    setFecha,
  ] = useState(
    obtenerFechaActual()
  );


  const [
    fleteroId,
    setFleteroId,
  ] = useState("");


  const [
    observaciones,
    setObservaciones,
  ] = useState("");


  const [
    productosOrden,
    setProductosOrden,
  ] = useState<FilaProducto[]>([
    {
      productoId: "",
      cantidad: "",
    },
  ]);


  // =========================================================
  // CONSULTAR FLETEROS
  // =========================================================

  const {
    data: fleteros = [],
    isLoading:
      cargandoFleteros,
  } = useQuery({

    queryKey: [
      "expedicion-fleteros",
    ],

    queryFn:
      obtenerFleteros,

  });


  // =========================================================
  // CONSULTAR PRODUCTOS
  // =========================================================

  const {
    data: productos = [],
    isLoading:
      cargandoProductos,
  } = useQuery({

    queryKey: [
      "productos",
    ],

    queryFn:
      obtenerProductos,

  });


  // =========================================================
  // CREAR ORDEN
  // =========================================================

  const guardarMutation =
    useMutation({

      mutationFn:
        crearOrdenCarga,

      onSuccess: async (
        orden
      ) => {

        await queryClient
          .invalidateQueries({
            queryKey: [
              "expedicion-ordenes",
            ],
          });


        alert(
          `Orden ${orden.numero} creada correctamente.`
        );


        navigate(
          "/expedicion/ordenes"
        );
      },


      onError: error => {

        alert(
          error instanceof Error
            ? error.message
            : "No se pudo crear la orden."
        );
      },

    });


  // =========================================================
  // CAMBIAR PRODUCTO
  // =========================================================

  function cambiarProducto(
    index: number,
    valor: string
  ) {

    setProductosOrden(
      actuales =>
        actuales.map(
          (
            item,
            i
          ) =>
            i === index
              ? {
                  ...item,
                  productoId:
                    valor,
                }
              : item
        )
    );
  }


  // =========================================================
  // CAMBIAR CANTIDAD
  // =========================================================

  function cambiarCantidad(
    index: number,
    valor: string
  ) {

    setProductosOrden(
      actuales =>
        actuales.map(
          (
            item,
            i
          ) =>
            i === index
              ? {
                  ...item,
                  cantidad:
                    valor,
                }
              : item
        )
    );
  }


  // =========================================================
  // AGREGAR PRODUCTO
  // =========================================================

  function agregarProducto() {

    setProductosOrden(
      actuales => [
        ...actuales,

        {
          productoId: "",
          cantidad: "",
        },
      ]
    );
  }


  // =========================================================
  // ELIMINAR PRODUCTO
  // =========================================================

  function eliminarProducto(
    index: number
  ) {

    if (
      productosOrden.length === 1
    ) {

      return;
    }


    setProductosOrden(
      actuales =>
        actuales.filter(
          (
            _,
            i
          ) =>
            i !== index
        )
    );
  }


  // =========================================================
  // GUARDAR ORDEN
  // =========================================================

  function guardarOrden(
    event:
      React.FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    // ---------------------------------------------------------
    // VALIDAR NÚMERO
    // ---------------------------------------------------------

    if (!numero.trim()) {

      alert(
        "Ingresá el número de orden."
      );

      return;
    }


    // ---------------------------------------------------------
    // VALIDAR FECHA
    // ---------------------------------------------------------

    if (!fecha) {

      alert(
        "Seleccioná una fecha."
      );

      return;
    }


    // ---------------------------------------------------------
    // VALIDAR FLETERO
    // ---------------------------------------------------------

    if (!fleteroId) {

      alert(
        "Seleccioná un fletero."
      );

      return;
    }


    // ---------------------------------------------------------
    // VALIDAR PRODUCTOS
    // ---------------------------------------------------------

    const detallesValidos =
      productosOrden.filter(
        item =>
          item.productoId
          &&
          Number(
            item.cantidad
          ) > 0
      );


    if (
      detallesValidos.length === 0
    ) {

      alert(
        "Agregá al menos un producto con cantidad válida."
      );

      return;
    }


    // ---------------------------------------------------------
    // EVITAR PRODUCTOS DUPLICADOS
    // ---------------------------------------------------------

    const ids =
      detallesValidos.map(
        item =>
          item.productoId
      );


    const idsUnicos =
      new Set(
        ids
      );


    if (
      idsUnicos.size
      !==
      ids.length
    ) {

      alert(
        "No podés agregar el mismo producto más de una vez."
      );

      return;
    }


    // ---------------------------------------------------------
    // CREAR ORDEN
    // ---------------------------------------------------------

    guardarMutation.mutate({

      numero:
        numero.trim(),

      fecha,

      fletero_id:
        Number(
          fleteroId
        ),

      observaciones:
        observaciones.trim(),

      detalles:
        detallesValidos.map(
          item => ({

            producto_id:
              Number(
                item.productoId
              ),

            cantidad_solicitada:
              Number(
                item.cantidad
              ),

          })
        ),

    });
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="pagina expedicion-page">

      <div className="dashboard-container">


        {/* ===================================== */}
        {/* ENCABEZADO */}
        {/* ===================================== */}

        <div className="dashboard-bienvenida">

          <div>

            <div className="badge-panel">

              <Icon
                name="truck"
                size={16}
              />

              Expedición

            </div>


            <h1>
              Nueva orden de carga
            </h1>


            <p>
              Registrá una nueva orden,
              seleccioná el fletero
              y agregá los productos
              solicitados para la carga.
            </p>

          </div>


          <div className="dashboard-status">

            <span />

            <div>

              <strong>
                Nueva operación
              </strong>

              <small>
                La orden no descuenta
                stock todavía
              </small>

            </div>

          </div>

        </div>


        {/* ===================================== */}
        {/* FORMULARIO */}
        {/* ===================================== */}

        <form
          onSubmit={
            guardarOrden
          }
        >


          {/* =================================== */}
          {/* DATOS GENERALES */}
          {/* =================================== */}

          <section>

            <div className="section-heading">

              <div>

                <span>
                  ORDEN
                </span>

                <h2>
                  Datos generales
                </h2>

              </div>


              <small>
                Información principal
                de la orden
              </small>

            </div>


            <div className="form-grid">


              {/* NÚMERO DE ORDEN */}

              <div className="form-group">

                <label>
                  Número de orden
                </label>


                <input
                  type="text"

                  value={
                    numero
                  }

                  onChange={
                    event =>
                      setNumero(
                        event.target.value
                      )
                  }

                  placeholder="Ej: OC-00125"
                />

              </div>


              {/* FECHA */}

              <div className="form-group">

                <label>
                  Fecha
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
                />

              </div>


              {/* FLETERO */}

              <div className="form-group">

                <label>
                  Fletero
                </label>


                <select
                  value={
                    fleteroId
                  }

                  onChange={
                    event =>
                      setFleteroId(
                        event.target.value
                      )
                  }

                  disabled={
                    cargandoFleteros
                  }
                >

                  <option value="">

                    {
                      cargandoFleteros
                        ? "Cargando fleteros..."
                        : "Seleccionar fletero"
                    }

                  </option>


                  {
                    fleteros
                      .filter(
                        fletero =>
                          fletero.activo
                      )
                      .map(
                        fletero => (

                          <option
                            key={
                              fletero.id
                            }

                            value={
                              fletero.id
                            }
                          >

                            {
                              fletero.nombre
                            }

                            {
                              fletero.apellido
                                ? ` ${fletero.apellido}`
                                : ""
                            }

                            {
                              fletero.empresa
                                ? ` - ${fletero.empresa}`
                                : ""
                            }

                          </option>

                        )
                      )
                  }

                </select>

              </div>

            </div>

          </section>


          {/* =================================== */}
          {/* PRODUCTOS */}
          {/* =================================== */}

          <section>

            <div className="section-heading">

              <div>

                <span>
                  PRODUCTOS
                </span>

                <h2>
                  Productos solicitados
                </h2>

              </div>


              <button
                type="button"
                className="module-enter"

                onClick={
                  agregarProducto
                }
              >

                <Icon
                  name="plus"
                  size={16}
                />

                Agregar producto

              </button>

            </div>


            <div
              style={{
                display:
                  "flex",

                flexDirection:
                  "column",

                gap:
                  "14px",
              }}
            >

              {
                productosOrden.map(
                  (
                    fila,
                    index
                  ) => (

                    <div
                      key={
                        index
                      }

                      className="expedicion-product-row"
                    >


                      {/* PRODUCTO */}

                      <div className="form-group">

                        <label>
                          Producto
                        </label>


                        <select
                          value={
                            fila.productoId
                          }

                          onChange={
                            event =>
                              cambiarProducto(
                                index,
                                event.target.value
                              )
                          }

                          disabled={
                            cargandoProductos
                          }
                        >

                          <option value="">

                            {
                              cargandoProductos
                                ? "Cargando productos..."
                                : "Seleccionar producto"
                            }

                          </option>


                          {
                            productos.map(
                              producto => (

                                <option
                                  key={
                                    producto.id
                                  }

                                  value={
                                    producto.id
                                  }
                                >

                                  {
                                    producto.codigo
                                  }

                                  {" - "}

                                  {
                                    producto.nombre
                                  }

                                </option>

                              )
                            )
                          }

                        </select>

                      </div>


                      {/* CANTIDAD */}

                      <div className="form-group">

                        <label>
                          Cantidad solicitada
                        </label>


                        <input
                          type="number"

                          min="0.01"

                          step="0.01"

                          value={
                            fila.cantidad
                          }

                          onChange={
                            event =>
                              cambiarCantidad(
                                index,
                                event.target.value
                              )
                          }

                          placeholder="Ej: 500"
                        />

                      </div>


                      {/* ELIMINAR */}

                      <button
                        type="button"

                        className="expedicion-remove-button"

                        onClick={
                          () =>
                            eliminarProducto(
                              index
                            )
                        }

                        disabled={
                          productosOrden.length
                          ===
                          1
                        }
                      >

                        Eliminar

                      </button>

                    </div>

                  )
                )
              }

            </div>

          </section>


          {/* =================================== */}
          {/* OBSERVACIONES */}
          {/* =================================== */}

          <section>

            <div className="section-heading">

              <div>

                <span>
                  OBSERVACIONES
                </span>

                <h2>
                  Información adicional
                </h2>

              </div>


              <small>
                Opcional
              </small>

            </div>


            <div className="form-group">

              <label>
                Observaciones de la orden
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

                placeholder={
                  "Agregá cualquier observación necesaria para esta orden..."
                }

                rows={4}
              />

            </div>

          </section>


          {/* =================================== */}
          {/* ACCIONES */}
          {/* =================================== */}

          <section>

            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "flex-end",

                flexWrap:
                  "wrap",

                gap:
                  "12px",
              }}
            >


              <button
                type="button"

                className="expedicion-remove-button"

                onClick={
                  () =>
                    navigate(
                      "/expedicion/ordenes"
                    )
                }
              >

                Cancelar

              </button>


              <button
                type="submit"

                className="btn-primary"

                disabled={
                  guardarMutation.isPending
                }
              >

                <Icon
                  name="plus"
                  size={16}
                />

                {
                  guardarMutation.isPending
                    ? "Creando orden..."
                    : "Crear orden"
                }

              </button>

            </div>

          </section>

        </form>

      </div>

    </div>

  );
}