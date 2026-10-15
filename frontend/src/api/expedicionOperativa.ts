export type ProductoOperativo = {
  id: number;
  codigo: string;
  nombre: string;
  alias: string;
  activo: boolean;
  unidades_pack: number;
  packs_corte: number;
  cortes_pallet: number;
  beneficio_empleado: boolean;
  configurado: boolean;
  stock: number;
  sin_codificar: number;
  minimo: number;
  critico: number;
  pendientes: Record<string, number>;
  pendientes_manuales: Record<string, number>;
};
export type LineaOrden = {
  producto: number;
  codigo: string;
  producto_nombre: string;
  cantidad_solicitada: string;
  resuelto: number;
  pendiente: number;
};
export type OrdenOperativa = {
  id: number;
  numero: string;
  fecha: string;
  fletero: number;
  fletero_nombre: string;
  circuito: string;
  turno: string;
  anulada: boolean;
  version: number;
  facturacion: string;
  observaciones: string;
  estado_operativo: string;
  creado_por_nombre: string;
  detalles: LineaOrden[];
  creado_en: string;
  entregas: {
    id: number;
    fecha: string;
    fecha_operativa: string;
    turno: string;
    observaciones: string;
    creado_por_nombre: string;
    detalles: {
      id: number;
      producto: number;
      solicitado: number;
      codigo: string;
      producto_nombre: string;
      cantidad_entregada: number;
    }[];
  }[];
};
export type FleteroOperativo = {
  id: number;
  nombre: string;
  apellido: string;
  empresa: string;
  activo: boolean;
};
export type EmpleadoOperativo = {
  id: number;
  legajo: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  saldo_fardos: number;
};
export type MovimientoOperativo = {
  id: number;
  producto: number;
  tipo: string;
  destino: string;
  direccion: string;
  cantidad: number;
  referencia: string;
  observaciones: string;
  orden: number | null;
  operacion: string;
  fecha: string;
  turno: string;
  usuario: string;
  sin_impacto: boolean;
  sin_codificar: boolean;
};
export type MaterialOperativo = {
  id: number;
  fletero: number;
  orden: number | null;
  fecha: string;
  turno: string;
  referencia: string;
  origen: string;
  observaciones: string;
  pallets_salida: number;
  pallets_entrada: number;
  chapadur_salida: number;
  chapadur_entrada: number;
};
export type ComprobanteOperativo = {
  id: number;
  empleado: number;
  tipo: string;
  numero: string;
  fecha: string;
  usuario: string;
  turno: string;
  observaciones: string;
  lineas: {
    producto: number;
    codigo: string;
    nombre: string;
    unidades: number;
    pack: number;
  }[];
};
export type ConteoOperativo = {
  id: number;
  fecha: string;
  usuario: string;
  turno: string;
  tipo: string;
  observaciones: string;
  corroborado_por: string;
  corroborado_en: string | null;
  lineas: {
    producto: number;
    codigo: string;
    nombre: string;
    sistema: number;
    fisico: number;
    diferencia: number;
  }[];
};
export type AuditoriaOperativa = {
  id: number;
  fecha: string;
  usuario: string;
  turno: string;
  accion: string;
  referencia: string;
  motivo: string;
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
};
export type ExpedicionOperativa = {
  usuario: string;
  admin: boolean;
  superusuario: boolean;
  productos: ProductoOperativo[];
  ordenes: OrdenOperativa[];
  fleteros: FleteroOperativo[];
  empleados: EmpleadoOperativo[];
  movimientos: MovimientoOperativo[];
  materiales: MaterialOperativo[];
  comprobantes: ComprobanteOperativo[];
  conteos: ConteoOperativo[];
  auditoria: AuditoriaOperativa[];
  usuarios: { id: number; username: string; nombre: string; activo: boolean }[];
};
export type LineaCarga = {
  producto: number;
  packs: number;
  unidades: number;
  solicitado?: number;
};
const URL = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"}/expedicion/operativa/`;
async function request<T>(
  body?: Record<string, unknown>,
  url = URL,
): Promise<T> {
  const csrf = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrftoken="))
    ?.slice(10);
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRFToken": decodeURIComponent(csrf) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null
        ? Object.values(data).flat().join(" · ")
        : "No se pudo completar la operación.";
    throw new Error(
      response.status === 403
        ? "Tu sesión no tiene acceso o venció. Volvé a ingresar."
        : message,
    );
  }
  return data as T;
}
export const obtenerOperativa = () => request<ExpedicionOperativa>();
export const ejecutarOperacion = (body: Record<string, unknown>) =>
  request<{ id?: number; comprobante?: number }>(body);
export const exportarRespaldo = (id?: number) =>
  request<unknown>(
    undefined,
    URL.replace("operativa/", "respaldos/") + (id ? `?id=${id}` : ""),
  );
export const listarRespaldos = () =>
  request<{ id: number; fecha: string; motivo: string }[]>(
    undefined,
    URL.replace("operativa/", "respaldos/?listar=1"),
  );
export const importarRespaldo = (
  archivo: unknown,
  revision?: number,
  confirmacion?: string,
) =>
  request<{
    revision: number;
    cantidades: Record<string, number>;
    restaurado?: boolean;
  }>(
    { archivo, revision, confirmacion },
    URL.replace("operativa/", "respaldos/"),
  );
export function claveOperacion() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const s = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
