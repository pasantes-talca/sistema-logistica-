// Revisión visual global con APIs simuladas. Nunca accede a la BD ni autentica usuarios reales.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_BROWSER,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    const errors = [],
      mutaciones = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.routeWebSocket("**", () => {});
    await page.route("https://fonts.googleapis.com/**", (r) =>
      r.fulfill({ contentType: "text/css", body: "" }),
    );
    await page.route("http://127.0.0.1:8771/api/**", (r) => {
      const p = new URL(r.request().url()).pathname;
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5181",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,X-CSRFToken",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      };
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ headers, status: 204 });
      if (r.request().method() !== "GET") {
        mutaciones.push(p);
        return r.fulfill({
          headers,
          status: 400,
          json: { error: "No se realizan escrituras en esta prueba" },
        });
      }
      let json = [];
      if (p === "/api/auth/usuario/")
        json = {
          autenticado: true,
          id: 1,
          username: "prueba",
          first_name: "Ariel",
          last_name: "Prueba",
          nombre_completo: "Ariel Prueba",
          es_administrador: true,
          puede_administrar: true,
          grupos: ["ADMINISTRADOR"],
        };
      if (p === "/api/administracion/usuarios/")
        json = { usuarios: [], modulos: [] };
      if (p === "/api/maestros/choferes/")
        json = [
          { id: 1, nombre: "Chofer de prueba", activo: true, disponible: true },
        ];
      if (p === "/api/kilometrajes/destinos/")
        json = [
          {
            id: 1,
            nombre: "Sharp / Mai-Gua",
            distancia_km: "5.00",
            activo: true,
          },
        ];
      if (p === "/api/expedicion/operativa/")
        json = {
          productos: [],
          ordenes: [],
          fleteros: [],
          empleados: [],
          movimientos: [],
          materiales: [],
          comprobantes: [],
          conteos: [],
          auditoria: [],
          usuarios: [],
          circuitos: [],
        };
      return r.fulfill({ headers, json });
    });
    const out = path.join(__dirname, "..", "test-artifacts");
    fs.mkdirSync(out, { recursive: true });
    await page.goto("http://127.0.0.1:5181/login");
    const rutas = [
      "/panel",
      "/repartos/nuevo",
      "/rechazos/nuevo",
      "/cambios/nuevo",
      "/viaticos/nuevo",
      "/kilometrajes/nuevo",
      "/expedicion/ordenes",
      "/administracion/usuarios",
      "/login",
    ];
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate(
          (t) =>
            localStorage.setItem(
              "talca-tema",
              t === "dark" ? "oscuro" : "claro",
            ),
          theme,
        );
        for (const ruta of rutas) {
          await page.goto("http://127.0.0.1:5181" + ruta);
          await page.waitForTimeout(200);
          assert.equal(
            await page.evaluate(() => document.documentElement.dataset.theme),
            theme,
            "Tema persistido al navegar",
          );
          await page
            .locator("h1:visible,h2:visible")
            .first()
            .waitFor({ timeout: 5000 })
            .catch(async (e) => {
              console.error(
                ruta,
                errors,
                await page.locator("body").innerText(),
              );
              throw e;
            });
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            true,
            `Desborde ${width} ${theme} ${ruta}`,
          );
          if (
            [
              "/panel",
              "/login",
              "/repartos/nuevo",
              "/expedicion/ordenes",
            ].includes(ruta) &&
            width !== 768
          )
            await page.screenshot({
              path: path.join(
                out,
                `identidad-${ruta.replaceAll("/", "-").slice(1)}-${width}-${theme}.png`,
              ),
            });
        }
      }
    }
    await page.goto("http://127.0.0.1:5181/repartos/nuevo");
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    const modulo = page.getByRole("button", {
      name: "Repartos y recargas",
      exact: true,
    });
    await modulo.click();
    assert.equal(await modulo.getAttribute("aria-expanded"), "false");
    await modulo.click();
    assert.equal(await modulo.getAttribute("aria-expanded"), "true");
    const anterior = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    await page.locator(".sidebar-close").click();
    await page.locator(".app-header .theme-toggle").click();
    assert.notEqual(
      await page.evaluate(() => document.documentElement.dataset.theme),
      anterior,
    );
    assert.deepEqual(mutaciones, []);
    assert.deepEqual(errors, []);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await modulo.evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    console.log(
      "OK: 9 pantallas x 3 tamaños x claro/oscuro, navegación desplegable y movimiento reducido. Sin escrituras, errores JS ni desbordamientos.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
