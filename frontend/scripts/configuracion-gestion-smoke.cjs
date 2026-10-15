// Exclusivamente contra expedicion.smoke_server: SQLite en memoria, no servidor operativo.
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
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  await context.routeWebSocket("**", () => {});
  await context.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const output = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(output, { recursive: true });
  const api = "http://127.0.0.1:8765/api/expedicion/operativa/";
  try {
    assert.equal(
      (
        await context.request.post("http://127.0.0.1:8765/api/auth/login/", {
          data: { username: "smoke", password: "Smoke-local-123!" },
        })
      ).status(),
      200,
    );
    const csrf = (await context.cookies()).find(
      (c) => c.name === "csrftoken",
    ).value;
    const getData = async () => {
      const r = await context.request.get(api);
      assert.equal(r.status(), 200);
      return r.json();
    };
    const command = async (body) => {
      const r = await context.request.post(api, {
        headers: { "X-CSRFToken": csrf },
        data: { clave: randomUUID(), turno: "Mañana", ...body },
      });
      assert.equal(r.status(), 200, await r.text());
      return r.json();
    };
    const stamp = Date.now();
    const duplicate = `José Config ${stamp}`;
    const f1 = (
      await command({
        accion: "fletero",
        nombre: duplicate,
        empresa: "Empresa A",
        activo: true,
      })
    ).id;
    const f2 = (
      await command({
        accion: "fletero",
        nombre: duplicate.toUpperCase(),
        empresa: "Empresa B",
        activo: true,
      })
    ).id;
    const p = (await getData()).productos.find((p) => p.codigo === "5670");
    await command({
      accion: "orden",
      numero: `CONFIG-${stamp}`,
      fletero: f2,
      fecha: "2026-10-14",
      circuito: "administrative",
      lineas: [{ producto: p.id, packs: 1, unidades: 0 }],
    });
    await page.goto("http://127.0.0.1:5175/expedicion/configuracion");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator(".eo-tabs").count(), 0);
    const users = page.getByRole("region", { name: "Usuarios", exact: true });
    const carriers = page.getByRole("region", {
      name: "Fleteros",
      exact: true,
    });
    const products = page.getByRole("region", {
      name: "Productos y equivalencias",
      exact: true,
    });
    assert(await users.isVisible());
    assert(await carriers.isVisible());
    const actionBox = await page
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .boundingBox();
    const shiftBox = await page
      .getByLabel("Turno activo", { exact: true })
      .boundingBox();
    assert(
      shiftBox.x + shiftBox.width <= actionBox.x,
      "Turno y copias no deben superponerse",
    );
    const ubox = await users.boundingBox(),
      fbox = await carriers.boundingBox();
    assert(Math.abs(ubox.y - fbox.y) < 1 && fbox.x > ubox.x);
    const baseline = await getData();
    await carriers.getByRole("button", { name: "Revisar duplicados" }).click();
    await page
      .locator("#eo-carrier-duplicates")
      .getByText(`ID ${f1} · Empresa A · Activo`, { exact: true })
      .waitFor();
    await page
      .locator("#eo-carrier-duplicates")
      .getByText(`ID ${f2} · Empresa B · Activo`, { exact: true })
      .waitFor();
    assert.deepEqual(
      await getData(),
      baseline,
      "Revisión no fusiona ni modifica nada",
    );
    assert.equal(
      await carriers
        .getByRole("button", { name: "Eliminar", exact: true })
        .count(),
      0,
    );
    await carriers.getByRole("button", { name: "Revisar duplicados" }).click();
    await carriers.getByLabel("Buscar fleteros").fill(`jose config ${stamp}`);
    assert.equal(await carriers.locator(".eo-config-list > li").count(), 2);
    await carriers
      .getByRole("button", {
        name: `Modificar fletero ${duplicate.toUpperCase()} ${f2}`,
        exact: true,
      })
      .click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Activo", { exact: true }).uncheck();
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    const afterDisable = await getData();
    assert.equal(afterDisable.fleteros.find((f) => f.id === f2).activo, false);
    assert.deepEqual(
      afterDisable.ordenes,
      baseline.ordenes,
      "La baja no borra ni altera órdenes",
    );
    await carriers.getByLabel("Estado de fleteros").selectOption("inactivo");
    assert.equal(await carriers.locator(".eo-config-list > li").count(), 1);
    await carriers.getByLabel("Buscar fleteros").fill("");
    await carriers.getByLabel("Estado de fleteros").selectOption("");
    await carriers.getByRole("button", { name: "Agregar fletero" }).click();
    await modal
      .getByLabel("Nombre", { exact: true })
      .fill(`Nuevo config ${stamp}`);
    await modal.getByLabel("Empresa", { exact: true }).fill("Empresa C");
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    assert(
      (await getData()).fleteros.some(
        (f) => f.nombre === `Nuevo config ${stamp}`,
      ),
    );
    const username = `config${stamp}`;
    await users.getByRole("button", { name: "Agregar usuario" }).click();
    await modal
      .getByLabel("Nombre", { exact: true })
      .fill("María Prueba Configuración");
    await modal.getByLabel("Usuario", { exact: true }).fill(username);
    await modal
      .getByLabel("Contraseña", { exact: true })
      .fill("Config-prueba-segura-927!");
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    await users.getByLabel("Buscar usuarios").fill("maria prueba");
    assert.equal(await users.locator(".eo-config-list > li").count(), 1);
    await users
      .getByRole("button", {
        name: `Modificar usuario ${username}`,
        exact: true,
      })
      .click();
    await modal
      .getByLabel("Nombre", { exact: true })
      .fill("María Configuración Editada");
    assert.equal(
      await modal.getByLabel("Contraseña nueva (opcional)").inputValue(),
      "",
    );
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    assert.equal(
      (await getData()).usuarios.find((u) => u.username === username).nombre,
      "María Configuración Editada",
    );
    await users.getByLabel("Buscar usuarios").fill("");
    await products.getByLabel("Buscar productos").fill("5670");
    assert.equal(await products.locator("tbody tr").count(), 1);
    await products
      .getByRole("button", { name: `Configurar ${p.nombre}`, exact: true })
      .click();
    assert(
      (await modal
        .getByLabel("Código", { exact: true })
        .getAttribute("readonly")) !== null,
    );
    await modal.getByLabel("Alias de búsqueda").fill("CO3-CFG");
    await modal.getByRole("button", { name: "Confirmar operación" }).click();
    await modal.waitFor({ state: "hidden" });
    const configured = (await getData()).productos.find((x) => x.id === p.id);
    assert.equal(configured.alias, "CO3-CFG");
    assert.equal(configured.unidades_pack, p.unidades_pack);
    assert.equal(configured.stock, p.stock);
    await products.getByLabel("Buscar productos").fill("");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "configuracion-escritorio.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .click();
    const backups = page.locator("#eo-config-backups");
    const beforeBackup = await getData();
    const dl = page.waitForEvent("download");
    await backups
      .getByRole("button", { name: "Descargar respaldo restaurable" })
      .click();
    const backupPath = path.join(output, "configuracion-respaldo.json");
    await (await dl).saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
    assert.equal(backup.formato, "talca-expedicion-django");
    assert(!JSON.stringify(backup).includes("Config-prueba-segura-927!"));
    await backups
      .getByRole("button", { name: "Ver copias previas del servidor" })
      .click();
    await backups
      .getByRole("heading", {
        name: "Copias previas del servidor",
        exact: true,
      })
      .waitFor();
    const file = backups.getByLabel("Seleccionar respaldo para revisar");
    await file.setInputFiles({
      name: "incorrecto.json",
      mimeType: "application/json",
      buffer: Buffer.from("no es JSON"),
    });
    await backups
      .getByRole("alert")
      .getByText(/JSON válido/)
      .waitFor();
    await file.setInputFiles({
      name: "grande.json",
      mimeType: "application/json",
      buffer: Buffer.alloc(2000001),
    });
    await backups
      .getByRole("alert")
      .getByText(/supera 2 MB/)
      .waitFor();
    await file.setInputFiles(backupPath);
    await modal.waitFor();
    assert.equal(await modal.getByLabel("Escribí RESTAURAR").inputValue(), "");
    await modal.getByRole("button", { name: "Cancelar", exact: true }).click();
    await modal.waitFor({ state: "hidden" });
    assert.deepEqual(
      await getData(),
      beforeBackup,
      "Descarga y revisión no restauran ni escriben registros",
    );
    await page
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tema oscuro", exact: true })
      .click();
    assert.equal(await page.locator(".eo-dark").count(), 1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "configuracion-oscuro.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tema claro", exact: true }).click();
    await products.getByLabel("Buscar productos").fill("5670");
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page
      .getByRole("button", { name: "Imprimir configuración", exact: true })
      .click();
    await page.locator("#eo-print-document").waitFor({ state: "attached" });
    await page.emulateMedia({ media: "print" });
    const print = page.locator("#eo-print-document");
    assert(await print.isVisible());
    assert.equal(await print.getByRole("button").count(), 0);
    assert.equal(
      await print
        .getByRole("cell", { name: "5670 / CO3-CFG", exact: true })
        .count(),
      1,
    );
    assert.equal(
      await print
        .getByRole("cell", { name: "4900 / SO2", exact: true })
        .count(),
      0,
    );
    await page.pdf({
      path: path.join(output, "configuracion.pdf"),
      format: "A4",
    });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => dispatchEvent(new Event("afterprint")));
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    assert.equal(
      await products.getByLabel("Buscar productos").inputValue(),
      "",
    );
    for (const width of [1366, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      if (await page.locator(".sidebar.sidebar-open").count())
        await page.locator(".sidebar-open .sidebar-close").click();
      if (width < 940)
        await page.waitForFunction(
          () =>
            document.querySelector(".sidebar").getBoundingClientRect().right <=
            1,
        );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Sin desborde en ${width}`,
      );
    }
    const restricted = await browser.newContext();
    await restricted.routeWebSocket("**", () => {});
    await restricted.route("https://fonts.googleapis.com/**", (r) =>
      r.fulfill({ contentType: "text/css", body: "" }),
    );
    assert.equal(
      (
        await restricted.request.post("http://127.0.0.1:8765/api/auth/login/", {
          data: { username, password: "Config-prueba-segura-927!" },
        })
      ).status(),
      200,
    );
    const restrictedPage = await restricted.newPage();
    await restrictedPage.goto("http://127.0.0.1:5175/expedicion/configuracion");
    await restrictedPage.locator(".eo-config-grid").waitFor();
    assert.equal(
      await restrictedPage
        .getByRole("button", { name: "Agregar usuario", exact: true })
        .count(),
      0,
    );
    await restrictedPage
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .click();
    assert.equal(
      await restrictedPage
        .getByRole("button", {
          name: "Descargar respaldo restaurable",
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(
      await restrictedPage
        .getByLabel("Seleccionar respaldo para revisar")
        .count(),
      0,
    );
    await restricted.close();
    assert.deepEqual(errors, []);
    console.log(
      "OK: usuarios y fleteros en dos columnas, altas/modificaciones, baja sin borrar historial, revisión sin fusiones, búsquedas, equivalencias, respaldos/revisión sin escrituras, permisos, consola, temas y responsive.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "configuracion-fallo.png"),
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
