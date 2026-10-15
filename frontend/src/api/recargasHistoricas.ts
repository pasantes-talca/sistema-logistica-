export type CeldaOriginal = string | number | boolean | null;
export type LoteHistorico = {
  id: number;
  nombre: string;
  origen_id: string;
  creado_en: string;
  huella: string;
  revision: {
    registros: number;
    resumenes: number;
    empleados_padron: number;
    registros_para_revisar: number;
    fechas_para_revisar: number;
    participantes_repetidos: number;
  };
};
export type RepartoHistorico = {
  fila: number;
  fecha_original: string;
  fecha: string | null;
  patente: string;
  asignacion: string;
  chofer: string;
  ayudantes: string[];
  bultos: string;
  puntos_venta: string;
  recargas: string;
  recarga_total: string;
  observaciones: string;
  incidencias: string[];
  calculo_actual: {
    recargas: number;
    cantidad_personas: number;
    recargas_totales: number;
  } | null;
  celdas_originales: CeldaOriginal[];
};
export type ResumenHistorico = {
  nombre: string;
  sheet_id?: number;
  filas: CeldaOriginal[][];
};
const URL = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"}/repartos/historicos/`;
async function leer<T>(path = ""): Promise<T> {
  const response = await fetch(URL + path, { credentials: "include" });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "El servidor todavía no tiene instalado el soporte histórico."
        : response.status === 403 || response.status === 401
          ? "La consulta histórica requiere una sesión con acceso a Repartos."
          : "No se pudo consultar el histórico. Verificá que la migración esté aplicada en el servidor.",
    );
  return response.json();
}
export const obtenerImportaciones = () => leer<LoteHistorico[]>();
export const obtenerRepartosHistoricos = (id: number) =>
  leer<RepartoHistorico[]>(`${id}/registros/`);
export const obtenerResumenesHistoricos = (id: number) =>
  leer<ResumenHistorico[]>(`${id}/resumenes/`);
export const obtenerPadronHistorico = (id: number) =>
  leer<CeldaOriginal[][]>(`${id}/padron/`);
export const obtenerCopiaHistorica = (id: number) =>
  leer<unknown>(`${id}/respaldo/`);
