import type {
  FleteroOperativo,
  MaterialOperativo,
} from "../../api/expedicionOperativa";

export const camposMateriales = [
  "pallets_salida",
  "pallets_entrada",
  "chapadur_salida",
  "chapadur_entrada",
] as const;
export type TotalesMateriales = Record<
  (typeof camposMateriales)[number],
  number
> & { saldo_pallets: number; saldo_chapadur: number };
export type FiltrosMateriales = {
  fletero: number;
  desde: string;
  hasta: string;
  tipo: string;
  busqueda?: string;
  turno?: string;
};
export const tiposMateriales = [
  "Carga por turno",
  "Orden de carga",
  "Devolución general",
  "Envío a Mendoza",
  "Recepción desde Mendoza",
  "Envío a San Juan",
  "Recepción desde San Juan",
];
export function nombreFletero(
  f?: FleteroOperativo,
  id?: number | null,
): string {
  return f
    ? [f.nombre, f.apellido, f.empresa].filter(Boolean).join(" · ")
    : id
      ? `Fletero #${id}`
      : "Sin fletero registrado";
}
export function totalesMateriales(
  rows: MaterialOperativo[],
): TotalesMateriales {
  const totals = rows.reduce(
    (t, m) => {
      camposMateriales.forEach((k) => {
        t[k] += m[k];
      });
      return t;
    },
    {
      pallets_salida: 0,
      pallets_entrada: 0,
      chapadur_salida: 0,
      chapadur_entrada: 0,
    },
  );
  return {
    ...totals,
    saldo_pallets: totals.pallets_salida - totals.pallets_entrada,
    saldo_chapadur: totals.chapadur_salida - totals.chapadur_entrada,
  };
}
export function filtrarMateriales(
  rows: MaterialOperativo[],
  filtros: FiltrosMateriales,
  fleteros: FleteroOperativo[],
) {
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const q = normalizar(filtros.busqueda || "");
  const catalogo = new Map(fleteros.map((f) => [f.id, f]));
  return rows
    .filter(
      (m) =>
        (!filtros.fletero || m.fletero === filtros.fletero) &&
        (!filtros.desde || m.fecha.slice(0, 10) >= filtros.desde) &&
        (!filtros.hasta || m.fecha.slice(0, 10) <= filtros.hasta) &&
        (!filtros.tipo || m.origen === filtros.tipo) &&
        (!filtros.turno || m.turno === filtros.turno) &&
        (!q ||
          normalizar(
            `${nombreFletero(catalogo.get(m.fletero), m.fletero)} ${m.referencia} ${m.origen} ${m.observaciones}`,
          ).includes(q)),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}
export function saldosMateriales(
  rows: MaterialOperativo[],
  fleteros: FleteroOperativo[],
) {
  const map = new Map<number, MaterialOperativo[]>();
  const catalogo = new Map(fleteros.map((f) => [f.id, f]));
  rows.forEach((m) => {
    const group = map.get(m.fletero) || [];
    group.push(m);
    map.set(m.fletero, group);
  });
  return [...map].map(([id, movimientos]) => ({
    id,
    nombre: nombreFletero(catalogo.get(id), id),
    ...totalesMateriales(movimientos),
  }));
}
