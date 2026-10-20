import { Navigate, Link, useLocation } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import { obtenerUsuarioActual } from "../api/logistica";

interface Props {
  children: React.ReactNode;
}

export default function RutaProtegida({ children }: Props) {
  const location = useLocation();

  const {
    data: usuario,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["usuario-actual"],

    queryFn: obtenerUsuarioActual,

    retry: false,
  });

  if (isLoading) {
    return (
      <div className="pagina">
        <div className="contenedor">Cargando...</div>
      </div>
    );
  }

  if (isError || !usuario) {
    return <Navigate to="/login" replace />;
  }

  const seccion = location.pathname.split("/")[1];
  const modulos: Record<string, string> = {
    repartos: "REPARTOS",
    rechazos: "RECHAZOS",
    cambios: "CAMBIOS",
    viaticos: "VIATICOS",
    kilometrajes: "KILOMETRAJES",
    "control-diario": "CONTROL_DIARIO",
    expedicion: "EXPEDICION",
    asistente: "ASISTENTE",
  };
  const admin = usuario.es_administrador || usuario.es_superusuario;
  const puedeAdministrar = usuario.puede_administrar ??
    (admin && usuario.username.toLowerCase() !== "arielgarro");
  if (
    (!puedeAdministrar && seccion === "administracion") ||
    (!admin && modulos[seccion] && !usuario.grupos.includes(modulos[seccion]))
  ) {
    return (
      <div className="pagina">
        <div className="contenedor">
          <h1>No tenés acceso a esta sección</h1>
          <p>Pedile al administrador que revise tus permisos.</p>
          <Link className="boton-principal" to="/panel">
            Volver al panel general
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
