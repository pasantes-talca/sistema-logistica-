import test from "node:test";
import assert from "node:assert/strict";
import {
  coincidenciasFleteros,
  filtrarFleteros,
  filtrarProductos,
  filtrarUsuarios,
} from "../src/components/expedicion/configuracion.ts";
const fleteros = [
  {
    id: 1,
    nombre: "José",
    apellido: "Martínez",
    empresa: "Empresa A",
    activo: true,
  },
  {
    id: 2,
    nombre: "  JOSE ",
    apellido: " MARTINEZ ",
    empresa: "Empresa B",
    activo: false,
  },
  {
    id: 3,
    nombre: "José",
    apellido: "Gómez",
    empresa: "Empresa A",
    activo: true,
  },
  { id: 4, nombre: "", apellido: "", empresa: "", activo: true },
];
test("revisión sólo agrupa coincidencias exactas normalizadas, no confunde homónimos ni fusiona", () => {
  const before = structuredClone(fleteros);
  assert.deepEqual(
    coincidenciasFleteros(fleteros).map((g) => g.map((f) => f.id)),
    [[1, 2]],
  );
  assert.deepEqual(fleteros, before);
  assert.deepEqual(coincidenciasFleteros([]), []);
});
test("filtros de fleteros incluyen empresa, acentos y estado sin excluir inactivos por defecto", () => {
  assert.deepEqual(
    filtrarFleteros(fleteros, "JOSE").map((f) => f.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    filtrarFleteros(fleteros, "empresa a", "activo").map((f) => f.id),
    [1, 3],
  );
  assert.deepEqual(
    filtrarFleteros(fleteros, "martinez", "inactivo").map((f) => f.id),
    [2],
  );
});
test("usuarios se buscan por nombre o cuenta sin acceder a contraseñas", () => {
  const usuarios = [
    { id: 1, nombre: "María Pérez", username: "mperez", activo: true },
    { id: 2, nombre: "Pablo", username: "pv", activo: false },
  ];
  assert.equal(filtrarUsuarios(usuarios, "maria")[0].id, 1);
  assert.equal(filtrarUsuarios(usuarios, "mperez")[0].id, 1);
  assert.equal(filtrarUsuarios(usuarios, "", "inactivo")[0].id, 2);
  assert.equal(filtrarUsuarios(usuarios, "ausente").length, 0);
});
test("catálogo conserva equivalencias e IDs y permite buscar código, alias o nombre", () => {
  const productos = [
    {
      id: 7,
      codigo: "5670",
      alias: "CO3",
      nombre: "Cola 3 L",
      activo: true,
      unidades_pack: 6,
    },
    {
      id: 8,
      codigo: "5061",
      alias: "MA5",
      nombre: "Manzana 500 ml",
      activo: false,
    },
  ];
  const before = structuredClone(productos);
  assert.equal(filtrarProductos(productos, "co3")[0].id, 7);
  assert.equal(filtrarProductos(productos, "5061", "inactivo")[0].id, 8);
  assert.equal(filtrarProductos(productos, "MANZANA", "activo").length, 0);
  assert.deepEqual(productos, before);
});
