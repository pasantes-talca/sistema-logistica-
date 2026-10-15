import { useSyncExternalStore } from "react";

export type TurnoExpedicion = "Mañana" | "Tarde";
const clave = "expedicion-turno";
const suscriptores = new Set<() => void>();

function leerTurno(): TurnoExpedicion {
  try {
    return sessionStorage.getItem(clave) === "Tarde" ? "Tarde" : "Mañana";
  } catch {
    return "Mañana";
  }
}

let turnoActual = leerTurno();
const obtenerTurno = () => turnoActual;

function suscribir(notificar: () => void) {
  suscriptores.add(notificar);
  return () => { suscriptores.delete(notificar); };
}

function setTurno(turno: TurnoExpedicion) {
  if (turnoActual === turno) return;
  turnoActual = turno;
  try {
    sessionStorage.setItem(clave, turno);
  } catch {
    // Mantener la selección durante la visita si el navegador bloquea el almacenamiento.
  }
  suscriptores.forEach((notificar) => notificar());
}

/** Compartido entre el encabezado y la operativa; conserva la sesión de esta pestaña. */
export function useTurnoExpedicion() {
  const turno = useSyncExternalStore(suscribir, obtenerTurno, () => "Mañana" as const);
  return { turno, setTurno };
}
