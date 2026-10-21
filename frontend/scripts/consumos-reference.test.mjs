import test from "node:test";
import assert from "node:assert/strict";
import { resumirConsumos } from "../src/components/expedicion/consumos.ts";
const filtros = { desde: "", hasta: "", tipo: "", usuario: "" };
const mov = (extras = {}) => ({
  id: 1,
  tipo: "CONSUMO_EMPLEADO",
  cantidad: 12,
  producto: 1,
  sin_impacto: false,
  direccion: "SALIDA",
  referencia: "CE-000001",
  operacion: "uno",
  fecha: "2026-10-21",
  turno: "Mañana",
  usuario: "Operador",
  ...extras,
});
const data = (movimientos) => ({
  productos: [
    {
      id: 1,
      codigo: "P1",
      nombre: "Cola",
      unidades_pack: 6,
      configurado: true,
    },
    {
      id: 2,
      codigo: "P2",
      nombre: "Soda",
      unidades_pack: 12,
      configurado: true,
    },
  ],
  movimientos,
  comprobantes: [
    {
      empleado: 1,
      numero: "CE-000001",
      tipo: "CONSUMO",
      lineas: [{ producto: 1, unidades: 12 }],
    },
  ],
  empleados: [{ id: 1, legajo: "001", nombre: "Empleado", apellido: "Prueba" }],
});
test("agrupa una operación multiproducto y no duplica comprobantes", () => {
  const d = data([mov(), mov({ id: 2, producto: 2, cantidad: 6 })]);
  const resumen = resumirConsumos(d, filtros);
  assert.equal(resumen.operaciones.length, 1);
  assert.equal(resumen.fardos, 2.5);
  assert.equal(resumen.operaciones[0].beneficiario, "001 · Empleado Prueba");
  assert.equal(d.movimientos.length, 2);
});
test("filtra fechas inclusivas, tipo y encargado; ignora entradas, derrames y otras salidas", () => {
  const d = data([
    mov(),
    mov({ id: 2, operacion: "dos", tipo: "BUFFET" }),
    mov({
      id: 3,
      operacion: "tres",
      tipo: "ANTICIPO_EMPLEADO",
      usuario: "Otro",
    }),
    mov({ id: 4, direccion: "ENTRADA" }),
    mov({ id: 5, sin_impacto: true }),
    mov({ id: 6, tipo: "ORDEN_CARGA" }),
  ]);
  assert.equal(resumirConsumos(d, filtros).fardos, 6);
  assert.equal(
    resumirConsumos(d, {
      ...filtros,
      desde: "2026-10-21",
      hasta: "2026-10-21",
      tipo: "BUFFET",
      usuario: "Operador",
    }).fardos,
    2,
  );
  assert.equal(
    resumirConsumos(d, { ...filtros, desde: "2026-10-22" }).fardos,
    0,
  );
  assert.equal(
    resumirConsumos(d, { ...filtros, usuario: "Otro" }).operaciones.length,
    1,
  );
});
test("no inventa equivalencias; sin operación preserva filas separadas", () => {
  const resumen = resumirConsumos(
    data([
      mov({ operacion: "", producto: 999 }),
      mov({ id: 2, operacion: "" }),
    ]),
    filtros,
  );
  assert.equal(resumen.completa, false);
  assert.equal(resumen.operaciones.length, 2);
  assert.equal(resumen.productos.find((p) => p.codigo === "?").completa, false);
});
