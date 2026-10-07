import {
  useEffect,
  useMemo,
  useRef,
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
  actualizarOrdenCarga,
  crearFletero,
  crearOrdenCarga,
  obtenerFleteros,
  obtenerOrdenCarga,
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

  const params = useParams();
  const ordenId = Number(params.id);
  const editando = Number.isInteger(ordenId) && ordenId > 0;


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

  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [mostrarNuevoFletero, setMostrarNuevoFletero] = useState(false);
  const [nuevoFleteroNombre, setNuevoFleteroNombre] = useState("");
  const [nuevoFleteroApellido, setNuevoFleteroApellido] = useState("");
  const [nuevoFleteroEmpresa, setNuevoFleteroEmpresa] = useState("");
  const selectProductoRefs = useRef<Array<HTMLSelectElement | null>>([]);


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

  const { data: ordenExistente } = useQuery({
    queryKey: ["expedicion-orden", ordenId],
    queryFn: () => obtenerOrdenCarga(ordenId),
    enabled: editando,
  });

  useEffect(() => {
    if (!ordenExistente) return;
    const cargarFormulario = window.setTimeout(() => {
      setNumero(ordenExistente.numero);
      setFecha(ordenExistente.fecha);
      setFleteroId(String(ordenExistente.fletero));
      setObservaciones(ordenExistente.observaciones);
      setProductosOrden(
        ordenExistente.detalles.map(detalle => ({
          productoId: String(detalle.producto),
          cantidad: String(Number(detalle.cantidad_solicitada)),
        }))
      );
    }, 0);
    return () => window.clearTimeout(cargarFormulario);
  }, [ordenExistente]);

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
        (datos: Parameters<typeof crearOrdenCarga>[0]) =>
          editando
            ? actualizarOrdenCarga(ordenId, datos)
            : crearOrdenCarga(datos),

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
          `Orden ${orden.numero} ${editando ? "actualizada" : "creada"} correctamente.`
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

  const crearFleteroMutation = useMutation({
    mutationFn: crearFletero,
    onSuccess: async fletero => {
      await queryClient.invalidateQueries({ queryKey: ["expedicion-fleteros"] });
      setFleteroId(String(fletero.id));
      setNuevoFleteroNombre("");
      setNuevoFleteroApellido("");
      setNuevoFleteroEmpresa("");
      setMostrarNuevoFletero(false);
    },
    onError: error => alert(error instanceof Error ? error.message : "No se pudo registrar el fletero."),
  });

  const productosOrdenados = useMemo(
    () => [...productos].sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "es", { numeric: true })
    ),
    [productos]
  );

  const productosFiltrados = useMemo(() => {
    const termino = busquedaProducto.trim().toLocaleLowerCase("es");
    if (!termino) return productosOrdenados;
    return productosOrdenados.filter(producto =>
      `${producto.codigo} ${producto.nombre} ${producto.presentacion} ${producto.sabor}`
        .toLocaleLowerCase("es")
        .includes(termino)
    );
  }, [busquedaProducto, productosOrdenados]);

  function productosVisiblesPara(productoId: string) {
    if (!productoId) return productosFiltrados;
    const seleccionado = productosOrdenados.find(
      producto => String(producto.id) === productoId
    );
    if (!seleccionado || productosFiltrados.some(producto => producto.id === seleccionado.id)) {
      return productosFiltrados;
    }
    return [seleccionado, ...productosFiltrados];
  }

  const esTrillay = useMemo(() => {
    const seleccionado = fleteros.find(item => String(item.id) === fleteroId);
    return `${seleccionado?.nombre ?? ""} ${seleccionado?.apellido ?? ""} ${seleccionado?.empresa ?? ""}`
      .toLocaleLowerCase("es")
      .includes("trillay");
  }, [fleteroId, fleteros]);


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


  function ordenarProductosYContinuar() {
    const codigos = new Map(
      productos.map(producto => [String(producto.id), producto.codigo])
    );

    setProductosOrden(actuales => {
      const completas = actuales
        .filter(item => item.productoId)
        .sort((a, b) =>
          (codigos.get(a.productoId) ?? "").localeCompare(
            codigos.get(b.productoId) ?? "",
            "es",
            { numeric: true }
          )
        );
      const vacias = actuales.filter(item => !item.productoId);
      return [...completas, ...(vacias.length ? vacias : [{ productoId: "", cantidad: "" }])];
    });

    window.setTimeout(() => {
      const referencias = selectProductoRefs.current;
      referencias[referencias.length - 1]?.focus();
    }, 0);
  }


  function manejarEnterFormulario(
    event: React.KeyboardEvent<HTMLFormElement>
  ) {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.dataset.enterCantidad === "true") return;
    event.preventDefault();
  }


  function guardarNuevoFletero() {
    if (!nuevoFleteroNombre.trim()) {
      alert("Ingresá el nombre del fletero.");
      return;
    }
    crearFleteroMutation.mutate({
      nombre: nuevoFleteroNombre.trim(),
      apellido: nuevoFleteroApellido.trim(),
      empresa: nuevoFleteroEmpresa.trim(),
      activo: true,
    });
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
              {editando ? "Editar orden de carga" : "Nueva orden de carga"}
            </h1>


            <p>
              {editando ? "Actualizá la orden," : "Registrá una nueva orden,"}
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
          onKeyDown={manejarEnterFormulario}
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

                <button
                  type="button"
                  className="expedicion-inline-action"
                  onClick={() => setMostrarNuevoFletero(valor => !valor)}
                >
                  <Icon name="plus" size={15} />
                  {mostrarNuevoFletero ? "Cancelar alta" : "Registrar nuevo fletero"}
                </button>

              </div>

            </div>

            {mostrarNuevoFletero && (
              <div className="expedicion-inline-form">
                <div className="form-group"><label>Nombre *</label><input value={nuevoFleteroNombre} onChange={event => setNuevoFleteroNombre(event.target.value)} placeholder="Nombre" /></div>
                <div className="form-group"><label>Apellido</label><input value={nuevoFleteroApellido} onChange={event => setNuevoFleteroApellido(event.target.value)} placeholder="Apellido" /></div>
                <div className="form-group"><label>Empresa</label><input value={nuevoFleteroEmpresa} onChange={event => setNuevoFleteroEmpresa(event.target.value)} placeholder="Empresa" /></div>
                <button type="button" className="btn-primary" onClick={guardarNuevoFletero} disabled={crearFleteroMutation.isPending}>{crearFleteroMutation.isPending ? "Guardando..." : "Guardar fletero"}</button>
              </div>
            )}

            {esTrillay && <div className="expedicion-info"><Icon name="activity" size={17}/><div><strong>Formato de cantidades Trillay</strong><span>Usá números enteros para packs completos y decimales para botellas sueltas. Ejemplo: 5.3 representa 5 packs y 3 botellas.</span></div></div>}

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

            <div className="expedicion-product-search">
              <Icon name="package" size={18}/>
              <input type="search" value={busquedaProducto} onChange={event => setBusquedaProducto(event.target.value)} placeholder="Buscar producto por código, nombre, sabor o presentación..." />
              <span>{productosFiltrados.length} productos</span>
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
                          ref={elemento => { selectProductoRefs.current[index] = elemento; }}
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
                            productosVisiblesPara(fila.productoId).map(
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

                          data-enter-cantidad="true"

                          onKeyDown={event => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              ordenarProductosYContinuar();
                            }
                          }}

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

                        {esTrillay && <small className="expedicion-field-help">Enteros: packs · Decimales: botellas sueltas</small>}

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
                    ? (editando ? "Guardando cambios..." : "Creando orden...")
                    : (editando ? "Guardar cambios" : "Crear orden")
                }

              </button>

            </div>

          </section>

        </form>

      </div>

    </div>

  );
}
