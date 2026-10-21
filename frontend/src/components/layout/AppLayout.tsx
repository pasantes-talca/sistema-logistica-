import { useState } from "react";
import ThemeToggle from "../ui/ThemeToggle";
import TurnoExpedicionSelector from "../expedicion/TurnoExpedicionSelector";

import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  cerrarSesion,
  obtenerUsuarioActual,
} from "../../api/logistica";

import Icon, {
  type IconName,
} from "../ui/Icon";


interface Props {
  children: React.ReactNode;
}


type SidebarModule = {
  label: string;
  icon: IconName;
  base: string;
  permiso: string;

  links: {
    label: string;
    to: string;
    icon: IconName;
  }[];
};


const modules: SidebarModule[] = [

  {
    label: "Repartos y recargas",
    icon: "truck",
    base: "/repartos",
    permiso: "REPARTOS",

    links: [
      {
        label: "Nuevo reparto",
        to: "/repartos/nuevo",
        icon: "plus",
      },
      {
        label: "Carga desde planillas",
        to: "/repartos/planillas",
        icon: "boxes",
      },
      {
        label: "Historial",
        to: "/repartos",
        icon: "history",
      },
      {
        label: "Reporte de recargas",
        to: "/repartos/recargas",
        icon: "chart",
      },
    ],
  },


  {
    label: "Rechazos",
    icon: "alert",
    base: "/rechazos",
    permiso: "RECHAZOS",

    links: [
      {
        label: "Nuevo rechazo",
        to: "/rechazos/nuevo",
        icon: "plus",
      },
      {
        label: "Historial",
        to: "/rechazos",
        icon: "history",
      },
      {
        label: "Estadísticas",
        to: "/rechazos/estadisticas",
        icon: "chart",
      },
    ],
  },


  {
    label: "Recibos de cambios",
    icon: "boxes",
    base: "/cambios",
    permiso: "CAMBIOS",

    links: [
      {
        label: "Nuevo recibo",
        to: "/cambios/nuevo",
        icon: "plus",
      },
      {
        label: "Historial",
        to: "/cambios",
        icon: "history",
      },
      {
        label: "Estadísticas",
        to: "/cambios/estadisticas",
        icon: "chart",
      },
    ],
  },


  {
    label: "Viáticos",
    icon: "truck",
    base: "/viaticos",
    permiso: "VIATICOS",

    links: [
      {
        label: "Nuevo registro",
        to: "/viaticos/nuevo",
        icon: "plus",
      },
      {
        label: "Historial",
        to: "/viaticos",
        icon: "history",
      },
      {
        label: "Resumen anual",
        to: "/viaticos/resumen",
        icon: "chart",
      },
    ],
  },


  {
    label: "Kilometrajes",
    icon: "truck",
    base: "/kilometrajes",
    permiso: "KILOMETRAJES",

    links: [
      {
        label: "Nuevo control",
        to: "/kilometrajes/nuevo",
        icon: "plus",
      },
      {
        label: "Historial",
        to: "/kilometrajes",
        icon: "history",
      },
      {
        label: "Estadísticas",
        to: "/kilometrajes/estadisticas",
        icon: "chart",
      },
    ],
  },


  {
    label: "Control diario",
    icon: "boxes",
    base: "/control-diario",
    permiso: "CONTROL_DIARIO",

    links: [
      {
        label: "Nueva carga",
        to: "/control-diario/nuevo",
        icon: "plus",
      },
      {
        label: "Historial",
        to: "/control-diario",
        icon: "history",
      },
      {
        label: "Estadísticas",
        to: "/control-diario/estadisticas",
        icon: "chart",
      },
    ],
  },


  {
    label: "Expedición",
    icon: "boxes",
    base: "/expedicion",
    permiso: "EXPEDICION",

    links: [
      { label: "Resumen del turno", to: "/expedicion/inicio", icon: "chart" },
      {
        label: "Órdenes de carga",
        to: "/expedicion/ordenes",
        icon: "truck",
      },
      { label: "Pendientes y cambios", to: "/expedicion/pendientes", icon: "history" },
      {
        label: "Stock",
        to: "/expedicion/stock",
        icon: "boxes",
      },
      {
        label: "Movimientos",
        to: "/expedicion/movimientos",
        icon: "history",
      },
      {
        label: "Materiales",
        to: "/expedicion/materiales",
        icon: "boxes",
      },
      { label: "Empleados", to: "/expedicion/empleados", icon: "boxes" },
      { label: "Conteos y relevo", to: "/expedicion/conteos", icon: "history" },
      { label: "Auditoría", to: "/expedicion/auditoria", icon: "history" },
      { label: "Configuración", to: "/expedicion/configuracion", icon: "boxes" },
      { label: "Fleteros", to: "/expedicion/fleteros", icon: "truck" },
    ],
  },

];


