// Exclusivamente expedicion.smoke_server (SQLite efímero) en 8765 y Vite en 5175.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
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
  await page.routeWebSocket("**", () => {});
  await page.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  const app = "http://127.0.0.1:5175";
  const out = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(out, { recursive: true });
  try {
    await page.goto(app + "/login");
    await page.getByLabel("Usuario", { exact: true }).fill("smoke");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("Smoke-local-123!");
    await page.getByRole("button", { name: "Ingresar al sistema" }).click();
    await page.waitForURL("**/panel");
    const api = (ruta, body) =>
      page.evaluate(
        async ({ ruta, body }) => {
          const csrf = document.cookie
            .split(";")
            .map((s) => s.trim())
            .find((s) => s.startsWith("csrftoken="))
            ?.slice(10);
          const r = await fetch(
            "http://127.0.0.1:8765/api/expedicion/" + ruta,
            {
              method: body ? "POST" : "GET",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": decodeURIComponent(csrf || ""),
              },
              body: body ? JSON.stringify(body) : undefined,
            },
          );
          const data = await r.json();
          if (!r.ok) throw new Error(JSON.stringify(data));
          return data;
        },
        { ruta, body },
      );
    const post = (body) =>
      api("operativa/", {
        fecha: new Date().toLocaleDateString("sv-SE"),
        turno: "Mañana",
        clave: randomUUID(),
        ...body,
      });
    let data = await api("operativa/");
    const p = data.productos.find((p) => p.codigo === "5670");
    const lineas = [{ producto: p.id, packs: 1, unidades: 0 }];
    await post({
      accion: "empleado",
      legajo: "SMOKE-NOVEDADES",
      nombre: "Empleado resumen",
      apellido: "Prueba",
      activo: true,
    });
    data = await api("operativa/");
    const empleado = data.empleados.find((e) => e.legajo === "SMOKE-NOVEDADES");
    await post({
      accion: "consumo",
      tipo: "ANTICIPO",
      empleado: empleado.id,
      lineas,
    });
    await post({
      accion: "movimiento",
      tipo: "BUFFET",
      referencia: "Buffet prueba",
      lineas,
    });
    await post({
      accion: "movimiento",
      tipo: "PRODUCCION",
      referencia: "Producción local",
      lineas,
    });
    await post({
      accion: "movimiento",
      tipo: "PRODUCCION",
      referencia: "Producción Mendoza",
      lineas,
    });
    await page.goto(app + "/expedicion/movimientos");
    const resumen = page.locator(".eo-consumption-summary");
    await resumen.locator("summary").click();
    await resumen.getByText("Total egresado", { exact: true }).waitFor();
    assert.match(await resumen.innerText(), /2 fardos/);
    assert.match(await resumen.innerText(), /Empleado resumen/);
    await resumen
      .getByLabel("Tipo de consumo")
      .selectOption("ANTICIPO_EMPLEADO");
    assert.match(await resumen.innerText(), /1 fardos/);
    assert(
      !(await resumen.locator("tbody").allTextContents())
        .join(" ")
        .includes("Buffet prueba"),
    );
    await page
      .getByRole("group", { name: "Filtros de movimientos" })
      .getByLabel("Tipo", { exact: true })
      .selectOption("Producción Mendoza");
    assert.match(
      await page.locator(".eo-movements-table tfoot").innerText(),
      /TOTAL \(1 operaciones\)/,
    );
    await page.evaluate(() => {
      window.print = () => {
        window.__printed = true;
      };
    });
    await resumen
      .getByRole("button", { name: "Imprimir resumen de consumos" })
      .click();
    await page.waitForFunction(() => window.__printed);
    await page.emulateMedia({ media: "print" });
    await page.screenshot({
      path: path.join(out, "consumos-reporte.png"),
      fullPage: true,
    });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await page.emulateMedia({ media: "screen" });
    await page.goto(app + "/expedicion/stock");
    const diag = page.locator(".eo-diagnostic");
    await diag.locator("summary").click();
    await diag.getByRole("button", { name: "Actualizar diagnóstico" }).click();
    await diag.getByText(/Sin base verificada válida/).waitFor();
    await diag
      .getByRole("button", { name: "Establecer base verificada" })
      .click();
    await diag.getByLabel(/Contrasté los saldos/).check();
    await diag
      .getByLabel("Motivo obligatorio")
      .fill("Stock físico verificado en SQLite de prueba");
    await diag.getByLabel("Escribí CONCILIAR").fill("CONCILIAR");
    await diag
      .getByRole("button", { name: "Confirmar conciliación", exact: true })
      .click();
    await diag.getByText(/Conciliación registrada/).waitFor();
    await diag.getByText(/Base verificada:/).waitFor();
    await page
      .getByRole("button", { name: "Activar tema oscuro", exact: true })
      .click();
    await page.screenshot({
      path: path.join(out, "conciliacion-oscuro.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
    const scroll = await diag
      .locator(".eo-table")
      .first()
      .evaluate((e) => ({ total: e.scrollWidth, ancho: e.clientWidth }));
    assert(scroll.total > scroll.ancho);
    await page.screenshot({
      path: path.join(out, "conciliacion-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto(app + "/expedicion/configuracion");
    await page
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .click();
    const backup = await api("respaldos/");
    const fila = structuredClone(
      backup.registros.find((r) => r.model === "expedicion.fletero"),
    );
    fila.pk = 9999;
    fila.fields.nombre = "Recuperado de respaldo";
    backup.registros.push(fila);
    const fusion = page.locator(".eo-backup-merge");
    await fusion
      .getByLabel("Seleccionar respaldo para fusionar")
      .setInputFiles({
        name: "respaldo-prueba.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(backup)),
      });
    await fusion.getByText("1 registros nuevos · 0 conflictos.").waitFor();
    await fusion.getByLabel("Escribí FUSIONAR").fill("FUSIONAR");
    await fusion.getByRole("button", { name: "Confirmar fusión" }).click();
    await fusion.getByText(/Fusión completada/).waitFor();
    assert((await api("operativa/")).fleteros.some((f) => f.id === 9999));
    const conflicto = await api("respaldos/");
    conflicto.registros.find(
      (r) => r.model === "expedicion.stockproducto",
    ).fields.cantidad_unidades = "999.00";
    await fusion
      .getByLabel("Seleccionar respaldo para fusionar")
      .setInputFiles({
        name: "conflicto.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(conflicto)),
      });
    await fusion.getByText(/No se puede fusionar/).waitFor();
    assert.equal(
      await fusion.getByRole("button", { name: "Confirmar fusión" }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "OK: consumos sin duplicar, filtros, impresión, totales Mendoza, diagnóstico, base, tema oscuro, móvil, fusión aditiva y bloqueo de conflictos. Solo SQLite efímero.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
