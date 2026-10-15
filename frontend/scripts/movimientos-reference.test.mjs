import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparMovimientos,
  filtrarMovimientos,
  fechaMovimiento,
} from "../src/components/expedicion/movimientos.ts";
const productos = [
  { id: 1, codigo: "5670", nombre: "Cola", alias: "CO3", unidades_pack: 6 },
  {
    id: 2,
    codigo: "5051",
    nombre: "Lima Limón",
    alias: "LI5",
    unidades_pack: 12,
  },
];
const mov = (props = {}) => ({
  id: 1,
  producto: 1,
  tipo: "ORDEN_CARGA",
  destino: "",
  direccion: "SALIDA",
  cantidad: 12,
  referencia: "50224",
  observaciones: "",
  orden: 1,
  operacion: "op1",
  fecha: "2026-10-14",
  turno: "Mañana",
  usuario: "Encargado",
  sin_impacto: false,
  sin_codificar: false,
  ...props,
});
test("una orden aparece una sola vez con todas sus entregas y correcciones", () => {
  const source = [
    mov({ fecha: "2026-10-13" }),
    mov({ id: 2, producto: 2, cantidad: 24, operacion: "op2" }),
    mov({
      id: 3,
      tipo: "CORRECCION",
      direccion: "ENTRADA",
      cantidad: 6,
      operacion: "op3",
    }),
  ];
  const groups = agruparMovimientos(source, productos);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].lineas.length, 3);
  assert.equal(groups[0].productos, 2);
  assert.equal(groups[0].entrada, 1);
  assert.equal(groups[0].salida, 4);
  assert.equal(groups[0].tipo, "Orden de carga");
  assert.equal(groups[0].fecha, "2026-10-14");
  assert.equal(source[0].id, 1);
});
test("derrame queda sólo en sin impacto; distintos fardos se convierten antes de sumar", () => {
  const groups = agruparMovimientos(
    [
      mov({ tipo: "DERRAME", orden: null, sin_impacto: true }),
      mov({
        id: 2,
        producto: 2,
        tipo: "DERRAME",
        orden: null,
        cantidad: 6,
        sin_impacto: true,
      }),
    ],
    productos,
  );
  assert.equal(groups[0].neutral, 2.5);
  assert.equal(groups[0].entrada, 0);
  assert.equal(groups[0].salida, 0);
});
test("no agrupar operaciones distintas ni anular visualmente el historial", () => {
  const groups = agruparMovimientos(
    [
      mov(),
      mov({ id: 2, tipo: "ANULACION", direccion: "ENTRADA" }),
      mov({ id: 3, orden: null, tipo: "REBOTE", operacion: "otro" }),
      mov({ id: 4, orden: null, tipo: "REBOTE", operacion: "" }),
    ],
    productos,
  );
  assert.equal(groups.length, 4);
  assert.equal(groups[1].tipo, "Rebote");
});
test("filtrar después de agrupar conserva totales históricos, fechas inclusivas y productos", () => {
  const groups = agruparMovimientos(
    [
      mov({ fecha: "2026-10-13" }),
      mov({ id: 2, fecha: "2026-10-14", producto: 2, cantidad: 24 }),
    ],
    productos,
  );
  const found = filtrarMovimientos(
    groups,
    {
      desde: "2026-10-14",
      hasta: "2026-10-14",
      tipo: "Orden de carga",
      busqueda: "limon",
      turno: "Mañana",
    },
    productos,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].salida, 4);
  assert.equal(
    filtrarMovimientos(
      groups,
      { desde: "2026-10-15", hasta: "", tipo: "" },
      productos,
    ).length,
    0,
  );
});
test("producción todas incluye codificada y sin codificar; transferencias mantienen provincia", () => {
  const groups = agruparMovimientos(
    [
      mov({ tipo: "PRODUCCION", orden: null }),
      mov({ id: 2, tipo: "PRODUCCION_SIN_CODIFICAR", orden: null }),
      mov({ id: 3, tipo: "TRANSFERENCIA", destino: "San Juan", orden: null }),
    ],
    productos,
  );
  assert.equal(
    filtrarMovimientos(
      groups,
      { desde: "", hasta: "", tipo: "Producción" },
      productos,
    ).length,
    2,
  );
  assert.equal(groups[0].tipo, "Envío a San Juan");
});
test("no inventar equivalencias ni horas ausentes en la API", () => {
  assert.equal(
    agruparMovimientos([mov({ producto: 99 })], productos)[0]
      .equivalenciasCompletas,
    false,
  );
  assert.equal(fechaMovimiento("2026-10-14"), "14/10/2026");
});
