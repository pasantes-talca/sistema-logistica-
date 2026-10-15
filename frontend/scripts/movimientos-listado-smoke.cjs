// Sólo SQLite en memoria de expedicion.smoke_server, nunca el backend real.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.routeWebSocket("**", () => {});
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const output = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(output, { recursive: true });
  try {
    assert.equal(
      (
        await page.request.post("http://127.0.0.1:8765/api/auth/login/", {
          data: { username: "smoke", password: "Smoke-local-123!" },
        })
      ).status(),
      200,
    );
    const api = "http://127.0.0.1:8765/api/expedicion/operativa/";
    const getData = async () => {
      const r = await page.request.get(api);
      assert.equal(r.status(), 200);
      return r.json();
    };
    const csrf = (await page.context().cookies()).find(
      (c) => c.name === "csrftoken",
    ).value;
    const command = async (body) => {
      const r = await page.request.post(api, {
        headers: { "X-CSRFToken": csrf },
        data: {
          clave: randomUUID(),
          turno: "Mañana",
          fecha: "2026-10-14",
          ...body,
        },
      });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    };
    let data = await getData();
    const productos = ["5670", "5051"].map((c) =>
      data.productos.find((p) => p.codigo === c),
    );
    const numero = `MOV-${Date.now()}`;
    const orden = await command({
      accion: "orden",
      numero,
      fletero: data.fleteros[0].id,
      circuito: "preventa",
      lineas: productos.map((p) => ({ producto: p.id, packs: 2, unidades: 0 })),
    });
    for (const [i, p] of productos.entries()) {
      data = await getData();
      const o = data.ordenes.find((o) => o.id === orden.id);
      await command({
        accion: "entrega",
        id: o.id,
        version: o.version,
        fecha: i === 0 ? "2026-10-13" : "2026-10-14",
        lineas: [{ producto: p.id, solicitado: p.id, packs: 2, unidades: 0 }],
      });
    }
    await page.goto("http://127.0.0.1:5175/expedicion/movimientos");
    await page.waitForLoadState("networkidle");
    const table = page.locator(".eo-movements-table");
    const filters = page.getByRole("group", {
      name: "Filtros de movimientos",
      exact: true,
    });
    assert.equal(await filters.locator("input,select").count(), 3);
    assert.equal(await table.getByRole("columnheader").count(), 9);
    assert.equal(await page.locator(".eo-tabs").count(), 0);
    const row = table
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: numero, exact: true }) });
    assert.equal(await row.count(), 1, "Una fila para las dos entregas");
    let cells = await row.getByRole("cell").allTextContents();
    assert.equal(cells[0], "14/10/2026");
    assert.equal(cells[4], "4 fardos");
    await row.locator("summary").click();
    assert.equal(await row.locator(".eo-movement-lines > div").count(), 2);
    await row.locator("summary").click();
    await filters.getByLabel("Desde", { exact: true }).fill("2026-10-14");
    cells = await row.getByRole("cell").allTextContents();
    assert.equal(
      cells[4],
      "4 fardos",
      "No truncar el total de la orden por fecha",
    );
    await page.screenshot({
      path: path.join(output, "movimientos-listado.png"),
      fullPage: true,
    });
    const modal = page.getByRole("dialog");
    const add = async (p, packs) => {
      await modal
        .getByRole("combobox", { name: "Código, alias o nombre" })
        .fill(p.codigo);
      await modal
        .getByRole("combobox", { name: "Código, alias o nombre" })
        .press("Enter");
      await modal
        .getByLabel("Packs completos", { exact: true })
        .fill(String(packs));
      await modal.getByLabel("Packs completos", { exact: true }).press("Enter");
      await modal.getByLabel("Botellas sueltas", { exact: true }).fill("0");
      await modal
        .getByLabel("Botellas sueltas", { exact: true })
        .press("Enter");
    };
    const rebote = `REB-${Date.now()}`;
    await page
      .getByRole("button", { name: "Nuevo rebote", exact: true })
      .click();
    assert.equal(
      await modal
        .getByLabel("Tipo de movimiento", { exact: true })
        .inputValue(),
      "REBOTE",
    );
    await modal.getByLabel("Referencia", { exact: true }).fill(rebote);
    for (const p of productos) await add(p, 1);
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    const reboteRow = table
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: rebote, exact: true }) });
    assert.equal(
      await reboteRow
        .getByRole("cell", { name: "2 fardos", exact: true })
        .count(),
      1,
    );
    await reboteRow
      .getByRole("button", { name: "Corregir fecha/ref." })
      .click();
    await modal
      .getByLabel("Referencia", { exact: true })
      .fill(`${rebote}-CORREGIDO`);
    await modal
      .getByLabel("Motivo obligatorio", { exact: true })
      .fill("Prueba de corrección aislada");
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    data = await getData();
    assert.equal(
      data.movimientos.filter((m) => m.referencia === `${rebote}-CORREGIDO`)
        .length,
      2,
    );
    const p = productos[0];
    const before = data.productos.find((x) => x.id === p.id).stock;
    const derrame = `DER-${Date.now()}`;
    await page
      .getByRole("button", { name: "Nuevo derrame", exact: true })
      .click();
    assert.equal(
      await modal
        .getByLabel("Tipo de movimiento", { exact: true })
        .inputValue(),
      "DERRAME",
    );
    await modal.getByLabel("Referencia", { exact: true }).fill(derrame);
    await add(p, 1);
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    data = await getData();
    assert.equal(data.productos.find((x) => x.id === p.id).stock, before);
    const derrameRow = table
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: derrame, exact: true }) });
    cells = await derrameRow.getByRole("cell").allTextContents();
    assert.equal(cells[3], "");
    assert.equal(cells[4], "");
    assert.equal(cells[5], "1 fardos");
    await filters.getByLabel("Tipo", { exact: true }).selectOption("Derrame");
    await page
      .getByRole("button", { name: "Filtros adicionales", exact: true })
      .click();
    await page.getByLabel("Buscar movimiento").fill(derrame);
    assert.equal(await table.locator("tbody tr").count(), 1);
    const pendingDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar CSV", exact: true })
      .click();
    const file = path.join(output, "movimientos-listado.csv");
    await (await pendingDownload).saveAs(file);
    const csv = fs.readFileSync(file, "utf8");
    assert(csv.includes(derrame));
    assert(csv.includes("Sin impacto"));
    await filters.getByRole("button", { name: "Limpiar", exact: true }).click();
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "movimientos-listado-oscuro.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tema claro" }).click();
    await page.setViewportSize({ width: 768, height: 1024 });
    if (await page.locator(".sidebar.sidebar-open").count())
      await page.locator(".sidebar-open .sidebar-close").click();
    await page.waitForFunction(
      () =>
        document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, "movimientos-listado-tablet.png"),
      fullPage: true,
    });
    await filters.getByLabel("Tipo", { exact: true }).selectOption("Derrame");
    await page.getByLabel("Buscar movimiento").fill(derrame);
    await page.evaluate(() => (window.print = () => {}));
    await filters
      .getByRole("button", { name: "Imprimir", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#eo-print-document th").count(), 8);
    assert.equal(await page.locator("#eo-print-document tbody tr").count(), 1);
    await page.pdf({
      path: path.join(output, "movimientos-listado.pdf"),
      format: "A4",
      landscape: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "OK: entregas agrupadas por orden, tres impactos, filtros, detalle, rebote, corrección múltiple, derrame neutral, CSV, temas, tablet e impresión.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "movimientos-listado-error.png"),
      fullPage: true,
    });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
