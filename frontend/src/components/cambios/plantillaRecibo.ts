// Mismo orden y códigos que PRODUCTOS_PLANTILLA en cambios/pdf.py.
export const plantillaRecibo = [
  ["1/5 LT.", "5051", "COLA"],
  ["", "5056", "LIMA"],
  ["", "5066", "NARANJA"],
  ["", "5071", "POMELO"],
  ["2 1/4 LT", "5200", "COLA"],
  ["", "5205", "LIMA"],
  ["", "5215", "NARANJA"],
  ["", "5220", "POMELO"],
  ["3 LT", "5670", "COLA"],
  ["", "5675", "LIMA"],
  ["", "5685", "NARANJA"],
  ["", "5690", "POMELO"],
  ["2 1/4 LT", "4900", "SODA"],
  ["2 LT", "4910", "SIFÓN"],
  ["1/2 LT", "417", "SODA"],
  ["AGUA 6 LT", "8690", "BIDÓN"],
  ["AGUA 2 LT", "8670", "AGUA"],
] as const;

export const camposOtros = [
  {
    campo: "pallets",
    nota: "pallets_observacion",
    titulo: "Pallets",
    codigo: "7060",
  },
  {
    campo: "pallets_descargados",
    nota: "pallets_descargados_observacion",
    titulo: "Pallets descargados",
    codigo: "",
  },
  {
    campo: "prensados",
    nota: "prensados_observacion",
    titulo: "Prensados",
    codigo: "757",
  },
] as const;
export type OtrosRecibo = Record<
  (typeof camposOtros)[number]["campo" | "nota"],
  string
>;
export interface FilaProducto {
  idLocal: number;
  productoId: string;
  cantidad: string;
  motivoId: string;
  observacion: string;
}
