import type {
  DestinoKilometraje,
  RegistroKilometrajeEntrada,
} from "../../types/logistica";

export type ViajesPorFecha = Record<string, Record<number, string>>;
const DIA = 86400000;
export function instanteFecha(fecha: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const n = Date.parse(fecha + "T00:00:00Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === fecha
    ? n
    : null;
}
export function diasPeriodo(desde: string, hasta: string): number {
  const a = instanteFecha(desde),
    b = instanteFecha(hasta);
  return a !== null && b !== null && b >= a ? (b - a) / DIA + 1 : 0;
}
export function moverDia(fecha: string, delta: number): string {
  const n = instanteFecha(fecha);
  return n === null ? "" : new Date(n + delta * DIA).toISOString().slice(0, 10);
}
export function resumirViajes(
  viajes: ViajesPorFecha,
  destinos: DestinoKilometraje[],
  desde: string,
  hasta: string,
) {
  const catalogo = new Map(destinos.map((d) => [d.id, d]));
  const registros: RegistroKilometrajeEntrada[] = [];
  const errores: string[] = [];
  let excluidos = 0,
    totalKm = 0,
    cantidadViajes = 0;
  for (const [fecha, valores] of Object.entries(viajes).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (const [id, valor] of Object.entries(valores)) {
      if (valor === "" || Number(valor) === 0) continue;
      if (!diasPeriodo(desde, hasta) || fecha < desde || fecha > hasta) {
        excluidos++;
        continue;
      }
      const cantidad = Number(valor),
        destino = catalogo.get(Number(id));
      if (
        !Number.isSafeInteger(cantidad) ||
        cantidad < 0 ||
        !destino ||
        !Number.isFinite(Number(destino.distancia_km))
      ) {
        errores.push(
          `Revisá la cantidad de viajes del ${fecha.split("-").reverse().join("/")} para ${destino?.nombre || "un destino que ya no está disponible"}. Debe ser un número entero, sin valores negativos.`,
        );
        continue;
      }
      registros.push({
        fecha,
        destino: destino.id,
        cantidad_viajes: cantidad,
        observaciones: "",
      });
      cantidadViajes += cantidad;
      totalKm += cantidad * Number(destino.distancia_km);
    }
  }
  return { registros, errores, excluidos, totalKm, cantidadViajes };
}
