// Sólo contra expedicion.smoke_server: SQLite en memoria y credenciales ficticias.
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
  // HMR y fuentes externas no participan en esta prueba de conectividad de la app.
  await page.routeWebSocket("**", () => {});
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error")
      errors.push(`${msg.text()} ${msg.location().url}`);
  });
  const output = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(output, { recursive: true });
  try {
    // Sesión real sin pasar por el dashboard: el servidor WSGI de prueba es
    // monohilo y no está destinado a la ráfaga de consultas de otros módulos.
    const login = await page.request.post(
      "http://127.0.0.1:8765/api/auth/login/",
      { data: { username: "smoke", password: "Smoke-local-123!" } },
    );
    assert.equal(login.status(), 200);
    const api = "http://127.0.0.1:8765/api/expedicion/operativa/";
    const getData = async () => {
      const res = await page.request.get(api);
      assert.equal(res.status(), 200);
      return res.json();
    };
    let data = await getData();
    const p = data.productos.find((p) => p.codigo === "5670");
    assert(p, "Catálogo aislado con cola 3 L");
    const csrf = (await page.context().cookies()).find(
      (c) => c.name === "csrftoken",
    ).value;
    const command = async (body) => {
      const res = await page.request.post(api, {
        headers: { "X-CSRFToken": csrf },
        data: {
          clave: randomUUID(),
          turno: "Mañana",
          fecha: "2026-10-13",
          ...body,
        },
      });
      assert.equal(res.status(), 200, await res.text());
    };
    await command({
      accion: "pendientes",
      producto: p.id,
      motivo: "Verificación local de circuitos",
      pendientes: {
        preventa: 12,
        distriC: 18,
        distriInterior: 24,
        oesteMendoza: 30,
        oesteJeremias: 36,
      },
    });
    await command({
      accion: "movimiento",
      tipo: "PRODUCCION_SIN_CODIFICAR",
      direccion: "ENTRADA",
      lineas: [{ producto: p.id, packs: 1, unidades: 0 }],
    });
    data = await getData();
    const current = data.productos.find((x) => x.id === p.id);
    await page.goto("http://127.0.0.1:5175/expedicion/stock");
    await page.waitForLoadState("networkidle");
    const group = page.getByRole("group", {
      name: "Filtros de stock",
      exact: true,
    });
    await group.waitFor();
    const table = page.locator(".eo-stock-table");
    assert.equal(await table.getByRole("columnheader").count(), 11);
    assert.deepEqual(await table.getByRole("columnheader").allTextContents(), [
      "Producto",
      "Stock físico",
      "Preventa pendiente",
      "Distri C pendiente",
      "Distri Interior",
      "Sin codificar",
      "Oeste Mendoza pendiente",
      "Oeste Jeremías pendiente",
      "Total pendiente",
      "% stock disponible",
      "Acciones",
    ]);
    assert.equal(await group.locator("input,select").count(), 2);
    assert.equal(await page.locator(".eo-tabs").count(), 0);
    await group.getByLabel("Buscar producto").fill(p.alias || p.codigo);
    assert.equal(await table.locator("tbody tr").count(), 1);
    let cells = await table.locator("tbody tr td").allTextContents();
    assert.deepEqual(cells.slice(2, 8), [
      "2 fardos",
      "3 fardos",
      "4 fardos",
      `${current.sin_codificar / p.unidades_pack} fardos`,
      "5 fardos",
      "6 fardos",
    ]);
    const totalPendiente = `${(120 + current.sin_codificar) / p.unidades_pack} fardos`;
    assert.equal(cells[8], totalPendiente);
    assert(cells[9].includes("Disponible"));
    assert.equal(await table.locator("tfoot td").count(), 11);
    await group.getByRole("button", { name: "Ver en pallets" }).click();
    cells = await table.locator("tbody tr td").allTextContents();
    const per = p.unidades_pack * p.packs_corte * p.cortes_pallet;
    assert(cells[1].includes(`${Math.floor(current.stock / per)} pallets`));
    await group.getByRole("button", { name: "Ver en fardos" }).click();
    await group
      .getByLabel("Estado", { exact: true })
      .selectOption("Sin pendientes");
    await table
      .getByText("No hay productos con los filtros seleccionados.")
      .waitFor();
    assert.equal(await table.locator("tfoot").count(), 0);
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar CSV", exact: true })
      .click();
    const download = await downloadPromise;
    const file = path.join(output, "stock-listado.csv");
    await download.saveAs(file);
    const csv = fs.readFileSync(file, "utf8");
    assert.equal(
      csv.trim().split("\r\n").length - 1,
      data.productos.filter((x) => x.activo).length,
    );
    assert(csv.includes('"Stock entregable"'));
    assert(csv.includes(`"${totalPendiente}"`));
    assert(!csv.includes("NaN"));
    await group.getByRole("button", { name: "Limpiar", exact: true }).click();
    await page.screenshot({
      path: path.join(output, "stock-listado.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "stock-listado-oscuro.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tema claro" }).click();
    await page
      .getByRole("button", { name: "Ajustar stock físico", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    assert.equal(
      await modal
        .getByLabel("Tipo de movimiento", { exact: true })
        .inputValue(),
      "AJUSTE",
    );
    const justification = modal.getByLabel(
      "Justificación de stock insuficiente / motivo del ajuste *",
      { exact: true },
    );
    assert.equal(await justification.getAttribute("required"), "");
    const combo = modal.getByRole("combobox", {
      name: "Código, alias o nombre",
    });
    await combo.fill(p.codigo);
    await modal
      .locator(".eo-options button")
      .filter({ hasText: p.codigo })
      .click();
    await modal.getByLabel("Packs completos", { exact: true }).fill("1");
    await modal.getByLabel("Botellas sueltas", { exact: true }).fill("0");
    await modal.getByLabel("Botellas sueltas", { exact: true }).press("Enter");
    assert.equal(
      await modal.count(),
      1,
      "Enter agrega producto, no guarda ajuste",
    );
    await justification.fill("Ajuste de prueba en memoria");
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    data = await getData();
    assert.equal(
      data.productos.find((x) => x.id === p.id).stock,
      current.stock + p.unidades_pack,
    );
    await page
      .getByRole("button", {
        name: `Editar pendientes ${p.codigo}`,
        exact: true,
      })
      .click();
    assert(
      await modal
        .getByRole("heading", { name: /Pendientes adicionales/ })
        .isVisible(),
    );
    await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.waitForLoadState("networkidle");
    await page.context().setOffline(true);
    await page.waitForFunction(
      () => document.querySelector(".eo-stock-actions button").disabled,
    );
    assert(
      await page
        .getByRole("button", { name: "Ajustar stock físico", exact: true })
        .isDisabled(),
    );
    assert(
      await page
        .getByRole("button", {
          name: `Editar pendientes ${p.codigo}`,
          exact: true,
        })
        .isDisabled(),
    );
    await page.context().setOffline(false);
    await page.waitForFunction(
      () => !document.querySelector(".eo-stock-actions button").disabled,
    );
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
      path: path.join(output, "stock-listado-tablet.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, "stock-listado-notebook.png"),
      fullPage: true,
    });
    await group.getByLabel("Buscar producto").fill(p.codigo);
    await page.evaluate(() => (window.print = () => {}));
    await page.getByRole("button", { name: "Imprimir", exact: true }).click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    const report = page.locator("#eo-print-document");
    assert.equal(await report.getByRole("columnheader").count(), 10);
    assert.equal(await report.locator("tbody tr").count(), 1);
    assert.equal(await report.getByRole("button").count(), 0);
    await page.pdf({
      path: path.join(output, "stock-listado.pdf"),
      format: "A4",
      landscape: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "OK: 11 columnas, circuitos, totales, búsqueda, filtros, pallets, CSV completo, ajuste real aislado, Enter seguro, edición, modo sin conexión, temas, tablet, notebook e impresión filtrada.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "stock-listado-error.png"),
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
