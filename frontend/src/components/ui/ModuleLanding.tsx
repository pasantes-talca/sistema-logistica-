import { Link } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

interface ModuleAction { to: string; title: string; description: string; icon: IconName }
interface Props { eyebrow: string; title: string; description: string; icon: IconName; actions: ModuleAction[] }

export default function ModuleLanding({ eyebrow, title, description, icon, actions }: Props) {
  return <div className="pagina"><div className="contenedor-grande">
    <div className="panel-bienvenida"><div className="module-page-icon"><Icon name={icon} size={27}/></div><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div></div>
    <div className="panel-modulos">{actions.map(action => <Link to={action.to} className="tarjeta-modulo" key={action.to}><div className="action-icon"><Icon name={action.icon}/></div><h2>{action.title}</h2><p>{action.description}</p><span className="action-link">Abrir sección <Icon name="chevron" size={15}/></span></Link>)}</div>
  </div></div>;
}
