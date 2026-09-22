
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
  RespuestaAsistente,
  Viatico,
  CrearViaticoPayload,
  ResumenAnualViaticos,
  DestinoKilometraje,
  ControlKilometraje,
  CrearControlKilometrajePayload,
  EstadisticasKilometrajes,
  ControlDiario,
  CrearControlDiarioPayload,
  ProductoControlDiario,
  ResumenControlDiario,
  UbicacionControlDiario,
  EstadisticasControlDiario,
} from "../types/logistica";




//const API_URL = "http://127.0.0.1:8000/api";
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";



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

export async function preguntarAsistente(
  pregunta: string
): Promise<RespuestaAsistente> {

  const csrfToken =
    obtenerCookie("csrftoken");


  const response = await fetch(
    `${API_URL}/asistente/preguntar/`,
    {
      method: "POST",

      credentials: "include",

      headers: {
        "Content-Type": "application/json",

        ...(csrfToken
          ? {
              "X-CSRFToken":
                csrfToken,
            }
          : {}),
      },

      body: JSON.stringify({
        pregunta,
      }),
    }
  );


  const datos =
    await response.json();


  if (!response.ok) {

    throw new Error(
      datos.error
      ??
      datos.detail
      ??
      `Error HTTP ${response.status}`
    );
  }


  return datos;
}

function obtenerCookie(nombre: string): string | null {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [clave, ...resto] = cookie.trim().split("=");

    if (clave === nombre) {
      return decodeURIComponent(
        resto.join("=")
      );
    }
  }

  return null;
}

// =============================================
// VIÁTICOS
// =============================================


export function obtenerViaticos():
Promise<Viatico[]> {

  return getJson<Viatico[]>(
    `${API_URL}/viaticos/`
  );
}


export function obtenerViatico(
  id: number
): Promise<Viatico> {

  return getJson<Viatico>(
    `${API_URL}/viaticos/${id}/`
  );
}


export async function crearViatico(
  datos: CrearViaticoPayload
): Promise<Viatico> {

  const response = await fetch(
    `${API_URL}/viaticos/`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(
        datos
      ),
    }
  );


  if (!response.ok) {

    const error =
      await response.json();

    throw new Error(
      JSON.stringify(error)
    );
  }


  return response.json();
}


export async function actualizarViatico(
  id: number,
  datos: CrearViaticoPayload
): Promise<Viatico> {

  const response = await fetch(
    `${API_URL}/viaticos/${id}/`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(
        datos
      ),
    }
  );


  if (!response.ok) {

    const error =
      await response.json();

    throw new Error(
      JSON.stringify(error)
    );
  }


  return response.json();
}


export async function eliminarViatico(
  id: number
): Promise<void> {

  const response = await fetch(
    `${API_URL}/viaticos/${id}/`,
    {
      method: "DELETE",
    }
  );


  if (!response.ok) {

    throw new Error(
      "No se pudo eliminar el viático."
    );
  }
}


export function obtenerResumenAnualViaticos(
  anio: number
): Promise<ResumenAnualViaticos> {

  return getJson<ResumenAnualViaticos>(
    `${API_URL}/viaticos/resumen-anual/?anio=${anio}`
  );
}

// ============================================================
// KILOMETRAJES
// ============================================================


export function obtenerDestinosKilometraje():
Promise<DestinoKilometraje[]> {

  return getJson<DestinoKilometraje[]>(
    `${API_URL}/kilometrajes/destinos/`
  );
}


export function obtenerControlesKilometraje():
Promise<ControlKilometraje[]> {

  return getJson<ControlKilometraje[]>(
    `${API_URL}/kilometrajes/`
  );
}


export function obtenerControlKilometraje(
  id: number
): Promise<ControlKilometraje> {

  return getJson<ControlKilometraje>(
    `${API_URL}/kilometrajes/${id}/`
  );
}


export async function crearControlKilometraje(
  datos: CrearControlKilometrajePayload
): Promise<ControlKilometraje> {

  const csrfToken =
    obtenerCookie("csrftoken");


  const response = await fetch(
    `${API_URL}/kilometrajes/`,
    {
      method: "POST",

      credentials: "include",

      headers: {
        "Content-Type":
          "application/json",

        ...(csrfToken
          ? {
              "X-CSRFToken":
                csrfToken,
            }
          : {}),
      },

      body: JSON.stringify(
        datos
      ),
    }
  );


  if (!response.ok) {

    const error =
      await response
        .json()
        .catch(
          () => null
        );


    throw new Error(
      error?.detail
      ??
      error?.error
      ??
      JSON.stringify(error)
      ??
      "No se pudo crear el control de kilometraje."
    );
  }


  return response.json();
}


