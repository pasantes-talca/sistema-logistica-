import type {
  ExpedicionOperativa,
  MovimientoOperativo,
} from "../../api/expedicionOperativa";

export const categoriasConsumo = {
  CONSUMO_EMPLEADO: "Consumos de empleados",
  ANTICIPO_EMPLEADO: "Anticipos de empleados",
  BUFFET: "Consumo interno / Buffet",
};
export type CategoriaConsumo = keyof typeof categoriasConsumo;
export type FiltrosConsumos = {
  desde: string;
  hasta: string;
  tipo: string;
  usuario: string;
};
export type OperacionConsumo = {
  clave: string;
  fecha: string;
  tipo: CategoriaConsumo;
  referencia: string;
  usuario: string;
  turno: string;
  beneficiario: string;
  fardos: number;
  completa: boolean;
  lineas: MovimientoOperativo[];
};

export function resumirConsumos(
  data: ExpedicionOperativa,
  filtros: FiltrosConsumos,
) {
  const catalogo = new Map(data.productos.map((p) => [p.id, p]));
  const grupos = new Map<string, OperacionConsumo>();
  const productos = new Map<
    number,
    {
      codigo: string;
      nombre: string;
      unidades: number;
      fardos: number;
      completa: boolean;
    }
  >();
  for (const m of data.movimientos) {
    // Comprobantes y movimientos representan la misma salida: sumar solo movimientos.
    if (
      !Object.hasOwn(categoriasConsumo, m.tipo) ||
      m.sin_impacto ||
      m.direccion !== "SALIDA"
    )
      continue;
    const dia = m.fecha.slice(0, 10);
    if (
      (filtros.desde && dia < filtros.desde) ||
      (filtros.hasta && dia > filtros.hasta) ||
      (filtros.tipo && m.tipo !== filtros.tipo) ||
      (filtros.usuario && m.usuario !== filtros.usuario)
    )
      continue;
    const tipo = m.tipo as CategoriaConsumo;
    const clave = `${tipo}:${m.operacion || `mov-${m.id}`}`;
    let g = grupos.get(clave);
    if (!g) {
      const comprobante = data.comprobantes.find(
        (c) =>
          c.numero === m.referencia &&
          c.tipo === (tipo === "CONSUMO_EMPLEADO" ? "CONSUMO" : "ANTICIPO"),
      );
      const empleado = data.empleados.find(
        (e) => e.id === comprobante?.empleado || e.legajo === m.referencia,
      );
      g = {
        clave,
        fecha: m.fecha,
        tipo,
        referencia: m.referencia,
        usuario: m.usuario,
        turno: m.turno,
        beneficiario:
          tipo === "BUFFET"
            ? m.referencia || "Buffet"
            : empleado
              ? `${empleado.legajo} · ${empleado.nombre} ${empleado.apellido}`
              : m.referencia || "Sin empleado identificado",
        fardos: 0,
        completa: true,
        lineas: [],
      };
      grupos.set(clave, g);
    }
    const p = catalogo.get(m.producto);
    const completa = !!p && p.configurado !== false && p.unidades_pack > 0;
    const fardos = completa ? m.cantidad / p.unidades_pack : 0;
    g.fardos += fardos;
    g.completa &&= completa;
    g.lineas.push(m);
    const producto = productos.get(m.producto) || {
      codigo: p?.codigo || "?",
      nombre: p?.nombre || `Producto #${m.producto}`,
      unidades: 0,
      fardos: 0,
      completa,
    };
    producto.unidades += m.cantidad;
    producto.fardos += fardos;
    producto.completa &&= completa;
    productos.set(m.producto, producto);
  }
  const operaciones = [...grupos.values()].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.clave.localeCompare(b.clave),
  );
  return {
    operaciones,
    productos: [...productos.values()].sort((a, b) => b.fardos - a.fardos),
    fardos: operaciones.reduce((n, g) => n + g.fardos, 0),
    completa: operaciones.every((g) => g.completa),
  };
}
