import {
  Navigate,
} from "react-router-dom";

import {
  useQuery,
} from "@tanstack/react-query";

import {
  obtenerUsuarioActual,
} from "../api/logistica";


interface Props {
  children:
    React.ReactNode;
}


export default function RutaProtegida({
  children,
}: Props) {

  const {
    data: usuario,
    isLoading,
    isError,
  } = useQuery({

    queryKey: [
      "usuario-actual"
    ],

    queryFn:
      obtenerUsuarioActual,

    retry:
      false,

  });


  if (isLoading) {

    return (
      <div className="pagina">
        <div className="contenedor">
          Cargando...
        </div>
      </div>
    );
  }


  if (
    isError
    ||
    !usuario
  ) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  return (
    <>
      {children}
    </>
  );
}