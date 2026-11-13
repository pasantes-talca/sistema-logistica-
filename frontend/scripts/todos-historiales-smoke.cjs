// Solo APIs simuladas. No conecta con la BD ni envía correos.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  try {
    const page = await browser.newPage(),
      errores = [],
      comandos = [];
    let admin = true;
    page.on("pageerror", (e) => errores.push(e.message));
    const sello = "2026-10-27T12:00:00Z";
    const base = { id: 1, fecha: "2026-10-27", actualizado_en: sello };
    const datos = {
      "/api/repartos/": [
        { ...base, personal: [], bultos: 2, recargas: 1, recargas_totales: 1 },
      ],
      "/api/rechazos/": [
        {
          ...base,
          punto_venta: "Prueba",
          bultos: "2",
          motivo_nombre: "Prueba",
        },
      ],
      "/api/cambios/recibos/": [
        {
          ...base,
          concesionario_nombre: "Prueba",
          detalles: [],
          pallets: 0,
          pallets_descargados: 0,
          prensados: 0,
        },
      ],
      "/api/control-diario/": [{ ...base, movimientos: [] }],
    };
    const exp = {
      usuario: "Admin",
      admin: true,
      superusuario: false,
      productos: [],
      ordenes: [],
      fleteros: [{ id: 1, nombre: "Prueba", activo: true }],
      usuarios: [],
      empleados: [],
      comprobantes: [],
      auditoria: [],
      movimientos: [
        {
          id: 1,
          producto: 1,
          tipo: "BUFFET",
          direccion: "SALIDA",
          cantidad: 6,
          referencia: "Prueba",
          observaciones: "",
          operacion: "op-prueba",
          fecha: "2026-10-27",
          turno: "Mañana",
          usuario: "Admin",
          huella: "huella-prueba",
        },
      ],
      materiales: [
        {
          ...base,
          fletero: 1,
          referencia: "Prueba",
          origen: "Carga manual",
          pallets_salida: 2,
          pallets_entrada: 0,
          chapadur_salida: 0,
          chapadur_entrada: 0,
          huella: "material-prueba",
        },
      ],
      conteos: [
        {
          ...base,
          turno: "Mañana",
          tipo: "Cierre de turno",
          usuario: "Admin",
          lineas: [],
          huella: "conteo-prueba",
        },
      ],
    };
    await page.routeWebSocket("**", () => {});
    await page.route("https://fonts.googleapis.com/**", (r) =>
      r.fulfill({ body: "", contentType: "text/css" }),
    );
    await page.route("http://127.0.0.1:8771/api/**", (r) => {
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5181",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,X-CSRFToken",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      };
      const p = new URL(r.request().url()).pathname;
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ status: 204, headers });
      if (r.request().method() === "POST") {
        comandos.push(r.request().postDataJSON());
        // Simula éxito y marca solo ese registro, sin tocar otras operaciones.
        const d = comandos.at(-1),
          coleccion = {
            movimiento: "movimientos",
            material: "materiales",
            conteo: "conteos",
          }[d.tipo_registro];
        exp[coleccion][0].anulado = true;
        return r.fulfill({ headers, json: { registro_anulado: d.registro } });
      }
      assert.notEqual(
        r.request().method(),
        "DELETE",
        "La prueba de interfaz no elimina datos",
      );
      const json =
        p === "/api/auth/usuario/"
          ? {
              id: 1,
              username: admin ? "administrador" : "operador",
              puede_administrar: admin,
              es_administrador: admin,
              grupos: admin
                ? ["ADMINISTRADOR"]
                : [
                    "REPARTOS",
                    "RECHAZOS",
                    "CAMBIOS",
                    "CONTROL_DIARIO",
                    "EXPEDICION",
                  ],
            }
          : p === "/api/expedicion/operativa/"
            ? exp
            : datos[p] || [];
      return r.fulfill({ headers, json });
    });
    for (const ruta of [
      "/repartos",
      "/rechazos",
      "/cambios",
      "/control-diario",
    ]) {
      await page.goto("http://127.0.0.1:5181" + ruta);
      await page.getByRole("button", { name: /^Eliminar / }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    for (const ruta of ["movimientos", "materiales", "conteos"]) {
      await page.goto("http://127.0.0.1:5181/expedicion/" + ruta);
      page.once("dialog", (d) => d.dismiss());
      await page.getByRole("button", { name: /^Anular y revertir / }).click();
      const n = comandos.length;
      page.once("dialog", async (d) => {
        page.once("dialog", (d) => d.accept("Prueba de interfaz"));
        await d.accept();
      });
      await page.getByRole("button", { name: /^Anular y revertir / }).click();
      await page
        .getByText("Anulado", { exact: true })
        .first()
        .waitFor({ timeout: 8000 })
        .catch(async (e) => {
          console.error(ruta, comandos, await page.locator("body").innerText());
          throw e;
        });
      assert.equal(comandos.length, n + 1);
      assert.equal(comandos.at(-1).accion, "anular_registro");
      assert.equal(comandos.at(-1).confirmar, true);
    }
    admin = false;
    for (const ruta of [
      "/repartos",
      "/rechazos",
      "/cambios",
      "/control-diario",
      "/expedicion/materiales",
    ]) {
      await page.goto("http://127.0.0.1:5181" + ruta);
      await page.getByRole("button", { name: "Cerrar sesión" }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: /^(Eliminar |Anular y revertir )/ })
          .count(),
        0,
      );
    }
    assert.deepEqual(errores, []);
    console.log(
      "OK: 4 historiales logísticos, cancelación sin DELETE; 3 anulaciones de Expedición, confirmación/motivo y actualización; botones ocultos a operadores. Sin BD real.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
