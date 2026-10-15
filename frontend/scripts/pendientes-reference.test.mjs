import test from "node:test";
import assert from "node:assert/strict";
import { filtrarPendientes } from "../src/components/expedicion/pendientes.ts";

const orden = {
  id: 1,
  numero: "50224",
  fecha: "2026-10-13",
  fletero: 1,
  fletero_nombre: "Fletero",
  circuito: "administrative",
  anulada: false,
  turno: "Mañana",
  estado_operativo: "PENDIENTE",
  entregas: [],
  detalles: [
    { producto: 1, codigo: "5670", producto_nombre: "Cola", pendiente: 60 },
    { producto: 2, codigo: "5680", producto_nombre: "Manzana", pendiente: 12 },
  ],
};
const vacios = { fletero: 0, desde: "" };

test("Una orden con varios productos pendientes ocupa una sola fila", () => {
  const result = filtrarPendientes([orden], vacios);
  assert.equal(result.length, 1);
  assert.equal(result[0].detalles.length, 2);
});
test("Incluir administrativos y parciales; excluir inmediatos, anulados y resueltos", () => {
  const input = [
    orden,
    {
      ...orden,
      id: 2,
      circuito: "preventa",
      estado_operativo: "Parcialmente despachada",
    },
    { ...orden, id: 3, circuito: "immediate" },
    { ...orden, id: 4, anulada: true },
    {
      ...orden,
      id: 5,
      detalles: orden.detalles.map((l) => ({ ...l, pendiente: 0 })),
    },
    { ...orden, id: 6, circuito: "sinCodificar" },
  ];
  assert.deepEqual(
    filtrarPendientes(input, vacios)
      .map((o) => o.id)
      .sort(),
    [1, 2],
  );
});
test("Las sustituciones por definir siguen apareciendo mientras haya pendiente", () => {
  assert.equal(
    filtrarPendientes(
      [
        {
          ...orden,
          circuito: "distriC",
          estado_operativo: "Pendiente de definición",
        },
      ],
      vacios,
    ).length,
    1,
  );
});
test("Desde es inclusivo y se combina con Fletero; ordenar números descendentes", () => {
  const input = [
    orden,
    { ...orden, id: 2, numero: "15984", fecha: "2026-10-12" },
    { ...orden, id: 3, numero: "50225", fletero: 2 },
  ];
  assert.deepEqual(
    filtrarPendientes(input, vacios).map((o) => o.numero),
    ["50225", "50224", "15984"],
  );
  assert.deepEqual(
    filtrarPendientes(input, { fletero: 1, desde: "2026-10-13" }).map(
      (o) => o.numero,
    ),
    ["50224"],
  );
});
test("Conservar filtros adicionales por producto sin repetir la orden", () => {
  assert.equal(
    filtrarPendientes([orden], { ...vacios, producto: 2 }).length,
    1,
  );
  assert.equal(
    filtrarPendientes([orden], { ...vacios, producto: 3 }).length,
    0,
  );
  const parcial = {
    ...orden,
    detalles: [{ ...orden.detalles[0], pendiente: 0 }, orden.detalles[1]],
  };
  assert.equal(
    filtrarPendientes([parcial], { ...vacios, producto: 1 }).length,
    0,
  );
  assert.equal(orden.detalles[0].pendiente, 60);
});
