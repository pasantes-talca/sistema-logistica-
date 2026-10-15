import type {
  OrdenOperativa,
  ProductoOperativo,
} from "../../api/expedicionOperativa";

export const tiposOrden: Record<string, string> = {
  administrative: "PENDIENTE · Sin impacto",
  preventa: "Preventa pendiente",
  distriC: "Distri C pendiente",
  distriInterior: "Distri Interior",
  oesteMendoza: "Oeste Mendoza pendiente",
  oesteJeremias: "Oeste Jeremías pendiente",
  immediate: "Salida inmediata",
  cancelled: "Anulada",
  legacy: "Histórica",
};

export type FiltrosOrdenes = {
  fletero: number;
  dia: string;
  encargado: string;
  turno: string;
  busqueda?: string;
  desde?: string;
  hasta?: string;
  estado?: string;
};

export function filtrarOrdenes(
  ordenes: OrdenOperativa[],
  filtros: FiltrosOrdenes,
) {
  return ordenes
    .filter(
      (o) =>
        (!filtros.fletero || o.fletero === filtros.fletero) &&
        (!filtros.dia || o.fecha === filtros.dia) &&
        (!filtros.desde || o.fecha >= filtros.desde) &&
        (!filtros.hasta || o.fecha <= filtros.hasta) &&
        (!filtros.estado || o.estado_operativo === filtros.estado) &&
        (!filtros.busqueda ||
          `${o.numero} ${o.fletero_nombre} ${o.creado_por_nombre} ${o.detalles.map((l) => `${l.codigo} ${l.producto_nombre}`).join(" ")}`
            .toLocaleLowerCase("es")
            .includes(filtros.busqueda.toLocaleLowerCase("es"))) &&
        (!filtros.encargado ||
          o.creado_por_nombre === filtros.encargado ||
          o.entregas.some((e) => e.creado_por_nombre === filtros.encargado)) &&
        (!filtros.turno ||
          o.turno === filtros.turno ||
          o.entregas.some((e) => e.turno === filtros.turno)),
    )
    .sort(
      (a, b) =>
        b.numero.localeCompare(a.numero, undefined, {
          numeric: true,
          sensitivity: "base",
        }) || b.id - a.id,
    );
}

// Cada presentación tiene su propio tamaño de fardo. Se suma la equivalencia
// por producto y se redondea solamente al mostrar el total (como en Salta).
export function resumenOrden(
  o: OrdenOperativa,
  productos: ProductoOperativo[],
) {
  const packs = new Map(productos.map((p) => [p.id, p.unidades_pack]));
  const enFardos = (producto: number, unidades: number) => {
    const pack = packs.get(producto);
    return pack && pack > 0 && Number.isFinite(unidades)
      ? unidades / pack
      : null;
  };
  const solicitados = o.detalles.map((l) =>
    enFardos(l.producto, Number(l.cantidad_solicitada)),
  );
  const entregados = o.entregas.flatMap((e) =>
    e.detalles.map((l) => enFardos(l.producto, Number(l.cantidad_entregada))),
  );
  const total = (items: (number | null)[]) =>
    items.some((v) => v === null)
      ? null
      : items.reduce<number>((s, v) => s + (v ?? 0), 0);
  const ultima = o.entregas.at(-1);
  return {
    solicitado: total(solicitados),
    entregado: total(entregados),
    encargado: ultima?.creado_por_nombre || o.creado_por_nombre || "—",
    turno: ultima?.turno || o.turno || "—",
    tipo: tiposOrden[o.circuito] || "Histórica",
  };
}

export function estiloEstadoOrden(estado: string) {
  if (estado === "PENDIENTE") return "administrativa";
  if (estado === "Despachada") return "completa";
  if (estado === "Anulada") return "anulada";
  if (estado.toLowerCase().includes("parcial")) return "parcial";
  return "pendiente";
}
