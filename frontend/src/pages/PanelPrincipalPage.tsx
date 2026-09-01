import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { obtenerRepartos, obtenerRechazos, obtenerRecibosCambio, obtenerUsuarioActual } from "../api/logistica";
import Icon, { type IconName } from "../components/ui/Icon";

export default function PanelPrincipalPage() {
  const { data: usuario } = useQuery({ queryKey: ["usuario-actual"], queryFn: obtenerUsuarioActual, retry: false });
  const { data: repartos, isLoading: cargandoRepartos } = useQuery({ queryKey: ["repartos"], queryFn: obtenerRepartos });
  const { data: rechazos, isLoading: cargandoRechazos } = useQuery({ queryKey: ["rechazos"], queryFn: obtenerRechazos });
  const { data: recibos, isLoading: cargandoRecibos } = useQuery({ queryKey: ["recibos-cambio"], queryFn: obtenerRecibosCambio });
  const nombre = usuario?.nombre_completo || usuario?.username || "Ariel Garro";
  const kpis: {label: string; value: number | string; icon: IconName; tone: string}[] = [
    { label: "Repartos registrados", value: cargandoRepartos ? "—" : repartos?.length ?? 0, icon: "truck", tone: "blue" },
    { label: "Rechazos registrados", value: cargandoRechazos ? "—" : rechazos?.length ?? 0, icon: "alert", tone: "amber" },
    { label: "Recibos de cambios", value: cargandoRecibos ? "—" : recibos?.length ?? 0, icon: "boxes", tone: "green" },
    { label: "Áreas operativas", value: 3, icon: "activity", tone: "navy" },
  ];
  const modules: {title: string; description: string; icon: IconName; tone: string; home: string; links: {to: string; label: string}[]}[] = [
    { title: "Repartos y recargas", description: "Planificá salidas, asigná personal y consultá las recargas de cada equipo.", icon: "truck", tone: "blue", home: "/repartos/inicio", links: [{to:"/repartos/nuevo",label:"Nuevo reparto"},{to:"/repartos",label:"Ver historial"}] },
    { title: "Rechazos", description: "Registrá entregas no concretadas y analizá sus principales motivos.", icon: "alert", tone: "amber", home: "/rechazos/inicio", links: [{to:"/rechazos/nuevo",label:"Nuevo rechazo"},{to:"/rechazos/estadisticas",label:"Ver estadísticas"}] },
    { title: "Recibos de cambios", description: "Controlá devoluciones, productos, pallets y movimientos por concesionario.", icon: "boxes", tone: "green", home: "/cambios/inicio", links: [{to:"/cambios/nuevo",label:"Nuevo recibo"},{to:"/cambios",label:"Ver historial"}] },
  ];
  return <div className="pagina"><div className="dashboard-container">
    <div className="dashboard-bienvenida"><div><div className="badge-panel"><Icon name="activity" size={16}/>Panel de operaciones</div><h1>Bienvenido, {nombre}</h1><p>Una vista general de la actividad logística y acceso rápido a cada área de trabajo.</p></div><div className="dashboard-status"><span/><div><strong>Plataforma disponible</strong><small>Todos los módulos operativos</small></div></div></div>
    <section><div className="section-heading"><div><span>RESUMEN GENERAL</span><h2>Actividad registrada</h2></div><small>Datos actuales del sistema</small></div><div className="dashboard-kpis">{kpis.map(kpi => <div className="kpi-card" key={kpi.label}><div className={`kpi-icon ${kpi.tone}`}><Icon name={kpi.icon}/></div><div><span>{kpi.label}</span><strong>{kpi.value}</strong><small>Registros totales</small></div></div>)}</div></section>
    <section><div className="section-heading"><div><span>MÓDULOS</span><h2>Áreas de gestión</h2></div><small>Seleccioná un área para comenzar</small></div><div className="grid-modulos">{modules.map(module => <article className={`modulo-card module-${module.tone}`} key={module.title}><div className="module-card-top"><div className="module-icon"><Icon name={module.icon} size={27}/></div><span>Área operativa</span></div><h3>{module.title}</h3><p>{module.description}</p><div className="modulo-links">{module.links.map(link => <Link className="modulo-link" to={link.to} key={link.to}>{link.label}</Link>)}</div><Link className="module-enter" to={module.home}>Ingresar al módulo <Icon name="chevron" size={17}/></Link></article>)}</div></section>
  </div></div>;
}
