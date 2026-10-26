const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER || undefined,
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const output = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto("http://127.0.0.1:5175/");
    await page.getByLabel("Usuario", { exact: true }).fill("smoke");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("Smoke-local-123!");
    await page.getByRole("button", { name: "Ingresar al sistema" }).click();
    await page.waitForURL("**/panel");
    await page.goto("http://127.0.0.1:5175/expedicion/ordenes");
    await page
      .getByRole("columnheader", { name: "Solicitado (orden)", exact: true })
      .waitFor();
    const filters = page.getByRole("group", {
      name: "Filtros de órdenes de carga",
    });
    assert.equal(await filters.locator("input,select").count(), 4);
    await page.screenshot({
      path: path.join(output, "ordenes-listado-escritorio.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Activar tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "ordenes-listado-oscuro.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Activar tema claro" }).click();
    await page.setViewportSize({ width: 768, height: 1024 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, "ordenes-listado-tablet.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      window.print = () => {};
    });
    await filters
      .getByRole("button", { name: "Imprimir listado", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    const report = page.locator("#eo-print-document");
    assert.equal(await report.locator(".eo-orders-table").getByRole("columnheader").count(), 9);
    assert.equal(await report.getByRole("heading", {name:"Totales por producto", exact:true}).count(), 1);
    assert.equal(await report.getByRole("link").count(), 0);
    await page.pdf({
      path: path.join(output, "ordenes-listado.pdf"),
      format: "A4",
    });
    assert.deepEqual(errors, []);
    console.log(
      "OK: cuatro filtros, columnas, escritorio/tema oscuro/tablet y reporte imprimible sin acciones.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
