import type {
  ExpedicionOperativa,
  FleteroOperativo,
  ProductoOperativo,
} from "../../api/expedicionOperativa";

export type EstadoConfiguracion = "" | "activo" | "inactivo";
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
const coincide = (texto: string, busqueda: string) =>
  normalizar(texto).includes(normalizar(busqueda));
const estadoCoincide = (activo: boolean, estado: EstadoConfiguracion) =>
  !estado || activo === (estado === "activo");
export const nombreFletero = (f: FleteroOperativo) =>
  `${f.nombre} ${f.apellido}`.trim();

export function filtrarFleteros(
  fleteros: FleteroOperativo[],
  busqueda: string,
  estado: EstadoConfiguracion = "",
) {
  return fleteros.filter(
    (f) =>
      coincide(`${nombreFletero(f)} ${f.empresa}`, busqueda) &&
      estadoCoincide(f.activo, estado),
  );
}
export function filtrarUsuarios(
  usuarios: ExpedicionOperativa["usuarios"],
  busqueda: string,
  estado: EstadoConfiguracion = "",
) {
  return usuarios.filter(
    (u) =>
      coincide(`${u.username} ${u.nombre}`, busqueda) &&
      estadoCoincide(u.activo, estado),
  );
}
export function filtrarProductos(
  productos: ProductoOperativo[],
  busqueda: string,
  estado: EstadoConfiguracion = "",
) {
  return productos.filter(
    (p) =>
      coincide(`${p.codigo} ${p.alias} ${p.nombre}`, busqueda) &&
      estadoCoincide(p.activo, estado),
  );
}
// Sólo identifica coincidencias de nombre/apellido. No decide qué registro conservar ni los fusiona.
export function coincidenciasFleteros(
  fleteros: FleteroOperativo[],
): FleteroOperativo[][] {
  const grupos = new Map<string, FleteroOperativo[]>();
  for (const f of fleteros) {
    const clave = normalizar(nombreFletero(f));
    if (!clave) continue;
    const grupo = grupos.get(clave) || [];
    grupo.push(f);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
}
