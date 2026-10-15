import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarMateriales,
  saldosMateriales,
  totalesMateriales,
} from "../src/components/expedicion/materiales.ts";
const fleteros = [
  { id: 1, nombre: "Jeremías", apellido: "", empresa: "", activo: true },
  { id: 2, nombre: "Salta", apellido: "", empresa: "", activo: false },
];
const movimiento = (props = {}) => ({
  id: 1,
  fletero: 1,
  orden: null,
  fecha: "2026-10-14",
  turno: "Mañana",
  origen: "Carga por turno",
  referencia: "Turno Mañana",
  observaciones: "",
  pallets_salida: 0,
  pallets_entrada: 0,
  chapadur_salida: 0,
  chapadur_entrada: 0,
  ...props,
});
const vacios = { fletero: 0, desde: "", hasta: "", tipo: "" };
test("los seis indicadores mantienen entregado menos devuelto, sin truncar negativos", () => {
  const total = totalesMateriales([
    movimiento({
      pallets_salida: 28,
      pallets_entrada: 104,
      chapadur_salida: 112,
      chapadur_entrada: 540,
    }),
    movimiento({
      pallets_salida: 58,
      pallets_entrada: 34,
      chapadur_salida: 222,
      chapadur_entrada: 140,
    }),
  ]);
  assert.deepEqual(total, {
    pallets_salida: 86,
    pallets_entrada: 138,
    chapadur_salida: 334,
    chapadur_entrada: 680,
    saldo_pallets: -52,
    saldo_chapadur: -346,
  });
});
test("fletero, fecha inclusiva y tipo filtran también el resumen y las transferencias", () => {
  const rows = [
    movimiento(),
    movimiento({ id: 2, fletero: 2, origen: "Envío a Mendoza" }),
    movimiento({ id: 3, fecha: "2026-10-13" }),
  ];
  assert.deepEqual(
    filtrarMateriales(
      rows,
      { ...vacios, desde: "2026-10-14", hasta: "2026-10-14" },
      fleteros,
    ).map((m) => m.id),
    [2, 1],
  );
  assert.equal(
    filtrarMateriales(
      rows,
      { ...vacios, tipo: "Envío a Mendoza", fletero: 2 },
      fleteros,
    ).length,
    1,
  );
  assert.equal(
    filtrarMateriales(rows, { ...vacios, desde: "2026-10-15" }, fleteros)
      .length,
    0,
  );
});
test("históricos, devoluciones y fleteros desconocidos no desaparecen del saldo", () => {
  const rows = [
    movimiento({ pallets_salida: 5 }),
    movimiento({ id: 2, origen: "Devolución general", pallets_entrada: 2 }),
    movimiento({ id: 3, fletero: 2 }),
    movimiento({ id: 4, fletero: 99, chapadur_entrada: 3 }),
  ];
  const balances = saldosMateriales(rows, fleteros);
  assert.equal(balances.length, 3);
  assert.equal(balances[0].saldo_pallets, 3);
  assert.equal(balances[1].saldo_pallets, 0);
  assert.equal(balances[2].nombre, "Fletero #99");
  assert.equal(balances[2].saldo_chapadur, -3);
  assert.deepEqual(totalesMateriales([]), {
    pallets_salida: 0,
    pallets_entrada: 0,
    chapadur_salida: 0,
    chapadur_entrada: 0,
    saldo_pallets: 0,
    saldo_chapadur: 0,
  });
});
test("búsqueda y turno siguen disponibles sin alterar datos originales", () => {
  const rows = [
    movimiento(),
    movimiento({ id: 2, turno: "Tarde", observaciones: "Recepción" }),
  ];
  assert.equal(
    filtrarMateriales(
      rows,
      { ...vacios, busqueda: "jeremias", turno: "Tarde" },
      fleteros,
    )[0].id,
    2,
  );
  assert.equal(
    filtrarMateriales(rows, { ...vacios, busqueda: "recepcion" }, fleteros)[0]
      .id,
    2,
  );
  assert.equal(rows[0].id, 1);
});
