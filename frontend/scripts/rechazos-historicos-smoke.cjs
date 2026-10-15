// Sólo contra rechazos.smoke_historicos, SQLite en memoria.
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
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const output = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(output, { recursive: true });
  try {
    assert.equal(
      (
        await context.request.post("http://127.0.0.1:8767/api/auth/login/", {
          data: { username: "rechazos_smoke", password: "Rechazos-local-123!" },
        })
      ).status(),
      200,
    );
    const api = "http://127.0.0.1:8767/api/rechazos/";
    const lotes = await (await context.request.get(api + "historicos/")).json();
    assert.equal(lotes.length, 1);
    const id = lotes[0].id;
    const source = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          "..",
          "..",
          "backend",
          "importaciones",
          "rechazos",
          "planilla-original.json",
        ),
        "utf8",
      ),
    );
    const data = await (
      await context.request.get(api + `historicos/${id}/registros/`)
    ).json();
    assert.equal(data.length, 62);
    assert.deepEqual(
      data.map((r) => r.celdas_originales),
      source.pestanas[0].filas.slice(1),
    );
    assert.equal(data.at(-1).fecha, null);
    assert.equal(data.at(-1).fecha_original, "");
    assert.equal(data.at(-1).marca_temporal, "13/10/2026 16:48:01");
    const before = await (await context.request.get(api)).json();
    assert.equal(before.length, 1);
    await page.goto("http://127.0.0.1:5177/rechazos");
    const table = page.locator(".hr-registros");
    await table.locator("tbody tr").nth(61).waitFor();
    assert.equal(await table.locator("tbody tr").count(), 62);
    const originalRows = source.pestanas[0].filas.slice(1);
    for (let i = 0; i < 62; i++) {
      const cells = await table
        .locator("tbody tr")
        .nth(i)
        .getByRole("cell")
        .allTextContents();
      for (let j = 0; j < originalRows[i].length; j++)
        assert.equal(cells[j + 1], String(originalRows[i][j] ?? ""));
    }
    await page.getByLabel("Sólo filas para revisar").check();
    assert.equal(await table.locator("tbody tr").count(), 1);
    const pending = table.locator("tbody tr").first();
    assert.equal(await pending.getByRole("cell").nth(2).textContent(), "");
    await pending.locator("summary").click();
    assert(
      (await pending.innerText()).includes(
        "No se sustituye por la marca temporal",
      ),
    );
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    await page.getByLabel("Desde", { exact: true }).fill("2026-06-01");
    await page.getByLabel("Hasta", { exact: true }).fill("2026-06-30");
    assert.equal(await table.locator("tbody tr").count(), 13);
    await page
      .getByRole("button", { name: "Estadísticas del histórico", exact: true })
      .click();
    const stats = page.locator(".hr-historico .tabla-repartos");
    const counts = await stats
      .locator("tbody tr")
      .evaluateAll((rows) =>
        rows.reduce((sum, r) => sum + Number(r.children[1].textContent), 0),
      );
    assert.equal(counts, 13);
    await page
      .getByRole("button", { name: "Rechazos originales", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Limpiar filtros", exact: true })
      .click();
    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar originales CSV" }).click();
    const csvPath = path.join(output, "rechazos-originales.csv");
    await (await csvDownload).saveAs(csvPath);
    const csv = fs.readFileSync(csvPath, "utf8");
    assert(csv.includes('"15.03"'));
    assert(csv.includes('"63 bultos"'));
    const jsonDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar copia completa JSON" })
      .click();
    const jsonPath = path.join(output, "rechazos-historico-completo.json");
    await (await jsonDownload).saveAs(jsonPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath, "utf8")), source);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector(".hr-registros").scrollLeft = 0;
    });
    await page.screenshot({
      path: path.join(output, "rechazos-historico.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Anexos originales", exact: true })
      .click();
    await page.getByLabel("Hoja original").waitFor();
    for (const sheet of source.pestanas.slice(1)) {
      await page.getByLabel("Hoja original").selectOption(sheet.nombre);
      const rows = await page
        .locator(".hr-historico .tabla-repartos tbody tr")
        .all();
      assert.equal(rows.length, sheet.filas.length);
      for (let i = 0; i < rows.length; i++) {
        const cells = await rows[i].getByRole("cell").allTextContents();
        for (let j = 0; j < sheet.filas[i].length; j++)
          assert.equal(cells[j], String(sheet.filas[i][j] ?? ""));
      }
    }
    await page
      .getByRole("button", { name: "Rechazos operativos", exact: true })
      .click();
    assert.equal(
      await page.getByRole("link", { name: "Editar", exact: true }).count(),
      1,
    );
    assert.deepEqual(await (await context.request.get(api)).json(), before);
    await page.goto("http://127.0.0.1:5177/rechazos/estadisticas");
    await page
      .getByRole("button", { name: "Estadísticas del histórico", exact: true })
      .first()
      .click();
    await page.getByText("62 de 62 rechazos", { exact: false }).waitFor();
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
    // El componente compartido no debe romper el histórico de Repartos ya instalado.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:5177/repartos");
    await page.getByText("1031 de 1031 registros", { exact: false }).waitFor();
    await page
      .getByRole("button", { name: "Recargas por período", exact: true })
      .click();
    await page.getByLabel("Período original").waitFor();
    assert.equal(
      await page.getByLabel("Período original").locator("option").count(),
      8,
    );
    await page.goto("http://127.0.0.1:5177/panel");
    const kpi = page
      .locator(".dashboard-kpi-card")
      .filter({ has: page.getByText("Rechazos históricos", { exact: true }) });
    await kpi.getByText("62", { exact: true }).waitFor();
    const repartoKpi = page
      .locator(".dashboard-kpi-card")
      .filter({ has: page.getByText("Repartos históricos", { exact: true }) });
    await repartoKpi.getByText("1031", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "OK: 62 registros idénticos, fecha ausente intacta, bultos textuales, 3 anexos, estadística junio 13, CSV/JSON, operativos sin cambios, histórico de repartos intacto, panel, responsive y consola.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(output, "rechazos-historico-fallo.png"),
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
