
import type {
  Empleado,
  Vehiculo,
  Asignacion,
  Reparto,
  CrearRepartoPayload,
  ReporteRecargas,
  MotivoRechazo,
  Rechazo,
  CrearRechazoPayload,
  EstadisticasRechazos,
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


export function obtenerMotivosRechazo(): Promise<MotivoRechazo[]> {
  return getJson<MotivoRechazo[]>(
    `${API_URL}/maestros/motivos-rechazo/`
  );
}


export async function crearRechazo(
  datos: CrearRechazoPayload
): Promise<Rechazo> {

  const response = await fetch(
    `${API_URL}/rechazos/`,
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

export function obtenerRechazos(): Promise<Rechazo[]> {
  return getJson<Rechazo[]>(
    `${API_URL}/rechazos/`
  );
}

export function obtenerRechazo(
  id: number
): Promise<Rechazo> {

  return getJson<Rechazo>(
    `${API_URL}/rechazos/${id}/`
  );
}


export async function actualizarRechazo(
  id: number,
  datos: CrearRechazoPayload
): Promise<Rechazo> {

  const response = await fetch(
    `${API_URL}/rechazos/${id}/`,
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


export function obtenerEstadisticasRechazos(
  desde: string,
  hasta: string,
  asignacionId: number | null
): Promise<EstadisticasRechazos> {

  const parametros =
    new URLSearchParams();

  parametros.set(
    "desde",
    desde
  );

  parametros.set(
    "hasta",
    hasta
  );


  if (asignacionId !== null) {

    parametros.set(
      "asignacion_id",
      String(asignacionId)
    );
  }


  return getJson<EstadisticasRechazos>(
    `${API_URL}/rechazos/estadisticas/?${parametros.toString()}`
  );
}