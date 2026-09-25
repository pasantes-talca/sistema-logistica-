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
  Link,
  useParams,
} from "react-router-dom";

import {
  crearEntregaOrden,
  obtenerOrdenCarga,
} from "../api/expedicion";

import Icon from "../components/ui/Icon";
import "./Expedicion.css";


type CantidadesEntrega = {
  [productoId: number]: string;
};


function formatearFecha(
  fecha: string
) {

  if (!fecha) {
    return "—";
  }


  const [
    anio,
    mes,
    dia,
  ] =
    fecha.split("-");


  return `${dia}/${mes}/${anio}`;
}


function formatearFechaHora(
  fecha: string | null
) {

  if (!fecha) {
    return "—";
  }


  return new Date(
    fecha
  ).toLocaleString(
    "es-AR"
  );
}


function nombreEstado(
  estado: string
) {

  const estados:
    Record<string, string> = {

      RECIBIDA:
        "Recibida",

      CARGA_INICIADA:
        "Carga iniciada",

      PARCIAL:
        "Parcial",

      COMPLETA:
        "Completa",

      COMPLETA_CON_CAMBIO:
        "Completa con cambio",

      PENDIENTE_CONTROL:
        "Pendiente de control",

    };


  return (
    estados[estado]
    ??
    estado
  );
}


