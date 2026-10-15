import test from "node:test";
import assert from "node:assert/strict";
import {
  detalleAuditoria,
  entidadAuditoria,
  filtrarAuditoria,
  usuarioAuditoria,
} from "../src/components/expedicion/auditoria.ts";
const audit = (props = {}) => ({
  id: 1,
  fecha: "2026-10-14T12:00:00-03:00",
  usuario: "Raúl",
  turno: "Mañana",
  accion: "Nueva orden",
  referencia: "50246",
  motivo: "",
  antes: {},
  despues: {},
  ...props,
});
const filtros = {
  busqueda: "",
  desde: "",
  hasta: "",
  turno: "",
  accion: "",
  entidad: "",
};
test("entidad informada se conserva; clasificación conocida es explícita y desconocidos no se inventan", () => {
  assert.deepEqual(entidadAuditoria(audit()), {
    texto: "Orden de carga",
    clasificada: true,
  });
  assert.deepEqual(
    entidadAuditoria(audit({ despues: { entidad: "Entidad original" } })),
    { texto: "Entidad original", clasificada: false },
  );
  assert.deepEqual(entidadAuditoria(audit({ accion: "Acción desconocida" })), {
    texto: "—",
    clasificada: false,
  });
});
test("preservar autor importado y motivo literal, sin modificar el registro", () => {
  const a = audit({
    motivo: 'Detalle "original"',
    despues: { origen: "Firebase", usuario_original: "Pablo original" },
  });
  assert.equal(usuarioAuditoria(a), "Pablo original");
  assert.equal(detalleAuditoria(a), 'Detalle "original"');
  assert.equal(a.usuario, "Raúl");
});
test("resumen usa unidades registradas, no una conversión histórica inventada", () => {
  assert.equal(
    detalleAuditoria(
      audit({
        accion: "REBOTE",
        despues: { lineas: [{ producto: 7, unidades: 12 }] },
      }),
      [{ id: 7, codigo: "5670", nombre: "Cola", unidades_pack: 99 }],
    ),
    "5670 · Cola: 12 un.",
  );
  assert.equal(
    detalleAuditoria(
      audit({ despues: { lineas: [{ diferencia: 0 }, { diferencia: -6 }] } }),
    ),
    "2 productos comparados · 1 con diferencias",
  );
  assert.equal(
    detalleAuditoria(audit()),
    "Sin detalle descriptivo registrado.",
  );
});
test("filtrar por usuario, fechas, turno, acción, entidad y metadatos sin eliminar ni mutar datos", () => {
  const a = audit({ despues: { campo: "Revisión histórica" } });
  const rows = [
    a,
    audit({ id: 2, fecha: "2026-10-13", accion: "Guardar empleado" }),
  ];
  assert.equal(
    filtrarAuditoria(rows, {
      ...filtros,
      busqueda: "raul",
      desde: "2026-10-14",
      hasta: "2026-10-14",
      turno: "Mañana",
      accion: "Nueva orden",
      entidad: "Orden de carga",
    }).length,
    1,
  );
  assert.equal(
    filtrarAuditoria(rows, { ...filtros, busqueda: "revision historica" })
      .length,
    1,
  );
  assert.equal(
    filtrarAuditoria(rows, { ...filtros, turno: "Tarde" }).length,
    0,
  );
  assert.equal(rows[0], a);
});
test("orden reciente determinista, conservando todas las entradas individuales", () => {
  const rows = [
    audit({ id: 1 }),
    audit({ id: 2 }),
    audit({ id: 3, fecha: "2026-10-15" }),
  ];
  assert.deepEqual(
    filtrarAuditoria(rows, filtros).map((a) => a.id),
    [3, 2, 1],
  );
  assert.equal(rows[0].id, 1);
  assert.deepEqual(
    filtrarAuditoria(
      [
        audit({ id: 4, fecha: "2026-10-14T11:00:00+00:00" }),
        audit({ id: 5, fecha: "2026-10-14T09:00:00-03:00" }),
      ],
      filtros,
    ).map((a) => a.id),
    [5, 4],
  );
});
