import test from "node:test";
import assert from "node:assert/strict";
import {
  cantidadesStock,
  columnasPendientes,
  descomponerStock,
  filtrarStock,
  totalesStock,
} from "../src/components/expedicion/stock.ts";

const producto = (overrides = {}) => ({
  id: 1,
  codigo: "5670",
  nombre: "Talca Cola 3 L",
  alias: "CO3",
  activo: true,
  unidades_pack: 6,
  packs_corte: 10,
  cortes_pallet: 8,
  stock: 600,
  sin_codificar: 0,
  pendientes: {},
  pendientes_manuales: {},
  ...overrides,
});

test("las seis columnas tienen el orden del sistema de Salta", () => {
  assert.deepEqual(
    columnasPendientes.map(([k]) => k),
    [
      "preventa",
      "distriC",
      "distriInterior",
      "sin_codificar",
      "oesteMendoza",
      "oesteJeremias",
    ],
  );
  const q = cantidadesStock(
    producto({
      sin_codificar: 4,
      pendientes: {
        preventa: 1,
        distriC: 2,
        distriInterior: 3,
        oesteMendoza: 5,
        oesteJeremias: 6,
        administrative: 100,
        immediate: 50,
      },
    }),
  );
  assert.deepEqual(q.pendientes, [1, 2, 3, 4, 5, 6]);
  assert.equal(q.total, 21);
  assert.equal(q.entregable, 596);
});
test("disponibilidad usa el entregable y no inventa porcentaje sin pendientes", () => {
  assert.equal(cantidadesStock(producto()).porcentaje, null);
  const q = cantidadesStock(
    producto({ stock: 100, sin_codificar: 20, pendientes: { preventa: 20 } }),
  );
  assert.equal(q.porcentaje, 50);
  assert.equal(q.estado, "Disponible");
  const insufficient = cantidadesStock(
    producto({ stock: 10, pendientes: { preventa: 20 } }),
  );
  assert.equal(insufficient.porcentaje, -100);
  assert.equal(insufficient.estado, "Insuficiente");
  assert.equal(
    cantidadesStock(producto({ stock: 0, sin_codificar: 3 })).porcentaje,
    -100,
  );
});
test("fardos más sueltas y pallets respetan la configuración de cada presentación", () => {
  assert.deepEqual(descomponerStock(487, producto()), {
    negativo: false,
    pallets: 0,
    fardos: 81,
    sueltas: 1,
  });
  assert.deepEqual(descomponerStock(487, producto(), true), {
    negativo: false,
    pallets: 1,
    fardos: 1,
    sueltas: 1,
  });
  assert.deepEqual(
    descomponerStock(
      1694,
      producto({ unidades_pack: 12, packs_corte: 14, cortes_pallet: 10 }),
      true,
    ),
    { negativo: false, pallets: 1, fardos: 1, sueltas: 2 },
  );
  assert.equal(descomponerStock(-7, producto()).negativo, true);
});
test("búsqueda ignora acentos, espacios y separadores; inactivos no aparecen", () => {
  const p = producto({ nombre: "Talca Lima Limón 3 L", alias: "LI3" });
  for (const busqueda of ["lima limon", "li-3", "5670"])
    assert.equal(filtrarStock([p], { busqueda, estado: "" }).length, 1);
  assert.equal(
    filtrarStock([producto({ activo: false })], { busqueda: "", estado: "" })
      .length,
    0,
  );
  assert.equal(
    filtrarStock([p], { busqueda: "", estado: "Disponible" }).length,
    0,
  );
  assert.equal(
    filtrarStock([p], { busqueda: "", estado: "Sin pendientes" }).length,
    1,
  );
});
test("el orden de presentaciones no elimina códigos adicionales ni muta la API", () => {
  const originales = [
    producto({ codigo: "4900" }),
    producto({ codigo: "9900" }),
    producto({ codigo: "5051" }),
    producto(),
  ];
  assert.deepEqual(
    filtrarStock(originales, { busqueda: "", estado: "" }).map((p) => p.codigo),
    ["5670", "5051", "4900", "9900"],
  );
  assert.equal(originales[0].codigo, "4900");
});
test("totales suman fardos equivalentes, no unidades de presentaciones diferentes", () => {
  const q = totalesStock([
    producto({ stock: 60, pendientes: { distriC: 12 } }),
    producto({
      unidades_pack: 12,
      stock: 120,
      sin_codificar: 12,
      pendientes: { preventa: 24 },
    }),
  ]);
  assert.equal(q.fisico, 20);
  assert.equal(q.entregable, 19);
  assert.equal(q.pendiente, 5);
  assert.deepEqual(q.circuitos, [2, 2, 0, 1, 0, 0]);
  assert.equal(q.porcentaje, 75);
  assert.equal(totalesStock([]).porcentaje, null);
  assert.equal(
    totalesStock([producto({ stock: 0, pendientes: { preventa: 6 } })])
      .porcentaje,
    0,
  );
});