const pageNames: Record<
  string,
  string
> = {

  administracion: "Administración",
  usuarios: "Usuarios y accesos",
  catalogos: "Catálogos",
  permisos: "Roles y permisos",
  panel: "Panel de control",
  "base-datos": "Base de datos",
  errores: "Registros de errores",
  reportes: "Reportes",
  notificaciones: "Notificaciones",
  seguridad: "Seguridad",
  estado: "Estado del sistema",
  repartos:
    "Repartos y recargas",

  rechazos:
    "Rechazos",

  cambios:
    "Recibos de cambios",

  viaticos:
    "Viáticos",

  kilometrajes:
    "Kilometrajes",

  "control-diario":
    "Control diario",

  expedicion:
    "Expedición",

  pendientes: "Pendientes y cambios",
  empleados: "Empleados",
  conteos: "Conteos y relevo",
  auditoria: "Auditoría",
  configuracion: "Configuración",
  nueva: "Nuevo registro",

  stock:
    "Stock",

  ordenes:
    "Órdenes de carga",

  movimientos:
    "Movimientos",

  fleteros:
    "Fleteros",

  materiales:
    "Pallets y chapadur",

  asistente:
    "Asistente IA",

  nuevo:
    "Nuevo registro",

  editar:
    "Editar",

  recargas:
    "Reporte de recargas",

  estadisticas:
    "Estadísticas",

  recibos:
    "Detalle de recibo",

  planillas:
    "Carga desde planillas",

  resumen:
    "Resumen anual",

  inicio:
    "Resumen",
};


function Breadcrumbs() {

  const location =
    useLocation();



  const segments =
    location.pathname
      .split("/")
      .filter(Boolean);


  if (!segments.length) {

    return (

      <div className="breadcrumb">

        <Icon
          name="home"
          size={15}
        />

        <span>
          Panel general
        </span>

      </div>

    );
  }


  const items =
    segments.filter(
      segment =>
        !/^\d+$/.test(
          segment
        )
    );


  return (

    <div className="breadcrumb">

      <NavLink to="/panel">
        Inicio
      </NavLink>


      {
        items.map(
          (
            item,
            index
          ) => (

            <span
              key={
                `${item}-${index}`
              }
              className="breadcrumb-item"
            >

              <Icon
                name="chevron"
                size={13}
              />

              <span>
                {
                  pageNames[item]
                  ?? item
                }
              </span>

            </span>

          )
        )
      }

    </div>

  );
}


