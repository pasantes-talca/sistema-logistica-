const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";


// ============================================================
// TIPOS
// ============================================================

export type Fletero = {
  id: number;
  nombre: string;
  apellido: string;
  empresa: string;
  activo: boolean;
};


export type StockProducto = {
  id: number;
  producto_id: number;
  codigo: string;
  producto: string;
  cantidad_unidades: string;
  stock_minimo: string;
  stock_critico: string;
  actualizado_en: string;
};


export type DetalleOrdenCarga = {
  id: number;
  producto: number;
  codigo: string;
  producto_nombre: string;
  cantidad_solicitada: string;
};


export type DetalleEntregaOrdenCarga = {
  id: number;
  producto: number;
  codigo: string;
  producto_nombre: string;
  cantidad_entregada: string;
};


export type EntregaOrdenCarga = {
  id: number;
  orden: number;
  fecha: string;

  inicio_carga: string | null;
  fin_carga: string | null;

  pallets_salida: string;
  pallets_entrada: string;

  chapadur_salida: string;
  chapadur_entrada: string;

  observaciones: string;
  justificacion_stock: string;

  creado_por: number | null;
  creado_por_nombre: string;

  detalles: DetalleEntregaOrdenCarga[];
};


export type OrdenCarga = {
  id: number;
  numero: string;
  fecha: string;

  fletero: number;
  fletero_nombre: string;

  estado: string;
  facturacion: string;

  observaciones: string;

  creado_por: number | null;
  creado_por_nombre: string;

  creado_en: string;
  actualizado_en: string;

  detalles: DetalleOrdenCarga[];
  entregas: EntregaOrdenCarga[];
};


export type MovimientoStock = {
  id: number;

  producto: number;
  codigo: string;
  producto_nombre: string;

  tipo: string;
  direccion: string;

  cantidad: string;

  referencia: string;
  observaciones: string;

  orden: number | null;

  creado_por: number | null;
  creado_por_nombre: string;

  creado_en: string;
};


export type MovimientoMaterial = {
  id: number;

  fletero: number;
  fletero_nombre: string;

  orden: number | null;

  referencia: string;
  origen: string;

  pallets_salida: string;
  pallets_entrada: string;

  chapadur_salida: string;
  chapadur_entrada: string;

  creado_por: number | null;
  creado_en: string;
};


// ============================================================
// PAYLOADS
// ============================================================

export type CrearFleteroPayload = {
  nombre: string;
  apellido?: string;
  empresa?: string;
  activo?: boolean;
};


export type CrearDetalleOrdenPayload = {
  producto_id: number;
  cantidad_solicitada: number;
};


export type CrearOrdenCargaPayload = {
  numero: string;
  fecha: string;
  fletero_id: number;
  observaciones?: string;
  detalles: CrearDetalleOrdenPayload[];
};


export type CrearDetalleEntregaPayload = {
  producto_id: number;
  cantidad_entregada: number;
};


export type CrearEntregaPayload = {
  inicio_carga?: string | null;
  fin_carga?: string | null;

  pallets_salida?: number;
  pallets_entrada?: number;

  chapadur_salida?: number;
  chapadur_entrada?: number;

  observaciones?: string;
  justificacion_stock?: string;

  detalles: CrearDetalleEntregaPayload[];
};


export type CrearMovimientoStockPayload = {
  producto_id: number;

  tipo:
    | "INGRESO"
    | "ORDEN_CARGA"
    | "AJUSTE"
    | "REBOTE"
    | "DERRAME"
    | "CONSUMO_EMPLEADO"
    | "ANTICIPO_EMPLEADO";

  direccion:
    | "ENTRADA"
    | "SALIDA";

  cantidad: number;

  referencia?: string;
  observaciones?: string;
};


// ============================================================
// UTILIDADES
// ============================================================

function obtenerCookie(
  nombre: string
): string | null {

  const cookies =
    document.cookie.split(";");


  for (
    const cookie
    of cookies
  ) {

    const [
      clave,
      ...resto
    ] =
      cookie
        .trim()
        .split("=");


    if (
      clave === nombre
    ) {

      return decodeURIComponent(
        resto.join("=")
      );
    }
  }


  return null;
}


