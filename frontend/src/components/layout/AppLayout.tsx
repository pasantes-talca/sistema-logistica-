import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cerrarSesion, obtenerUsuarioActual } from "../../api/logistica";
import Icon, { type IconName } from "../ui/Icon";

interface Props { children: React.ReactNode }

const modules: { label: string; icon: IconName; base: string; links: { label: string; to: string; icon: IconName }[] }[] = [
  { label: "Repartos y recargas", icon: "truck", base: "/repartos", links: [
    { label: "Nuevo reparto", to: "/repartos/nuevo", icon: "plus" },
    { label: "Historial", to: "/repartos", icon: "history" },
    { label: "Reporte de recargas", to: "/repartos/recargas", icon: "chart" },
  ]},
  { label: "Rechazos", icon: "alert", base: "/rechazos", links: [
    { label: "Nuevo rechazo", to: "/rechazos/nuevo", icon: "plus" },
    { label: "Historial", to: "/rechazos", icon: "history" },
    { label: "Estadísticas", to: "/rechazos/estadisticas", icon: "chart" },
  ]},
  { label: "Recibos de cambios", icon: "boxes", base: "/cambios", links: [
    { label: "Nuevo recibo", to: "/cambios/nuevo", icon: "plus" },
    { label: "Historial", to: "/cambios", icon: "history" },
    { label: "Estadísticas", to: "/cambios/estadisticas", icon: "chart" },
  ]},
];

const pageNames: Record<string, string> = {
  repartos: "Repartos y recargas", rechazos: "Rechazos", cambios: "Recibos de cambios",
  nuevo: "Nuevo registro", editar: "Editar", recargas: "Reporte de recargas",
  estadisticas: "Estadísticas", recibos: "Detalle de recibo", inicio: "Resumen",
};

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  if (!segments.length) return <div className="breadcrumb"><Icon name="home" size={15}/><span>Panel general</span></div>;
  const items = segments.filter(s => !/^\d+$/.test(s));
  return <div className="breadcrumb"><NavLink to="/">Inicio</NavLink>{items.map((item, index) => <span key={`${item}-${index}`} className="breadcrumb-item"><Icon name="chevron" size={13}/><span>{pageNames[item] ?? item}</span></span>)}</div>;
}

export default function AppLayout({ children }: Props) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["usuario-actual"], queryFn: obtenerUsuarioActual, retry: false });
  const name = user?.nombre_completo || user?.username || "Ariel Garro";
  const initials = name.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase();

  async function logout() {
    try { await cerrarSesion(); } finally {
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><img className="sidebar-logo" src="/logo-talca.png" alt="Talca"/><div className="sidebar-brand-copy"><strong>Logística</strong><span>Gestión operativa</span></div><button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Cerrar menú"><Icon name="close"/></button></div>
      <nav className="sidebar-nav" onClick={() => setOpen(false)}>
        <span className="nav-caption">Plataforma</span>
        <NavLink to="/" end className={({isActive}) => `nav-item ${isActive ? "active" : ""}`}><Icon name="home"/><span>Panel general</span></NavLink>
        <span className="nav-caption nav-caption-modules">Operación</span>
        {modules.map(module => <div className={`nav-module ${location.pathname.startsWith(module.base) ? "expanded" : ""}`} key={module.base}>
          <NavLink to={`${module.base}/inicio`} className="nav-module-title"><Icon name={module.icon}/><span>{module.label}</span><Icon name="chevron" size={15}/></NavLink>
          <div className="nav-subitems">{module.links.map(link => <NavLink key={link.to} to={link.to} end className={({isActive}) => `nav-subitem ${isActive ? "active" : ""}`}><Icon name={link.icon} size={17}/><span>{link.label}</span></NavLink>)}</div>
        </div>)}
      </nav>
      <div className="sidebar-status"><Icon name="shield"/><div><strong>Sistema operativo</strong><span>Conexión segura</span></div><i/></div>
    </aside>
    {open && <button className="sidebar-overlay" onClick={() => setOpen(false)} aria-label="Cerrar menú"/>}
    <div className="app-main">
      <header className="app-header"><button className="menu-toggle" onClick={() => setOpen(true)} aria-label="Abrir menú"><Icon name="menu"/></button><Breadcrumbs/><div className="header-user"><div className="user-avatar">{initials}</div><div className="user-copy"><strong>{name}</strong><span>Usuario conectado</span></div><button className="logout-button" onClick={logout} title="Cerrar sesión"><Icon name="logout"/><span>Cerrar sesión</span></button></div></header>
      <main className="app-content">{children}</main>
    </div>
  </div>;
}