export async function eliminarControlKilometraje(
  id: number
): Promise<void> {

  const csrfToken =
    obtenerCookie("csrftoken");


  const response = await fetch(
    `${API_URL}/kilometrajes/${id}/`,
    {
      method: "DELETE",

      credentials: "include",

      headers: {
        ...(csrfToken
          ? {
              "X-CSRFToken":
                csrfToken,
            }
          : {}),
      },
    }
  );


  if (!response.ok) {

    const error =
      await response
        .json()
        .catch(
          () => null
        );


    throw new Error(
      error?.detail
      ??
      error?.error
      ??
      "No se pudo eliminar el control de kilometraje."
    );
  }
}

export function obtenerEstadisticasKilometrajes(
  desde?: string,
  hasta?: string
): Promise<EstadisticasKilometrajes> {

  const parametros =
    new URLSearchParams();

  if (desde) {
    parametros.set(
      "desde",
      desde
    );
  }

  if (hasta) {
    parametros.set(
      "hasta",
      hasta
    );
  }

  const query =
    parametros.toString();

  return getJson<EstadisticasKilometrajes>(
    `${API_URL}/kilometrajes/estadisticas/${
      query
        ? `?${query}`
        : ""
    }`
  );
}

export async function obtenerProductosControlDiario():
  Promise<ProductoControlDiario[]> {

  const response = await fetch(
    `${API_URL}/control-diario/productos/`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "No se pudieron obtener los productos del control diario."
    );
  }

  return response.json();
}


export async function obtenerUbicacionesControlDiario():
  Promise<UbicacionControlDiario[]> {

  const response = await fetch(
    `${API_URL}/control-diario/ubicaciones/`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(
      "No se pudieron obtener las ubicaciones del control diario."
    );
  }

  return response.json();
}


export async function obtenerControlesDiarios(
  desde?: string,
  hasta?: string
): Promise<ControlDiario[]> {

  const params =
    new URLSearchParams();


  if (desde) {
    params.set(
      "desde",
      desde
    );
  }


  if (hasta) {
    params.set(
      "hasta",
      hasta
    );
  }


  const query =
    params.toString();


  const url =
    query
      ? `${API_URL}/control-diario/?${query}`
      : `${API_URL}/control-diario/`;


  const response = await fetch(
    url,
    {
      credentials: "include",
    }
  );


  if (!response.ok) {
    throw new Error(
      "No se pudieron obtener los controles diarios."
    );
  }


  return response.json();
}


export async function obtenerControlDiario(
  id: number
): Promise<ControlDiario> {

  const response = await fetch(
    `${API_URL}/control-diario/${id}/`,
    {
      credentials: "include",
    }
  );


  if (!response.ok) {
    throw new Error(
      "No se pudo obtener el control diario."
    );
  }


  return response.json();
}


export async function crearControlDiario(
  payload: CrearControlDiarioPayload
): Promise<ControlDiario> {

  const csrfToken =
    obtenerCookie(
      "csrftoken"
    );


  const response = await fetch(
    `${API_URL}/control-diario/`,
    {
      method: "POST",

      credentials: "include",

      headers: {
        "Content-Type":
          "application/json",

        ...(csrfToken
          ? {
              "X-CSRFToken":
                csrfToken,
            }
          : {}),
      },

      body:
        JSON.stringify(
          payload
        ),
    }
  );


  if (!response.ok) {

    let mensaje =
      "No se pudo guardar el control diario.";


    try {

      const error =
        await response.json();

      mensaje =
        JSON.stringify(
          error
        );

    } catch {
      // dejamos el mensaje original
    }


    throw new Error(
      mensaje
    );
  }


  return response.json();
}


export async function eliminarControlDiario(
  id: number
): Promise<void> {

  const csrfToken =
    obtenerCookie(
      "csrftoken"
    );


  const response = await fetch(
    `${API_URL}/control-diario/${id}/`,
    {
      method: "DELETE",

      credentials: "include",

      headers: {
        ...(csrfToken
          ? {
              "X-CSRFToken":
                csrfToken,
            }
          : {}),
      },
    }
  );


  if (!response.ok) {
    throw new Error(
      "No se pudo eliminar el control diario."
    );
  }
}


export async function obtenerResumenControlDiario(
  id: number
): Promise<ResumenControlDiario> {

  const response = await fetch(
    `${API_URL}/control-diario/${id}/resumen/`,
    {
      credentials: "include",
    }
  );


  if (!response.ok) {
    throw new Error(
      "No se pudo obtener el resumen del control diario."
    );
  }


  return response.json();
}

export async function obtenerEstadisticasControlDiario(
  desde?: string,
  hasta?: string
): Promise<EstadisticasControlDiario> {

  const params =
    new URLSearchParams();


  if (desde) {
    params.set(
      "desde",
      desde
    );
  }


  if (hasta) {
    params.set(
      "hasta",
      hasta
    );
  }


  const query =
    params.toString();


  const url =
    query
      ? `${API_URL}/control-diario/estadisticas/?${query}`
      : `${API_URL}/control-diario/estadisticas/`;


  const response = await fetch(
    url,
    {
      credentials: "include",
    }
  );


  if (!response.ok) {
    throw new Error(
      "No se pudieron obtener las estadísticas del control diario."
    );
  }


  return response.json();
}