// Verificación exclusivamente contra expedicion.smoke_server, base en memoria.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
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
    const initial = await getData();
    const p = initial.productos.find((p) => p.codigo === "5670");
    const zero = initial.productos.find((p) => p.codigo === "5051");
    const excluded = initial.productos.find((p) => p.codigo === "5680");
    const observaciones = `Conteo-${Date.now()}`;
    await page.goto("http://127.0.0.1:5175/expedicion/conteos");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".eo-tabs").count(), 0);
    const table = page.locator(".eo-counts-table");
    assert.deepEqual(await table.getByRole("columnheader").allTextContents(), [
      "Fecha",
      "Turno",
      "Tipo",
      "Encargado",
      "Diferencias",
      "Estado",
      "Acciones",
    ]);
    await page
      .getByRole("button", { name: "Nuevo conteo", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    assert.equal(
      await modal.locator(".eo-count-entry tbody tr").count(),
      initial.productos.filter((p) => p.activo).length,
    );
    const packs = modal.getByLabel(`Fardos físicos ${p.codigo}`, {
      exact: true,
    });
    await packs.fill(String(Math.floor(p.stock / p.unidades_pack) + 1));
    await packs.press("Enter");
    assert(
      await modal
        .getByLabel(`Botellas sueltas ${p.codigo}`, { exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await modal
      .getByLabel(`Fardos físicos ${zero.codigo}`, { exact: true })
      .fill("0");
    await modal
      .getByLabel(`Botellas sueltas ${zero.codigo}`, { exact: true })
      .fill("0");
    await modal
      .getByLabel(`Incluir ${excluded.codigo}`, { exact: true })
      .uncheck();
    const search = modal.getByLabel("Buscar producto del conteo", {
      exact: true,
    });
    await search.fill(p.codigo);
    assert.equal(await modal.locator(".eo-count-entry tbody tr").count(), 1);
    const row = modal.locator(".eo-count-entry tbody tr");
    assert.equal(
      await row.getByRole("cell").last().textContent(),
      `+${p.unidades_pack}`,
    );
    await page.screenshot({
      path: path.join(output, "conteos-formulario.png"),
      fullPage: true,
    });
    await modal
      .getByLabel(`Botellas sueltas ${p.codigo}`, { exact: true })
      .press("Enter");
    assert.equal(
      (await getData()).conteos.length,
      initial.conteos.length,
      "Enter no guarda el conteo",
    );
    await modal
      .getByLabel("Observaciones", { exact: true })
      .fill(observaciones);
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    let data = await getData();
    const conteo = data.conteos.find((c) => c.observaciones === observaciones);
    assert(conteo);
    assert.equal(
      conteo.lineas.length,
      initial.productos.filter((p) => p.activo).length - 1,
      "La búsqueda no elimina productos del payload",
    );
    assert.equal(
      conteo.lineas.find((l) => l.producto === zero.id).fisico,
      0,
      "Cero es un conteo válido",
    );
    assert.equal(conteo.lineas.filter((l) => l.diferencia !== 0).length, 2);
    assert.deepEqual(
      data.productos.map((p) => [p.id, p.stock]),
      initial.productos.map((p) => [p.id, p.stock]),
      "El conteo no cambia stock",
    );
    assert.equal(conteo.corroborado_en, null);
    assert.equal(
      await page
        .getByRole("button", { name: "Corroborar recepción", exact: true })
        .count(),
      0,
    );
    const conteoRow = table
      .getByRole("row")
      .filter({
        has: page.getByRole("cell", { name: "Cierre de turno", exact: true }),
      })
      .first();
    assert.equal(await conteoRow.getByRole("cell").nth(4).textContent(), "2");
    await conteoRow
      .getByRole("button", { name: "Ver detalle", exact: true })
      .click();
    const detail = page.getByRole("region", { name: "Detalle del conteo" });
    assert.equal(
      await detail.locator("tbody tr").count(),
      conteo.lineas.length,
    );
    await detail.getByText(observaciones).waitFor();
    await page.screenshot({
      path: path.join(output, "conteos-listado.png"),
      fullPage: true,
    });
    await detail
      .getByRole("button", { name: "Cerrar detalle", exact: true })
      .click();
    await page
      .getByLabel("Turno activo", { exact: true })
      .selectOption("Tarde");
    await page
      .locator(".eo-count-handover")
      .getByRole("button", { name: "Corroborar recepción", exact: true })
      .click();
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    data = await getData();
    assert(data.conteos.find((c) => c.id === conteo.id).corroborado_en);
    assert.equal(
      data.conteos.find((c) => c.id === conteo.id).corroborado_por,
      "smoke",
    );
    assert.equal(
      await conteoRow.getByRole("cell").nth(5).textContent(),
      "Corroborado",
    );
    await conteoRow
      .getByRole("button", { name: "Ver detalle", exact: true })
      .click();
    assert.equal(
      await detail
        .getByRole("button", { name: "Corroborar recepción", exact: true })
        .count(),
      0,
      "El conteo ya recibido no permite corroborar nuevamente",
    );
    await detail
      .getByRole("button", { name: "Cerrar detalle", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nuevo conteo", exact: true })
      .click();
    await modal
      .getByLabel("Tipo de conteo", { exact: true })
      .selectOption("Apertura / corroboración");
    await modal
      .getByLabel("Observaciones", { exact: true })
      .fill(`${observaciones}-APERTURA`);
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    data = await getData();
    assert(
      data.conteos.find((c) => c.observaciones === `${observaciones}-APERTURA`)
        .corroborado_en,
    );
    assert.deepEqual(
      data.productos.map((p) => [p.id, p.stock]),
      initial.productos.map((p) => [p.id, p.stock]),
    );
    await page
      .getByRole("button", { name: "Filtros adicionales", exact: true })
      .click();
    const filters = page.getByRole("group", {
      name: "Filtros de conteos",
      exact: true,
    });
    await filters.getByLabel("Desde", { exact: true }).fill("2099-01-01");
    await page
      .getByText("No hay conteos con los filtros seleccionados.")
      .waitFor();
    await filters.getByRole("button", { name: "Limpiar", exact: true }).click();
    await filters
      .getByLabel("Buscar", { exact: true })
      .fill(`${observaciones}-APERTURA`);
    assert.equal(await table.locator("tbody tr").count(), 1);
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "conteos-listado-oscuro.png"),
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
      path: path.join(output, "conteos-listado-tablet.png"),
      fullPage: true,
    });
    await page.evaluate(() => (window.print = () => {}));
    await page
      .getByRole("button", { name: "Imprimir listado", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#eo-print-document th").count(), 6);
    assert.equal(await page.locator("#eo-print-document tbody tr").count(), 1);
    await page.pdf({
      path: path.join(output, "conteos-listado.pdf"),
      format: "A4",
      landscape: true,
    });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await table
      .getByRole("button", { name: "Ver detalle", exact: true })
      .click();
    await detail
      .getByRole("button", { name: "Imprimir detalle", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: path.join(output, "conteos-detalle.pdf"),
      format: "A4",
    });
    assert.deepEqual(errors, []);
    console.log(
      "OK: tabla resumen, diferencias, conteo cero/parcial, búsquedas sin pérdida, Enter seguro, stock inalterado, relevo entre turnos, apertura corroborada, detalle, filtros, temas, tablet e impresión.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "conteos-error.png"),
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
