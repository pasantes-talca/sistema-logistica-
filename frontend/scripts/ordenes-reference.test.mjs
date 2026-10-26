import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarOrdenes,
  resumenOrden,
  estiloEstadoOrden,
  entregasFiltradas,
  totalizarProductosOrdenes,
  fechaDespacho,
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
      fecha_operativa: "2026-10-13",
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
test("Encargado y turno pertenecen al despacho; nunca al autor de carga", () => {
  assert.equal(resumenOrden(orden, productos).encargado, "Pablo");
  assert.equal(resumenOrden(orden, productos).turno, "Tarde");
  assert.equal(
    resumenOrden({ ...orden, entregas: [] }, productos).encargado,
    "Sin despacho",
  );
  assert.equal(
    resumenOrden({ ...orden, entregas: [], turno: "" }, productos).turno,
    "—",
  );
});
test("Día, encargado y turno solo incluyen entregas, nunca registro de la orden", () => {
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
    0,
  );
  assert.equal(filtrarOrdenes([orden], { ...vacios, fletero: 2 }).length, 0);
});

test("Todos los filtros deben coincidir en la MISMA entrega y se suma solo esa salida", () => {
  const o = {
    ...orden,
    fecha: "2026-10-10",
    entregas: [
      {
        ...orden.entregas[0],
        fecha_operativa: "2026-10-13",
        turno: "Mañana",
        creado_por_nombre: "Pablo",
        detalles: [{ producto: 1, cantidad_entregada: 6 }],
      },
      {
        ...orden.entregas[0],
        fecha_operativa: "2026-10-14",
        turno: "Tarde",
        creado_por_nombre: "Andres",
        detalles: [{ producto: 1, cantidad_entregada: 60 }],
      },
    ],
  };
  const f = {
    ...vacios,
    dia: "2026-10-13",
    encargado: "Pablo",
    turno: "Mañana",
  };
  assert.equal(filtrarOrdenes([o], f).length, 1);
  assert.equal(resumenOrden(o, productos, f).entregado, 1);
  assert.equal(resumenOrden(o, productos, f).encargado, "Pablo");
  assert.equal(resumenOrden(o, productos, f).fecha, "2026-10-13");
  assert.equal(filtrarOrdenes([o], { ...f, turno: "Tarde" }).length, 0);
  assert.equal(filtrarOrdenes([o], { ...f, encargado: "Andres" }).length, 0);
  assert.equal(filtrarOrdenes([o], { ...vacios, dia: "2026-10-10" }).length, 0);
  assert.equal(filtrarOrdenes([{ ...o, entregas: [] }], vacios).length, 1);
  assert.equal(filtrarOrdenes([{ ...o, entregas: [] }], f).length, 0);
  assert.equal(
    entregasFiltradas(o, {
      ...vacios,
      desde: "2026-10-14",
      hasta: "2026-10-14",
    }).length,
    1,
  );
});

test("Totales conjuntos por producto real, sueltas, sustituciones, negativos y anuladas", () => {
  const otra = {
    ...orden,
    id: 2,
    entregas: [
      {
        ...orden.entregas[0],
        detalles: [
          { producto: 1, cantidad_entregada: 5 },
          { producto: 2, cantidad_entregada: -2, solicitado: 1 },
          {
            producto: 3,
            cantidad_entregada: 7,
            codigo: "SIN",
            producto_nombre: "Sin pack",
          },
        ],
      },
    ],
  };
  const resultado = totalizarProductosOrdenes(
    [orden, orden, otra, { ...orden, id: 3, anulada: true }],
    productos,
  );
  assert.equal(resultado.find((p) => p.producto === 1).despachado, 35);
  assert.equal(resultado.find((p) => p.producto === 1).solicitado, 144);
  assert.equal(resultado.find((p) => p.producto === 2).despachado, 10);
  assert.equal(resultado.find((p) => p.producto === 3).unidades_pack, null);
  assert.equal(resultado.find((p) => p.producto === 3).despachado, 7);
  assert.equal(
    totalizarProductosOrdenes([orden], productos, {
      ...vacios,
      turno: "Mañana",
    }).find((p) => p.producto === 1).despachado,
    0,
  );
  assert.equal(
    filtrarOrdenes([{ ...orden, anulada: true }], {
      ...vacios,
      dia: "2026-10-13",
    }).length,
    0,
  );
});

test("Fecha operativa manda; respaldo horario argentino sin caer en la fecha de carga", () => {
  assert.equal(
    fechaDespacho({
      fecha_operativa: "2026-10-13",
      fecha: "2026-10-14T01:00:00Z",
    }),
    "2026-10-13",
  );
  assert.equal(fechaDespacho({ fecha: "2026-10-14T01:00:00Z" }), "2026-10-13");
  assert.equal(fechaDespacho({ fecha: "inválida" }), "");
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
