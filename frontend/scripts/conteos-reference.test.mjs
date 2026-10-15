import test from "node:test";
import assert from "node:assert/strict";
import {
  cantidadDiferencias,
  filtrarConteos,
  puedeCorroborar,
  ultimoRelevoPendiente,
} from "../src/components/expedicion/conteos.ts";
const conteo = (props) => ({
  id: 1,
  fecha: "2026-10-14T12:00:00-03:00",
  turno: "Mañana",
  tipo: "Cierre de turno",
  usuario: "Responsable",
  observaciones: "",
  corroborado_por: "",
  corroborado_en: null,
  lineas: [],
  ...props,
});
const filtros = { desde: "", hasta: "", turno: "", busqueda: "" };
test("diferencias cuenta productos con desvíos, no suma unidades ni incluye ceros", () => {
  const c = conteo({
    lineas: [{ diferencia: 0 }, { diferencia: 12 }, { diferencia: -12 }],
  });
  assert.equal(cantidadDiferencias(c), 2);
  assert.equal(cantidadDiferencias(conteo()), 0);
});
test("corroboración sólo está disponible para otro turno y sin recepción previa", () => {
  assert.equal(puedeCorroborar(conteo(), "Mañana"), false);
  assert.equal(puedeCorroborar(conteo(), "Tarde"), true);
  assert.equal(
    puedeCorroborar(
      conteo({ corroborado_en: "2026-10-14T13:00:00-03:00" }),
      "Tarde",
    ),
    false,
  );
});
test("aviso de relevo usa el último cierre pendiente de otro turno", () => {
  const rows = [
    conteo({ id: 1, fecha: "2026-10-13" }),
    conteo({ id: 2 }),
    conteo({
      id: 3,
      fecha: "2026-10-15",
      tipo: "Apertura / corroboración",
      corroborado_en: "2026-10-15",
    }),
  ];
  assert.equal(ultimoRelevoPendiente(rows, "Tarde").id, 2);
  assert.equal(ultimoRelevoPendiente(rows, "Mañana"), undefined);
  assert.equal(rows[0].id, 1);
});
test("filtros mantienen fecha inclusiva, turno y búsqueda por encargado o producto", () => {
  const rows = [
    conteo({ id: 1, fecha: "2026-10-13T12:00:00-03:00" }),
    conteo({
      id: 2,
      usuario: "Raúl",
      lineas: [{ codigo: "5670", nombre: "Cola", diferencia: 0 }],
    }),
  ];
  assert.deepEqual(
    filtrarConteos(rows, {
      ...filtros,
      desde: "2026-10-14",
      hasta: "2026-10-14",
      turno: "Mañana",
    }).map((c) => c.id),
    [2],
  );
  assert.equal(filtrarConteos(rows, { ...filtros, busqueda: "raul" })[0].id, 2);
  assert.equal(filtrarConteos(rows, { ...filtros, busqueda: "5670" })[0].id, 2);
  assert.equal(filtrarConteos(rows, { ...filtros, turno: "Tarde" }).length, 0);
});
