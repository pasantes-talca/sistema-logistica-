// APIs simuladas exclusivamente en 8771. No se accede a ninguna base de datos.
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
  const rechazos = [],
    recibos = [];
  let fallarGuardado = true,
    creado = true,
    fallarListas = false;
  const productos = [
    {
      id: 10,
      codigo: "5670",
      nombre: "Cola 3 L",
      familia: "GASEOSAS",
      activo: true,
    },
    {
      id: 11,
      codigo: "4900",
      nombre: "Soda 2 L",
      familia: "SODA",
      activo: true,
    },
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
    const url = new URL(r.request().url()),
      p = url.pathname;
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
    if (p.startsWith("/api/maestros/") && fallarListas)
      return responder({ detail: "Error de conexión de prueba" }, 503);
    if (p === "/api/maestros/asignaciones/")
      return responder([
        { id: 9, codigo: "R-10", descripcion: "Zona centro", activo: true },
      ]);
    if (p === "/api/maestros/motivos-rechazo/")
      return responder([{ id: 4, nombre: "Local cerrado", activo: true }]);
    if (p === "/api/maestros/concesionarios/")
      return responder([
        { id: 7, nombre: "Concesionario Prueba", activo: true },
      ]);
    if (p === "/api/maestros/productos/") return responder(productos);
    if (p === "/api/maestros/motivos-cambio/")
      return responder(
        url.searchParams.get("familia") === "SODA"
          ? [{ id: 22, nombre: "Pérdida soda", activo: true }]
          : [{ id: 21, nombre: "Envase dañado", activo: true }],
      );
    if (p === "/api/rechazos/" && r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      rechazos.push(body);
      if (fallarGuardado)
        return responder({ detail: "Error de guardado de prueba" }, 400);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return responder({ id: 31, ...body, motivo_nombre: "Local cerrado" });
    }
    if (p === "/api/cambios/recibos/" && r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      recibos.push(body);
      if (fallarGuardado)
        return responder({ detail: "Error de guardado de prueba" }, 400);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return responder({
        creado,
        recibo: {
          id: 41,
          ...body,
          concesionario_nombre: "Concesionario Prueba",
          pallets: creado ? String(body.pallets) : "8.00",
          pallets_descargados: String(body.pallets_descargados),
          prensados: String(body.prensados),
          detalles: body.detalles.map((d, i) => ({
            id: i + 1,
            ...d,
            cantidad: String(d.cantidad),
            producto_codigo: productos.find((p) => p.id === d.producto_id)
              .codigo,
            producto_nombre: productos.find((p) => p.id === d.producto_id)
              .nombre,
            motivo_nombre: d.motivo_id === 22 ? "Pérdida soda" : null,
          })),
        },
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
    await page.waitForTimeout(150);
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
    await page.goto(app + "/rechazos/nuevo");
    await page
      .getByRole("heading", { name: "Nuevo rechazo", exact: true })
      .waitFor();
    await revisar();
    assert.equal(rechazos.length, 0);
    assert(
      await page
        .locator("#rechazo-asignacion")
        .evaluate((e) => e.required && e.validity.valueMissing),
    );
    await page.getByLabel("Fecha", { exact: false }).fill("2026-10-22");
    await page
      .getByLabel("Asignación (obligatorio)", { exact: true })
      .selectOption("9");
    await page.getByLabel("Punto de venta", { exact: false }).fill("Vea 34");
    await page.getByLabel("Bultos", { exact: false }).fill("54 + 2");
    await page
      .getByLabel("Motivo de no entrega (obligatorio)", { exact: true })
      .selectOption("4");
    await page
      .getByText("Agregar una observación (opcional)", { exact: true })
      .click();
    await page.getByLabel("Observación", { exact: true }).fill("Volver mañana");
    await foto("nuevo-rechazo-claro");
    await revisar();
    assert.equal(rechazos.length, 0);
    assert.match(
      await page.locator(".nr-summary").innerText(),
      /Local cerrado/,
    );
    await page.getByRole("button", { name: "Volver a corregir" }).click();
    assert.equal(
      await page.getByLabel("Bultos", { exact: false }).inputValue(),
      "54 + 2",
    );
    await revisar();
    await page
      .getByRole("button", { name: "Confirmar y guardar rechazo" })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Los datos siguen en pantalla" })
      .waitFor();
    assert.match(await page.locator(".nr-summary").innerText(), /Vea 34/);
    fallarGuardado = false;
    await page
      .getByRole("button", { name: "Confirmar y guardar rechazo" })
      .click();
    await page
      .getByRole("heading", { name: "Carga guardada", exact: true })
      .waitFor();
    assert.deepEqual(rechazos[1], {
      fecha: "2026-10-22",
      asignacion_id: 9,
      punto_venta: "Vea 34",
      bultos: "54 + 2",
      motivo_id: 4,
      observacion: "Volver mañana",
    });
    await page.getByRole("button", { name: "Cargar otro rechazo" }).click();
    assert.equal(
      await page.getByLabel("Punto de venta", { exact: false }).inputValue(),
      "",
    );
    await page.getByRole("button", { name: "Activar tema oscuro" }).click();
    await foto("nuevo-rechazo-oscuro");
    await responsive();

    await page.goto(app + "/cambios/nuevo");
    await page
      .getByRole("heading", { name: "Nuevo recibo de cambios", exact: true })
      .waitFor();
    await revisar();
    assert.equal(recibos.length, 0);
    await page.getByLabel("Fecha", { exact: false }).fill("2026-10-22");
    await page
      .getByLabel("Concesionario (obligatorio)", { exact: true })
      .selectOption("7");
    await page
      .getByRole("combobox", { name: "Producto 1", exact: true })
      .selectOption("10");
    await page
      .getByLabel("Cantidad del producto 1", { exact: true })
      .fill("2.5");
    await page
      .getByLabel("Motivo del producto 1", { exact: true })
      .selectOption("21");
    await page
      .getByRole("combobox", { name: "Producto 1", exact: true })
      .selectOption("11");
    assert.equal(
      await page
        .getByLabel("Motivo del producto 1", { exact: true })
        .inputValue(),
      "",
    );
    await page
      .getByLabel("Motivo del producto 1", { exact: true })
      .selectOption("22");
    await page
      .getByLabel("Observación del producto 1", { exact: true })
      .fill("Botellas con pérdida");
    await page
      .getByRole("button", { name: "+ Agregar otro producto", exact: true })
      .click();
    await page.getByLabel("Cantidad del producto 2", { exact: true }).fill("3");
    await revisar();
    assert.equal(recibos.length, 0);
    assert(
      await page
        .getByRole("combobox", { name: "Producto 2", exact: true })
        .evaluate((e) => e.validity.valueMissing),
    );
    await page
      .getByRole("combobox", { name: "Producto 2", exact: true })
      .selectOption("10");
    await page
      .getByRole("button", { name: "+ Agregar otro producto", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Quitar producto 3", exact: true })
      .click();
    await page.getByLabel("Pallets (opcional)", { exact: true }).fill("2");
    await page
      .getByText("Agregar observación de pallets (opcional)", { exact: true })
      .click();
    await page
      .getByLabel("Observación de pallets", { exact: true })
      .fill("Retorno");
    await page
      .getByLabel("Pallets descargados (opcional)", { exact: true })
      .fill("1");
    await page.getByRole("button", { name: "Activar tema claro" }).click();
    await foto("nuevo-recibo-claro");
    await responsive();
    await revisar();
    assert.equal(recibos.length, 0);
    assert.match(
      await page.locator(".nr-review").innerText(),
      /esta carga se suma/,
    );
    assert.match(await page.locator(".nr-review").innerText(), /Pérdida soda/);
    await page.getByRole("button", { name: "Volver a corregir" }).click();
    assert.equal(
      await page
        .getByLabel("Cantidad del producto 1", { exact: true })
        .inputValue(),
      "2.5",
    );
    await revisar();
    fallarGuardado = true;
    await page
      .getByRole("button", { name: "Confirmar y guardar recibo" })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Los datos siguen en pantalla" })
      .waitFor();
    fallarGuardado = false;
    await page
      .getByRole("button", { name: "Confirmar y guardar recibo" })
      .click();
    await page
      .getByRole("heading", { name: "Carga guardada", exact: true })
      .waitFor();
    assert.deepEqual(recibos[1], {
      fecha: "2026-10-22",
      concesionario_id: 7,
      pallets: 2,
      pallets_observacion: "Retorno",
      pallets_descargados: 1,
      pallets_descargados_observacion: "",
      prensados: 0,
      prensados_observacion: "",
      detalles: [
        {
          producto_id: 11,
          cantidad: 2.5,
          motivo_id: 22,
          observacion: "Botellas con pérdida",
        },
        { producto_id: 10, cantidad: 3, motivo_id: null, observacion: "" },
      ],
    });
    assert.match(
      await page.locator(".nr-success").innerText(),
      /se creó el recibo/,
    );
    await page.getByRole("button", { name: "Cargar otro recibo" }).click();
    assert.equal(
      await page
        .getByLabel("Concesionario (obligatorio)", { exact: true })
        .inputValue(),
      "7",
    );
    assert.equal(
      await page
        .getByLabel("Cantidad del producto 1", { exact: true })
        .inputValue(),
      "",
    );
    creado = false;
    await page.getByLabel("Pallets (opcional)", { exact: true }).fill("1");
    await revisar();
    await page
      .getByRole("button", { name: "Confirmar y guardar recibo" })
      .click();
    await page
      .getByRole("heading", { name: "Carga guardada", exact: true })
      .waitFor();
    assert.equal(recibos.at(-1).detalles.length, 0);
    assert.match(
      await page.locator(".nr-success").innerText(),
      /carga se agregó al recibo existente/,
    );
    assert.match(await page.locator(".nr-summary").innerText(), /8.00/);
    await page.getByRole("button", { name: "Cargar otro recibo" }).click();
    await page.getByRole("button", { name: "Activar tema oscuro" }).click();
    await foto("nuevo-recibo-oscuro");
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
      () =>
        !document.querySelector("#recibo-concesionario").closest("fieldset")
          .disabled,
    );
    assert.deepEqual(errors, []);
    console.log(
      "OK: rechazo y recibo, obligatorios, revisión sin envío, corrección, errores sin perder datos, payloads originales, motivos por familia, filas incompletas, solo pallets, acumulación, claro/oscuro/móvil/tablet y recuperación de listas. Sin BD.",
    );
  } catch (e) {
    await foto("rechazo-recibo-fallo");
    console.error((await page.locator("body").innerText()).slice(-2500));
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
