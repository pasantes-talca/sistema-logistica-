// Prueba sólo contra expedicion.smoke_server (SQLite en memoria).
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
  const writes = [];
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method()))
      writes.push(r.url());
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
        data: { clave: randomUUID(), turno: "Mañana", ...body },
      });
      assert.equal(r.status(), 200, await r.text());
    };
    const ref = `=SUM(1;1)-AUD-${Date.now()}`;
    let data = await getData();
    const p = data.productos.find((p) => p.codigo === "5670");
    await command({
      accion: "empleado",
      legajo: `AUD-${Date.now()}`,
      nombre: "Auditoría de prueba",
      activo: true,
    });
    await command({
      accion: "movimiento",
      tipo: "REBOTE",
      direccion: "ENTRADA",
      referencia: ref,
      lineas: [{ producto: p.id, packs: 1, unidades: 1 }],
    });
    const baseline = await getData();
    const saved = baseline.auditoria.find((a) => a.referencia === ref);
    assert(saved);
    await page.goto("http://127.0.0.1:5175/expedicion/auditoria");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".eo-tabs").count(), 0);
    const table = page.locator(".eo-audit-table");
    assert.deepEqual(await table.getByRole("columnheader").allTextContents(), [
      "Fecha",
      "Usuario",
      "Acción",
      "Entidad",
      "Referencia",
      "Detalle",
    ]);
    assert.equal(
      await table.locator("tbody tr").count(),
      baseline.auditoria.length,
    );
    assert.equal(
      await table.getByRole("button").count(),
      0,
      "El historial no ofrece acciones de escritura",
    );
    const row = table
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: ref, exact: true }) });
    const cells = await row.getByRole("cell").allTextContents();
    assert(cells[2].includes("REBOTE"));
    assert.equal(cells[3], "Stock");
    assert(
      cells[5].includes(
        `${p.codigo} · ${p.nombre}: ${p.unidades_pack + 1} un.`,
      ),
    );
    assert(
      (
        await row.getByRole("cell").nth(3).locator("span").getAttribute("title")
      ).includes("clasificada"),
    );
    await row.locator("summary").click();
    const meta = JSON.parse(await row.locator("pre").textContent());
    assert.deepEqual(meta, { antes: saved.antes, despues: saved.despues });
    await row.locator("summary").click();
    await page.screenshot({
      path: path.join(output, "auditoria-listado.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Filtros adicionales", exact: true })
      .click();
    const filters = page.getByRole("group", {
      name: "Filtros de auditoría",
      exact: true,
    });
    await filters.getByLabel("Desde", { exact: true }).fill("2099-01-01");
    await page
      .getByText("No hay registros de auditoría con los filtros seleccionados.")
      .waitFor();
    await filters.getByRole("button", { name: "Limpiar", exact: true }).click();
    await filters.getByLabel("Buscar", { exact: true }).fill(p.codigo);
    assert.equal(
      await table.locator("tbody tr").count(),
      1,
      "La búsqueda incluye el detalle presentado",
    );
    await filters.getByLabel("Entidad", { exact: true }).selectOption("Stock");
    await filters.getByLabel("Acción", { exact: true }).selectOption("REBOTE");
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar CSV", exact: true })
      .click();
    const file = path.join(output, "auditoria-listado.csv");
    await (await downloadPromise).saveAs(file);
    const csv = fs.readFileSync(file, "utf8");
    assert(csv.includes('"Entidad"'));
    assert(csv.includes('"Antes"'));
    assert(csv.includes('"Después"'));
    assert(csv.includes('"Turno"'));
    assert(
      csv.includes(`"'${ref}"`),
      "Neutralizar fórmulas en campos exportados",
    );
    assert(csv.includes(saved.fecha), "Conservar fecha ISO original en CSV");
    assert(csv.includes('"Sí"'), "Identificar entidad clasificada");
    assert.equal(csv.split("AUD-").length - 1, 1);
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "auditoria-listado-oscuro.png"),
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
      path: path.join(output, "auditoria-listado-tablet.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, "auditoria-listado-notebook.png"),
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
      path: path.join(output, "auditoria-listado.pdf"),
      format: "A4",
      landscape: true,
    });
    assert.deepEqual((await getData()).auditoria, baseline.auditoria);
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log(
      "OK: seis columnas, registros reales intactos, clasificación explícita, detalle original, filtros, CSV completo y seguro, fechas ISO, cero escrituras, temas, tablet, notebook e impresión filtrada.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "auditoria-listado-error.png"),
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
