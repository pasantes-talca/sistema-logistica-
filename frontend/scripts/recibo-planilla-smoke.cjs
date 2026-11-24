// Vite 5181, API exclusivamente simulada 8771. No BD ni correo real.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1050 },
      }),
      errores = [],
      posts = [];
    page.on("pageerror", (e) => errores.push(e.message));
    const codigos = [
      "5051",
      "5056",
      "5066",
      "5071",
      "5200",
      "5205",
      "5215",
      "5220",
      "5670",
      "5675",
      "5685",
      "5690",
      "4900",
      "4910",
      "417",
      "8690",
      "8670",
    ];
    // El código 417 no existe en este catálogo simulado: no se inventa ni se envía.
    const productos = codigos
      .filter((c) => c !== "417")
      .map((codigo, i) => ({
        id: 100 + i,
        codigo,
        nombre: "Producto " + codigo,
        familia: "GASEOSAS",
        activo: true,
      }));
    productos.push({
      id: 999,
      codigo: "EXTRA",
      nombre: "Producto adicional",
      familia: "GASEOSAS",
      activo: true,
    });
    let fallar = true,
      creado = true;
    await page.routeWebSocket("**", () => {});
    await page.route("https://fonts.googleapis.com/**", (r) =>
      r.fulfill({ body: "", contentType: "text/css" }),
    );
    await page.route("http://127.0.0.1:8771/api/**", (r) => {
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5181",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,X-CSRFToken",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      };
      const p = new URL(r.request().url()).pathname;
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ headers, status: 204 });
      if (r.request().method() === "POST") {
        assert.equal(p, "/api/cambios/recibos/");
        const d = r.request().postDataJSON();
        posts.push(d);
        if (fallar)
          return r.fulfill({
            headers,
            status: 400,
            json: { error: "Fallo de prueba" },
          });
        return r.fulfill({
          headers,
          json: {
            creado,
            recibo: {
              ...d,
              id: 1,
              concesionario_nombre: "Distribuidor prueba",
              pallets: creado ? d.pallets : 8,
              detalles: d.detalles.map((f, i) => ({
                ...f,
                id: i + 1,
                producto_codigo: productos.find((p) => p.id === f.producto_id)
                  .codigo,
                producto_nombre: "Producto",
                motivo_nombre: f.motivo_id ? "Envase roto" : null,
              })),
            },
          },
        });
      }
      const json =
        p === "/api/auth/usuario/"
          ? {
              id: 1,
              username: "prueba",
              puede_administrar: false,
              es_administrador: false,
              grupos: ["CAMBIOS"],
            }
          : p === "/api/maestros/productos/"
            ? productos
            : p === "/api/maestros/concesionarios/"
              ? [{ id: 7, nombre: "Distribuidor prueba", activo: true }]
              : p === "/api/maestros/motivos-cambio/"
                ? [{ id: 21, nombre: "Envase roto", activo: true }]
                : [];
      return r.fulfill({ headers, json });
    });
    const out = path.join(__dirname, "..", "test-artifacts");
    fs.mkdirSync(out, { recursive: true });
    await page.goto("http://127.0.0.1:5181/cambios/nuevo");
    const revisar = () =>
      page
        .getByRole("button", { name: "Revisar la carga", exact: false })
        .click();
    await page
      .getByRole("heading", { name: "NOTA DE PEDIDO", exact: true })
      .waitFor();
    await page.getByLabel("Concesionario *", { exact: true }).selectOption("7");
    await page.getByLabel("Fecha *", { exact: true }).fill("2026-11-24");
    await page.getByLabel("Cantidad 5670 COLA", { exact: true }).fill("12.5");
    await page
      .getByLabel("Observación 5670 COLA", { exact: true })
      .fill("Envases dañados");
    await page
      .getByText("Clasificar motivos de cambio (opcional)", { exact: true })
      .click();
    await page
      .getByLabel("Motivo 5670 COLA", { exact: true })
      .selectOption("21");
    await page.getByLabel("Cantidad 4900 SODA", { exact: true }).fill("2");
    await page.getByLabel("Pallets", { exact: true }).fill("3");
    await page
      .getByLabel("Observación de pallets", { exact: true })
      .fill("Recibidos");
    assert.equal(
      await page.getByLabel("Cantidad 417 SODA", { exact: true }).isDisabled(),
      true,
    );
    // Limpiar una fila evita enviar cantidades vacías como cero.
    await page.getByLabel("Cantidad 5051 COLA", { exact: true }).fill("1");
    await page.getByLabel("Cantidad 5051 COLA", { exact: true }).fill("");
    assert.equal(await page.locator('.rc-tamano[rowspan="4"]').count(), 3);
    assert.equal(await page.locator(".rc-gap").count(), 5);
    assert.equal(
      await page
        .locator(".rc-cantidad")
        .first()
        .evaluate((e) => getComputedStyle(e).backgroundColor),
      "rgb(255, 242, 204)",
    );
    await page
      .locator(".rc-recibo")
      .screenshot({
        path: path.join(out, "recibo-formato-impreso.png"),
        style: ".app-header { visibility: hidden !important; }",
      });
    await page
      .getByRole("button", {
        name: "+ Agregar otro producto del catálogo",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Otro producto 1", { exact: true })
      .selectOption("999");
    await page
      .getByLabel("Cantidad otro producto 1", { exact: true })
      .fill("4");
    await page.screenshot({
      path: path.join(out, "recibo-planilla-claro.png"),
      fullPage: true,
    });
    await revisar();
    assert.equal(posts.length, 0);
    await page
      .getByRole("heading", { name: "Revisá antes de guardar", exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".rc-recibo input,.rc-recibo select").count(),
      0,
    );
    await page
      .getByRole("button", { name: "Volver a corregir", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Cantidad 5670 COLA", { exact: true }).inputValue(),
      "12.5",
    );
    for (const width of [390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.ok(
        await page
          .locator(".rc-tabla-scroll")
          .evaluate((e) => e.scrollWidth > e.clientWidth),
      );
      await page
        .locator(".rc-tabla-scroll")
        .evaluate((e) => (e.scrollLeft = 10000));
      assert.ok(
        await page
          .locator(".rc-tabla-scroll")
          .evaluate((e) => e.scrollLeft > 0),
      );
    }
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    await page.screenshot({
      path: path.join(out, "recibo-planilla-movil-oscuro.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await revisar();
    await page
      .getByRole("button", { name: "Confirmar y guardar recibo", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Los datos siguen en pantalla" })
      .waitFor();
    assert.equal(posts.length, 1);
    assert.deepEqual(posts[0], {
      fecha: "2026-11-24",
      concesionario_id: 7,
      pallets: 3,
      pallets_observacion: "Recibidos",
      pallets_descargados: 0,
      pallets_descargados_observacion: "",
      prensados: 0,
      prensados_observacion: "",
      detalles: [
        {
          producto_id: productos.find((p) => p.codigo === "5670").id,
          cantidad: 12.5,
          motivo_id: 21,
          observacion: "Envases dañados",
        },
        {
          producto_id: productos.find((p) => p.codigo === "4900").id,
          cantidad: 2,
          motivo_id: null,
          observacion: "",
        },
        { producto_id: 999, cantidad: 4, motivo_id: null, observacion: "" },
      ],
    });
    fallar = false;
    await page
      .getByRole("button", { name: "Confirmar y guardar recibo", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Carga guardada", exact: true })
      .waitFor();
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[1], posts[0]);
    await page
      .getByRole("button", { name: "Cargar otro recibo", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Cantidad 5670 COLA", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await page.getByLabel("Pallets", { exact: true }).inputValue(),
      "",
    );
    // Se conserva la carga solo de materiales y el aviso de acumulación existente.
    creado = false;
    await page.getByLabel("Pallets", { exact: true }).fill("5");
    await revisar();
    await page.getByText(/esta carga se suma al recibo existente/).waitFor();
    await page
      .getByRole("button", { name: "Confirmar y guardar recibo", exact: true })
      .click();
    await page
      .getByRole("heading", { name: /Listo, la carga se agregó/ })
      .waitFor();
    assert.deepEqual(posts[2].detalles, []);
    assert.deepEqual(errores, []);
    console.log(
      "OK: recibo editable, filas por código, vacíos omitidos, decimales, motivos, extras, materiales, revisión sin POST, error conserva datos, guardado/reset/acumulación y móvil/oscuro. Sin BD ni correos reales.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
