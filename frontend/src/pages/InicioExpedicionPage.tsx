import {
  Link,
} from "react-router-dom";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerMovimientosMaterial,
  obtenerMovimientosStock,
  obtenerOrdenesCarga,
  obtenerStockExpedicion,
} from "../api/expedicion";

import Icon, {
  type IconName,
} from "../components/ui/Icon";

import "./Expedicion.css";

type KpiExpedicion = {
  label: string;
  value: number | string;
  icon: IconName;
  tone: string;
};


type ModuloExpedicion = {
  title: string;
  description: string;
  icon: IconName;
  tone: string;
  home: string;

  links: {
    to: string;
    label: string;
  }[];
};


export default function InicioExpedicionPage() {

  const {
    data: ordenes = [],
    isLoading:
      cargandoOrdenes,
  } = useQuery({

    queryKey: [
      "expedicion-ordenes",
    ],

    queryFn:
      obtenerOrdenesCarga,

  });


  const {
    data: stock = [],
    isLoading:
      cargandoStock,
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
    data: materiales = [],
    isLoading:
      cargandoMateriales,
  } = useQuery({

    queryKey: [
      "expedicion-materiales",
    ],

    queryFn:
      obtenerMovimientosMaterial,

  });


  const ordenesPendientes =
    ordenes.filter(
      orden =>
        orden.estado !== "COMPLETA"
        &&
        orden.estado !==
          "COMPLETA_CON_CAMBIO"
    );


  const productosSinStock =
    stock.filter(
      item =>
        Number(
          item.cantidad_unidades
        ) <= 0
    );


  const kpis:
    KpiExpedicion[] = [

      {
        label:
          "Órdenes registradas",

        value:
          cargandoOrdenes
            ? "—"
            : ordenes.length,

        icon:
          "truck",

        tone:
          "blue",
      },

      {
        label:
          "Órdenes pendientes",

        value:
          cargandoOrdenes
            ? "—"
            : ordenesPendientes.length,

        icon:
          "history",

        tone:
          "amber",
      },

      {
        label:
          "Productos controlados",

        value:
          cargandoStock
            ? "—"
            : stock.length,

        icon:
          "boxes",

        tone:
          "green",
      },

      {
        label:
          "Productos sin stock",

        value:
          cargandoStock
            ? "—"
            : productosSinStock.length,

        icon:
          "alert",

        tone:
          "amber",
      },

      {
        label:
          "Movimientos de stock",

        value:
          cargandoMovimientos
            ? "—"
            : movimientos.length,

        icon:
          "activity",

        tone:
          "blue",
      },

      {
        label:
          "Movimientos de materiales",

        value:
          cargandoMateriales
            ? "—"
            : materiales.length,

        icon:
          "boxes",

        tone:
          "green",
      },

    ];


  const modules:
    ModuloExpedicion[] = [

      {
        title:
          "Órdenes de carga",

        description:
          (
            "Gestioná pedidos, entregas reales, "
            +
            "estados y cantidades despachadas."
          ),

        icon:
          "truck",

        tone:
          "blue",

        home:
          "/expedicion/ordenes",

        links: [
          {
            to:
              "/expedicion/ordenes",

            label:
              "Ver órdenes",
          },
        ],
      },

      {
        title:
          "Stock de productos",

        description:
          (
            "Consultá existencias y registrá "
            +
            "ingresos, salidas y ajustes."
          ),

        icon:
          "boxes",

        tone:
          "green",

        home:
          "/expedicion/stock",

        links: [
          {
            to:
              "/expedicion/stock",

            label:
              "Ver stock",
          },
        ],
      },

      {
        title:
          "Movimientos",

        description:
          (
            "Revisá el historial completo de "
            +
            "movimientos de mercadería."
          ),

        icon:
          "history",

        tone:
          "navy",

        home:
          "/expedicion/movimientos",

        links: [
          {
            to:
              "/expedicion/movimientos",

            label:
              "Ver movimientos",
          },
        ],
      },

      {
        title:
          "Fleteros",

        description:
          (
            "Administrá los fleteros utilizados "
            +
            "en las órdenes de carga."
          ),

        icon:
          "truck",

        tone:
          "blue",

        home:
          "/expedicion/fleteros",

        links: [
          {
            to:
              "/expedicion/fleteros",

            label:
              "Ver fleteros",
          },
        ],
      },

      {
        title:
          "Pallets y chapadur",

        description:
          (
            "Controlá salidas, devoluciones "
            +
            "y saldos de materiales."
          ),

        icon:
          "boxes",

        tone:
          "green",

        home:
          "/expedicion/materiales",

        links: [
          {
            to:
              "/expedicion/materiales",

            label:
              "Ver materiales",
          },
        ],
      },

    ];


  return (

    <div className="pagina">

      <div className="dashboard-container">


        {/* ===================================== */}
        {/* BIENVENIDA */}
        {/* ===================================== */}

        <div className="dashboard-bienvenida">

          <div>

            <div className="badge-panel">

              <Icon
                name="boxes"
                size={16}
              />

              Expedición

            </div>


            <h1>
              Gestión de Expedición
            </h1>


            <p>
              Controlá órdenes de carga,
              stock de productos, fleteros,
              pallets y chapadur desde
              un único módulo.
            </p>

          </div>


          <div className="dashboard-status">

            <span />

            <div>

              <strong>
                Módulo operativo
              </strong>

              <small>
                Datos sincronizados
                con PostgreSQL
              </small>

            </div>

          </div>

        </div>


        {/* ===================================== */}
        {/* RESUMEN */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                RESUMEN GENERAL
              </span>

              <h2>
                Estado actual
              </h2>

            </div>


            <small>
              Información registrada
              en Expedición
            </small>

          </div>


          <div className="dashboard-kpis">

            {
              kpis.map(
                kpi => (

                  <div
                    className="kpi-card"
                    key={
                      kpi.label
                    }
                  >

                    <div
                      className={
                        `kpi-icon ${kpi.tone}`
                      }
                    >

                      <Icon
                        name={
                          kpi.icon
                        }
                      />

                    </div>


                    <div>

                      <span>
                        {
                          kpi.label
                        }
                      </span>

                      <strong>
                        {
                          kpi.value
                        }
                      </strong>

                      <small>
                        Datos actuales
                      </small>

                    </div>

                  </div>

                )
              )
            }

          </div>

        </section>


        {/* ===================================== */}
        {/* MÓDULOS */}
        {/* ===================================== */}

        <section>

          <div className="section-heading">

            <div>

              <span>
                OPERACIÓN
              </span>

              <h2>
                Gestión de Expedición
              </h2>

            </div>


            <small>
              Seleccioná una sección
              para comenzar
            </small>

          </div>


          <div className="grid-modulos">

            {
              modules.map(
                module => (

                  <article
                    className={
                      `modulo-card module-${module.tone}`
                    }
                    key={
                      module.title
                    }
                  >

                    <div className="module-card-top">

                      <div className="module-icon">

                        <Icon
                          name={
                            module.icon
                          }
                          size={27}
                        />

                      </div>


                      <span>
                        Expedición
                      </span>

                    </div>


                    <h3>
                      {
                        module.title
                      }
                    </h3>


                    <p>
                      {
                        module.description
                      }
                    </p>


                    <div className="modulo-links">

                      {
                        module.links.map(
                          link => (

                            <Link
                              className="modulo-link"
                              to={
                                link.to
                              }
                              key={
                                link.to
                              }
                            >

                              {
                                link.label
                              }

                            </Link>

                          )
                        )
                      }

                    </div>


                    <Link
                      className="module-enter"
                      to={
                        module.home
                      }
                    >

                      Ingresar

                      <Icon
                        name="chevron"
                        size={17}
                      />

                    </Link>

                  </article>

                )
              )
            }

          </div>

        </section>

      </div>

    </div>

  );
}