async function procesarError(
  response: Response
): Promise<never> {

  let datos: any = null;

  try {
    datos =
      await response.json();

  } catch {
    datos = null;
  }


  const mensaje =
    datos?.error
    ??
    datos?.detail
    ??
    (
      datos
        ? JSON.stringify(datos)
        : `Error HTTP ${response.status}`
    );


  throw new Error(
    mensaje
  );
}


async function getJson<T>(
  url: string
): Promise<T> {

  const response =
    await fetch(
      url,
      {
        credentials:
          "include",
      }
    );


  if (!response.ok) {
    return procesarError(
      response
    );
  }


  return response.json();
}


async function enviarJson<T>(
  url: string,
  method: "POST" | "PUT" | "PATCH",
  datos: unknown
): Promise<T> {

  const csrfToken =
    obtenerCookie(
      "csrftoken"
    );


  const response =
    await fetch(
      url,
      {
        method,

        credentials:
          "include",

        headers: {
          "Content-Type":
            "application/json",

          ...(
            csrfToken
              ? {
                  "X-CSRFToken":
                    csrfToken,
                }
              : {}
          ),
        },

        body:
          JSON.stringify(
            datos
          ),
      }
    );


  if (!response.ok) {
    return procesarError(
      response
    );
  }


  return response.json();
}


// ============================================================
// FLETEROS
// ============================================================

export function obtenerFleteros():
Promise<Fletero[]> {

  return getJson<Fletero[]>(
    `${API_URL}/expedicion/fleteros/`
  );
}


export function crearFletero(
  datos: CrearFleteroPayload
): Promise<Fletero> {

  return enviarJson<Fletero>(
    `${API_URL}/expedicion/fleteros/`,
    "POST",
    datos
  );
}


// ============================================================
// STOCK
// ============================================================

export function obtenerStockExpedicion():
Promise<StockProducto[]> {

  return getJson<StockProducto[]>(
    `${API_URL}/expedicion/stock/`
  );
}


// ============================================================
// MOVIMIENTOS DE STOCK
// ============================================================

export function obtenerMovimientosStock():
Promise<MovimientoStock[]> {

  return getJson<MovimientoStock[]>(
    `${API_URL}/expedicion/movimientos/`
  );
}


export function crearMovimientoStock(
  datos: CrearMovimientoStockPayload
): Promise<MovimientoStock> {

  return enviarJson<MovimientoStock>(
    `${API_URL}/expedicion/movimientos/`,
    "POST",
    datos
  );
}


// ============================================================
// ÓRDENES
// ============================================================

export function obtenerOrdenesCarga():
Promise<OrdenCarga[]> {

  return getJson<OrdenCarga[]>(
    `${API_URL}/expedicion/ordenes/`
  );
}


export function obtenerOrdenCarga(
  id: number
): Promise<OrdenCarga> {

  return getJson<OrdenCarga>(
    `${API_URL}/expedicion/ordenes/${id}/`
  );
}


export function crearOrdenCarga(
  datos: CrearOrdenCargaPayload
): Promise<OrdenCarga> {

  return enviarJson<OrdenCarga>(
    `${API_URL}/expedicion/ordenes/`,
    "POST",
    datos
  );
}


// ============================================================
// ENTREGAS
// ============================================================

export function crearEntregaOrden(
  ordenId: number,
  datos: CrearEntregaPayload
): Promise<{
  mensaje: string;
  entrega: {
    id: number;
    orden_id: number;
    estado_orden: string;
  };
}> {

  return enviarJson(
    `${API_URL}/expedicion/ordenes/${ordenId}/entregas/`,
    "POST",
    datos
  );
}


// ============================================================
// MATERIALES
// ============================================================

export function obtenerMovimientosMaterial():
Promise<MovimientoMaterial[]> {

  return getJson<MovimientoMaterial[]>(
    `${API_URL}/expedicion/materiales/`
  );
}