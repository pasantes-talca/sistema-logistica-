import type { ConteoOperativo } from "../../api/expedicionOperativa";
export type FiltrosConteos = {
  desde: string;
  hasta: string;
  turno: string;
  busqueda: string;
};
export function cantidadDiferencias(c: ConteoOperativo): number {
  return c.lineas.filter((l) => l.diferencia !== 0).length;
}
export function puedeCorroborar(c: ConteoOperativo, turno: string): boolean {
  return !c.corroborado_en && c.turno !== turno;
}
export function filtrarConteos(conteos: ConteoOperativo[], f: FiltrosConteos) {
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const q = normalizar(f.busqueda);
  return conteos
    .filter(
      (c) =>
        (!f.desde || c.fecha.slice(0, 10) >= f.desde) &&
        (!f.hasta || c.fecha.slice(0, 10) <= f.hasta) &&
        (!f.turno || c.turno === f.turno) &&
        normalizar(
          `${c.tipo} ${c.usuario} ${c.observaciones} ${c.corroborado_por} ${c.lineas.map((l) => `${l.codigo} ${l.nombre}`).join(" ")}`,
        ).includes(q),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
}
export function ultimoRelevoPendiente(
  conteos: ConteoOperativo[],
  turno: string,
) {
  return filtrarConteos(conteos, {
    desde: "",
    hasta: "",
    turno: "",
    busqueda: "",
  }).find((c) => c.tipo === "Cierre de turno" && puedeCorroborar(c, turno));
}
