const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");

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
    const snapshotResponse = await page.request.get(
      "http://127.0.0.1:8765/api/expedicion/operativa/",
    );
    assert.equal(snapshotResponse.status(), 200);
    const data = await snapshotResponse.json();
    const csrf = (await page.context().cookies()).find(
      (c) => c.name === "csrftoken",
    ).value;
    const numero = `PENDIENTE-BROWSER-${Date.now()}`;
    const res = await page.request.post(
      "http://127.0.0.1:8765/api/expedicion/operativa/",
      {
        headers: { "X-CSRFToken": csrf },
        data: {
          accion: "orden",
          clave: randomUUID(),
          turno: "Mañana",
          numero,
          fletero: data.fleteros[0].id,
          circuito: "administrative",
          fecha: "2026-10-13",
          lineas: data.productos
            .filter((p) => ["5670", "5680"].includes(p.codigo))
            .map((p) => ({ producto: p.id, packs: 2, unidades: 0 })),
        },
      },
    );
    assert.equal(res.status(), 200, await res.text());
    await page.goto("http://127.0.0.1:5175/expedicion/pendientes");
    const group = page.getByRole("group", {
      name: "Filtros de pendientes",
      exact: true,
    });
    await group.waitFor();
    assert.equal(await group.locator("input,select").count(), 2);
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: numero, exact: true }) });
    await row.waitFor();
    assert.equal(
      await row.count(),
      1,
      "Una fila aunque haya dos productos pendientes",
    );
    assert.equal(await row.getByRole("cell").count(), 5);
    await page.screenshot({
      path: path.join(output, "pendientes-listado.png"),
      fullPage: true,
    });
    await group.getByLabel("Desde", { exact: true }).fill("2026-10-14");
    await page
      .getByText("No hay órdenes pendientes con los filtros seleccionados.")
      .waitFor();
    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    await row.waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar CSV", exact: true })
      .click();
    const download = await downloadPromise;
    const file = path.join(output, "pendientes-listado.csv");
    await download.saveAs(file);
    const csv = fs.readFileSync(file, "utf8");
    assert.equal(csv.split(numero).length - 1, 1);
    assert(csv.includes('"Fecha";"Fletero";"Tipo"'));
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "pendientes-listado-oscuro.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 768, height: 1024 });
    if (await page.locator(".sidebar.sidebar-open").count()) await page.locator(".sidebar-open .sidebar-close").click();
    await page.waitForFunction(() => document.querySelector(".sidebar").getBoundingClientRect().right <= 1);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, "pendientes-listado-tablet.png"),
      fullPage: true,
    });
    await page.evaluate(() => {
      window.print = () => {};
    });
    await group.getByRole("button", { name: "Imprimir", exact: true }).click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page
        .locator("#eo-print-document")
        .getByRole("columnheader")
        .count(),
      4,
    );
    await page.pdf({
      path: path.join(output, "pendientes-listado.pdf"),
      format: "A4",
    });
    assert.deepEqual(errors, []);
    console.log(
      "OK: pendientes agrupados, dos filtros, CSV por orden, temas, tablet e impresión.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
