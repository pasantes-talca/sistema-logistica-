import type { ProductoOperativo } from "../../api/expedicionOperativa";
import { fmt } from "./format";
import {
  cantidadesStock,
  columnasPendientes,
  descomponerStock,
  filtrarStock,
} from "./stock";

export const porcentajeStock = (value: number) =>
  `${value.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export function cantidadStock(
  q: number,
  p: ProductoOperativo,
  pallets = false,
) {
  const v = descomponerStock(q, p, pallets);
  const partes = [
    v.pallets ? `${fmt(v.pallets)} pallets` : "",
    v.fardos || !v.pallets ? `${fmt(v.fardos)} fardos` : "",
    v.sueltas ? `${fmt(v.sueltas)} un.` : "",
  ].filter(Boolean);
  return `${v.negativo ? "−" : ""}${partes.join(" + ")}`;
}

export function filasStockCSV(
  productos: ProductoOperativo[],
  pallets: boolean,
) {
  return filtrarStock(productos, { busqueda: "", estado: "" }).map((p) => {
    const q = cantidadesStock(p);
    return [
      p.codigo,
      p.alias,
      p.nombre,
      cantidadStock(p.stock, p, pallets),
      cantidadStock(q.entregable, p, pallets),
      ...q.pendientes.map((v) => cantidadStock(v, p, pallets)),
      cantidadStock(q.total, p, pallets),
      q.porcentaje === null ? "Sin pendientes" : porcentajeStock(q.porcentaje),
    ];
  });
}
export const columnasStockCSV = [
  "Código",
  "Alias",
  "Producto",
  "Stock físico",
  "Stock entregable",
  ...columnasPendientes.map(([, label]) => label),
  "Total pendiente",
  "% disponible",
];
