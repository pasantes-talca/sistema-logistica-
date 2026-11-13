import { useQuery } from "@tanstack/react-query";
import { obtenerUsuarioActual } from "../../api/logistica";

export function useEliminarHistorial() {
  const { data: usuario } = useQuery({
    queryKey: ["usuario-actual"],
    queryFn: obtenerUsuarioActual,
    retry: false,
  });
  return (
    usuario?.puede_administrar ??
    (Boolean(usuario?.es_administrador || usuario?.es_superusuario) &&
      usuario?.username.toLowerCase() !== "arielgarro")
  );
}
