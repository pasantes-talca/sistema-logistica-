import type { OrdenOperativa } from "../../api/expedicionOperativa";

export type FiltrosPendientes = {
  fletero: number;
  desde: string;
  busqueda?: string;
  hasta?: string;
  turno?: string;
  estado?: string;
  producto?: number;
};

// En Salta, PENDIENTE administrativo también aparece en este listado. Las
// salidas inmediatas, anuladas y órdenes ya resueltas quedan afuera.
const circuitosPendientes = new Set([
  "administrative",
  "preventa",
  "distriC",
  "distriInterior",
  "oesteMendoza",
  "oesteJeremias",
]);

export function filtrarPendientes(
  ordenes: OrdenOperativa[],
  filtros: FiltrosPendientes,
) {
  return ordenes
    .filter(
      (o) =>
        !o.anulada &&
        circuitosPendientes.has(o.circuito) &&
        o.detalles.some((l) => l.pendiente > 0) &&
        (!filtros.fletero || o.fletero === filtros.fletero) &&
        (!filtros.desde || o.fecha >= filtros.desde) &&
        (!filtros.hasta || o.fecha <= filtros.hasta) &&
        (!filtros.estado || o.estado_operativo === filtros.estado) &&
        (!filtros.turno ||
          o.turno === filtros.turno ||
          o.entregas.some((e) => e.turno === filtros.turno)) &&
        (!filtros.producto ||
          o.detalles.some(
            (l) => l.producto === filtros.producto && l.pendiente > 0,
          )) &&
        (!filtros.busqueda ||
          `${o.numero} ${o.fletero_nombre} ${o.detalles.map((l) => `${l.codigo} ${l.producto_nombre}`).join(" ")}`
            .toLocaleLowerCase("es")
            .includes(filtros.busqueda.toLocaleLowerCase("es"))),
    )
    .sort(
      (a, b) =>
        b.numero.localeCompare(a.numero, "es", {
          numeric: true,
          sensitivity: "base",
        }) || b.id - a.id,
    );
}
