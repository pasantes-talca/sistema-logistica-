// Sólo contra cambios.smoke_historicos: base efímera en memoria.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.routeWebSocket("**", () => {});
  await context.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const output = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(output, { recursive: true });
  try {
    assert.equal(
      (
        await context.request.post("http://127.0.0.1:8768/api/auth/login/", {
          data: { username: "cambios_smoke", password: "Cambios-local-123!" },
        })
      ).status(),
      200,
    );
    const api = "http://127.0.0.1:8768/api/cambios/";
    const lotes = await (await context.request.get(api + "historicos/")).json();
    assert.equal(lotes.length, 1);
    const source = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          "..",
          "..",
          "backend",
          "importaciones",
          "cambios",
          "planilla-original.json",
        ),
        "utf8",
      ),
    );
    const rows = await (
      await context.request.get(api + `historicos/${lotes[0].id}/recibos/`)
    ).json();
    assert.equal(rows.length, 87);
    const sheets = source.pestanas.filter((s) =>
      s.nombre.startsWith("Recibo "),
    );
    for (let i = 0; i < 87; i++) {
      assert.deepEqual(rows[i].filas_originales, sheets[i].filas);
      assert.equal(rows[i].fecha_original, sheets[i].filas[2][8]);
      assert.equal(rows[i].concesionario, sheets[i].filas[4][2]);
      for (const p of rows[i].productos) {
        assert.equal(p.cantidad, String(sheets[i].filas[p.fila - 1][6] ?? ""));
        assert.equal(
          p.observacion,
          String(sheets[i].filas[p.fila - 1][8] ?? ""),
        );
      }
      assert.equal(rows[i].incidencias.length, 0);
    }
    const before = await (await context.request.get(api + "recibos/")).json();
    assert.equal(before.length, 1);
    console.log("API y datos originales verificados.");
    await page.goto("http://127.0.0.1:5178/cambios");
    await page.getByText("87 de 87 recibos", { exact: false }).waitFor();
    console.log("Historial de recibos cargado.");
    assert.equal(await page.locator(".hc-listado tbody tr").count(), 87);
    await page.getByLabel("Desde", { exact: true }).fill("2026-05-01");
    await page.getByLabel("Hasta", { exact: true }).fill("2026-06-30");
    const expected = rows.filter(
      (r) => r.fecha >= "2026-05-01" && r.fecha <= "2026-06-30",
    );
    assert.equal(
      await page.locator(".hc-listado tbody tr").count(),
      expected.length,
    );
    await page
      .getByLabel("Concesionario original", { exact: true })
      .selectOption("Aiobak");
    assert.equal(
      await page.locator(".hc-listado tbody tr").count(),
      expected.filter((r) => r.concesionario === "Aiobak").length,
    );
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar copia completa JSON" })
      .click();
    const snapshotPath = path.join(output, "cambios-originales.json");
    await (await download).saveAs(snapshotPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(snapshotPath, "utf8")), source);
    await page
      .getByRole("button", {
        name: `Ver recibo ${rows[0].nombre_hoja}`,
        exact: true,
      })
      .click();
    assert.equal(
      await page.locator(".hc-productos tbody tr").count(),
      rows[0].productos.length,
    );
    assert.equal(
      await page.locator(".hc-cantidad").first().textContent(),
      "1.03",
    );
    await page.locator(".hc-original summary").click();
    const original = page.locator(".hc-original tbody tr");
    assert.equal(await original.count(), 34);
    for (let i = 0; i < 34; i++) {
      const cells = await original.nth(i).getByRole("cell").allTextContents();
      for (let j = 0; j < sheets[0].filas[i].length; j++)
        assert.equal(cells[j], String(sheets[0].filas[i][j] ?? ""));
    }
    await page.screenshot({
      path: path.join(output, "cambios-recibo.png"),
      fullPage: true,
    });
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page
        .locator(".hc-print")
        .evaluate((el) => getComputedStyle(el).visibility),
      "visible",
    );
    assert.equal(
      await page
        .locator(".sidebar")
        .evaluate((el) => getComputedStyle(el).visibility),
      "hidden",
    );
    const receiptPdf = await page.pdf({
      path: path.join(output, "cambios-recibo.pdf"),
      format: "A4",
      printBackground: true,
    });
    const receiptPages = (
      receiptPdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []
    ).length;
    assert(
      receiptPages >= 1 && receiptPages <= 2,
      `Páginas de impresión del recibo: ${receiptPages}`,
    );
    await page.emulateMedia({ media: "screen" });
    await page
      .getByRole("button", { name: "Volver al listado", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Resumen generado original", exact: true })
      .click();
    const summary = source.pestanas.find((s) =>
      s.nombre.startsWith("Resumen "),
    );
    const summaryRows = page.locator(".hc-hoja-original tbody tr");
    await summaryRows.nth(96).waitFor();
    assert.equal(await summaryRows.count(), 97);
    for (let i = 0; i < 97; i++) {
      const cells = await summaryRows
        .nth(i)
        .getByRole("cell")
        .allTextContents();
      for (let j = 0; j < summary.filas[i].length; j++)
        assert.equal(cells[j], String(summary.filas[i][j] ?? ""));
    }
    const csv = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar hoja CSV", exact: true })
      .click();
    const csvPath = path.join(output, "cambios-resumen.csv");
    await (await csv).saveAs(csvPath);
    assert(
      fs.readFileSync(csvPath, "utf8").includes("total de totales: 120,5"),
    );
    await page.screenshot({
      path: path.join(output, "cambios-resumen.png"),
      fullPage: true,
    });
    const summaryPdf = await page.pdf({
      path: path.join(output, "cambios-resumen.pdf"),
      format: "A4",
      printBackground: true,
    });
    const summaryPages = (
      summaryPdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []
    ).length;
    assert(
      summaryPages >= 1 && summaryPages <= 6,
      `Páginas de impresión del resumen: ${summaryPages}`,
    );
    await page
      .getByRole("button", { name: "Plantilla original", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Plantilla", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Recibos operativos", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("link", { name: "Ver detalle", exact: true })
        .count(),
      1,
    );
    assert.deepEqual(
      await (await context.request.get(api + "recibos/")).json(),
      before,
    );
    await page.goto("http://127.0.0.1:5178/cambios/estadisticas");
    await page
      .getByRole("button", {
        name: "Resumen histórico de planilla",
        exact: true,
      })
      .click();
    await page.locator(".hc-hoja-original tbody tr").nth(96).waitFor();
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
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:5178/panel");
    await page
      .locator(".dashboard-kpi-card")
      .filter({ has: page.getByText("Recibos históricos", { exact: true }) })
      .getByText("87", { exact: true })
      .waitFor();
    await page
      .locator(".dashboard-kpi-card")
      .filter({ has: page.getByText("Rechazos históricos", { exact: true }) })
      .getByText("62", { exact: true })
      .waitFor();
    await page
      .locator(".dashboard-kpi-card")
      .filter({ has: page.getByText("Repartos históricos", { exact: true }) })
      .getByText("1031", { exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "OK: 87 recibos y todas sus celdas intactas; resumen 97 filas, totales originales; cantidades, filtros, detalle, impresión, CSV/JSON, operativos intactos, panel, responsive y consola.",
    );
  } catch (error) {
    await page.screenshot({
      path: path.join(output, "cambios-fallo.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
