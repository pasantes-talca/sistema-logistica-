import type {
  AuditoriaOperativa,
  ProductoOperativo,
} from "../../api/expedicionOperativa";
export type FiltrosAuditoria = {
  busqueda: string;
  desde: string;
  hasta: string;
  turno: string;
  accion: string;
  entidad: string;
};
const categorias: Record<string, string> = {
  "Nueva orden": "Orden de carga",
  "Corregir orden": "Orden de carga",
  Entrega: "Orden de carga",
  "Anular orden": "Orden de carga",
  PRODUCCION: "Stock",
  PRODUCCION_SIN_CODIFICAR: "Stock",
  REBOTE: "Stock",
  DERRAME: "Stock",
  AJUSTE: "Stock",
  TRANSFERENCIA: "Stock",
  "Corregir movimiento": "Movimiento de stock",
  Materiales: "Pallets y chapadur",
  "Pendientes manuales": "Stock y pendientes",
  "Guardar fletero": "Fletero",
  "Configurar producto": "Producto",
  "Guardar empleado": "Empleado",
  "Acreditar beneficio": "Empleados",
  CONSUMO: "Empleado",
  ANTICIPO: "Empleado",
  Conteo: "Conteo",
  "Corroborar relevo": "Conteo",
  "Gestionar usuario": "Usuario",
  "Restaurar respaldo": "Respaldo",
};
export function entidadAuditoria(a: AuditoriaOperativa) {
  const valor = a.despues?.entidad || a.antes?.entidad;
  if (typeof valor === "string" && valor.trim())
    return { texto: valor, clasificada: false };
  return {
    texto: categorias[a.accion] || "—",
    clasificada: !!categorias[a.accion],
  };
}
export function usuarioAuditoria(a: AuditoriaOperativa): string {
  return a.despues?.origen === "Firebase" &&
    typeof a.despues.usuario_original === "string" &&
    a.despues.usuario_original
    ? a.despues.usuario_original
    : a.usuario;
}
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function filtrarAuditoria(
  registros: AuditoriaOperativa[],
  f: FiltrosAuditoria,
  productos: ProductoOperativo[] = [],
) {
  const q = normalizar(f.busqueda);
  return registros
    .filter(
      (a) =>
        (!f.desde || a.fecha.slice(0, 10) >= f.desde) &&
        (!f.hasta || a.fecha.slice(0, 10) <= f.hasta) &&
        (!f.turno || a.turno === f.turno) &&
        (!f.accion || a.accion === f.accion) &&
        (!f.entidad || entidadAuditoria(a).texto === f.entidad) &&
        (!q ||
          normalizar(
            `${usuarioAuditoria(a)} ${a.accion} ${entidadAuditoria(a).texto} ${a.referencia} ${a.motivo} ${detalleAuditoria(a, productos)} ${JSON.stringify(a.antes)} ${JSON.stringify(a.despues)}`,
          ).includes(q)),
    )
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha) || b.id - a.id);
}
export function detalleAuditoria(
  a: AuditoriaOperativa,
  productos: ProductoOperativo[] = [],
): string {
  if (a.motivo) return a.motivo;
  const d = a.despues || {};
  const fmt = (n: number) =>
    n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  if (Array.isArray(d.lineas) && d.lineas.length) {
    const rows = d.lineas.filter(
      (l): l is Record<string, unknown> => !!l && typeof l === "object",
    );
    if (rows.length && rows.every((l) => typeof l.diferencia === "number"))
      return `${rows.length} productos comparados · ${rows.filter((l) => l.diferencia !== 0).length} con diferencias`;
    const cantidades = rows
      .filter((l) => typeof l.unidades === "number")
      .map((l) => {
        const p = productos.find((p) => p.id === l.producto);
        return `${p ? `${p.codigo} · ${p.nombre}` : `Producto #${l.producto}`}: ${fmt(l.unidades as number)} un.`;
      });
    if (cantidades.length) return cantidades.join(" · ");
  }
  if (Array.isArray(d.empleados) && typeof d.fardos === "number")
    return `${d.empleados.length} empleados · +${fmt(d.fardos)} fardos por empleado`;
  if (typeof d.empleado === "number" && typeof d.saldo === "number")
    return `Empleado #${d.empleado} · Saldo posterior: ${fmt(d.saldo)} fardos`;
  if (typeof d.estado_operativo === "string")
    return `Estado: ${d.estado_operativo}`;
  if (typeof d.estado === "string") return `Estado: ${d.estado}`;
  if (typeof d.fecha === "string" && typeof d.referencia === "string")
    return `Fecha: ${d.fecha} · Referencia: ${d.referencia}`;
  if (typeof d.unidades_pack === "number")
    return `Unidades por fardo: ${d.unidades_pack}${typeof d.alias === "string" && d.alias ? ` · Alias: ${d.alias}` : ""}`;
  return "Sin detalle descriptivo registrado.";
}
