import test from "node:test";
import assert from "node:assert/strict";
import {
  buscarEmpleados,
  primerEmpleado,
  validarOperacionEmpleado,
} from "../src/components/expedicion/empleados.ts";
const empleado = {
  id: 1,
  legajo: "11607",
  nombre: "José",
  apellido: "Martínez",
  activo: true,
  saldo_fardos: 2,
};
const productos = [
  { id: 1, activo: true, beneficio_empleado: true },
  { id: 2, activo: true, beneficio_empleado: false },
  { id: 3, activo: false, beneficio_empleado: true },
];
const linea = (props = {}) => ({
  producto: 1,
  packs: 1,
  unidades: 0,
  ...props,
});
test("buscar por legajo, nombre y apellido sin acentos; padrón conserva inactivos", () => {
  const lista = [empleado, { ...empleado, id: 2, activo: false }];
  for (const q of ["11607", "jose", "martinez", "   jose   "])
    assert.equal(buscarEmpleados(lista, q).length, 1);
  assert.equal(buscarEmpleados(lista, "", false).length, 2);
});
test("Enter prioriza legajo exacto entre coincidencias y no inventa empleados", () => {
  assert.equal(
    primerEmpleado(
      [{ ...empleado, id: 2, legajo: "116070" }, empleado],
      "11607",
    ).id,
    1,
  );
  assert.equal(primerEmpleado([empleado], "desconocido"), undefined);
});
test("consumo suma varios productos y descuenta sólo fardos completos permitidos", () => {
  assert.deepEqual(
    validarOperacionEmpleado(
      empleado,
      "CONSUMO",
      [linea(), linea()],
      productos,
    ),
    { totalFardos: 2, saldoPosterior: 0 },
  );
  assert.throws(
    () =>
      validarOperacionEmpleado(
        empleado,
        "CONSUMO",
        [linea({ packs: 3 })],
        productos,
      ),
    /Saldo insuficiente/,
  );
  assert.throws(
    () =>
      validarOperacionEmpleado(
        empleado,
        "CONSUMO",
        [linea({ unidades: 1 })],
        productos,
      ),
    /fardos completos/,
  );
  assert.throws(
    () =>
      validarOperacionEmpleado(
        empleado,
        "CONSUMO",
        [linea({ producto: 2 })],
        productos,
      ),
    /habilitados/,
  );
});
test("anticipo admite botellas sueltas y nunca descuenta el beneficio", () => {
  assert.deepEqual(
    validarOperacionEmpleado(
      empleado,
      "ANTICIPO",
      [linea({ producto: 2, packs: 10, unidades: 3 })],
      productos,
    ),
    { totalFardos: 10, saldoPosterior: 2 },
  );
});
test("validación rechaza inactivos, producto inválido y cantidades incorrectas", () => {
  assert.throws(
    () =>
      validarOperacionEmpleado(
        { ...empleado, activo: false },
        "ANTICIPO",
        [linea()],
        productos,
      ),
    /empleado activo/,
  );
  for (const props of [
    { packs: -1 },
    { packs: 0.5 },
    { unidades: 0.5 },
    { packs: 0, unidades: 0 },
    { producto: 3 },
    { producto: 99 },
  ])
    assert.throws(() =>
      validarOperacionEmpleado(empleado, "ANTICIPO", [linea(props)], productos),
    );
  assert.throws(
    () => validarOperacionEmpleado(empleado, "CONSUMO", [], productos),
    /al menos/,
  );
});
