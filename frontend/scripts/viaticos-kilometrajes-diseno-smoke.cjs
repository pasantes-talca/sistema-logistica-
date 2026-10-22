// Solo Vite 5181 con APIs simuladas en 8771. No consulta ni modifica ninguna BD.
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
  const viaticos = [],
    controles = [];
  let fallar = true,
    fallarListas = false;
  const destinos = [
    { id: 10, nombre: "Centro", distancia_km: "100.50", activo: true },
    { id: 11, nombre: "Norte", distancia_km: "50.00", activo: true },
  ];
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
    const p = new URL(r.request().url()).pathname;
    const responder = (json, status = 200) =>
      r.fulfill({ json, status, headers });
    if (r.request().method() === "OPTIONS")
      return r.fulfill({ status: 204, headers });
    if (p === "/api/auth/usuario/")
      return responder({
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
      });
    if (
      fallarListas &&
      (p.startsWith("/api/maestros/") || p === "/api/kilometrajes/destinos/")
    )
      return responder({ detail: "Error de conexión de prueba" }, 503);
    if (p === "/api/maestros/choferes/")
      return responder([
        { id: 1, nombre: "José Martínez", activo: true, disponible: true },
        { id: 2, nombre: "Carlos Pérez", activo: true, disponible: true },
      ]);
    if (p === "/api/kilometrajes/destinos/") return responder(destinos);
    if (p === "/api/viaticos/" && r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      viaticos.push(body);
      if (fallar)
        return responder({ detail: "Error de guardado de prueba" }, 400);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return responder({
        id: 31,
        ...body,
        chofer_nombre: "José Martínez",
        tipo_reparto_nombre: "Larga distancia",
        valor_viatico: String(body.valor_viatico),
        monto_total: (body.valor_viatico * body.cantidad_viaticos).toFixed(2),
      });
    }
    if (p === "/api/kilometrajes/" && r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      controles.push(body);
      if (fallar)
        return responder({ detail: "Error de guardado de prueba" }, 400);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const total = body.registros.reduce(
        (s, r) =>
          s +
          r.cantidad_viajes *
            Number(destinos.find((d) => d.id === r.destino).distancia_km),
        0,
      );
      return responder({
        id: 41,
        ...body,
        chofer_nombre: "José Martínez",
        total_km: total.toFixed(2),
      });
    }
    return responder([]);
  });
  const app = "http://127.0.0.1:5181",
    out = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(out, { recursive: true });
  const revisar = () =>
    page.getByRole("button", { name: /Revisar la carga/ }).click();
  async function foto(name) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(out, name + ".png"),
      fullPage: true,
    });
  }
  async function responsive() {
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(350);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert(
        await page
          .locator(".nr-page input")
          .first()
          .evaluate(
            (e) =>
              e.getBoundingClientRect().height >= 48 &&
              parseFloat(getComputedStyle(e).fontSize) >= 16,
          ),
      );
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.waitForTimeout(350);
  }
  try {
    await page.goto(app + "/viaticos/nuevo");
    await page
      .getByRole("heading", { name: "Nuevo viático", exact: true })
      .waitFor();
    await revisar();
    assert.equal(viaticos.length, 0);
    assert(
      await page
        .locator("#viatico-chofer")
        .evaluate((e) => e.validity.valueMissing),
    );
    await page.getByLabel("Fecha", { exact: false }).fill("2026-10-22");
    await page
      .getByLabel("Chofer (obligatorio)", { exact: true })
      .selectOption("1");
    await page
      .getByLabel("Tipo de reparto (obligatorio)", { exact: true })
      .selectOption("LARGA_DISTANCIA");
    await page
      .getByLabel("Valor de cada viático", { exact: false })
      .fill("12200.55");
    await page.getByLabel("Cantidad de viáticos", { exact: false }).fill("2");
    await page
      .getByLabel("Observaciones / Ruta", { exact: false })
      .fill("Ruta 9");
    assert.match(await page.locator(".nr-info").innerText(), /24\.401,10/);
    await foto("nuevo-viatico-claro");
    await responsive();
    await revisar();
    assert.equal(viaticos.length, 0);
    await page.getByRole("button", { name: "Volver a corregir" }).click();
    assert.equal(
      await page
        .getByLabel("Valor de cada viático", { exact: false })
        .inputValue(),
      "12200.55",
    );
    await revisar();
    await page
      .getByRole("button", { name: "Confirmar y guardar viático" })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Los datos siguen en pantalla" })
      .waitFor();
    assert.match(await page.locator(".nr-summary").innerText(), /Ruta 9/);
    fallar = false;
    await page
      .getByRole("button", { name: "Confirmar y guardar viático" })
      .click();
    await page
      .getByRole("heading", { name: "Carga guardada", exact: true })
      .waitFor();
    assert.deepEqual(viaticos[1], {
      chofer: 1,
      fecha: "2026-10-22",
      tipo_reparto: "LARGA_DISTANCIA",
      valor_viatico: 12200.55,
      cantidad_viaticos: 2,
      observaciones: "Ruta 9",
    });
    assert.match(await page.locator(".nr-success").innerText(), /24\.401,10/);
    await page.getByRole("button", { name: "Cargar otro viático" }).click();
    assert.equal(
      await page
        .getByLabel("Cantidad de viáticos", { exact: false })
        .inputValue(),
      "1",
    );
    assert.equal(
      await page
        .getByLabel("Valor de cada viático", { exact: false })
        .inputValue(),
      "",
    );
    await page.getByRole("button", { name: "Activar tema oscuro" }).click();
    await foto("nuevo-viatico-oscuro");

    await page.goto(app + "/kilometrajes/nuevo");
    await page
      .getByRole("heading", {
        name: "Nuevo control de kilometraje",
        exact: true,
      })
      .waitFor();
    await revisar();
    assert.equal(controles.length, 0);
    await page
      .getByLabel("Chofer (obligatorio)", { exact: true })
      .selectOption("1");
    await page.getByLabel("Desde", { exact: false }).fill("2026-10-22");
    await page.getByLabel("Hasta", { exact: false }).fill("2026-10-21");
    await page
      .getByRole("alert")
      .filter({ hasText: "Hasta no puede" })
      .waitFor();
    await page.getByLabel("Hasta", { exact: false }).fill("2026-10-23");
    await page
      .getByLabel("Viajes a Centro el 22/10/2026", { exact: true })
      .fill("2");
    await page
      .getByRole("button", { name: "Día siguiente →", exact: true })
      .click();
    await page
      .getByLabel("Viajes a Norte el 23/10/2026", { exact: true })
      .fill("3");
    assert.match(
      await page
        .locator(".nr-info")
        .allTextContents()
        .then((x) => x.join(" ")),
      /Total del período: 351 km/,
    );
    await page
      .getByRole("button", { name: "← Día anterior", exact: true })
      .click();
    assert.equal(
      await page
        .getByLabel("Viajes a Centro el 22/10/2026", { exact: true })
        .inputValue(),
      "2",
    );
    await page
      .getByLabel("Viajes a Centro el 22/10/2026", { exact: true })
      .fill("0.5");
    await page
      .getByRole("button", { name: "Día siguiente →", exact: true })
      .click();
    await revisar();
    await page
      .getByRole("alert")
      .filter({ hasText: "número entero" })
      .waitFor();
    await page
      .getByRole("button", { name: "← Día anterior", exact: true })
      .click();
    await page
      .getByLabel("Viajes a Centro el 22/10/2026", { exact: true })
      .fill("2");
    await page.getByLabel("Hasta", { exact: false }).fill("2026-10-22");
    await revisar();
    assert.equal(controles.length, 0);
    await page
      .getByLabel("Entiendo que los viajes fuera del período no se guardarán", {
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Confirmar y guardar control", exact: true })
      .click();
    assert.equal(controles.length, 0);
    await page
      .getByRole("button", { name: "Volver a corregir", exact: true })
      .click();
    await page.getByLabel("Hasta", { exact: false }).fill("2026-10-23");
    await page
      .getByLabel("Observaciones", { exact: false })
      .fill("Control mensual");
    await foto("nuevo-kilometraje-oscuro");
    await responsive();
    await page.getByRole("button", { name: "Activar tema claro" }).click();
    await foto("nuevo-kilometraje-claro");
    await revisar();
    assert.equal(controles.length, 0);
    assert.equal(await page.locator(".nr-km-review-table tbody tr").count(), 2);
    assert.match(await page.locator(".nr-summary").innerText(), /351 km/);
    fallar = true;
    await page
      .getByRole("button", { name: "Confirmar y guardar control", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Los datos siguen en pantalla" })
      .waitFor();
    fallar = false;
    await page
      .getByRole("button", { name: "Confirmar y guardar control", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Carga guardada", exact: true })
      .waitFor();
    assert.deepEqual(controles[1], {
      chofer: 1,
      fecha_desde: "2026-10-22",
      fecha_hasta: "2026-10-23",
      observaciones: "Control mensual",
      registros: [
        {
          fecha: "2026-10-22",
          destino: 10,
          cantidad_viajes: 2,
          observaciones: "",
        },
        {
          fecha: "2026-10-23",
          destino: 11,
          cantidad_viajes: 3,
          observaciones: "",
        },
      ],
    });
    await page.getByRole("button", { name: "Cargar otro control" }).click();
    assert.equal(
      await page.getByLabel("Desde", { exact: false }).inputValue(),
      "",
    );
    fallarListas = true;
    await page.reload();
    await page
      .getByRole("alert")
      .filter({ hasText: "No se pudieron cargar las listas" })
      .waitFor({ timeout: 15000 });
    assert(
      await page.getByRole("button", { name: /Revisar la carga/ }).isDisabled(),
    );
    fallarListas = false;
    await page
      .getByRole("button", { name: "Volver a intentar", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector("#km-chofer").closest("fieldset").disabled,
    );
    assert.deepEqual(errors, []);
    console.log(
      "OK: viáticos y kilometrajes, revisión sin envío, cálculos/payloads originales, corrección, errores sin perder datos, viajes por día, fracciones inválidas ocultas, cambios de período con confirmación, claro/oscuro/móvil/tablet y recuperación de listas. Sin BD.",
    );
  } catch (e) {
    await foto("viaticos-kilometrajes-fallo");
    console.error((await page.locator("body").innerText()).slice(-3500));
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
