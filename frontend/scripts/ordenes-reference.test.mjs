import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarOrdenes,
  resumenOrden,
  estiloEstadoOrden,
} from "../src/components/expedicion/ordenes.ts";

const productos = [
  { id: 1, unidades_pack: 6 },
  { id: 2, unidades_pack: 12 },
];
const orden = {
  id: 1,
  numero: "50223",
  fecha: "2026-10-13",
  fletero: 1,
  circuito: "preventa",
  creado_por_nombre: "Andres",
  turno: "Mañana",
  detalles: [
    { producto: 1, cantidad_solicitada: "72" },
    { producto: 2, cantidad_solicitada: "72" },
  ],
  entregas: [
    {
      creado_por_nombre: "Pablo",
      turno: "Tarde",
      detalles: [
        { producto: 1, cantidad_entregada: 30 },
        { producto: 2, cantidad_entregada: 12, solicitado: 1 },
      ],
    },
  ],
};
const vacios = { fletero: 0, dia: "", encargado: "", turno: "" };

test("Solicitado y entregado usan el pack de cada producto, también en sustituciones", () => {
  const r = resumenOrden(orden, productos);
  assert.equal(r.solicitado, 18);
  assert.equal(r.entregado, 6);
});
test("Las botellas sueltas participan como fracciones reales de fardo", () => {
  const r = resumenOrden(
    {
      ...orden,
      detalles: [
        { producto: 1, cantidad_solicitada: "15" },
        { producto: 2, cantidad_solicitada: "5" },
      ],
      entregas: [],
    },
    productos,
  );
  assert.equal(r.solicitado, 2.5 + 5 / 12);
  assert.equal(r.entregado, 0);
});
test("Encargado y turno muestran la última salida, con fallback histórico", () => {
  assert.equal(resumenOrden(orden, productos).encargado, "Pablo");
  assert.equal(resumenOrden(orden, productos).turno, "Tarde");
  assert.equal(
    resumenOrden({ ...orden, entregas: [] }, productos).encargado,
    "Andres",
  );
  assert.equal(
    resumenOrden({ ...orden, entregas: [], turno: "" }, productos).turno,
    "—",
  );
});
test("Día es una fecha exacta; filtros de autor y turno incluyen registro y entregas", () => {
  assert.equal(
    filtrarOrdenes([orden], { ...vacios, dia: "2026-10-12" }).length,
    0,
  );
  assert.equal(
    filtrarOrdenes([orden], {
      ...vacios,
      dia: "2026-10-13",
      fletero: 1,
      encargado: "Pablo",
      turno: "Tarde",
    }).length,
    1,
  );
  assert.equal(
    filtrarOrdenes([orden], { ...vacios, encargado: "Andres", turno: "Mañana" })
      .length,
    1,
  );
  assert.equal(filtrarOrdenes([orden], { ...vacios, fletero: 2 }).length, 0);
});
test("Órdenes numéricas se ordenan de mayor a menor sin alterar la lista original", () => {
  const input = [
    { ...orden, numero: "9" },
    { ...orden, numero: "50223" },
    { ...orden, numero: "100" },
  ];
  assert.deepEqual(
    filtrarOrdenes(input, vacios).map((o) => o.numero),
    ["50223", "100", "9"],
  );
  assert.equal(input[0].numero, "9");
});
test("No inventar totales cuando falta una equivalencia; diferenciar estados", () => {
  assert.equal(resumenOrden(orden, []).solicitado, null);
  assert.equal(estiloEstadoOrden("PENDIENTE"), "administrativa");
  assert.equal(estiloEstadoOrden("Despachada"), "completa");
  assert.equal(estiloEstadoOrden("Parcialmente despachada"), "parcial");
});

test("Los filtros adicionales conservan búsqueda, rango y estado", () => {
  const o = {
    ...orden,
    fletero_nombre: "Fletero prueba",
    estado_operativo: "Despachada",
  };
  assert.equal(
    filtrarOrdenes([o], {
      ...vacios,
      busqueda: "50223",
      desde: "2026-10-01",
      hasta: "2026-10-31",
      estado: "Despachada",
    }).length,
    1,
  );
  assert.equal(
    filtrarOrdenes([o], { ...vacios, hasta: "2026-10-12" }).length,
    0,
  );
  assert.equal(
    filtrarOrdenes([o], { ...vacios, estado: "PENDIENTE" }).length,
    0,
  );
});