export default function AppLayout({
  children,
}: Props) {

  const [
    open,
    setOpen,
  ] = useState(
    false
  );


  const location =
    useLocation();


  const esExpedicion = location.pathname === "/expedicion" || location.pathname.startsWith("/expedicion/");

  const [modulosAbiertos, setModulosAbiertos] = useState<Record<string, boolean>>({});
  const estaAbierto = (base: string) =>
    modulosAbiertos[base] ?? location.pathname.startsWith(base);

  function alternarModulo(base: string) {
    setModulosAbiertos(actual => ({
      ...actual,
      [base]: !(actual[base] ?? location.pathname.startsWith(base)),
    }));
  }

  const navigate =
    useNavigate();


  const queryClient =
    useQueryClient();


  const {
    data: user,
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


  const esSuperusuario = user?.es_superusuario ?? false;
  const esAdministrador = user?.es_administrador ?? esSuperusuario;
  const puedeAdministrar = user?.puede_administrar ??
    (esAdministrador && user?.username.toLowerCase() !== "arielgarro");


  const grupos =
    user?.grupos
    ?? [];


  function tienePermiso(
    permiso: string
  ) {

    if (
      esAdministrador
    ) {

      return true;
    }


    return grupos.includes(
      permiso
    );
  }


  const modulesVisibles =
    esAdministrador
      ? modules
      : modules.filter(
          module =>
            tienePermiso(
              module.permiso
            )
        );


  const puedeUsarAsistente =
    esAdministrador
    ||
    grupos.includes(
      "ASISTENTE"
    );


  /*
   * Por ahora el sistema de Stock
   * de pallets queda habilitado para:
   *
   * - superusuario
   * - grupo CAMBIOS
   */
  const puedeVerStock =
    esAdministrador
    ||
    grupos.includes(
      "CAMBIOS"
    );


  const name =
    user?.nombre_completo
    ||
    user?.username
    ||
    "Usuario";


  const initials =
    name
      .split(" ")
      .slice(
        0,
        2
      )
      .map(
        part =>
          part[0]
      )
      .join("")
      .toUpperCase();


  async function logout() {

    try {

      await cerrarSesion();

      queryClient.clear();


      navigate(
        "/login",
        {
          replace:
            true,
        }
      );

    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo cerrar la sesión. Volvé a intentarlo.");

    }

  }


  if (
    cargandoUsuario
  ) {

    return (

      <div className="app-shell">

        <div className="app-main">

          <main className="app-content">

            <div className="pagina">

              <div className="dashboard-container">

                Cargando usuario...

              </div>

            </div>

          </main>

        </div>

      </div>

    );
  }


  return (

    <div className="app-shell">


      {/* ======================================= */}
      {/* SIDEBAR */}
      {/* ======================================= */}

      <aside
        className={
          `sidebar ${
            open
              ? "sidebar-open"
              : ""
          }`
        }
      >

        <div className="sidebar-brand">

          <NavLink
            to="/panel"
            className="sidebar-home-link"
            aria-label="Ir al inicio"
            title="Ir al inicio"
            onClick={() => setOpen(false)}
          >

          <img
            className="sidebar-logo"
            src="/logo-talca.png"
            alt="Talca"
          />


          <div className="sidebar-brand-copy">

            <strong>
              Logística
            </strong>

            <span>
              Gestión operativa
            </span>

          </div>

          </NavLink>


          <button
            className="sidebar-close"
            onClick={
              () =>
                setOpen(
                  false
                )
            }
            aria-label="Cerrar menú"
          >

            <Icon
              name="close"
            />

          </button>

        </div>


        {/* ===================================== */}
        {/* NAVEGACIÓN */}
        {/* ===================================== */}

        <nav
          className="sidebar-nav"
          onClick={
            event => {
              if ((event.target as Element).closest("a")) setOpen(false);
            }
          }
        >

          {puedeAdministrar && <NavLink to="/administracion/usuarios" className={({isActive})=>`nav-item ${isActive ? "active" : ""}`}><Icon name="shield"/><span>Administración</span></NavLink>}
          <span className="nav-caption">
            Plataforma
          </span>


          {/* PANEL GENERAL */}

          <NavLink
            to="/panel"
            end
            className={
              ({
                isActive,
              }) =>
                `nav-item ${
                  isActive
                    ? "active"
                    : ""
                }`
            }
          >

            <Icon
              name="home"
            />

            <span>
              Panel general
            </span>

          </NavLink>


          {/* ASISTENTE IA */}

          {
            puedeUsarAsistente
            &&
            (

              <NavLink
                to="/asistente"
                className={
                  ({
                    isActive,
                  }) =>
                    `nav-item ${
                      isActive
                        ? "active"
                        : ""
                    }`
                }
              >

                <Icon
                  name="chart"
                />

                <span>
                  Asistente IA
                </span>

              </NavLink>

            )
          }


          <span
            className="
              nav-caption
              nav-caption-modules
            "
          >
            Operación
          </span>


          {/* MÓDULOS */}

          {
            modulesVisibles.map(
              module => (

                <div
                  className={
                    `nav-module ${
                      estaAbierto(module.base)
                        ? "expanded"
                        : ""
                    }`
                  }
                  key={
                    module.base
                  }
                >

                  <button
                    type="button"
                    className="nav-module-title"
                    aria-expanded={estaAbierto(module.base)}
                    aria-controls={`submenu-${module.base.slice(1)}`}
                    onClick={() => alternarModulo(module.base)}
                  >

                    <Icon
                      name={
                        module.icon
                      }
                    />

                    <span>
                      {
                        module.label
                      }
                    </span>

                    <Icon name="chevron" size={15} />
                  </button>


                  <div className="nav-subitems" id={`submenu-${module.base.slice(1)}`} hidden={!estaAbierto(module.base)}>

                    {
                      module.links.map(
                        link => (

                          <NavLink
                            key={
                              link.to
                            }
                            to={
                              link.to
                            }
                            end
                            className={
                              ({
                                isActive,
                              }) =>
                                `nav-subitem ${
                                  isActive
                                    ? "active"
                                    : ""
                                }`
                            }
                          >

                            <Icon
                              name={
                                link.icon
                              }
                              size={17}
                            />

                            <span>
                              {
                                link.label
                              }
                            </span>

                          </NavLink>

                        )
                      )
                    }

                  </div>

                </div>

              )
            )
          }


          {/* STOCK DE PALLETS */}

          {
            puedeVerStock
            &&
            (

              <a
                href="http://10.242.4.13:8000/"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-item"
              >

                <Icon
                  name="boxes"
                />

                <span>
                  Stock de pallets
                </span>

              </a>

            )
          }

        </nav>


        {/* ===================================== */}
        {/* ESTADO */}
        {/* ===================================== */}

        <div className="sidebar-status">

          <Icon
            name="shield"
          />

          <div>

            <strong>
              Sistema operativo
            </strong>

            <span>
              Conexión segura
            </span>

          </div>

          <i />

        </div>

      </aside>


      {/* ======================================= */}
      {/* OVERLAY MOBILE */}
      {/* ======================================= */}

      {
        open
        &&
        (

          <button
            className="sidebar-overlay"
            onClick={
              () =>
                setOpen(
                  false
                )
            }
            aria-label="Cerrar menú"
          />

        )
      }


      {/* ======================================= */}
      {/* CONTENIDO PRINCIPAL */}
      {/* ======================================= */}

      <div className="app-main">

        <header className={`app-header${esExpedicion ? " app-header-expedicion" : ""}`}>

          <button
            className="menu-toggle"
            onClick={
              () =>
                setOpen(
                  true
                )
            }
            aria-label="Abrir menú"
          >

            <Icon
              name="menu"
            />

          </button>


          <Breadcrumbs />


          <div className="header-user">

            <ThemeToggle />

            {esExpedicion && <TurnoExpedicionSelector />}

            <div className="user-avatar">

              {
                initials
              }

            </div>


            <div className="user-copy">

              <strong>
                {
                  name
                }
              </strong>

              <span>
                Usuario conectado
              </span>

            </div>


            <button
              className="logout-button"
              onClick={
                logout
              }
              title="Cerrar sesión"
            >

              <Icon
                name="logout"
              />

              <span>
                Cerrar sesión
              </span>

            </button>

          </div>

        </header>


        <main className="app-content">

          {
            children
          }

        </main>

      </div>

    </div>

  );
}
