
import type {
  Empleado,
  Vehiculo,
  Asignacion,
  Reparto,
  CrearRepartoPayload,
  ReporteRecargas,
} from "../types/logistica";


const API_URL = "http://127.0.0.1:8000/api";


async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Error al consultar el servidor.");
  }

  return response.json();
}


export function obtenerChoferes(): Promise<Empleado[]> {
  return getJson<Empleado[]>(
    `${API_URL}/maestros/choferes/`
  );
}


export function obtenerAyudantes(): Promise<Empleado[]> {
  return getJson<Empleado[]>(
    `${API_URL}/maestros/ayudantes/`
  );
}


export function obtenerVehiculos(): Promise<Vehiculo[]> {
  return getJson<Vehiculo[]>(
    `${API_URL}/maestros/vehiculos/`
  );
}


export function obtenerAsignaciones(): Promise<Asignacion[]> {
  return getJson<Asignacion[]>(
    `${API_URL}/maestros/asignaciones/`
  );
}


export function obtenerRepartos(): Promise<Reparto[]> {
  return getJson<Reparto[]>(
    `${API_URL}/repartos/`
  );
}


export function obtenerReparto(
  id: number
): Promise<Reparto> {
  return getJson<Reparto>(
    `${API_URL}/repartos/${id}/`
  );
}


export async function crearReparto(
  datos: CrearRepartoPayload
): Promise<Reparto> {

  const response = await fetch(
    `${API_URL}/repartos/`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(datos),
    }
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      JSON.stringify(error)
    );
  }

  return response.json();
}


export async function actualizarReparto(
  id: number,
  datos: CrearRepartoPayload
): Promise<Reparto> {

  const response = await fetch(
    `${API_URL}/repartos/${id}/`,
    {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(datos),
    }
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      JSON.stringify(error)
    );
  }

  return response.json();
}

export function obtenerReporteRecargas(
  desde: string,
  hasta: string
): Promise<ReporteRecargas> {

  return getJson<ReporteRecargas>(
    `${API_URL}/repartos/reporte-recargas/` +
    `?desde=${desde}&hasta=${hasta}`
  );
}