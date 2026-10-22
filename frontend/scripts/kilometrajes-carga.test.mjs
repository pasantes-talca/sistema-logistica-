import test from "node:test";
import assert from "node:assert/strict";
import {
  diasPeriodo,
  instanteFecha,
  moverDia,
  resumirViajes,
} from "../src/components/ui/viajesKilometraje.ts";
const destinos = [
  { id: 1, nombre: "Centro", distancia_km: "100.50" },
  { id: 2, nombre: "Norte", distancia_km: "50.00" },
];
test("períodos inclusivos, años bisiestos y fechas inválidas sin generar grillas gigantes", () => {
  assert.equal(diasPeriodo("2024-02-28", "2024-03-01"), 3);
  assert.equal(diasPeriodo("2026-10-22", "2026-10-22"), 1);
  assert.equal(diasPeriodo("2026-10-23", "2026-10-22"), 0);
  assert.equal(instanteFecha("2026-02-30"), null);
  assert.equal(moverDia("2024-02-28", 1), "2024-02-29");
  assert.equal(moverDia("2026-12-31", 1), "2027-01-01");
  assert(diasPeriodo("1900-01-01", "9999-12-31") > 2000000);
});
test("mismo cálculo por destino y día, payload solo de viajes positivos y sin mutaciones", () => {
  const viajes = {
    "2026-10-22": { 1: "2", 2: "0" },
    "2026-10-23": { 1: "", 2: "3" },
  };
  const original = structuredClone(viajes);
  const r = resumirViajes(viajes, destinos, "2026-10-22", "2026-10-23");
  assert.equal(r.totalKm, 351);
  assert.equal(r.cantidadViajes, 5);
  assert.deepEqual(r.registros, [
    { fecha: "2026-10-22", destino: 1, cantidad_viajes: 2, observaciones: "" },
    { fecha: "2026-10-23", destino: 2, cantidad_viajes: 3, observaciones: "" },
  ]);
  assert.deepEqual(viajes, original);
});
test("reducir el período identifica los registros excluidos y ampliarlo los recupera", () => {
  const v = { "2026-10-22": { 1: "2" }, "2026-10-23": { 2: "3" } };
  assert.equal(
    resumirViajes(v, destinos, "2026-10-22", "2026-10-22").excluidos,
    1,
  );
  assert.equal(
    resumirViajes(v, destinos, "2026-10-22", "2026-10-22").totalKm,
    201,
  );
  assert.equal(
    resumirViajes(v, destinos, "2026-10-22", "2026-10-23").totalKm,
    351,
  );
});
test("rechaza negativos, fracciones, no finitos y destinos desaparecidos incluso en días no visibles", () => {
  const r = resumirViajes(
    {
      "2026-10-22": { 1: "-2", 2: "0.5", 999: "1" },
      "2026-10-23": { 1: "NaN" },
    },
    destinos,
    "2026-10-22",
    "2026-10-23",
  );
  assert.equal(r.errores.length, 4);
  assert.equal(r.registros.length, 0);
  assert.equal(
    resumirViajes({}, destinos, "2026-10-22", "2026-10-23").totalKm,
    0,
  );
});
