import type {
  CatalogosERP,
  ListadoERP,
  RepartoERPDetalle,
  RecorridoERP,
  UnidadERP,
} from "../types/repartosErp";
const BASE = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"}/repartos-erp`;

async function json<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const cookie = document.cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("csrftoken="));
  const response = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    signal,
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            ...(cookie
              ? { "X-CSRFToken": decodeURIComponent(cookie.slice(10)) }
              : {}),
          },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "detail" in data
        ? String(data.detail)
        : JSON.stringify(data);
    throw new Error(
      message || `No se pudo completar la consulta (${response.status}).`,
    );
  }
  return data as T;
}
export interface FiltrosRepartosERP {
  fecha?: string;
  chofer?: string;
  ruta?: string;
  almacen?: string;
}
export const obtenerRepartosERP = (
  filtros: FiltrosRepartosERP,
  signal?: AbortSignal,
) =>
  json<ListadoERP>(
    `/?${new URLSearchParams(Object.entries(filtros).filter(([, v]) => Boolean(v)) as [string, string][]).toString()}`,
    undefined,
    signal,
  );
export const obtenerRepartoERP = (cod: number, signal?: AbortSignal) =>
  json<RepartoERPDetalle>(`/${cod}/`, undefined, signal);
export const catalogosERP = () => json<CatalogosERP>("/catalogos/");
export const importarERP = (cod: number) =>
  json<{ reparto: RepartoERPDetalle; advertencia: string }>(
    `/${cod}/importar/`,
    {},
  );
export const operarERP = (cod: number, datos: Record<string, unknown>) =>
  json<RepartoERPDetalle>(`/${cod}/acciones/`, datos);
export const planificarERP = (cod: number, datos: Record<string, unknown>) =>
  json<RecorridoERP>(`/${cod}/planificar/`, datos);
export const crearUnidadERP = (datos: Omit<UnidadERP, "id" | "activo">) =>
  json<UnidadERP>("/unidades/", datos);
