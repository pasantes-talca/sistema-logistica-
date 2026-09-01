import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { iniciarSesion } from "../api/logistica";
import Icon from "../components/ui/Icon";

export default function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: iniciarSesion,
    onSuccess: async () => { setError(""); await queryClient.invalidateQueries({ queryKey: ["usuario-actual"] }); navigate("/"); },
    onError: (requestError: Error) => setError(requestError.message),
  });
  function enviar(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!username.trim() || !password) { setError("Ingresá usuario y contraseña."); return; }
    mutation.mutate({ username: username.trim(), password });
  }
  return <div className="pagina-login">
    <section className="login-visual">
      <div className="login-brand"><div className="login-brand-mark"><Icon name="route" size={30}/></div><div><strong>Logística Talca</strong><span>Sistema de gestión logística</span></div></div>
      <div className="login-message"><span className="login-eyebrow">CONTROL OPERATIVO CENTRALIZADO</span><h1>La operación logística, clara y conectada.</h1><p>Gestioná repartos, incidencias y movimientos de mercadería desde una única plataforma segura.</p></div>
      <div className="logistics-visual" aria-hidden="true"><div className="route-line route-line-one"/><div className="route-line route-line-two"/><span className="route-node node-a"><Icon name="truck"/></span><span className="route-node node-b"><Icon name="package"/></span><span className="route-node node-c"><Icon name="shield"/></span></div>
      <div className="login-features"><span><Icon name="activity"/>Operación centralizada</span><span><Icon name="shield"/>Acceso interno seguro</span></div>
    </section>
    <section className="login-access"><div className="login-card">
      <div className="login-mobile-brand"><Icon name="route"/><strong>Logística Talca</strong></div>
      <div className="login-marca"><span className="login-kicker">Acceso al sistema</span><h2>Bienvenido</h2><p>Ingresá tus credenciales para continuar.</p></div>
      <form className="login-formulario" onSubmit={enviar}>
        <div className="campo campo-login"><label htmlFor="username">Usuario</label><div className="input-with-icon"><Icon name="user" size={19}/><input id="username" type="text" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" autoFocus placeholder="Ingresá tu usuario"/></div></div>
        <div className="campo campo-login"><label htmlFor="password">Contraseña</label><div className="input-with-icon"><Icon name="shield" size={19}/><input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="Ingresá tu contraseña"/></div></div>
        {error && <div className="login-error">{error}</div>}
        <button className="boton-guardar login-boton" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Ingresando..." : "Ingresar al sistema"}</button>
      </form>
      <div className="login-help"><Icon name="shield" size={16}/>Acceso exclusivo para personal autorizado</div>
    </div></section>
  </div>;
}
