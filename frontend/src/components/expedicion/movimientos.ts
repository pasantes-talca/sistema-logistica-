import type {
  MovimientoOperativo,
  ProductoOperativo,
} from "../../api/expedicionOperativa";

export const tiposMovimiento: Record<string, string> = {
  PRODUCCION: "Producción codificada",
  PRODUCCION_SIN_CODIFICAR: "Producción sin codificar",
  REBOTE: "Rebote",
  DERRAME: "Derrame",
  AJUSTE: "Ajuste de inventario",
  BUFFET: "Consumo interno - Buffet",
  TRANSFERENCIA: "Mendoza / San Juan",
  ORDEN_CARGA: "Orden de carga",
  CORRECCION: "Corrección de orden",
  ANULACION: "Anulación de orden",
  INGRESO: "Ingreso",
  CONSUMO_EMPLEADO: "Consumo de empleado",
  ANTICIPO_EMPLEADO: "Anticipo empleado",
};
export function nombreMovimiento(m: MovimientoOperativo): string {
  if (m.tipo === "TRANSFERENCIA" && m.destino)
    return `${m.direccion === "ENTRADA" ? "Recepción desde" : "Envío a"} ${m.destino}`;
  return tiposMovimiento[m.tipo] || m.tipo;
}
export type GrupoMovimiento = {
  clave: string;
  tipo: string;
  fecha: string;
  referencia: string;
  usuario: string;
  turno: string;
  orden: number | null;
  lineas: MovimientoOperativo[];
  productos: number;
  entrada: number;
  salida: number;
  neutral: number;
  equivalenciasCompletas: boolean;
};
export type FiltrosMovimientos = {
  desde: string;
  hasta: string;
  tipo: string;
  busqueda?: string;
  turno?: string;
};
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function agruparMovimientos(
  movimientos: MovimientoOperativo[],
  productos: ProductoOperativo[],
): GrupoMovimiento[] {
  const catalogo = new Map(productos.map((p) => [p.id, p]));
  const map = new Map<string, GrupoMovimiento>();
  // Primero los registros más recientes; las filas de una operación mantienen
  // su detalle íntegro, incluidas las entradas compensatorias de una corrección.
  const ordenados = [...movimientos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id,
  );
  for (const m of ordenados) {
    const deOrden = !!m.orden && ["ORDEN_CARGA", "CORRECCION"].includes(m.tipo);
    const tipo = deOrden ? "Orden de carga" : nombreMovimiento(m);
    const clave = deOrden
      ? `orden:${m.orden}`
      : m.operacion
        ? `operacion:${m.operacion}:${tipo}`
        : `movimiento:${m.id}`;
    let g = map.get(clave);
    if (!g) {
      g = {
        clave,
        tipo,
        fecha: m.fecha,
        referencia: m.referencia,
        usuario: m.usuario,
        turno: m.turno,
        orden: m.orden,
        lineas: [],
        productos: 0,
        entrada: 0,
        salida: 0,
        neutral: 0,
        equivalenciasCompletas: true,
      };
      map.set(clave, g);
    }
    g.lineas.push(m);
    const p = catalogo.get(m.producto);
    if (!p || p.configurado === false || !(p.unidades_pack > 0)) {
      g.equivalenciasCompletas = false;
      continue;
    }
    const fardos = m.cantidad / p.unidades_pack;
    if (m.sin_impacto) g.neutral += fardos;
    else if (m.direccion === "ENTRADA") g.entrada += fardos;
    else if (m.direccion === "SALIDA") g.salida += fardos;
  }
  return [...map.values()].map((g) => ({
    ...g,
    productos: new Set(g.lineas.map((m) => m.producto)).size,
  }));
}

export function filtrarMovimientos(
  grupos: GrupoMovimiento[],
  filtros: FiltrosMovimientos,
  productos: ProductoOperativo[],
): GrupoMovimiento[] {
  const catalogo = new Map(productos.map((p) => [p.id, p]));
  const q = normalizar(filtros.busqueda || "");
  return grupos.filter((g) => {
    const dia = g.fecha.slice(0, 10);
    // Filtrar después de agrupar, como en Salta: no truncar los totales de una
    // orden con entregas parciales ni ocultar sus movimientos compensatorios.
    return (
      (!filtros.desde || dia >= filtros.desde) &&
      (!filtros.hasta || dia <= filtros.hasta) &&
      (!filtros.tipo ||
        (filtros.tipo === "Producción"
          ? g.lineas.some((m) =>
              ["PRODUCCION", "PRODUCCION_SIN_CODIFICAR"].includes(m.tipo),
            )
          : g.tipo === filtros.tipo)) &&
      (!filtros.turno || g.lineas.some((m) => m.turno === filtros.turno)) &&
      (!q ||
        normalizar(
          [
            g.tipo,
            g.referencia,
            g.usuario,
            ...g.lineas.flatMap((m) => {
              const p = catalogo.get(m.producto);
              return [
                m.referencia,
                m.observaciones,
                p?.codigo || "",
                p?.nombre || "",
                p?.alias || "",
              ];
            }),
          ].join(" "),
        ).includes(q))
    );
  });
}

export function fechaMovimiento(fecha: string): string {
  const dia = fecha.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dia))
    return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
  return fecha || "—";
}
