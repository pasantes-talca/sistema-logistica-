// Sólo contra repartos.smoke_historicos: SQLite en memoria; nunca PostgreSQL operativo.
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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) =>
    console.log("Solicitud fallida:", r.url(), r.failure()?.errorText),
  );
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const output = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(output, { recursive: true });
  try {
    assert.equal(
      (
        await context.request.post("http://127.0.0.1:8766/api/auth/login/", {
          data: {
            username: "historico_smoke",
            password: "Historico-local-123!",
          },
        })
      ).status(),
      200,
    );
    const api = "http://127.0.0.1:8766/api/repartos/";
    const lotes = await (await context.request.get(api + "historicos/")).json();
    assert.equal(lotes.length, 1);
    const original = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          "..",
          "..",
          "backend",
          "importaciones",
          "recargas-2026",
          "planilla-original.json",
        ),
        "utf8",
      ),
    );
    const id = lotes[0].id;
    const before = await (await context.request.get(api)).json();
    assert.equal(before.length, 1);
    const raw = await (
      await context.request.get(api + `historicos/${id}/respaldo/`)
    ).json();
    assert.deepEqual(raw, original);
    const records = await (
      await context.request.get(api + `historicos/${id}/registros/`)
    ).json();
    const sourceRows = original.pestanas
      .find((s) => s.nombre === "Registros")
      .filas.slice(1);
    assert.equal(records.length, 1031);
    assert.deepEqual(
      records.map((r) => r.celdas_originales),
      sourceRows,
    );
    await page.goto("http://127.0.0.1:5176/repartos");
    const table = page.locator(".hr-registros");
    await table.locator("tbody tr").first().waitFor();
    assert.equal(await table.locator("tbody tr").count(), 100);
    const firstCells = await table
      .locator("tbody tr")
      .first()
      .getByRole("cell")
      .allTextContents();
    assert.equal(firstCells[1], sourceRows[0][0]);
    assert.equal(firstCells[10], sourceRows[0][9]);
    assert.equal(firstCells[11], sourceRows[0][10]);
    // El original de fila 3 conserva recargas 1 y total 0, sin corregirlos.
    const fila3 = table.locator("tbody tr").nth(1);
    assert.equal(await fila3.getByRole("cell").nth(10).textContent(), "1");
    assert.equal(await fila3.getByRole("cell").nth(11).textContent(), "0");
    await page.getByLabel("Buscar en originales").fill("7/3/32026");
    assert.equal(await table.locator("tbody tr").count(), 1);
    assert.equal(
      await table.getByRole("cell", { name: "7/3/32026", exact: true }).count(),
      1,
    );
    await table.locator("summary").click();
    assert((await table.innerText()).includes("Fecha no interpretable"));
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    await page.getByLabel("Sólo filas para revisar").check();
    await page.getByText("133 de 1031 registros", { exact: false }).waitFor();
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    const allCsvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar originales CSV" }).click();
    const allCsv = path.join(output, "repartos-originales.csv");
    await (await allCsvDownload).saveAs(allCsv);
    assert.equal(
      fs.readFileSync(allCsv, "utf8").trimEnd().split("\r\n").length,
      1032,
    );
    const jsonDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar copia completa JSON" })
      .click();
    const jsonPath = path.join(output, "historico-completo.json");
    await (await jsonDownload).saveAs(jsonPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath, "utf8")), original);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector(".hr-registros").scrollLeft = 0;
    });
    await page.screenshot({
      path: path.join(output, "historico-repartos.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Recargas por período", exact: true })
      .click();
    const periodos = original.pestanas.filter((s) =>
      s.nombre.startsWith("Recarga "),
    );
    await page.getByLabel("Período original").waitFor();
    assert.equal(
      await page.getByLabel("Período original").locator("option").count(),
      8,
    );
    for (const periodo of periodos) {
      await page.getByLabel("Período original").selectOption(periodo.nombre);
      const rows = await page
        .locator(".hr-historico .tabla-repartos tbody tr")
        .all();
      assert.equal(rows.length, periodo.filas.length);
      for (let i = 0; i < rows.length; i++) {
        const cells = await rows[i].getByRole("cell").allTextContents();
        for (let j = 0; j < periodo.filas[i].length; j++)
          assert.equal(cells[j], String(periodo.filas[i][j] ?? ""));
      }
    }
    await page
      .getByRole("button", { name: "Padrón original", exact: true })
      .click();
    await page
      .locator(".hr-historico .tabla-repartos tbody tr")
      .nth(23)
      .waitFor();
    assert.equal(
      await page.locator(".hr-historico .tabla-repartos tbody tr").count(),
      24,
    );
    await page
      .getByRole("button", { name: "Repartos operativos", exact: true })
      .click();
    assert.equal(
      await page.getByRole("link", { name: "Editar", exact: true }).count(),
      1,
    );
    assert.deepEqual(await (await context.request.get(api)).json(), before);
    await page.goto("http://127.0.0.1:5176/repartos/recargas");
    await page
      .getByRole("button", { name: "Resúmenes originales de planilla" })
      .click();
    await page.getByLabel("Período original").waitFor();
    await page.getByLabel("Período original").selectOption(periodos[0].nombre);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(output, "historico-resumenes.png"),
      fullPage: true,
    });
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
        `Sin desborde a ${width}`,
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:5176/panel");
    const historicKpi = page
      .locator(".dashboard-kpi-card")
      .filter({ has: page.getByText("Repartos históricos", { exact: true }) });
    await historicKpi.getByText("1031", { exact: true }).waitFor();
    assert((await historicKpi.textContent()).includes("todos los períodos"));
    const operativoKpi = page
      .locator(".dashboard-kpi-card")
      .filter({ has: page.getByText("Repartos", { exact: true }) });
    await operativoKpi.getByText("1", { exact: true }).waitFor();
    assert((await operativoKpi.textContent()).includes("Últimos 7 días"));
    assert.deepEqual(errors, []);
    console.log(
      "OK: 1.031 filas idénticas, 8 resúmenes y notas originales, padrón, 133 advertencias, fechas erróneas intactas, CSV/JSON completos, rutas previas, operativos sin cambios, responsive y consola.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "historico-fallo.png"),
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
