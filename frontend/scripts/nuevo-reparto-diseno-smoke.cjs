// Intercepta TODAS las APIs: no lee ni escribe bases de datos.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSER,
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const recibidos = [];
  let rechazar = true,
    fallarListas = false;
  const empleado = (id, nombre) => ({
    id,
    nombre,
    legajo: String(id),
    puesto: "Prueba",
    activo: true,
    disponible: true,
  });
  await page.routeWebSocket("**", () => {});
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route("http://127.0.0.1:8771/api/**", async (r) => {
    const headers = {
      "Access-Control-Allow-Origin": "http://127.0.0.1:5181",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, X-CSRFToken",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    if (r.request().method() === "OPTIONS")
      return r.fulfill({ status: 204, headers });
    const p = new URL(r.request().url()).pathname;
    let data = [];
    if (p === "/api/auth/usuario/")
      data = {
        autenticado: true,
        id: 1,
        username: "prueba",
        first_name: "Operador",
        last_name: "Prueba",
        nombre_completo: "Operador Prueba",
        es_administrador: true,
        puede_administrar: true,
        es_superusuario: false,
        es_staff: false,
        grupos: ["ADMINISTRADOR"],
      };
    if (p === "/api/maestros/choferes/")
      data = [empleado(1, "José Martínez"), empleado(2, "Carlos Pérez")];
    if (p === "/api/maestros/ayudantes/")
      data = [
        empleado(1, "José Martínez"),
        empleado(3, "Ana López"),
        empleado(4, "Luis Gómez"),
      ];
    if (p === "/api/maestros/vehiculos/")
      data = [
        {
          id: 7,
          patente: "AB123CD",
          descripcion: "Camión",
          activo: true,
          tipo: "CAMION",
        },
      ];
    if (p === "/api/maestros/asignaciones/")
      data = [
        {
          id: 9,
          codigo: "R-10",
          descripcion: "Zona centro",
          activo: true,
          chofer_predeterminado_id: 1,
          chofer_predeterminado_nombre: "José Martínez",
        },
      ];
    if (fallarListas && p.startsWith("/api/maestros/"))
      return r.fulfill({
        status: 503,
        headers,
        json: { detail: "Sin conexión de prueba" },
      });
    if (p === "/api/repartos/" && r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      recibidos.push(body);
      if (rechazar)
        return r.fulfill({
          status: 400,
          headers,
          json: { error: "Error de prueba; volvé a intentar." },
        });
      await new Promise((resolve) => setTimeout(resolve, 250));
      return r.fulfill({
        headers,
        json: {
          id: 41,
          ...body,
          recargas: 2,
          cantidad_personas: 2,
          recargas_totales: 4,
          personal: [],
        },
      });
    }
    await r.fulfill({ json: data, headers });
  });
  const out = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(out, { recursive: true });
  try {
    await page.goto("http://127.0.0.1:5181/repartos/nuevo");
    await page
      .getByRole("heading", { name: "Nuevo reparto", exact: true })
      .waitFor();
    const submit = page.getByRole("button", { name: /Revisar reparto/ });
    await submit.click();
    assert.equal(recibidos.length, 0);
    for (const id of ["nr-patente", "nr-asignacion"]) {
      assert.equal(
        await page
          .locator("#" + id)
          .evaluate((e) => e.required && e.validity.valueMissing),
        true,
      );
    }
    assert.equal(
      await page.locator("#nr-chofer").evaluate((e) => e.validity.valueMissing),
      true,
    );
    await page
      .getByLabel("Fecha del reparto", { exact: false })
      .fill("2026-10-22");
    await page.getByLabel("Patente", { exact: false }).selectOption("7");
    await page.getByLabel("Asignación", { exact: false }).selectOption("9");
    assert.equal(
      await page.getByLabel("Chofer", { exact: false }).inputValue(),
      "1",
    );
    await page
      .getByRole("button", { name: "+ Agregar ayudante", exact: true })
      .click();
    await page.getByLabel("Ayudante 1", { exact: true }).selectOption("3");
    await page
      .getByRole("button", { name: "+ Agregar ayudante", exact: true })
      .click();
    assert.equal(
      await page
        .getByLabel("Ayudante 2", { exact: true })
        .locator('option[value="3"]')
        .evaluate((e) => e.disabled),
      true,
    );
    await page
      .getByRole("button", { name: "Quitar ayudante 2", exact: true })
      .click();
    await page.getByLabel("Cantidad de bultos", { exact: false }).fill("350");
    await page.getByLabel("Puntos de venta", { exact: false }).fill("Centro");
    await page
      .getByText("Agregar una observación (opcional)", { exact: true })
      .click();
    await page
      .getByLabel("Observaciones", { exact: true })
      .fill("Entrega por la mañana");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(out, "nuevo-reparto-claro.png"),
      fullPage: true,
    });
    await submit.click();
    await page
      .getByRole("heading", { name: "Revisá antes de guardar", exact: true })
      .waitFor();
    assert.equal(recibidos.length, 0);
    assert.match(await page.locator(".nr-summary").innerText(), /Ana López/);
    await page.getByRole("button", { name: "Volver a corregir" }).click();
    assert.equal(
      await page
        .getByLabel("Cantidad de bultos", { exact: false })
        .inputValue(),
      "350",
    );
    await page.getByLabel("Cantidad de bultos", { exact: false }).fill("360");
    await submit.click();
    await page
      .getByRole("button", { name: "Confirmar y guardar reparto", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Los datos siguen en pantalla" })
      .waitFor();
    assert.match(await page.locator(".nr-summary").innerText(), /360/);
    rechazar = false;
    await page
      .getByRole("button", { name: "Confirmar y guardar reparto", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Reparto guardado", exact: true })
      .waitFor();
    assert.deepEqual(recibidos[1], {
      fecha: "2026-10-22",
      vehiculo_id: 7,
      asignacion_id: 9,
      chofer_id: 1,
      ayudantes_ids: [3],
      bultos: 360,
      puntos_venta: "Centro",
      observaciones: "Entrega por la mañana",
    });
    assert.equal(recibidos.length, 2);
    assert.match(
      await page.locator(".nr-success").innerText(),
      /Recargas totales\s+4/,
    );
    await page.getByRole("button", { name: "Cargar otro reparto" }).click();
    assert.equal(
      await page
        .getByLabel("Cantidad de bultos", { exact: false })
        .inputValue(),
      "",
    );
    assert.equal(
      await page.getByLabel("Chofer", { exact: false }).inputValue(),
      "",
    );
    await page.getByRole("button", { name: "Activar tema oscuro" }).click();
    await page.screenshot({
      path: path.join(out, "nuevo-reparto-oscuro.png"),
      fullPage: true,
    });
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.equal(
        await page
          .locator("#nr-bultos")
          .evaluate(
            (e) =>
              parseFloat(getComputedStyle(e).fontSize) >= 16 &&
              e.getBoundingClientRect().height >= 48,
          ),
        true,
      );
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(out, "nuevo-reparto-tablet.png"),
      fullPage: true,
    });
    fallarListas = true;
    await page.reload();
    await page
      .getByRole("alert")
      .filter({ hasText: "No se pudieron cargar las listas" })
      .waitFor({ timeout: 15000 });
    assert(
      await page.getByRole("button", { name: /Revisar reparto/ }).isDisabled(),
    );
    fallarListas = false;
    await page
      .getByRole("button", { name: "Volver a intentar", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#nr-chofer").disabled &&
        !document.querySelector("#nr-chofer").closest("fieldset").disabled,
    );
    assert.deepEqual(errors, []);
    console.log(
      "OK: diseño claro/oscuro/tablet/móvil, etiquetas, controles grandes, asignación automática, ayudantes, revisión sin enviar, corrección, error sin perder datos, guardado y recuperación de listas. APIs simuladas, sin BD.",
    );
  } catch (e) {
    console.error(
      "Estado de la prueba:",
      page.url(),
      errors,
      (await page.locator("body").innerText()).slice(0, 2500),
    );
    await page.screenshot({
      path: path.join(out, "nuevo-reparto-fallo.png"),
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
