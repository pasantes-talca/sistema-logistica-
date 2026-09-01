
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
  Concesionario,
  Producto,
  MotivoCambio,
  CrearReciboCambioPayload,
  RespuestaGuardarReciboCambio,
  ReciboCambio,
  EstadisticasCambios,
  LoginPayload,
  UsuarioActual,
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

export function obtenerConcesionarios(): Promise<Concesionario[]> {
  return getJson<Concesionario[]>(
    `${API_URL}/maestros/concesionarios/`
  );
}

export function obtenerProductos(): Promise<Producto[]> {
  return getJson<Producto[]>(
    `${API_URL}/maestros/productos/`
  );
}

export function obtenerMotivosCambio(
  familia: string
): Promise<MotivoCambio[]> {
  return getJson<MotivoCambio[]>(
    `${API_URL}/maestros/motivos-cambio/?familia=${encodeURIComponent(familia)}`
  );
}

export async function guardarReciboCambio(
  datos: CrearReciboCambioPayload
): Promise<RespuestaGuardarReciboCambio> {
  const response = await fetch(
    `${API_URL}/cambios/recibos/`,
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

export function obtenerRecibosCambio(): Promise<ReciboCambio[]> {
  return getJson<ReciboCambio[]>(
    `${API_URL}/cambios/recibos/`
  );
}


export function obtenerReciboCambio(
  id: number
): Promise<ReciboCambio> {
  return getJson<ReciboCambio>(
    `${API_URL}/cambios/recibos/${id}/`
  );
}

export async function actualizarReciboCambio(
  id: number,
  datos: CrearReciboCambioPayload
): Promise<ReciboCambio> {

  const response = await fetch(
    `${API_URL}/cambios/recibos/${id}/`,
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

export function obtenerEstadisticasCambios(
  desde: string,
  hasta: string,
  concesionarioId: number | null
): Promise<EstadisticasCambios> {

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

  if (
    concesionarioId !== null
  ) {
    parametros.set(
      "concesionario_id",
      String(
        concesionarioId
      )
    );
  }

  return getJson<EstadisticasCambios>(
    `${API_URL}/cambios/estadisticas/?${parametros.toString()}`
  );
}

export async function iniciarSesion(
  datos: LoginPayload
): Promise<UsuarioActual> {

  const response = await fetch(
    `${API_URL}/auth/login/`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(datos),
    }
  );

  if (!response.ok) {

    const error = await response.json();

    throw new Error(
      error.error ??
      "No se pudo iniciar sesión."
    );
  }

  return response.json();
}


export async function obtenerUsuarioActual():
Promise<UsuarioActual> {

  const response = await fetch(
    `${API_URL}/auth/usuario/`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "No hay una sesión activa."
    );
  }

  return response.json();
}


export async function cerrarSesion():
Promise<void> {

  const response = await fetch(
    `${API_URL}/auth/logout/`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "No se pudo cerrar la sesión."
    );
  }
}