const base = `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"}/administracion/`;
export type Modulo = { codigo: string; nombre: string };
export type Cuenta = {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  administrador: boolean;
  superusuario: boolean;
  protegido: boolean;
  modulos: string[];
  ultimo_ingreso: string | null;
  creado: string;
};
export type DatosCuenta = Pick<
  Cuenta,
  "username" | "nombre" | "apellido" | "activo" | "modulos"
> & { password?: string; administrador?: boolean };
export type CampoCatalogo = {
  clave: string;
  tipo: "text" | "boolean" | "empleado";
  requerido: boolean;
  maximo: number | null;
};
export type Catalogo = {
  clave: string;
  nombre: string;
  campos: CampoCatalogo[];
};
export type RegistroCatalogo = { id: number; familias?: string[] } & Record<
  string,
  string | number | boolean | null | string[] | undefined
>;
export type Evento = {
  id: number;
  fecha: string;
  usuario: string;
  modulo: string;
  accion: string;
  referencia: string;
  motivo: string;
  antes: unknown;
  despues: unknown;
};

function explicar(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(explicar).join(" ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => `${k === "detail" ? "" : `${k}: `}${explicar(v)}`)
      .join(" ");
  return "No se pudo completar la operación.";
}

export async function respuesta(path: string, method = "GET", data?: unknown) {
  const csrf = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrftoken="))
    ?.slice(10);
  const response = await fetch(base + path, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrf && method !== "GET" ? { "X-CSRFToken": csrf } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    throw new Error(
      error ? explicar(error) : "No se pudo conectar con el servidor.",
    );
  }
  return response;
}

export const listarUsuarios = async (): Promise<{
  modulos: Modulo[];
  usuarios: Cuenta[];
}> => (await respuesta("usuarios/")).json();
export const guardarUsuario = async (
  id: number | null,
  datos: DatosCuenta,
): Promise<Cuenta> =>
  (
    await respuesta(
      `usuarios/${id ? `${id}/` : ""}`,
      id ? "PATCH" : "POST",
      datos,
    )
  ).json();
export const restablecerPassword = async (
  id: number,
  password: string,
): Promise<{ mensaje: string }> =>
  (await respuesta(`usuarios/${id}/password/`, "POST", { password })).json();
export const listarCatalogos = async (): Promise<{
  catalogos: Catalogo[];
  empleados: { id: number; nombre: string }[];
  familias: string[];
}> => (await respuesta("catalogos/")).json();
export const leerCatalogo = async (
  clave: string,
): Promise<RegistroCatalogo[]> =>
  (await respuesta(`catalogos/${clave}/`)).json();
export const guardarCatalogo = async (
  clave: string,
  id: number | null,
  datos: Record<string, unknown>,
): Promise<RegistroCatalogo> =>
  (
    await respuesta(
      `catalogos/${clave}/${id ? `${id}/` : ""}`,
      id ? "PATCH" : "POST",
      datos,
    )
  ).json();
export const listarAuditoria = async (
  params: URLSearchParams,
): Promise<{
  total: number;
  pagina: number;
  tamano: number;
  resultados: Evento[];
}> => (await respuesta(`auditoria/?${params}`)).json();
export async function exportarAuditoria(params: URLSearchParams) {
  const query = new URLSearchParams(params);
  query.set("formato", "csv");
  const blob = await (await respuesta(`auditoria/?${query}`)).blob();
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "auditoria-sistema.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
