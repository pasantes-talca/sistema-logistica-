/* Prueba de navegador contra el servidor aislado expedicion.smoke_server.
 * PLAYWRIGHT_MODULE permite usar una instalación temporal, sin dependencia productiva.
 */
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
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const output = path.join(__dirname, "..", "test-artifacts");
  const orderNumber = `OC-BROWSER-${Date.now()}`;
  const employeeLegajo = String(Date.now());
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto("http://127.0.0.1:5175/");
    await page.getByLabel("Usuario", { exact: true }).fill("smoke");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("Smoke-local-123!");
    await page.getByRole("button", { name: "Ingresar al sistema" }).click();
    await page.waitForURL("**/panel");
    await page.goto("http://127.0.0.1:5175/expedicion/ordenes/nueva");
    const modal = page.getByRole("dialog");
    await modal
      .getByLabel("Número de orden", { exact: true })
      .fill(orderNumber);
    await modal
      .getByLabel("Circuito", { exact: true })
      .selectOption("preventa");
    await modal.getByLabel("Fletero", { exact: true }).click();
    await modal
      .getByRole("button", { name: "Fletero de prueba · Transporte prueba" })
      .click();
    await modal
      .getByLabel("Código, alias o nombre", { exact: true })
      .fill("5670");
    await modal
      .getByLabel("Código, alias o nombre", { exact: true })
      .press("Enter");
    await modal.getByLabel("Packs completos", { exact: true }).fill("2");
    await modal.getByLabel("Packs completos", { exact: true }).press("Enter");
    await modal.getByLabel("Botellas sueltas", { exact: true }).fill("3");
    await modal.getByLabel("Botellas sueltas", { exact: true }).press("Enter");
    await modal.getByRole("cell", { name: "15 un.", exact: true }).waitFor();
    assert.equal(await modal.count(), 1, "Enter no debe confirmar la orden");
    await page.screenshot({
      path: path.join(output, "orden-formulario.png"),
      fullPage: true,
    });
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await page.waitForURL(/\/expedicion\/ordenes\/\d+$/);
    await page.getByRole("heading", { name: `Orden ${orderNumber}` }).waitFor();
    await page
      .getByRole("button", { name: "Confirmar salida", exact: true })
      .click();
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page.getByText("Despachada", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Corregir orden" }).click();
    await modal
      .getByLabel("Motivo obligatorio")
      .fill("Corrección posterior a la entrega");
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page.screenshot({
      path: path.join(output, "orden-detalle.png"),
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:5175/expedicion/ordenes");
    await page
      .getByRole("columnheader", { name: "Solicitado", exact: true })
      .waitFor();
    await page
      .getByRole("columnheader", { name: "Entregado", exact: true })
      .waitFor();
    await page
      .getByRole("columnheader", { name: "Encargado", exact: true })
      .waitFor();
    const savedOrder = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: orderNumber, exact: true }),
    });
    assert.equal(
      await savedOrder
        .getByRole("cell", { name: "2,5 fardos", exact: true })
        .count(),
      2,
    );
    await page.screenshot({
      path: path.join(output, "ordenes-listado.png"),
      fullPage: true,
    });
    await page.getByLabel("Turno", { exact: true }).selectOption("Tarde");
    await page
      .getByText("No hay registros para los filtros seleccionados.")
      .waitFor();
    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    await savedOrder.waitFor();
    await page.evaluate(() => {
      window.print = () => {};
    });
    const addProduct = async (packs = "1", units = "0") => {
      await modal
        .getByLabel("Código, alias o nombre", { exact: true })
        .fill("5670");
      await modal
        .getByLabel("Código, alias o nombre", { exact: true })
        .press("Enter");
      await modal.getByLabel("Packs completos", { exact: true }).fill(packs);
      await modal.getByLabel("Packs completos", { exact: true }).press("Enter");
      await modal.getByLabel("Botellas sueltas", { exact: true }).fill(units);
      await modal
        .getByLabel("Botellas sueltas", { exact: true })
        .press("Enter");
    };
    await page.goto("http://127.0.0.1:5175/expedicion/empleados");
    await page
      .getByRole("button", { name: "Administrar padrón", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nuevo empleado", exact: true })
      .click();
    await modal
      .getByLabel("Nombre", { exact: true })
      .fill("Empleado navegador");
    await modal.getByLabel("Legajo", { exact: true }).fill(employeeLegajo);
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page
      .getByRole("button", {
        name: "Acreditar +2 fardos a activos",
        exact: true,
      })
      .click();
    await modal.getByLabel("Motivo obligatorio").fill("Acreditación de prueba");
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    const employeeRow = page
      .getByRole("row")
      .filter({
        has: page.getByRole("cell", {
          name: employeeLegajo,
          exact: true,
        }),
      })
      .first();
    await employeeRow
      .getByRole("button", { name: "Consumo", exact: true })
      .click();
    await addProduct();
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    assert.equal(
      await page.locator("#eo-print-document .eo-receipt").count(),
      2,
      "Dos comprobantes para facturación y guardia",
    );
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: path.join(output, "comprobante-empleado.pdf"),
      format: "A4",
    });
    const receiptPdf = fs
      .readFileSync(path.join(output, "comprobante-empleado.pdf"))
      .toString("latin1");
    assert.equal(
      (receiptPdf.match(/\/Type\s*\/Page\b/g) || []).length,
      1,
      "Las dos copias deben caber en una hoja A4",
    );
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    await employeeRow
      .getByRole("cell", { name: "1 fardos", exact: true })
      .waitFor();
    await page.goto("http://127.0.0.1:5175/expedicion/materiales");
    await page
      .getByRole("button", { name: "Nueva carga de materiales", exact: true })
      .click();
    await modal.getByLabel("Fletero", { exact: true }).click();
    await modal
      .getByRole("button", { name: "Fletero de prueba · Transporte prueba" })
      .click();
    await modal.getByLabel("Pallets entregados", { exact: true }).fill("3");
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page
      .getByRole("heading", {
        name: "Saldos de fleteros en este período",
        exact: true,
      })
      .waitFor();
    await page.goto("http://127.0.0.1:5175/expedicion/conteos");
    await page.getByRole("button", { name: "Nuevo conteo" }).click();
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page.getByLabel("Turno activo").selectOption("Tarde");
    await page
      .getByRole("button", { name: "Corroborar recepción" })
      .first()
      .click();
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page.goto("http://127.0.0.1:5175/expedicion/configuracion");
    await page
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar respaldo restaurable" })
      .click();
    const backupDownload = await downloadPromise;
    const backupPath = path.join(output, "respaldo-smoke.json");
    await backupDownload.saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    assert.equal(backup.formato, "talca-expedicion-django");
    await page
      .getByLabel("Seleccionar respaldo para revisar")
      .setInputFiles(backupPath);
    await modal.getByLabel("Escribí RESTAURAR").fill("RESTAURAR");
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await page
      .getByRole("status")
      .getByText(/Respaldo restaurado/)
      .waitFor();
    for (const route of [
      "inicio",
      "ordenes",
      "pendientes",
      "stock",
      "movimientos",
      "materiales",
      "empleados",
      "conteos",
      "auditoria",
      "configuracion",
      "fleteros",
    ]) {
      await page.goto(`http://127.0.0.1:5175/expedicion/${route}`);
      await page.locator(".eo-content").waitFor();
      assert.equal(
        await page.locator(".eo-error").count(),
        0,
        `Error en ruta ${route}`,
      );
    }
    await page.goto("http://127.0.0.1:5175/expedicion/stock");
    await page.locator(".eo-content").waitFor();
    await page.screenshot({
      path: path.join(output, "stock-escritorio.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    assert.equal(await page.locator(".eo-dark").count(), 1);
    await page.screenshot({
      path: path.join(output, "stock-oscuro.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tema claro" }).click();
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({
      path: path.join(output, "stock-tablet.png"),
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "La página no debe desbordar horizontalmente",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole("button", { name: "Imprimir", exact: true }).click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    assert(await page.locator("#eo-print-document").isVisible());
    await page.pdf({ path: path.join(output, "stock.pdf"), format: "A4" });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    assert.deepEqual(errors, [], "Errores de consola de navegador");
    console.log(
      "OK: login, órdenes, teclado, entrega, corrección, empleados/beneficios, materiales, conteo/relevo, respaldo/restauración, 11 rutas, tema, tablet e impresión.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "fallo.png"),
      fullPage: true,
    });
    console.log(await page.locator("body").innerText());
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
