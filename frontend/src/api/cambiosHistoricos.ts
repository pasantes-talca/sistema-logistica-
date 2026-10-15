import type { CeldaOriginal } from "../components/historicos/archivoOriginal";
export type ImportacionCambios = {
  id: number;
  nombre: string;
  origen_id: string;
  creado_en: string;
  huella: string;
  revision: {
    recibos: number;
    resumenes: number;
    anexos: number;
    fechas_para_revisar: number;
    recibos_para_revisar: number;
  };
};
export type ProductoHistoricoCambio = {
  fila: number;
  codigo: string;
  presentacion: string;
  sabor: string;
  cantidad: string;
  observacion: string;
};
export type ReciboHistoricoCambio = {
  sheet_id: number;
  nombre_hoja: string;
  fecha_original: string;
  fecha: string | null;
  concesionario: string;
  productos: ProductoHistoricoCambio[];
  materiales: {
    fila: number;
    nombre: string;
    cantidad: string;
    observacion: string;
  }[];
  productos_cargados: number;
  incidencias: string[];
  filas_originales: CeldaOriginal[][];
};
export type HojaHistoricaCambios = {
  sheet_id: number;
  nombre: string;
  oculta?: boolean;
  filas: CeldaOriginal[][];
};
const URL = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"}/cambios/historicos/`;
async function leer<T>(path = ""): Promise<T> {
  const response = await fetch(URL + path, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Necesitás una sesión con acceso a Cambios para consultar el histórico."
        : "No se pudo consultar el histórico. Verificá la instalación en el servidor.",
    );
  return response.json();
}
export const obtenerHistoricosCambios = () => leer<ImportacionCambios[]>();
export const obtenerRecibosHistoricos = (id: number) =>
  leer<ReciboHistoricoCambio[]>(`${id}/recibos/`);
export const obtenerResumenesCambios = (id: number) =>
  leer<HojaHistoricaCambios[]>(`${id}/resumenes/`);
export const obtenerAnexosCambios = (id: number) =>
  leer<HojaHistoricaCambios[]>(`${id}/anexos/`);
export const obtenerCopiaCambios = (id: number) =>
  leer<unknown>(`${id}/respaldo/`);
