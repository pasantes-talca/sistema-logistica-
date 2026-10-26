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

export function hayFiltrosDespacho(f?: FiltrosOrdenes) {
  return Boolean(f && (f.dia || f.desde || f.hasta || f.encargado || f.turno));
}

export function fechaDespacho(e: OrdenOperativa["entregas"][number]) {
  if (e.fecha_operativa) return e.fecha_operativa;
  // Solo respaldo para registros antiguos: nunca usar la fecha de creación de la orden.
  const fecha = new Date(e.fecha);
  if (!Number.isFinite(fecha.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value || "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function entregasFiltradas(o: OrdenOperativa, f?: FiltrosOrdenes) {
  if (o.anulada) return [];
  return o.entregas.filter((e) => {
    const dia = fechaDespacho(e);
    return (
      (!f?.dia || dia === f.dia) &&
      (!f?.desde || (dia && dia >= f.desde)) &&
      (!f?.hasta || (dia && dia <= f.hasta)) &&
      (!f?.encargado || e.creado_por_nombre === f.encargado) &&
      (!f?.turno || e.turno === f.turno)
    );
  });
}

export function filtrarOrdenes(
  ordenes: OrdenOperativa[],
  filtros: FiltrosOrdenes,
) {
  return ordenes
    .filter(
      (o) =>
        (!filtros.fletero || o.fletero === filtros.fletero) &&
        (!hayFiltrosDespacho(filtros) ||
          entregasFiltradas(o, filtros).length > 0) &&
        (!filtros.estado || o.estado_operativo === filtros.estado) &&
        (!filtros.busqueda ||
          `${o.numero} ${o.fletero_nombre} ${o.creado_por_nombre} ${o.detalles.map((l) => `${l.codigo} ${l.producto_nombre}`).join(" ")}`
            .toLocaleLowerCase("es")
            .includes(filtros.busqueda.toLocaleLowerCase("es"))),
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
  filtros?: FiltrosOrdenes,
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
  const entregas = entregasFiltradas(o, filtros);
  const entregados = entregas.flatMap((e) =>
    e.detalles.map((l) => enFardos(l.producto, Number(l.cantidad_entregada))),
  );
  const total = (items: (number | null)[]) =>
    items.some((v) => v === null)
      ? null
      : items.reduce<number>((s, v) => s + (v ?? 0), 0);
  const unir = (valores: string[]) =>
    [...new Set(valores.filter(Boolean))].join(" · ");
  return {
    solicitado: total(solicitados),
    entregado: total(entregados),
    encargado: unir(entregas.map((e) => e.creado_por_nombre)) || "Sin despacho",
    turno: unir(entregas.map((e) => e.turno)) || "—",
    fecha: unir(entregas.map(fechaDespacho).sort()) || "—",
    tipo: tiposOrden[o.circuito] || "Histórica",
  };
}

export function totalizarProductosOrdenes(
  ordenes: OrdenOperativa[],
  productos: ProductoOperativo[],
  filtros?: FiltrosOrdenes,
) {
  const catalogo = new Map(productos.map((p) => [p.id, p]));
  const totales = new Map<
    number,
    {
      producto: number;
      codigo: string;
      nombre: string;
      solicitado: number;
      despachado: number;
      unidades_pack: number | null;
    }
  >();
  const obtener = (id: number, codigo: string, nombre: string) => {
    if (!totales.has(id)) {
      const p = catalogo.get(id);
      totales.set(id, {
        producto: id,
        codigo: p?.codigo || codigo || String(id),
        nombre: p?.nombre || nombre || "Producto sin catálogo",
        solicitado: 0,
        despachado: 0,
        unidades_pack:
          p?.unidades_pack && p.unidades_pack > 0 ? p.unidades_pack : null,
      });
    }
    return totales.get(id)!;
  };
  // Una orden puede aparecer seleccionada una sola vez; no duplicar ni sumar anuladas.
  for (const o of new Map(ordenes.map((o) => [o.id, o])).values()) {
    if (o.anulada) continue;
    for (const l of o.detalles)
      obtener(l.producto, l.codigo, l.producto_nombre).solicitado += Number(
        l.cantidad_solicitada,
      );
    for (const e of entregasFiltradas(o, filtros))
      for (const l of e.detalles)
        obtener(l.producto, l.codigo, l.producto_nombre).despachado += Number(
          l.cantidad_entregada,
        );
  }
  return [...totales.values()].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
  );
}

export function estiloEstadoOrden(estado: string) {
  if (estado === "PENDIENTE") return "administrativa";
  if (estado === "Despachada") return "completa";
  if (estado === "Anulada") return "anulada";
  if (estado.toLowerCase().includes("parcial")) return "parcial";
  return "pendiente";
}
