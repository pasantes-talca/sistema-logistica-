import type {
  EmpleadoOperativo,
  LineaCarga,
  ProductoOperativo,
} from "../../api/expedicionOperativa";
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function buscarEmpleados(
  empleados: EmpleadoOperativo[],
  q: string,
  soloActivos = true,
) {
  const busqueda = normalizar(q);
  return empleados.filter(
    (e) =>
      (!soloActivos || e.activo) &&
      normalizar(`${e.legajo} ${e.nombre} ${e.apellido}`).includes(busqueda),
  );
}
export function primerEmpleado(empleados: EmpleadoOperativo[], q: string) {
  const matches = buscarEmpleados(empleados, q);
  return (
    matches.find((e) => normalizar(e.legajo) === normalizar(q)) || matches[0]
  );
}
export function validarOperacionEmpleado(
  empleado: EmpleadoOperativo,
  tipo: "CONSUMO" | "ANTICIPO",
  lineas: LineaCarga[],
  productos: ProductoOperativo[],
) {
  if (!empleado.activo) throw new Error("Seleccioná un empleado activo.");
  if (!lineas.length) throw new Error("Agregá al menos un producto.");
  let totalFardos = 0;
  for (const l of lineas) {
    const p = productos.find((p) => p.id === l.producto && p.activo);
    if (!p) throw new Error("Seleccioná un producto activo en cada fila.");
    if (
      !Number.isInteger(l.packs) ||
      !Number.isInteger(l.unidades) ||
      l.packs < 0 ||
      l.unidades < 0 ||
      l.packs + l.unidades <= 0
    )
      throw new Error("Ingresá cantidades enteras y mayores que cero.");
    if (tipo === "CONSUMO" && (!p.beneficio_empleado || l.unidades !== 0))
      throw new Error(
        "El beneficio admite solo fardos completos de productos habilitados.",
      );
    totalFardos += l.packs;
  }
  if (tipo === "CONSUMO" && totalFardos > empleado.saldo_fardos)
    throw new Error(
      `Saldo insuficiente: seleccionaste ${totalFardos} fardos y el empleado dispone de ${empleado.saldo_fardos}.`,
    );
  return {
    totalFardos,
    saldoPosterior:
      empleado.saldo_fardos - (tipo === "CONSUMO" ? totalFardos : 0),
  };
}
