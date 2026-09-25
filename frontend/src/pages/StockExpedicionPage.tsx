import {
  useState,
} from "react";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  crearMovimientoStock,
  obtenerMovimientosStock,
  obtenerStockExpedicion,
} from "../api/expedicion";

import {
  obtenerProductos,
} from "../api/logistica";

import Icon from "../components/ui/Icon";

import "./Expedicion.css";


type TipoMovimiento =
  | "INGRESO"
  | "AJUSTE"
  | "REBOTE"
  | "DERRAME";


type DireccionMovimiento =
  | "ENTRADA"
  | "SALIDA";


export default function StockExpedicionPage() {

  const queryClient =
    useQueryClient();


  const [
    productoId,
    setProductoId,
  ] = useState("");


  const [
    tipo,
    setTipo,
  ] = useState<TipoMovimiento>(
    "INGRESO"
  );


  const [
    direccion,
    setDireccion,
  ] = useState<DireccionMovimiento>(
    "ENTRADA"
  );


  const [
    cantidad,
    setCantidad,
  ] = useState("");


  const [
    referencia,
    setReferencia,
  ] = useState("");


  const [
    observaciones,
    setObservaciones,
  ] = useState("");


  // =========================================================
  // CONSULTAS
  // =========================================================

  const {
    data: stock = [],
    isLoading: cargandoStock,
    error: errorStock,
  } = useQuery({
    queryKey: [
      "expedicion-stock",
    ],

    queryFn:
      obtenerStockExpedicion,
  });


  const {
    data: movimientos = [],
    isLoading:
      cargandoMovimientos,
  } = useQuery({
    queryKey: [
      "expedicion-movimientos-stock",
    ],

    queryFn:
      obtenerMovimientosStock,
  });


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
  // GUARDAR MOVIMIENTO
  // =========================================================

  const guardarMutation =
    useMutation({

      mutationFn:
        crearMovimientoStock,

      onSuccess: async () => {

        await Promise.all([

          queryClient.invalidateQueries({
            queryKey: [
              "expedicion-stock",
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "expedicion-movimientos-stock",
            ],
          }),

        ]);


        setCantidad("");
        setReferencia("");
        setObservaciones("");


        alert(
          "Movimiento registrado correctamente."
        );
      },


      onError: error => {

        alert(
          error instanceof Error
            ? error.message
            : (
                "No se pudo registrar "
                + "el movimiento."
              )
        );
      },

    });


  function guardarMovimiento(
    event:
      React.FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    if (!productoId) {

      alert(
        "Seleccioná un producto."
      );

      return;
    }


    const cantidadNumero =
      Number(cantidad);


    if (
      !cantidadNumero
      ||
      cantidadNumero <= 0
    ) {

      alert(
        "Ingresá una cantidad mayor a cero."
      );

      return;
    }


    guardarMutation.mutate({

      producto_id:
        Number(productoId),

      tipo,

      direccion,

      cantidad:
        cantidadNumero,

      referencia:
        referencia.trim(),

      observaciones:
        observaciones.trim(),

    });
  }


  // =========================================================
  // CAMBIOS DE SELECT
  // =========================================================

  function cambiarTipo(
    valor: string
  ) {

    if (
      valor === "INGRESO"
      ||
      valor === "AJUSTE"
      ||
      valor === "REBOTE"
      ||
      valor === "DERRAME"
    ) {

      setTipo(
        valor
      );
    }
  }


  function cambiarDireccion(
    valor: string
  ) {

    if (
      valor === "ENTRADA"
      ||
      valor === "SALIDA"
    ) {

      setDireccion(
        valor
      );
    }
  }


  // =========================================================
  // ESTADO DEL STOCK
  // =========================================================

  function estadoStock(
    cantidadActual: number,
    minimo: number,
    critico: number
  ) {

    if (
      cantidadActual <= 0
    ) {

      return "Sin stock";
    }


    if (
      critico > 0
      &&
      cantidadActual <= critico
    ) {

      return "Crítico";
    }


    if (
      minimo > 0
      &&
      cantidadActual <= minimo
    ) {

      return "Bajo";
    }


    return "Normal";
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="pagina expedicion-page">

      <div className="contenedor-grande">


        {/* ===================================== */}
        {/* ENCABEZADO */}
        {/* ===================================== */}

        <div className="page-header">

          <div>

            <div className="badge-panel">

              <Icon
                name="boxes"
                size={16}
              />

              Expedición

            </div>


            <h1>
              Stock de productos
            </h1>


            <p>
              Consultá existencias y registrá
              ingresos, salidas y ajustes
              de mercadería.
            </p>

          </div>

        </div>


        {/* ===================================== */}
        {/* NUEVO MOVIMIENTO */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                MOVIMIENTO
              </span>

              <h2>
                Registrar movimiento
              </h2>

            </div>

          </div>


          <form
            onSubmit={
              guardarMovimiento
            }
          >

            <div className="form-grid">


              {/* PRODUCTO */}

              <div className="form-group">

                <label>
                  Producto
                </label>


                <select
                  value={
                    productoId
                  }

                  onChange={
                    event =>
                      setProductoId(
                        event.target.value
                      )
                  }

                  disabled={
                    cargandoProductos
                  }
                >

                  <option value="">
                    Seleccionar producto
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


              {/* TIPO */}

              <div className="form-group">

                <label>
                  Tipo de movimiento
                </label>


                <select
                  value={
                    tipo
                  }

                  onChange={
                    event =>
                      cambiarTipo(
                        event.target.value
                      )
                  }
                >

                  <option value="INGRESO">
                    Ingreso
                  </option>

                  <option value="AJUSTE">
                    Ajuste
                  </option>

                  <option value="REBOTE">
                    Rebote
                  </option>

                  <option value="DERRAME">
                    Derrame
                  </option>

                </select>

              </div>


              {/* DIRECCIÓN */}

              <div className="form-group">

                <label>
                  Dirección
                </label>


                <select
                  value={
                    direccion
                  }

                  onChange={
                    event =>
                      cambiarDireccion(
                        event.target.value
                      )
                  }
                >

                  <option value="ENTRADA">
                    Entrada
                  </option>

                  <option value="SALIDA">
                    Salida
                  </option>

                </select>

              </div>


              {/* CANTIDAD */}

              <div className="form-group">

                <label>
                  Cantidad
                </label>


                <input
                  type="number"

                  min="0.01"

                  step="0.01"

                  value={
                    cantidad
                  }

                  onChange={
                    event =>
                      setCantidad(
                        event.target.value
                      )
                  }

                  placeholder="Ej: 500"
                />

              </div>


              {/* REFERENCIA */}

              <div className="form-group">

                <label>
                  Referencia
                </label>


                <input
                  type="text"

                  value={
                    referencia
                  }

                  onChange={
                    event =>
                      setReferencia(
                        event.target.value
                      )
                  }

                  placeholder={
                    "Ej: INGRESO-PLANTA"
                  }
                />

              </div>


              {/* OBSERVACIONES */}

              <div className="form-group">

                <label>
                  Observaciones
                </label>


                <input
                  type="text"

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
                    "Observación opcional"
                  }
                />

              </div>

            </div>


            <div
              style={{
                marginTop: "20px",
              }}
            >

              <button
                type="submit"

                className="btn-primary"

                disabled={
                  guardarMutation.isPending
                }
              >

                {
                  guardarMutation.isPending
                    ? "Guardando..."
                    : "Registrar movimiento"
                }

              </button>

            </div>

          </form>

        </section>


        {/* ===================================== */}
        {/* STOCK ACTUAL */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                STOCK
              </span>


              <h2>
                Existencias actuales
              </h2>

            </div>


            <small>

              {
                stock.length
              }

              {" "}

              productos controlados

            </small>

          </div>


          {
            cargandoStock
              ? (

                  <p>
                    Cargando stock...
                  </p>

                )
              : errorStock
                ? (

                    <p>
                      No se pudo cargar
                      el stock.
                    </p>

                  )
                : stock.length === 0
                  ? (

                      <p>
                        Todavía no hay productos
                        con movimientos de stock.
                      </p>

                    )
                  : (

                      <div
                        style={{
                          overflowX: "auto",
                        }}
                      >

                        <table>

                          <thead>

                            <tr>

                              <th>
                                Código
                              </th>

                              <th>
                                Producto
                              </th>

                              <th>
                                Stock actual
                              </th>

                              <th>
                                Stock mínimo
                              </th>

                              <th>
                                Stock crítico
                              </th>

                              <th>
                                Estado
                              </th>

                            </tr>

                          </thead>


                          <tbody>

                            {
                              stock.map(
                                item => {

                                  const actual =
                                    Number(
                                      item
                                        .cantidad_unidades
                                    );


                                  const minimo =
                                    Number(
                                      item
                                        .stock_minimo
                                    );


                                  const critico =
                                    Number(
                                      item
                                        .stock_critico
                                    );


                                  return (

                                    <tr
                                      key={
                                        item.id
                                      }
                                    >

                                      <td>

                                        <strong>

                                          {
                                            item.codigo
                                          }

                                        </strong>

                                      </td>


                                      <td>

                                        {
                                          item.producto
                                        }

                                      </td>


                                      <td>

                                        {
                                          actual
                                            .toLocaleString(
                                              "es-AR"
                                            )
                                        }

                                      </td>


                                      <td>

                                        {
                                          minimo
                                            .toLocaleString(
                                              "es-AR"
                                            )
                                        }

                                      </td>


                                      <td>

                                        {
                                          critico
                                            .toLocaleString(
                                              "es-AR"
                                            )
                                        }

                                      </td>


                                      <td>

                                        {
                                          estadoStock(
                                            actual,
                                            minimo,
                                            critico
                                          )
                                        }

                                      </td>

                                    </tr>

                                  );

                                }
                              )
                            }

                          </tbody>

                        </table>

                      </div>

                    )
          }

        </section>


        {/* ===================================== */}
        {/* ÚLTIMOS MOVIMIENTOS */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                HISTORIAL
              </span>


              <h2>
                Últimos movimientos
              </h2>

            </div>

          </div>


          {
            cargandoMovimientos
              ? (

                  <p>
                    Cargando movimientos...
                  </p>

                )
              : movimientos.length === 0
                ? (

                    <p>
                      Todavía no hay
                      movimientos registrados.
                    </p>

                  )
                : (

                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >

                      <table>

                        <thead>

                          <tr>

                            <th>
                              Fecha
                            </th>

                            <th>
                              Producto
                            </th>

                            <th>
                              Tipo
                            </th>

                            <th>
                              Dirección
                            </th>

                            <th>
                              Cantidad
                            </th>

                            <th>
                              Referencia
                            </th>

                          </tr>

                        </thead>


                        <tbody>

                          {
                            movimientos
                              .slice(
                                0,
                                10
                              )
                              .map(
                                movimiento => (

                                  <tr
                                    key={
                                      movimiento.id
                                    }
                                  >

                                    <td>

                                      {
                                        new Date(
                                          movimiento
                                            .creado_en
                                        )
                                          .toLocaleString(
                                            "es-AR"
                                          )
                                      }

                                    </td>


                                    <td>

                                      {
                                        movimiento.codigo
                                      }

                                      {" - "}

                                      {
                                        movimiento
                                          .producto_nombre
                                      }

                                    </td>


                                    <td>

                                      {
                                        movimiento.tipo
                                      }

                                    </td>


                                    <td>

                                      {
                                        movimiento
                                          .direccion
                                      }

                                    </td>


                                    <td>

                                      {
                                        Number(
                                          movimiento
                                            .cantidad
                                        )
                                          .toLocaleString(
                                            "es-AR"
                                          )
                                      }

                                    </td>


                                    <td>

                                      {
                                        movimiento
                                          .referencia
                                        ||
                                        "—"
                                      }

                                    </td>

                                  </tr>

                                )
                              )
                          }

                        </tbody>

                      </table>

                    </div>

                  )
          }

        </section>

      </div>

    </div>
  );
}