export default function DetalleOrdenExpedicionPage() {

  const params =
    useParams();


  const ordenId =
    Number(
      params.id
    );


  const queryClient =
    useQueryClient();


  const [
    cantidades,
    setCantidades,
  ] = useState<CantidadesEntrega>(
    {}
  );


  const [
    palletsSalida,
    setPalletsSalida,
  ] = useState("0");


  const [
    palletsEntrada,
    setPalletsEntrada,
  ] = useState("0");


  const [
    chapadurSalida,
    setChapadurSalida,
  ] = useState("0");


  const [
    chapadurEntrada,
    setChapadurEntrada,
  ] = useState("0");


  const [
    observaciones,
    setObservaciones,
  ] = useState("");


  const [
    justificacion,
    setJustificacion,
  ] = useState("");


  const {
    data: orden,
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "expedicion-orden",
      ordenId,
    ],

    queryFn:
      () =>
        obtenerOrdenCarga(
          ordenId
        ),

    enabled:
      Number.isFinite(
        ordenId
      ),

  });


  const entregadoPorProducto =
    useMemo(
      () => {

        const acumulado:
          Record<number, number> = {};


        if (!orden) {
          return acumulado;
        }


        for (
          const entrega
          of orden.entregas
        ) {

          for (
            const detalle
            of entrega.detalles
          ) {

            acumulado[
              detalle.producto
            ] =
              (
                acumulado[
                  detalle.producto
                ]
                ??
                0
              )
              +
              Number(
                detalle.cantidad_entregada
              );

          }

        }


        return acumulado;

      },
      [
        orden,
      ]
    );


  const pendientes =
    useMemo(
      () => {

        if (!orden) {
          return [];
        }


        return orden.detalles.map(
          detalle => {

            const solicitado =
              Number(
                detalle.cantidad_solicitada
              );


            const entregado =
              entregadoPorProducto[
                detalle.producto
              ]
              ??
              0;


            const pendiente =
              Math.max(
                solicitado
                -
                entregado,
                0
              );


            return {
              ...detalle,
              solicitado,
              entregado,
              pendiente,
            };

          }
        );

      },
      [
        orden,
        entregadoPorProducto,
      ]
    );


  const ordenCompleta =
    pendientes.length > 0
    &&
    pendientes.every(
      item =>
        item.pendiente <= 0
    );


  useEffect(
    () => {

      if (!orden) {
        return;
      }


      const inicial:
        CantidadesEntrega = {};


      for (
        const item
        of pendientes
      ) {

        inicial[
          item.producto
        ] = "";

      }


      setCantidades(
        inicial
      );

    },
    [
      orden?.id,
    ]
  );


  const registrarMutation =
    useMutation({

      mutationFn:
        (
          datos: {
            ordenId: number;
            payload: Parameters<
              typeof crearEntregaOrden
            >[1];
          }
        ) =>
          crearEntregaOrden(
            datos.ordenId,
            datos.payload
          ),


      onSuccess: async () => {

        await Promise.all([

          queryClient.invalidateQueries({
            queryKey: [
              "expedicion-orden",
              ordenId,
            ],
          }),

          queryClient.invalidateQueries({
            queryKey: [
              "expedicion-ordenes",
            ],
          }),

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

          queryClient.invalidateQueries({
            queryKey: [
              "expedicion-materiales",
            ],
          }),

        ]);


        setPalletsSalida("0");
        setPalletsEntrada("0");
        setChapadurSalida("0");
        setChapadurEntrada("0");

        setObservaciones("");
        setJustificacion("");


        alert(
          "Entrega registrada correctamente."
        );
      },


      onError: error => {

        alert(
          error instanceof Error
            ? error.message
            : (
                "No se pudo registrar "
                +
                "la entrega."
              )
        );
      },

    });


  function cambiarCantidad(
    productoId: number,
    valor: string
  ) {

    setCantidades(
      actual => ({
        ...actual,

        [productoId]:
          valor,
      })
    );
  }


  function registrarEntrega(
    event:
      React.FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    const detalles =
      pendientes
        .filter(
          item =>
            item.pendiente > 0
            &&
            Number(
              cantidades[
                item.producto
              ]
              ??
              0
            ) > 0
        )
        .map(
          item => ({

            producto_id:
              item.producto,

            cantidad_entregada:
              Number(
                cantidades[
                  item.producto
                ]
              ),

          })
        );


    if (
      detalles.length === 0
    ) {

      alert(
        "Ingresá al menos una cantidad entregada."
      );

      return;
    }


    for (
      const detalle
      of detalles
    ) {

      const producto =
        pendientes.find(
          item =>
            item.producto
            ===
            detalle.producto_id
        );


      if (
        producto
        &&
        detalle.cantidad_entregada
        >
        producto.pendiente
      ) {

        alert(
          (
            `No podés entregar más de `
            +
            `${producto.pendiente} unidades `
            +
            `del producto `
            +
            `${producto.codigo}.`
          )
        );

        return;
      }

    }


    registrarMutation.mutate({

      ordenId,

      payload: {

        pallets_salida:
          Number(
            palletsSalida
            ||
            0
          ),

        pallets_entrada:
          Number(
            palletsEntrada
            ||
            0
          ),

        chapadur_salida:
          Number(
            chapadurSalida
            ||
            0
          ),

        chapadur_entrada:
          Number(
            chapadurEntrada
            ||
            0
          ),

        observaciones:
          observaciones.trim(),

        justificacion_stock:
          justificacion.trim(),

        detalles,

      },

    });
  }


  if (
    isLoading
  ) {

    return (

      <div className="pagina">

        <div className="dashboard-container">
          Cargando orden...
        </div>

      </div>

    );
  }


  if (
    isError
    ||
    !orden
  ) {

    return (

      <div className="pagina">

        <div className="dashboard-container">

          No se pudo cargar
          la orden.

        </div>

      </div>

    );
  }


  return (

    <div className="pagina">

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
              Orden {orden.numero}
            </h1>


            <p>
              Consultá el avance de la orden
              y registrá las entregas reales
              realizadas.
            </p>

          </div>


          <div className="dashboard-status">

            <span />

            <div>

              <strong>
                {
                  nombreEstado(
                    orden.estado
                  )
                }
              </strong>

              <small>
                Estado actual
                de la orden
              </small>

            </div>

          </div>

        </div>


        {/* ===================================== */}
        {/* DATOS GENERALES */}
        {/* ===================================== */}

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


            <Link
              to="/expedicion/ordenes"
              className="modulo-link"
            >
              Volver a órdenes
            </Link>

          </div>


          <div className="dashboard-kpis">


            <div className="kpi-card">

              <div className="kpi-icon blue">

                <Icon
                  name="history"
                />

              </div>

              <div>

                <span>
                  Fecha
                </span>

                <strong>
                  {
                    formatearFecha(
                      orden.fecha
                    )
                  }
                </strong>

                <small>
                  Fecha de orden
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon green">

                <Icon
                  name="truck"
                />

              </div>

              <div>

                <span>
                  Fletero
                </span>

                <strong>
                  {
                    orden.fletero_nombre
                  }
                </strong>

                <small>
                  Transporte asignado
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon amber">

                <Icon
                  name="boxes"
                />

              </div>

              <div>

                <span>
                  Productos
                </span>

                <strong>
                  {
                    orden.detalles.length
                  }
                </strong>

                <small>
                  Productos solicitados
                </small>

              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon blue">

                <Icon
                  name="activity"
                />

              </div>

              <div>

                <span>
                  Entregas
                </span>

                <strong>
                  {
                    orden.entregas.length
                  }
                </strong>

                <small>
                  Entregas registradas
                </small>

              </div>

            </div>

          </div>

        </section>


        {/* ===================================== */}
        {/* PRODUCTOS */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                PRODUCTOS
              </span>

              <h2>
                Avance de la orden
              </h2>

            </div>

          </div>


          <div
            style={{
              overflowX:
                "auto",
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
                    Solicitado
                  </th>

                  <th>
                    Entregado
                  </th>

                  <th>
                    Pendiente
                  </th>

                </tr>

              </thead>


              <tbody>

                {
                  pendientes.map(
                    item => (

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
                            item.producto_nombre
                          }
                        </td>


                        <td>
                          {
                            item.solicitado
                              .toLocaleString(
                                "es-AR"
                              )
                          }
                        </td>


                        <td>
                          {
                            item.entregado
                              .toLocaleString(
                                "es-AR"
                              )
                          }
                        </td>


                        <td>

                          <strong>
                            {
                              item.pendiente
                                .toLocaleString(
                                  "es-AR"
                                )
                            }
                          </strong>

                        </td>

                      </tr>

                    )
                  )
                }

              </tbody>

            </table>

          </div>

        </section>


        {/* ===================================== */}
        {/* REGISTRAR ENTREGA */}
        {/* ===================================== */}

        {
          !ordenCompleta
          &&
          (

            <section>

              <div className="section-heading">

                <div>

                  <span>
                    ENTREGA
                  </span>

                  <h2>
                    Registrar entrega
                  </h2>

                </div>


                <small>
                  Solo se descontará
                  lo realmente entregado
                </small>

              </div>


              <form
                onSubmit={
                  registrarEntrega
                }
              >


                {/* PRODUCTOS */}

                <div
                  style={{
                    display:
                      "flex",

                    flexDirection:
                      "column",

                    gap:
                      "12px",
                  }}
                >

                  {
                    pendientes
                      .filter(
                        item =>
                          item.pendiente > 0
                      )
                      .map(
                        item => (

                          <div
                            key={
                              item.producto
                            }
                            className="expedicion-delivery-row"
                          >

                            <div>

                              <strong>
                                {
                                  item.codigo
                                }
                                {" - "}
                                {
                                  item.producto_nombre
                                }
                              </strong>

                              <div
                                style={{
                                  marginTop:
                                    "5px",

                                  fontSize:
                                    "12px",

                                  color:
                                    "#667085",
                                }}
                              >

                                Pendiente:
                                {" "}
                                {
                                  item.pendiente
                                    .toLocaleString(
                                      "es-AR"
                                    )
                                }

                              </div>

                            </div>


                            <div className="form-group">

                              <label>
                                Cantidad entregada
                              </label>


                              <input
                                type="number"
                                min="0"
                                max={
                                  item.pendiente
                                }
                                step="0.01"
                                value={
                                  cantidades[
                                    item.producto
                                  ]
                                  ??
                                  ""
                                }
                                onChange={
                                  event =>
                                    cambiarCantidad(
                                      item.producto,
                                      event.target.value
                                    )
                                }
                                placeholder={
                                  `Máx. ${item.pendiente}`
                                }
                              />

                            </div>

                          </div>

                        )
                      )
                  }

                </div>


                {/* MATERIALES */}

                <div
                  style={{
                    marginTop:
                      "28px",
                  }}
                >

                  <div className="section-heading">

                    <div>

                      <span>
                        MATERIALES
                      </span>

                      <h2>
                        Pallets y chapadur
                      </h2>

                    </div>

                  </div>


                  <div
                    className="expedicion-delivery-row"
                  >


                    <div className="form-group">

                      <label>
                        Pallets salida
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          palletsSalida
                        }
                        onChange={
                          event =>
                            setPalletsSalida(
                              event.target.value
                            )
                        }
                      />

                    </div>


                    <div className="form-group">

                      <label>
                        Pallets entrada
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          palletsEntrada
                        }
                        onChange={
                          event =>
                            setPalletsEntrada(
                              event.target.value
                            )
                        }
                      />

                    </div>


                    <div className="form-group">

                      <label>
                        Chapadur salida
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          chapadurSalida
                        }
                        onChange={
                          event =>
                            setChapadurSalida(
                              event.target.value
                            )
                        }
                      />

                    </div>


                    <div className="form-group">

                      <label>
                        Chapadur entrada
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          chapadurEntrada
                        }
                        onChange={
                          event =>
                            setChapadurEntrada(
                              event.target.value
                            )
                        }
                      />

                    </div>

                  </div>

                </div>


                {/* OBSERVACIONES */}

                <div
                  className="expedicion-delivery-row"
                >


                  <div className="form-group">

                    <label>
                      Observaciones
                    </label>

                    <textarea
                      rows={4}
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
                        "Observaciones de la entrega..."
                      }
                    />

                  </div>


                  <div className="form-group">

                    <label>
                      Justificación de stock
                    </label>

                    <textarea
                      rows={4}
                      value={
                        justificacion
                      }
                      onChange={
                        event =>
                          setJustificacion(
                            event.target.value
                          )
                      }
                      placeholder={
                        "Solo necesaria si el stock disponible no alcanza..."
                      }
                    />

                  </div>

                </div>


                <div
                  style={{
                    marginTop:
                      "24px",
                  }}
                >

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={
                      registrarMutation.isPending
                    }
                  >

                    {
                      registrarMutation.isPending
                        ? "Registrando..."
                        : "Confirmar entrega"
                    }

                  </button>

                </div>

              </form>

            </section>

          )
        }


        {/* ===================================== */}
        {/* HISTORIAL DE ENTREGAS */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                HISTORIAL
              </span>

              <h2>
                Entregas realizadas
              </h2>

            </div>


            <small>
              {
                orden.entregas.length
              }
              {" "}
              entregas
            </small>

          </div>


          {
            orden.entregas.length === 0
              ? (

                  <p>
                    Todavía no hay
                    entregas registradas.
                  </p>

                )
              : (

                  <div
                    style={{
                      overflowX:
                        "auto",
                    }}
                  >

                    <table>

                      <thead>

                        <tr>

                          <th>
                            Fecha
                          </th>

                          <th>
                            Productos
                          </th>

                          <th>
                            Pallets
                          </th>

                          <th>
                            Chapadur
                          </th>

                          <th>
                            Usuario
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {
                          orden.entregas.map(
                            entrega => (

                              <tr
                                key={
                                  entrega.id
                                }
                              >

                                <td>
                                  {
                                    formatearFechaHora(
                                      entrega.fecha
                                    )
                                  }
                                </td>


                                <td>

                                  {
                                    entrega.detalles.map(
                                      detalle => (

                                        <div
                                          key={
                                            detalle.id
                                          }
                                        >

                                          {
                                            detalle.codigo
                                          }
                                          {" · "}
                                          {
                                            Number(
                                              detalle
                                                .cantidad_entregada
                                            )
                                              .toLocaleString(
                                                "es-AR"
                                              )
                                          }

                                        </div>

                                      )
                                    )
                                  }

                                </td>


                                <td>

                                  Salida:
                                  {" "}
                                  {
                                    Number(
                                      entrega
                                        .pallets_salida
                                    )
                                      .toLocaleString(
                                        "es-AR"
                                      )
                                  }

                                  <br />

                                  Entrada:
                                  {" "}
                                  {
                                    Number(
                                      entrega
                                        .pallets_entrada
                                    )
                                      .toLocaleString(
                                        "es-AR"
                                      )
                                  }

                                </td>


                                <td>

                                  Salida:
                                  {" "}
                                  {
                                    Number(
                                      entrega
                                        .chapadur_salida
                                    )
                                      .toLocaleString(
                                        "es-AR"
                                      )
                                  }

                                  <br />

                                  Entrada:
                                  {" "}
                                  {
                                    Number(
                                      entrega
                                        .chapadur_entrada
                                    )
                                      .toLocaleString(
                                        "es-AR"
                                      )
                                  }

                                </td>


                                <td>
                                  {
                                    entrega
                                      .creado_por_nombre
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