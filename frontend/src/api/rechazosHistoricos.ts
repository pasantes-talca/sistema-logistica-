import type { CeldaOriginal } from "../components/historicos/archivoOriginal";
export type ImportacionRechazos = {
  id: number;
  nombre: string;
  origen_id: string;
  creado_en: string;
  huella: string;
  revision: {
    registros: number;
    fechas_para_revisar: number;
    registros_para_revisar: number;
    anexos: number;
  };
};
export type RechazoHistorico = {
  fila: number;
  fecha_original: string;
  fecha: string | null;
  marca_temporal: string;
  registrado_en: string | null;
  asignacion: string;
  punto_venta: string;
  bultos: string;
  motivo: string;
  observacion: string;
  incidencias: string[];
  celdas_originales: CeldaOriginal[];
};
export type AnexoRechazos = {
  nombre: string;
  oculta?: boolean;
  filas: CeldaOriginal[][];
};
const URL = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"}/rechazos/historicos/`;
async function leer<T>(path = ""): Promise<T> {
  const r = await fetch(URL + path, { credentials: "include" });
  if (!r.ok)
    throw new Error(
      r.status === 401 || r.status === 403
        ? "La consulta histórica requiere una sesión con acceso a Rechazos."
        : "No se pudo consultar el histórico. Verificá la instalación en el servidor.",
    );
  return r.json();
}
export const obtenerHistoricosRechazos = () => leer<ImportacionRechazos[]>();
export const obtenerRegistrosRechazos = (id: number) =>
  leer<RechazoHistorico[]>(`${id}/registros/`);
export const obtenerAnexosRechazos = (id: number) =>
  leer<AnexoRechazos[]>(`${id}/anexos/`);
export const obtenerCopiaRechazos = (id: number) =>
  leer<unknown>(`${id}/respaldo/`);
