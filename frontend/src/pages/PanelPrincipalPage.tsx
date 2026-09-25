import {
  Link,
} from "react-router-dom";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerRepartos,
  obtenerRechazos,
  obtenerRecibosCambio,
  obtenerUsuarioActual,
  obtenerViaticos,
} from "../api/logistica";

import {
  obtenerFleteros,
  obtenerMovimientosMaterial,
  obtenerMovimientosStock,
  obtenerOrdenesCarga,
  obtenerStockExpedicion,
} from "../api/expedicion";

import Icon, {
  type IconName,
} from "../components/ui/Icon";

import "./PanelPrincipalPage.css";


type ModuleItem = {
  title: string;
  description: string;
  icon: IconName;
  tone: string;
  home?: string;
  externalUrl?: string;

  links?: {
    to: string;
    label: string;
  }[];

  external?: boolean;
  permiso: string;
};


type KpiItem = {
  label: string;
  value: number | string;
  icon: IconName;
  tone: string;
  description: string;
};


export default function PanelPrincipalPage() {

  // =========================================================
  // USUARIO
  // =========================================================

  const {
    data: usuario,
    isLoading: cargandoUsuario,
  } = useQuery({

    queryKey: [
      "usuario-actual",
    ],

    queryFn:
      obtenerUsuarioActual,

    retry:
      false,

  });


  const nombre =
    usuario?.nombre_completo
    ||
    usuario?.username
    ||
    "Usuario";


  const esSuperusuario =
    usuario?.es_superusuario
    ??
    false;


  const grupos =
    usuario?.grupos
    ??
    [];


  function tienePermiso(
    permiso: string
  ) {

    if (
      esSuperusuario
    ) {

      return true;
    }


    return grupos.includes(
      permiso
    );
  }


  // =========================================================
  // PERMISOS GENERALES
  // =========================================================

  const puedeRepartos =
    tienePermiso(
      "REPARTOS"
    );


  const puedeRechazos =
    tienePermiso(
      "RECHAZOS"
    );


  const puedeCambios =
    tienePermiso(
      "CAMBIOS"
    );


  const puedeViaticos =
    tienePermiso(
      "VIATICOS"
    );


  const puedeKilometrajes =
    tienePermiso(
      "KILOMETRAJES"
    );


  const puedeControlDiario =
    tienePermiso(
      "CONTROL_DIARIO"
    );


  const puedeExpedicion =
    tienePermiso(
      "EXPEDICION"
    );


  const puedeStockPallets =
    esSuperusuario
    ||
    grupos.includes(
      "CAMBIOS"
    );


  const puedeVerLogistica =
    puedeRepartos
    ||
    puedeRechazos
    ||
    puedeCambios
    ||
    puedeViaticos
    ||
    puedeKilometrajes
    ||
    puedeControlDiario
    ||
    puedeStockPallets;


  // =========================================================
  // DATOS DE LOGÍSTICA
  // =========================================================

  const {
    data: repartos = [],
    isLoading:
      cargandoRepartos,
  } = useQuery({

    queryKey: [
      "repartos",
    ],

    queryFn:
      obtenerRepartos,

    enabled:
      puedeRepartos,
  });


  const {
    data: rechazos = [],
    isLoading:
      cargandoRechazos,
  } = useQuery({

    queryKey: [
      "rechazos",
    ],

    queryFn:
      obtenerRechazos,

    enabled:
      puedeRechazos,
  });


  const {
    data: recibos = [],
    isLoading:
      cargandoRecibos,
  } = useQuery({

    queryKey: [
      "recibos-cambio",
    ],

    queryFn:
      obtenerRecibosCambio,

    enabled:
      puedeCambios,
  });


  const {
    data: viaticos = [],
    isLoading:
      cargandoViaticos,
  } = useQuery({

    queryKey: [
      "viaticos",
    ],

    queryFn:
      obtenerViaticos,

    enabled:
      puedeViaticos,
  });


  // =========================================================
  // DATOS DE EXPEDICIÓN
  // =========================================================

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

    enabled:
      puedeExpedicion,
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

    enabled:
      puedeExpedicion,
  });


  const {
    data: movimientosStock = [],
    isLoading:
      cargandoMovimientosStock,
  } = useQuery({

    queryKey: [
      "expedicion-movimientos-stock",
    ],

    queryFn:
      obtenerMovimientosStock,

    enabled:
      puedeExpedicion,
  });


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

    enabled:
      puedeExpedicion,
  });


  const {
    data: movimientosMaterial = [],
    isLoading:
      cargandoMaterial,
  } = useQuery({

    queryKey: [
      "expedicion-materiales",
    ],

    queryFn:
      obtenerMovimientosMaterial,

    enabled:
      puedeExpedicion,
  });


  // =========================================================
  // CÁLCULOS EXPEDICIÓN
  // =========================================================

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


  const fleterosActivos =
    fleteros.filter(
      fletero =>
        fletero.activo
    );


  // =========================================================
  // KPIS LOGÍSTICA
  // =========================================================

  const kpisLogistica:
    KpiItem[] = [];


  if (
    puedeRepartos
  ) {

    kpisLogistica.push({

      label:
        "Repartos",

      value:
        cargandoRepartos
          ? "—"
          : repartos.length,

      icon:
        "truck",

      tone:
        "blue",

      description:
        "Repartos registrados",

    });
  }


  if (
    puedeRechazos
  ) {

    kpisLogistica.push({

      label:
        "Rechazos",

      value:
        cargandoRechazos
          ? "—"
          : rechazos.length,

      icon:
        "alert",

      tone:
        "amber",

      description:
        "Entregas no concretadas",

    });
  }


  if (
    puedeCambios
  ) {

    kpisLogistica.push({

      label:
        "Recibos de cambios",

      value:
        cargandoRecibos
          ? "—"
          : recibos.length,

      icon:
        "boxes",

      tone:
        "green",

      description:
        "Recibos registrados",

    });
  }


  if (
    puedeViaticos
  ) {

    kpisLogistica.push({

      label:
        "Viáticos",

      value:
        cargandoViaticos
          ? "—"
          : viaticos.length,

      icon:
        "activity",

      tone:
        "navy",

      description:
        "Registros cargados",

    });
  }


  // =========================================================
  // KPIS EXPEDICIÓN
  // =========================================================

  const kpisExpedicion:
    KpiItem[] = [

      {
        label:
          "Órdenes",

        value:
          cargandoOrdenes
            ? "—"
            : ordenes.length,

        icon:
          "truck",

        tone:
          "blue",

        description:
          "Órdenes registradas",
      },

      {
        label:
          "Pendientes",

        value:
          cargandoOrdenes
            ? "—"
            : ordenesPendientes.length,

        icon:
          "history",

        tone:
          "amber",

        description:
          "Órdenes por completar",
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

        description:
          "Productos con stock",
      },

      {
        label:
          "Sin stock",

        value:
          cargandoStock
            ? "—"
            : productosSinStock.length,

        icon:
          "alert",

        tone:
          "red",

        description:
          "Productos sin existencias",
      },

      {
        label:
          "Movimientos",

        value:
          cargandoMovimientosStock
            ? "—"
            : movimientosStock.length,

        icon:
          "activity",

        tone:
          "navy",

        description:
          "Movimientos de stock",
      },

      {
        label:
          "Fleteros activos",

        value:
          cargandoFleteros
            ? "—"
            : fleterosActivos.length,

        icon:
          "truck",

        tone:
          "green",

        description:
          "Disponibles para cargas",
      },

    ];


  // =========================================================
  // MÓDULOS LOGÍSTICA
  // =========================================================

  const modulosLogistica:
    ModuleItem[] = [

      {
        title:
          "Repartos y recargas",

        description:
          (
            "Planificá salidas, asigná personal "
            +
            "y consultá las recargas de cada equipo."
          ),

        icon:
          "truck",

        tone:
          "blue",

        permiso:
          "REPARTOS",

        home:
          "/repartos/inicio",

        links: [
          {
            to:
              "/repartos/nuevo",

            label:
              "Nuevo reparto",
          },
          {
            to:
              "/repartos",

            label:
              "Historial",
          },
        ],
      },


      {
        title:
          "Rechazos",

        description:
          (
            "Registrá entregas no concretadas "
            +
            "y analizá sus principales motivos."
          ),

        icon:
          "alert",

        tone:
          "amber",

        permiso:
          "RECHAZOS",

        home:
          "/rechazos/inicio",

        links: [
          {
            to:
              "/rechazos/nuevo",

            label:
              "Nuevo rechazo",
          },
          {
            to:
              "/rechazos/estadisticas",

            label:
              "Estadísticas",
          },
        ],
      },


      {
        title:
          "Recibos de cambios",

        description:
          (
            "Controlá devoluciones, productos, "
            +
            "pallets y movimientos."
          ),

        icon:
          "boxes",

        tone:
          "green",

        permiso:
          "CAMBIOS",

        home:
          "/cambios/inicio",

        links: [
          {
            to:
              "/cambios/nuevo",

            label:
              "Nuevo recibo",
          },
          {
            to:
              "/cambios",

            label:
              "Historial",
          },
        ],
      },


      {
        title:
          "Viáticos",

        description:
          (
            "Registrá y consultá viáticos locales "
            +
            "y de larga distancia."
          ),

        icon:
          "activity",

        tone:
          "navy",

        permiso:
          "VIATICOS",

        home:
          "/viaticos/inicio",

        links: [
          {
            to:
              "/viaticos/nuevo",

            label:
              "Nuevo registro",
          },
          {
            to:
              "/viaticos/resumen",

            label:
              "Resumen anual",
          },
        ],
      },


      {
        title:
          "Kilometrajes",

        description:
          (
            "Registrá y consultá los kilómetros "
            +
            "recorridos por chofer y destino."
          ),

        icon:
          "truck",

        tone:
          "blue",

        permiso:
          "KILOMETRAJES",

        home:
          "/kilometrajes/inicio",

        links: [
          {
            to:
              "/kilometrajes/nuevo",

            label:
              "Nuevo control",
          },
          {
            to:
              "/kilometrajes",

            label:
              "Historial",
          },
        ],
      },


      {
        title:
          "Control diario",

        description:
          (
            "Gestioná disponibilidad, asignaciones, "
            +
            "stock de depósitos y distribución diaria."
          ),

        icon:
          "boxes",

        tone:
          "blue",

        permiso:
          "CONTROL_DIARIO",

        home:
          "/control-diario/inicio",

        links: [
          {
            to:
              "/control-diario/nuevo",

            label:
              "Nueva carga",
          },
          {
            to:
              "/control-diario",

            label:
              "Historial",
          },
        ],
      },

    ];


  const modulosLogisticaVisibles =
    modulosLogistica.filter(
      modulo =>
        tienePermiso(
          modulo.permiso
        )
    );


  // =========================================================
  // MÓDULOS EXPEDICIÓN
  // =========================================================

  const modulosExpedicion:
    ModuleItem[] = [

      {
        title:
          "Órdenes de carga",

        description:
          (
            "Gestioná órdenes, productos solicitados "
            +
            "y entregas realizadas."
          ),

        icon:
          "truck",

        tone:
          "blue",

        permiso:
          "EXPEDICION",

        home:
          "/expedicion/ordenes",

        links: [
          {
            to:
              "/expedicion/ordenes/nueva",

            label:
              "Nueva orden",
          },
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
          "Stock",

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

        permiso:
          "EXPEDICION",

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
            "Consultá el historial de movimientos "
            +
            "generados sobre los productos."
          ),

        icon:
          "history",

        tone:
          "navy",

        permiso:
          "EXPEDICION",

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
            "Administrá los fleteros disponibles "
            +
            "para las órdenes de carga."
          ),

        icon:
          "truck",

        tone:
          "blue",

        permiso:
          "EXPEDICION",

        home:
          "/expedicion/fleteros",

        links: [
          {
            to:
              "/expedicion/fleteros",

            label:
              "Administrar",
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

        permiso:
          "EXPEDICION",

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


  // =========================================================
  // CARGANDO USUARIO
  // =========================================================

  if (
    cargandoUsuario
  ) {

    return (

      <div className="pagina">

        <div className="dashboard-container">

          Cargando panel...

        </div>

      </div>

    );
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="pagina panel-principal-page">

      <div className="dashboard-container">


        {/* ===================================== */}
        {/* CABECERA GENERAL */}
        {/* ===================================== */}

        <div className="panel-hero">

          <div>

            <div className="badge-panel">

              <Icon
                name="activity"
                size={16}
              />

              Panel operativo

            </div>


            <h1>
              Bienvenido, {nombre}
            </h1>


            <p>
              Accedé a las áreas de Logística
              y Expedición desde un único panel
              de gestión.
            </p>

          </div>


          <div className="panel-hero-status">

            <span />

            <div>

              <strong>
                Plataforma disponible
              </strong>

              <small>
                Sistema operativo Talca
              </small>

            </div>

          </div>

        </div>


        {/* ===================================== */}
        {/* ACCESO RÁPIDO */}
        {/* ===================================== */}

        <div className="panel-area-selector">


          {
            puedeVerLogistica
            &&
            (

              <a
                href="#logistica"
                className="
                  panel-area-button
                  panel-area-logistica
                "
              >

                <div className="panel-area-icon">

                  <Icon
                    name="truck"
                    size={24}
                  />

                </div>


                <div>

                  <strong>
                    Logística
                  </strong>

                  <span>
                    Distribución y gestión operativa
                  </span>

                </div>

              </a>

            )
          }


          {
            puedeExpedicion
            &&
            (

              <a
                href="#expedicion"
                className="
                  panel-area-button
                  panel-area-expedicion
                "
              >

                <div className="panel-area-icon">

                  <Icon
                    name="boxes"
                    size={24}
                  />

                </div>


                <div>

                  <strong>
                    Expedición
                  </strong>

                  <span>
                    Cargas, stock y materiales
                  </span>

                </div>

              </a>

            )
          }

        </div>


        {/* ================================================= */}
        {/* LOGÍSTICA */}
        {/* ================================================= */}

        {
          puedeVerLogistica
          &&
          (

            <section
              id="logistica"
              className="
                panel-area-section
                panel-logistica
              "
            >

              <div className="panel-area-heading">

                <div className="panel-area-title">

                  <div className="panel-area-title-icon">

                    <Icon
                      name="truck"
                      size={23}
                    />

                  </div>


                  <div>

                    <span>
                      ÁREA OPERATIVA
                    </span>

                    <h2>
                      Logística
                    </h2>

                    <p>
                      Distribución, entregas,
                      controles y gestión diaria.
                    </p>

                  </div>

                </div>


                <div className="panel-area-count">

                  {
                    modulosLogisticaVisibles.length
                    +
                    (
                      puedeStockPallets
                        ? 1
                        : 0
                    )
                  }

                  <span>
                    módulos disponibles
                  </span>

                </div>

              </div>


              {/* KPIs */}

              {
                kpisLogistica.length > 0
                &&
                (

                  <div className="panel-kpis">

                    {
                      kpisLogistica.map(
                        kpi => (

                          <div
                            className="panel-kpi"
                            key={
                              kpi.label
                            }
                          >

                            <div
                              className={
                                `panel-kpi-icon ${kpi.tone}`
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
                                {
                                  kpi.description
                                }
                              </small>

                            </div>

                          </div>

                        )
                      )
                    }

                  </div>

                )
              }


              {/* MÓDULOS */}

              <div className="panel-module-grid">

                {
                  modulosLogisticaVisibles.map(
                    module => (

                      <article
                        className="
                          panel-module-card
                          panel-module-logistica
                        "
                        key={
                          module.title
                        }
                      >

                        <div className="panel-module-top">

                          <div className="panel-module-icon">

                            <Icon
                              name={
                                module.icon
                              }
                              size={23}
                            />

                          </div>

                          <span>
                            Logística
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


                        {
                          module.links
                          &&
                          (

                            <div className="panel-module-links">

                              {
                                module.links.map(
                                  link => (

                                    <Link
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

                          )
                        }


                        <Link
                          to={
                            module.home
                            ||
                            "/"
                          }
                          className="panel-module-enter"
                        >

                          Ingresar

                          <Icon
                            name="chevron"
                            size={16}
                          />

                        </Link>

                      </article>

                    )
                  )
                }


                {/* STOCK PALLETS */}

                {
                  puedeStockPallets
                  &&
                  (

                    <article
                      className="
                        panel-module-card
                        panel-module-logistica
                      "
                    >

                      <div className="panel-module-top">

                        <div className="panel-module-icon">

                          <Icon
                            name="boxes"
                            size={23}
                          />

                        </div>

                        <span>
                          Sistema externo
                        </span>

                      </div>


                      <h3>
                        Stock de pallets
                      </h3>


                      <p>
                        Accedé al sistema externo
                        de control de stock de pallets.
                      </p>


                      <a
                        href="http://10.242.4.13:8000/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="panel-module-enter"
                      >

                        Abrir sistema

                        <Icon
                          name="chevron"
                          size={16}
                        />

                      </a>

                    </article>

                  )
                }

              </div>

            </section>

          )
        }


        {/* ================================================= */}
        {/* EXPEDICIÓN */}
        {/* ================================================= */}

        {
          puedeExpedicion
          &&
          (

            <section
              id="expedicion"
              className="
                panel-area-section
                panel-expedicion
              "
            >

              <div className="panel-area-heading">

                <div className="panel-area-title">

                  <div
                    className="
                      panel-area-title-icon
                      expedicion
                    "
                  >

                    <Icon
                      name="boxes"
                      size={23}
                    />

                  </div>


                  <div>

                    <span>
                      ÁREA OPERATIVA
                    </span>

                    <h2>
                      Expedición
                    </h2>

                    <p>
                      Órdenes de carga,
                      productos, stock,
                      fleteros y materiales.
                    </p>

                  </div>

                </div>


                <div className="panel-area-count">

                  5

                  <span>
                    módulos disponibles
                  </span>

                </div>

              </div>


              {/* KPIs */}

              <div className="panel-kpis">

                {
                  kpisExpedicion.map(
                    kpi => (

                      <div
                        className="panel-kpi"
                        key={
                          kpi.label
                        }
                      >

                        <div
                          className={
                            `panel-kpi-icon ${kpi.tone}`
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
                            {
                              kpi.description
                            }
                          </small>

                        </div>

                      </div>

                    )
                  )
                }

              </div>


              {/* RESUMEN MATERIAL */}

              <div className="panel-expedition-summary">

                <div>

                  <span>
                    Movimientos de materiales
                  </span>

                  <strong>

                    {
                      cargandoMaterial
                        ? "—"
                        : movimientosMaterial.length
                    }

                  </strong>

                  <small>
                    Pallets y chapadur
                  </small>

                </div>


                <div>

                  <span>
                    Fleteros registrados
                  </span>

                  <strong>

                    {
                      cargandoFleteros
                        ? "—"
                        : fleteros.length
                    }

                  </strong>

                  <small>
                    Total en maestros
                  </small>

                </div>

              </div>


              {/* MÓDULOS */}

              <div className="panel-module-grid">

                {
                  modulosExpedicion.map(
                    module => (

                      <article
                        className="
                          panel-module-card
                          panel-module-expedicion
                        "
                        key={
                          module.title
                        }
                      >

                        <div className="panel-module-top">

                          <div className="panel-module-icon">

                            <Icon
                              name={
                                module.icon
                              }
                              size={23}
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


                        {
                          module.links
                          &&
                          (

                            <div className="panel-module-links">

                              {
                                module.links.map(
                                  link => (

                                    <Link
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

                          )
                        }


                        <Link
                          to={
                            module.home
                            ||
                            "/expedicion/inicio"
                          }
                          className="panel-module-enter"
                        >

                          Ingresar

                          <Icon
                            name="chevron"
                            size={16}
                          />

                        </Link>

                      </article>

                    )
                  )
                }

              </div>


              <div className="panel-area-footer">

                <div>

                  <strong>
                    Panel de Expedición
                  </strong>

                  <span>
                    Consultá el resumen completo
                    del área.
                  </span>

                </div>


                <Link
                  to="/expedicion/inicio"
                  className="panel-area-main-link"
                >

                  Ver Expedición

                  <Icon
                    name="chevron"
                    size={16}
                  />

                </Link>

              </div>

            </section>

          )
        }

      </div>

    </div>

  );
}