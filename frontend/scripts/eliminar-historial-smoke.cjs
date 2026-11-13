// APIs simuladas: nunca borra registros en la BD real. Vite 5181 / API simulada 8771.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errores = [],
      borrados = [];
    page.on("pageerror", (e) => errores.push(e.message));
    let admin = true,
      fallar = true;
    const sello = "2026-10-26T12:00:00Z";
    let viaticos = [
      {
        id: 1,
        chofer: 1,
        chofer_nombre: "Chofer prueba",
        fecha: "2026-10-01",
        mes: "OCTUBRE",
        tipo_reparto: "LOCAL",
        tipo_reparto_nombre: "Local",
        valor_viatico: "100.00",
        cantidad_viaticos: 2,
        monto_total: "200.00",
        observaciones: "Prueba",
        actualizado_en: sello,
      },
    ];
    let kilometrajes = [
      {
        id: 2,
        chofer: 1,
        chofer_nombre: "Chofer prueba",
        fecha_desde: "2026-10-01",
        fecha_hasta: "2026-10-25",
        total_km: "30.00",
        registros: [{ id: 1 }],
        version: 3,
        estado: "BORRADOR",
        envio_estado: "PENDIENTE",
        actualizado_en: sello,
      },
    ];
    await page.routeWebSocket("**", () => {});
    await page.route("https://fonts.googleapis.com/**", (r) =>
      r.fulfill({ body: "", contentType: "text/css" }),
    );
    await page.route("http://127.0.0.1:8771/api/**", (r) => {
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:5181",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type,X-CSRFToken",
        "Access-Control-Allow-Methods": "GET,DELETE,OPTIONS",
      };
      const p = new URL(r.request().url()).pathname;
      if (r.request().method() === "OPTIONS")
        return r.fulfill({ status: 204, headers });
      if (r.request().method() === "DELETE") {
        const datos = r.request().postDataJSON();
        borrados.push({ p, datos });
        if (fallar)
          return r.fulfill({
            status: 409,
            headers,
            json: { error: "No se pudo eliminar: error de prueba." },
          });
        if (p.includes("viaticos")) viaticos = [];
        else kilometrajes = [];
        return r.fulfill({ status: 204, headers });
      }
      const json =
        p === "/api/auth/usuario/"
          ? {
              id: 1,
              username: admin ? "administrador" : "operador",
              nombre_completo: "Operador Prueba",
              es_administrador: admin,
              puede_administrar: admin,
              es_superusuario: false,
              grupos: admin ? ["ADMINISTRADOR"] : ["VIATICOS", "KILOMETRAJES"],
            }
          : p === "/api/viaticos/"
            ? viaticos
            : p === "/api/kilometrajes/"
              ? kilometrajes
              : [];
      return r.fulfill({ headers, json });
    });
    await page.goto("http://127.0.0.1:5181/viaticos");
    await page.getByRole("button", { name: /Eliminar viático de/ }).click();
    let dialogo = page.getByRole("dialog");
    await dialogo.waitFor();
    assert.equal(borrados.length, 0);
    assert.equal(
      await dialogo
        .getByRole("button", { name: "Eliminar definitivamente", exact: true })
        .isDisabled(),
      true,
    );
    await dialogo
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(borrados.length, 0);
    await page.getByRole("button", { name: /Eliminar viático de/ }).click();
    await dialogo.getByRole("textbox").fill("Carga de prueba");
    await dialogo.getByRole("checkbox").check();
    await dialogo
      .getByRole("button", { name: "Eliminar definitivamente", exact: true })
      .click();
    await dialogo.getByRole("alert").waitFor();
    assert.equal(viaticos.length, 1);
    assert.equal(
      await dialogo.getByRole("textbox").inputValue(),
      "Carga de prueba",
    );
    fallar = false;
    await dialogo
      .getByRole("button", { name: "Eliminar definitivamente", exact: true })
      .click();
    await page
      .getByText("Todavía no hay viáticos registrados.", { exact: true })
      .waitFor();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.deepEqual(borrados[1].datos, {
      confirmar: true,
      motivo: "Carga de prueba",
      actualizado_en: sello,
    });
    await page.goto("http://127.0.0.1:5181/kilometrajes");
    await page.getByRole("button", { name: /Eliminar planilla de/ }).click();
    dialogo = page.getByRole("dialog");
    await dialogo.getByRole("textbox").fill("Planilla de prueba");
    await dialogo.getByRole("checkbox").check();
    for (const width of [1440, 390])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          (t) => (document.documentElement.dataset.theme = t),
          theme,
        );
        assert.equal(
          await dialogo.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
          true,
          "Modal sin desbordamiento",
        );
        await dialogo.getByRole("textbox").focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.evaluate(() =>
            document.querySelector("dialog").contains(document.activeElement),
          ),
          true,
          "Foco dentro del modal",
        );
      }
    await dialogo
      .getByRole("button", { name: "Eliminar definitivamente", exact: true })
      .click();
    await page
      .getByText("Todavía no hay controles registrados", { exact: true })
      .waitFor();
    assert.equal(borrados.at(-1).datos.version, 3);
    admin = false;
    viaticos = [
      {
        id: 5,
        chofer_nombre: "Chofer prueba",
        fecha: "2026-10-01",
        mes: "OCTUBRE",
        tipo_reparto: "LOCAL",
        tipo_reparto_nombre: "Local",
        valor_viatico: "100",
        cantidad_viaticos: 1,
        monto_total: "100",
        actualizado_en: sello,
      },
    ];
    kilometrajes = [
      {
        id: 6,
        chofer_nombre: "Chofer prueba",
        fecha_desde: "2026-10-01",
        fecha_hasta: "2026-10-25",
        total_km: "30",
        registros: [],
        version: 1,
        actualizado_en: sello,
      },
    ];
    await page.goto("http://127.0.0.1:5181/viaticos");
    await page.getByText("Historial de viáticos", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Eliminar/ }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("columnheader", { name: "Acciones", exact: true })
        .count(),
      0,
    );
    await page.goto("http://127.0.0.1:5181/kilometrajes");
    await page
      .getByText("Historial de kilometrajes", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Eliminar/ }).count(),
      0,
    );
    assert.deepEqual(errores, []);
    console.log(
      "OK: eliminación solo admin, cancelar no borra, confirmación y motivo, error conserva datos, refresco de historiales, payload con versión/fecha, foco modal y móvil/oscuro. Sin BD real.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
