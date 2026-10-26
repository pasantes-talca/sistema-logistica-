// Vite 5181 con VITE_API_URL http://127.0.0.1:8771/api. Solo APIs simuladas; no imprime en papel.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errores = [],
      escrituras = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.addInitScript(() => {
      window.print = () => {
        window.__impresiones = (window.__impresiones || 0) + 1;
      };
    });
    await page.routeWebSocket("**", () => {});
    await page.route("https://fonts.googleapis.com/**", (r) =>
      r.fulfill({ contentType: "text/css", body: "" }),
    );
    const producto = {
      id: 1,
      codigo: "5670",
      nombre: "Cola 3 L",
      alias: "CO3",
      unidades_pack: 6,
      packs_corte: 10,
      cortes_pallet: 4,
      activo: true,
      stock: 1000,
      sin_codificar: 0,
      minimo: 0,
      critico: 0,
      pendientes: {},
      pendientes_manuales: {},
      configurado: true,
    };
    const entrega = (id, fecha, turno, usuario, unidades) => ({
      id,
      fecha: fecha + "T12:00:00-03:00",
      fecha_operativa: fecha,
      turno,
      creado_por_nombre: usuario,
      detalles: [
        {
          id,
          producto: 1,
          codigo: "5670",
          producto_nombre: "Cola 3 L",
          cantidad_entregada: unidades,
        },
      ],
    });
    const orden = (id, entregas) => ({
      id,
      numero: String(500 + id),
      fecha: "2026-10-24",
      creado_en: "2026-10-24T12:00:00-03:00",
      creado_por_nombre: "Carga",
      fletero: 1,
      fletero_nombre: "Fletero de prueba",
      circuito: "preventa",
      turno: "Tarde",
      anulada: false,
      version: 1,
      estado_operativo: "Despachada",
      detalles: [
        {
          producto: 1,
          codigo: "5670",
          producto_nombre: "Cola 3 L",
          cantidad_solicitada: "72",
          resuelto: 72,
          pendiente: 0,
        },
      ],
      entregas,
    });
    const data = {
      usuario: "Operador",
      admin: true,
      superusuario: false,
      productos: [producto],
      fleteros: [
        {
          id: 1,
          nombre: "Fletero de prueba",
          apellido: "",
          empresa: "",
          activo: true,
        },
      ],
      usuarios: [],
      movimientos: [],
      materiales: [],
      empleados: [],
      comprobantes: [],
      conteos: [],
      auditoria: [],
      ordenes: [
        orden(1, [
          entrega(1, "2026-10-26", "Mañana", "Despachador", 6),
          entrega(2, "2026-10-27", "Tarde", "Otro", 60),
        ]),
        orden(2, [entrega(3, "2026-10-26", "Mañana", "Despachador", 12)]),
        {
          ...orden(3, []),
          fecha: "2026-10-26",
          creado_por_nombre: "Despachador",
          turno: "Mañana",
          estado_operativo: "PENDIENTE",
        },
        {
          ...orden(4, [entrega(4, "2026-10-26", "Mañana", "Despachador", 36)]),
          anulada: true,
          estado_operativo: "Anulada",
        },
      ],
    };
    await page.route("http://127.0.0.1:8771/api/**", (r) => {
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5181",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,X-CSRFToken",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      };
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ status: 204, headers });
      if (r.request().method() !== "GET") escrituras.push(r.request().url());
      const p = new URL(r.request().url()).pathname;
      const json =
        p === "/api/auth/usuario/"
          ? {
              id: 1,
              username: "prueba",
              first_name: "Operador",
              last_name: "Prueba",
              nombre_completo: "Operador Prueba",
              es_administrador: true,
              puede_administrar: true,
              grupos: ["ADMINISTRADOR"],
            }
          : p === "/api/expedicion/operativa/"
            ? data
            : [];
      return r.fulfill({ headers, json });
    });
    await page.goto("http://127.0.0.1:5181/expedicion/ordenes");
    await page
      .getByLabel("Seleccionar orden 501", { exact: true })
      .waitFor({ timeout: 5000 })
      .catch(async (e) => {
        console.error(errores, await page.locator("body").innerText());
        throw e;
      });
    assert.equal(
      await page
        .getByRole("button", {
          name: "Imprimir seleccionadas (0)",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByLabel("Seleccionar orden 504", { exact: true })
        .isDisabled(),
      true,
    );
    await page.getByLabel("Día", { exact: true }).fill("2026-10-26");
    await page
      .getByLabel("Encargado", { exact: true })
      .selectOption("Despachador");
    await page.getByLabel("Turno", { exact: true }).selectOption("Mañana");
    assert.equal(await page.locator(".eo-orders-table tbody tr").count(), 2);
    assert.equal(
      await page.getByLabel("Seleccionar orden 503", { exact: true }).count(),
      0,
      "Carga no es despacho",
    );
    const fila = page
      .locator(".eo-orders-table tbody tr")
      .filter({ hasText: "501" });
    assert.match(await fila.innerText(), /1 fardos/);
    assert.doesNotMatch(await fila.innerText(), /11 fardos/);
    await page.getByLabel("Seleccionar orden 501", { exact: true }).check();
    await page
      .getByRole("button", { name: "Imprimir seleccionadas (1)", exact: true })
      .click();
    let documento = page.locator("#eo-print-document");
    await documento
      .getByRole("heading", {
        name: "Totales por producto",
        exact: true,
        includeHidden: true,
      })
      .waitFor({ state: "attached" });
    assert.equal(
      await documento.locator(".eo-orders-table tbody tr").count(),
      1,
    );
    assert.match(
      await documento.locator(".eo-orders-product-totals").innerText(),
      /1 fardos/,
    );
    assert.doesNotMatch(
      await documento.innerText(),
      /Solicitado \(orden completa\)/,
    );
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await documento.locator("input[type=checkbox],button,a").count(),
      0,
    );
    assert.equal(
      await documento
        .locator(".eo-orders-table .eo-table")
        .evaluate((e) => getComputedStyle(e).maxHeight),
      "none",
    );
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    await page
      .getByLabel("Seleccionar todas las órdenes visibles", { exact: true })
      .check();
    await page
      .getByRole("button", { name: "Imprimir seleccionadas (2)", exact: true })
      .click();
    await documento
      .getByRole("heading", {
        name: "Totales por producto",
        exact: true,
        includeHidden: true,
      })
      .waitFor({ state: "attached" });
    assert.equal(
      await documento.locator(".eo-orders-table tbody tr").count(),
      2,
    );
    const filaTotal = documento.locator(".eo-orders-product-totals tbody tr");
    assert.equal(await filaTotal.count(), 1);
    assert.match(await filaTotal.innerText(), /3 fardos/);
    assert.equal(await filaTotal.locator("td").last().innerText(), "18");
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    await page.getByLabel("Turno", { exact: true }).selectOption("Tarde");
    assert.equal(
      await page.getByLabel("Seleccionar orden 501", { exact: true }).count(),
      0,
      "No cruzar filtros entre entregas distintas",
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Imprimir seleccionadas (0)",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    assert.equal(
      await page.getByLabel("Seleccionar orden 503", { exact: true }).count(),
      1,
      "Sin filtros se ven pendientes",
    );
    const out = path.join(__dirname, "..", "test-artifacts");
    fs.mkdirSync(out, { recursive: true });
    await page.getByRole("button", {name:"Imprimir listado", exact:true}).click();
    await documento.locator('.eo-orders-product-totals').waitFor({state:'attached'});
    assert.equal(await documento.locator('.eo-orders-table tbody tr').count(),4);
    assert.equal(await documento.locator('.eo-orders-product-totals tbody tr td').last().innerText(),'78');
    await page.emulateMedia({media:'print'});
    await page.pdf({path:path.join(out,'ordenes-consolidadas.pdf'),format:'A4',printBackground:true});
    await page.emulateMedia({media:'screen'});
    await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
    for (const width of [1440, 390])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
        );
        await page.screenshot({
          path: path.join(out, `ordenes-conjuntas-${width}-${theme}.png`),
        });
      }
    assert.deepEqual(errores, []);
    assert.deepEqual(escrituras, []);
    console.log(
      "OK: selección individual/todas, total por producto, impresión sin controles, fecha y autor del despacho, parciales por turno, filtros coherentes, pendientes visibles sin filtros y móvil/oscuro. Sin BD ni impresión real.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
