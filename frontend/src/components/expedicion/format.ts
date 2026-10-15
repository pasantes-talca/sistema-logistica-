export const fmt = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
