import type { ProductoOperativo } from "../../api/expedicionOperativa";

export const columnasPendientes = [
  ["preventa", "Preventa pendiente"],
  ["distriC", "Distri C pendiente"],
  ["distriInterior", "Distri Interior"],
  ["sin_codificar", "Sin codificar"],
  ["oesteMendoza", "Oeste Mendoza pendiente"],
  ["oesteJeremias", "Oeste Jeremías pendiente"],
] as const;

export type EstadoStock = "" | "Disponible" | "Insuficiente" | "Sin pendientes";
export type FiltrosStock = { busqueda: string; estado: EstadoStock };

export function cantidadesStock(p: ProductoOperativo) {
  const pendientes = columnasPendientes.map(([key]) =>
    key === "sin_codificar" ? p.sin_codificar : p.pendientes[key] || 0,
  );
  const total = pendientes.reduce((a, b) => a + b, 0);
  const entregable = Math.max(0, p.stock - p.sin_codificar);
  const porcentaje =
    total === 0
      ? null
      : entregable === 0
        ? -100
        : ((entregable - total) / entregable) * 100;
  const estado: EstadoStock =
    total === 0
      ? "Sin pendientes"
      : entregable >= total
        ? "Disponible"
        : "Insuficiente";
  return { pendientes, total, entregable, porcentaje, estado };
}

// Orden de las presentaciones del catálogo de referencia; los códigos nuevos
// siguen siendo visibles, sin renombrar ni modificar productos existentes.
const ordenCatalogo = [
  "5670",
  "5675",
  "5680",
  "5685",
  "5690",
  "5051",
  "5056",
  "5061",
  "5066",
  "5071",
  "5200",
  "5205",
  "5210",
  "5215",
  "5220",
  "8670",
  "4900",
  "417",
  "4171",
  "4910",
];
const normalizarBusqueda = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
export function filtrarStock(
  productos: ProductoOperativo[],
  filtros: FiltrosStock,
) {
  const q = normalizarBusqueda(filtros.busqueda);
  const rank = (p: ProductoOperativo) => {
    const index = ordenCatalogo.indexOf(p.codigo);
    return index < 0 ? ordenCatalogo.length : index;
  };
  return productos
    .filter(
      (p) =>
        p.activo &&
        normalizarBusqueda(`${p.codigo} ${p.alias} ${p.nombre}`).includes(q) &&
        (!filtros.estado || cantidadesStock(p).estado === filtros.estado),
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.codigo.localeCompare(b.codigo, "es", { numeric: true }),
    );
}

export function descomponerStock(
  unidades: number,
  p: ProductoOperativo,
  enPallets = false,
) {
  const cantidad = Math.abs(unidades);
  const pack = Math.max(1, p.unidades_pack);
  const capacidad =
    pack * Math.max(1, p.packs_corte) * Math.max(1, p.cortes_pallet);
  const pallets = enPallets ? Math.floor(cantidad / capacidad) : 0;
  const resto = cantidad - pallets * capacidad;
  return {
    negativo: unidades < 0,
    pallets,
    fardos: Math.floor(resto / pack),
    sueltas: resto % pack,
  };
}

// No se suman botellas de distintas presentaciones como si fueran fardos.
// Los totales se mantienen en fardos equivalentes incluso en la vista de pallets.
export function totalesStock(productos: ProductoOperativo[]) {
  const totales = productos.reduce(
    (t, p) => {
      const q = cantidadesStock(p);
      const pack = Math.max(1, p.unidades_pack);
      t.fisico += p.stock / pack;
      t.entregable += q.entregable / pack;
      t.pendiente += q.total / pack;
      q.pendientes.forEach((v, i) => {
        t.circuitos[i] += v / pack;
      });
      return t;
    },
    {
      fisico: 0,
      entregable: 0,
      pendiente: 0,
      circuitos: columnasPendientes.map(() => 0),
    },
  );
  return {
    ...totales,
    porcentaje:
      totales.pendiente === 0
        ? null
        : totales.fisico === 0
          ? 0
          : ((totales.fisico - totales.pendiente) / totales.fisico) * 100,
  };
}
