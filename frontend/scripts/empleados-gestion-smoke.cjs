// Sólo expedicion.smoke_server: credenciales ficticias y SQLite en memoria.
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
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  let operaciones = 0;
  page.on("request", (req) => {
    if (
      req.method() === "POST" &&
      req.url().endsWith("/expedicion/operativa/") &&
      req.postDataJSON()?.accion === "consumo"
    )
      operaciones++;
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
      return r.json();
    };
    const legajo = String(Date.now());
    await command({
      accion: "empleado",
      legajo,
      nombre: "José",
      apellido: "Martínez",
      activo: true,
    });
    await command({
      accion: "empleado",
      legajo: `${legajo}-I`,
      nombre: "Prueba",
      apellido: "Inactiva",
      activo: false,
    });
    let data = await getData();
    const alta = data.empleados.find((e) => e.legajo === legajo);
    const inactive = data.empleados.find((e) => e.legajo === `${legajo}-I`);
    const elegibles = data.productos
      .filter((p) => p.activo && p.beneficio_empleado)
      .slice(0, 2);
    assert.equal(elegibles.length, 2);
    await page.goto("http://127.0.0.1:5175/expedicion/empleados");
    await page.waitForLoadState("networkidle");
    await page
      .getByText(
        "Seleccioná un empleado para consultar su saldo, historial y registrar operaciones.",
      )
      .waitFor();
    assert.equal(await page.locator(".eo-tabs").count(), 0);
    await page.screenshot({
      path: path.join(output, "empleados-inicio.png"),
      fullPage: true,
    });
    const search = page.getByLabel("Legajo o nombre", { exact: true });
    await search.fill(legajo);
    assert.equal(
      await page.locator(".eo-employee-results button").count(),
      1,
      "El inactivo no aparece en la búsqueda operativa",
    );
    await search.press("Enter");
    await page
      .locator(".eo-employee-profile")
      .getByRole("heading", { name: "José Martínez" })
      .waitFor();
    await page
      .getByRole("button", {
        name: "Acreditar +2 fardos a activos",
        exact: true,
      })
      .click();
    const modal = page.getByRole("dialog");
    await modal
      .getByLabel("Motivo obligatorio")
      .fill("Acreditación de prueba aislada");
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await page
      .locator(".eo-employee-profile strong")
      .getByText("2 fardos", { exact: true })
      .waitFor();
    data = await getData();
    assert.equal(
      data.empleados.find((e) => e.id === inactive.id).saldo_fardos,
      0,
    );
    const consumo = page.getByRole("form", {
      name: "Consumo de empleado",
      exact: true,
    });
    const anticipo = page.getByRole("form", {
      name: "Anticipo empleado",
      exact: true,
    });
    await consumo.getByLabel("Fardos 1", { exact: true }).fill("3");
    await consumo
      .getByRole("button", {
        name: "Confirmar y generar comprobantes",
        exact: true,
      })
      .click();
    await consumo
      .getByRole("alert")
      .getByText(/Saldo insuficiente/)
      .waitFor();
    assert.equal(operaciones, 0);
    await consumo.getByLabel("Fardos 1", { exact: true }).fill("1");
    await consumo
      .getByRole("combobox", { name: "Producto 1" })
      .fill(elegibles[0].codigo);
    await consumo
      .locator(".eo-options button")
      .filter({ hasText: elegibles[0].codigo })
      .click();
    await consumo
      .getByRole("button", { name: "Agregar producto", exact: true })
      .click();
    await consumo
      .getByRole("combobox", { name: "Producto 2" })
      .fill(elegibles[1].codigo);
    await consumo
      .locator(".eo-options button")
      .filter({ hasText: elegibles[1].codigo })
      .click();
    await page.screenshot({
      path: path.join(output, "empleados-ficha.png"),
      fullPage: true,
    });
    await page.evaluate(() => (window.print = () => {}));
    await consumo
      .getByRole("button", {
        name: "Confirmar y generar comprobantes",
        exact: true,
      })
      .dblclick();
    await page.locator(".eo-employee-receipt").waitFor();
    assert.equal(operaciones, 1, "Doble clic no duplica la operación");
    data = await getData();
    const empleado = data.empleados.find((e) => e.id === alta.id);
    assert.equal(empleado.saldo_fardos, 0);
    const c = data.comprobantes.find(
      (c) => c.empleado === alta.id && c.tipo === "CONSUMO",
    );
    assert.equal(c.lineas.length, 2);
    await page
      .locator(".eo-employee-receipt")
      .getByRole("button", { name: "Imprimir dos copias", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    assert.equal(
      await page.locator("#eo-print-document .eo-receipt").count(),
      2,
    );
    await page.emulateMedia({ media: "print" });
    const pdf = path.join(output, "empleados-comprobante.pdf");
    await page.pdf({ path: pdf, format: "A4" });
    assert.equal(
      (fs.readFileSync(pdf, "latin1").match(/\/Type\s*\/Page\b/g) || []).length,
      1,
    );
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    const p = data.productos.find((p) => p.activo && !p.beneficio_empleado);
    const stock = p.stock;
    await anticipo
      .getByRole("combobox", { name: "Código, alias o nombre" })
      .fill(p.codigo);
    await anticipo
      .getByRole("combobox", { name: "Código, alias o nombre" })
      .press("Enter");
    await anticipo.getByLabel("Packs completos", { exact: true }).fill("0");
    await anticipo.getByLabel("Botellas sueltas", { exact: true }).fill("1");
    await anticipo
      .getByLabel("Botellas sueltas", { exact: true })
      .press("Enter");
    assert.equal(
      operaciones,
      1,
      "Enter agrega producto y no confirma anticipo",
    );
    await anticipo
      .getByRole("button", {
        name: "Confirmar y generar comprobantes",
        exact: true,
      })
      .click();
    await page
      .locator(".eo-employee-receipt")
      .getByText(/Anticipo · Comprobante/)
      .waitFor();
    data = await getData();
    assert.equal(data.empleados.find((e) => e.id === alta.id).saldo_fardos, 0);
    assert.equal(data.productos.find((x) => x.id === p.id).stock, stock - 1);
    assert.equal(
      data.comprobantes.filter((c) => c.empleado === alta.id).length,
      2,
    );
    await page.getByRole("button", { name: "Tema oscuro" }).click();
    await page.screenshot({
      path: path.join(output, "empleados-oscuro.png"),
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
      path: path.join(output, "empleados-tablet.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(output, "empleados-notebook.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Administrar padrón", exact: true })
      .click();
    await page.getByLabel("Buscar en padrón").fill(`${legajo}-I`);
    assert.equal(
      await page.locator(".eo-employee-roster > .eo-table tbody tr").count(),
      1,
    );
    await page
      .locator(".eo-employee-roster > .eo-table")
      .getByRole("button", { name: "Editar", exact: true })
      .click();
    await modal.getByLabel("Apellido", { exact: true }).fill("Actualizada");
    await modal
      .getByRole("button", { name: "Confirmar operación", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    data = await getData();
    assert.equal(
      data.empleados.find((e) => e.id === inactive.id).apellido,
      "Actualizada",
    );
    await page
      .getByRole("button", { name: "Imprimir padrón", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: path.join(output, "empleados-padron.pdf"),
      format: "A4",
    });
    assert.deepEqual(errors, []);
    console.log(
      "OK: búsqueda, selección, activos/inactivos, acreditación manual, consumo múltiple, saldo insuficiente, doble clic seguro, anticipo con sueltas, dos copias A4, historial, padrón, edición, temas, tablet y notebook.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "empleados-error.png"),
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
