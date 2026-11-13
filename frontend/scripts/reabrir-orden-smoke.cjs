// Vite 5181 / API simulada 8771. No modifica la BD real ni envía correos.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errores = [],
      escrituras = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.routeWebSocket("**", () => {});
    await page.route("https://fonts.googleapis.com/**", (r) =>
      r.fulfill({ body: "", contentType: "text/css" }),
    );
    const p = {
      id: 1,
      codigo: "5670",
      nombre: "Cola 3 L",
      alias: "CO3",
      unidades_pack: 6,
      packs_corte: 10,
      cortes_pallet: 4,
      activo: true,
      configurado: true,
      stock: 100,
      sin_codificar: 0,
      minimo: 0,
      critico: 0,
      pendientes: {},
      pendientes_manuales: {},
    };
    const orden = {
      id: 1,
      numero: "R-1",
      fecha: "2026-11-01",
      creado_en: "2026-11-01T12:00:00-03:00",
      creado_por_nombre: "Creador",
      fletero: 1,
      fletero_nombre: "Prueba",
      circuito: "preventa",
      turno: "Mañana",
      anulada: true,
      version: 3,
      estado_operativo: "Anulada",
      facturacion: "NO_APLICA",
      observaciones: "Prueba de reapertura",
      detalles: [
        {
          producto: 1,
          codigo: "5670",
          producto_nombre: p.nombre,
          cantidad_solicitada: "12",
          resuelto: 12,
          pendiente: 0,
        },
      ],
      entregas: [
        {
          id: 1,
          fecha: "2026-11-01T12:00:00-03:00",
          fecha_operativa: "2026-11-01",
          turno: "Mañana",
          creado_por_nombre: "Anterior",
          anulada: true,
          detalles: [
            {
              id: 1,
              producto: 1,
              codigo: "5670",
              producto_nombre: p.nombre,
              cantidad_entregada: 12,
            },
          ],
        },
      ],
    };
    const data = {
      usuario: "Encargado",
      admin: false,
      superusuario: false,
      productos: [p],
      ordenes: [orden],
      fleteros: [{ id: 1, nombre: "Prueba", activo: true }],
      usuarios: [],
      movimientos: [],
      materiales: [],
      empleados: [],
      comprobantes: [],
      conteos: [],
      auditoria: [],
    };
    let fallar = true;
    await page.route("http://127.0.0.1:8771/api/**", (r) => {
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5181",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,X-CSRFToken",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      };
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ status: 204, headers });
      const path = new URL(r.request().url()).pathname;
      if (r.request().method() === "POST") {
        const d = r.request().postDataJSON();
        escrituras.push(d);
        if (d.accion === "reabrir_orden") {
          if (fallar)
            return r.fulfill({
              status: 400,
              headers,
              json: { detail: "La orden cambió. Actualizá la pantalla." },
            });
          assert.equal(d.confirmar, true);
          assert.equal(d.version, 3);
          assert.ok(d.motivo.trim());
          orden.anulada = false;
          orden.version = 4;
          orden.estado_operativo = "Pendiente de despacho";
          orden.detalles[0].resuelto = 0;
          orden.detalles[0].pendiente = 12;
          assert.equal(p.stock, 100);
        } else if (d.accion === "entrega") {
          assert.equal(d.version, 4);
          assert.equal(d.lineas[0].packs, 2);
          orden.version = 5;
          orden.estado_operativo = "Despachada";
          orden.detalles[0].resuelto = 12;
          orden.detalles[0].pendiente = 0;
          p.stock = 88;
          orden.entregas.push({
            id: 2,
            fecha: "2026-11-13T12:00:00-03:00",
            fecha_operativa: d.fecha,
            turno: d.turno,
            creado_por_nombre: "Encargado",
            anulada: false,
            detalles: [{ ...orden.entregas[0].detalles[0], id: 2 }],
          });
        } else throw new Error("Acción inesperada " + d.accion);
        return r.fulfill({ headers, json: { id: 1 } });
      }
      return r.fulfill({
        headers,
        json:
          path === "/api/auth/usuario/"
            ? {
                id: 1,
                username: "encargado",
                nombre_completo: "Encargado",
                grupos: ["EXPEDICION"],
                es_administrador: false,
                puede_administrar: false,
              }
            : path === "/api/expedicion/operativa/"
              ? data
              : [],
      });
    });
    await page.goto("http://127.0.0.1:5181/expedicion/ordenes/1");
    await page
      .getByRole("button", { name: "Reabrir orden", exact: true })
      .click();
    let modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(escrituras.length, 0);
    await page
      .getByRole("button", { name: "Reabrir orden", exact: true })
      .click();
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    assert.equal(escrituras.length, 0); // Confirmación y motivo requeridos por el formulario.
    await modal.getByRole("checkbox").check();
    await modal.getByRole("textbox").fill("La mercadería aún debe salir");
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.getByRole("alert").waitFor();
    assert.equal(orden.anulada, true);
    assert.equal(
      await modal.getByRole("textbox").inputValue(),
      "La mercadería aún debe salir",
    );
    fallar = false;
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirmar salida", exact: true })
      .waitFor();
    assert.equal(p.stock, 100);
    await page.getByText(/Entrega anulada y revertida/).waitFor();
    await page
      .getByRole("button", { name: "Confirmar salida", exact: true })
      .click();
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    assert.equal(p.stock, 88);
    assert.equal(orden.entregas.length, 2);
    assert.equal(orden.entregas.filter((e) => !e.anulada).length, 1);
    assert.deepEqual(errores, []);
    console.log(
      "OK: reabrir, cancelar sin escribir, confirmación y motivo, error conserva borrador, reapertura sin mover stock, nuevo despacho separado, historial preservado. API simulada.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
