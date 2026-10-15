// Ejecutar únicamente contra expedicion.smoke_server (SQLite en memoria).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSER,
    headless: true,
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
    if (m.type() === "error") errors.push(`${m.text()} ${m.location().url}`);
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
    const ref = `Materiales-${Date.now()}`;
    const carrier = await command({
      accion: "fletero",
      nombre: ref,
      activo: true,
    });
    await command({
      accion: "materiales",
      fletero: carrier.id,
      origen: "Carga por turno",
      referencia: ref,
      pallets_salida: 10,
      pallets_entrada: 4,
      chapadur_salida: 40,
      chapadur_entrada: 12,
    });
    await command({
      accion: "materiales",
      fletero: carrier.id,
      origen: "Devolución general",
      referencia: ref,
      pallets_entrada: 3,
      chapadur_entrada: 9,
    });
    const data = await getData();
    await command({
      accion: "movimiento",
      tipo: "TRANSFERENCIA",
      destino: "Mendoza",
      direccion: "ENTRADA",
      fletero: carrier.id,
      referencia: `Remito ${ref}`,
      pallets_entrada: 2,
      chapadur_entrada: 4,
      lineas: [{ producto: data.productos[0].id, packs: 1, unidades: 0 }],
    });
    await page.goto("http://127.0.0.1:5175/expedicion/materiales");
    await page.waitForLoadState("networkidle");
    const filters = page.getByRole("group", {
      name: "Filtros de materiales",
      exact: true,
    });
    assert.equal(await filters.locator("input,select").count(), 4);
    assert.equal(await page.locator(".eo-tabs").count(), 0);
    await filters
      .getByLabel("Fletero", { exact: true })
      .selectOption(String(carrier.id));
    assert.deepEqual(
      await page.locator(".eo-material-stat strong").allTextContents(),
      ["10", "9", "1", "40", "25", "15"],
    );
    const balances = page.locator(".eo-material-balances");
    assert.equal(await balances.getByRole("columnheader").count(), 5);
    assert.equal(await balances.locator("tbody tr").count(), 1);
    assert.equal(
      await page.locator(".eo-material-movements tbody tr").count(),
      3,
    );
    await page.screenshot({
      path: path.join(output, "materiales-listado.png"),
      fullPage: true,
    });
    await filters
      .getByLabel("Tipo", { exact: true })
      .selectOption("Devolución general");
    assert.deepEqual(
      await page.locator(".eo-material-stat strong").allTextContents(),
      ["0", "3", "-3", "0", "9", "-9"],
    );
    assert.equal(await balances.locator(".eo-material-credit").count(), 2);
    await filters.getByLabel("Desde").fill("2026-10-15");
    assert.deepEqual(
      await page.locator(".eo-material-stat strong").allTextContents(),
      ["0", "0", "0", "0", "0", "0"],
    );
    await filters.getByRole("button", { name: "Limpiar", exact: true }).click();
    await page
      .getByRole("button", { name: "Registrar devolución", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    assert.equal(await modal.locator('input[type="number"]').count(), 2);
    await modal
      .getByRole("combobox", { name: "Fletero", exact: true })
      .fill(ref);
    await modal.locator(".eo-options button").filter({ hasText: ref }).click();
    await modal.getByLabel("Pallets devueltos", { exact: true }).fill("2");
    await modal.getByLabel("Pallets devueltos", { exact: true }).press("Enter");
    assert(
      await modal
        .getByLabel("Chapadur devuelto", { exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await modal.getByLabel("Chapadur devuelto", { exact: true }).fill("3");
    await modal.getByLabel("Chapadur devuelto", { exact: true }).press("Enter");
    assert(
      await modal
        .getByLabel("Observaciones", { exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await modal
      .getByLabel("Observaciones", { exact: true })
      .fill("Devolución de prueba");
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    const after = await getData();
    const saved = after.materiales.find(
      (m) => m.observaciones === "Devolución de prueba",
    );
    assert(saved);
    assert.equal(saved.origen, "Devolución general");
    assert.equal(saved.pallets_salida, 0);
    assert.equal(saved.pallets_entrada, 2);
    await page
      .getByRole("button", { name: "Nueva carga de materiales", exact: true })
      .click();
    assert.equal(await modal.locator('input[type="number"]').count(), 4);
    await modal
      .getByRole("combobox", { name: "Fletero", exact: true })
      .fill(ref);
    await modal.locator(".eo-options button").filter({ hasText: ref }).click();
    for (const [label, value] of [
      ["Pallets entregados", "1"],
      ["Pallets devueltos", "0"],
      ["Chapadur entregado", "2"],
      ["Chapadur devuelto", "0"],
    ]) {
      await modal.getByLabel(label, { exact: true }).fill(value);
      await modal.getByLabel(label, { exact: true }).press("Enter");
      assert.equal(await modal.count(), 1, "Enter no confirma la carga");
    }
    await modal
      .getByLabel("Observaciones", { exact: true })
      .fill("Carga de prueba");
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await filters
      .getByLabel("Fletero", { exact: true })
      .selectOption(String(carrier.id));
    assert.deepEqual(
      await page.locator(".eo-material-stat strong").allTextContents(),
      ["11", "11", "0", "42", "28", "14"],
    );
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "materiales-listado-oscuro.png"),
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
      path: path.join(output, "materiales-listado-tablet.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, "materiales-listado-notebook.png"),
      fullPage: true,
    });
    await filters
      .getByLabel("Tipo", { exact: true })
      .selectOption("Recepción desde Mendoza");
    await page.evaluate(() => (window.print = () => {}));
    await filters
      .getByRole("button", { name: "Imprimir", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page
        .locator("#eo-print-document .eo-material-movements tbody tr")
        .count(),
      1,
    );
    assert.equal(await page.locator("#eo-print-document button").count(), 0);
    await page.pdf({
      path: path.join(output, "materiales-listado.pdf"),
      format: "A4",
      landscape: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "OK: indicadores, saldos, cuatro filtros, transferencias, carga y devolución reales aisladas, Enter, temas, tablet, notebook e impresión filtrada.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "materiales-listado-error.png"),
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
