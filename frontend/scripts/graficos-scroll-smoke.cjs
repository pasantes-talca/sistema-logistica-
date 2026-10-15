// UI real con SQLite efímero (core.smoke_conversion); escenarios grandes sólo de prueba.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSER,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  await context.routeWebSocket("**", () => {});
  await context.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" || /width.*-1|height.*-1/i.test(m.text()))
      errors.push(m.text());
  });
  const out = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(out, { recursive: true });
  const api = "http://127.0.0.1:8769/api",
    app = "http://127.0.0.1:5179";
  async function checkChart(label, count, kind = "bar") {
    const region = page.getByRole("region", { name: label, exact: true });
    await region.waitFor();
    await page.waitForFunction(
      ({ label, count }) => {
        const el = [
          ...document.querySelectorAll(".scrollable-chart__viewport"),
        ].find((e) => e.getAttribute("aria-label") === label);
        return (
          el && el.querySelectorAll(".chart-category-tick").length === count
        );
      },
      { label, count },
    );
    const size = await region.evaluate((el) => ({
      visible: el.clientWidth,
      full: el.scrollWidth,
      height: el.clientHeight,
      style: getComputedStyle(el).overflowX,
    }));
    assert(size.full > size.visible + 100, `${label}: no hay desplazamiento`);
    assert.equal(size.style, "auto");
    assert(size.height >= 300);
    assert.equal(await region.locator(".chart-category-tick").count(), count);
    const slider=page.getByRole('slider',{name:`Desplazamiento horizontal de ${label}`,exact:true});
    await slider.waitFor();
    const sliderBox=await slider.boundingBox();
    await slider.click({position:{x:sliderBox.width*.75,y:sliderBox.height/2}});
    assert(await region.evaluate(el=>el.scrollLeft>0),'La barra visible no desplaza el gráfico');
    await slider.press('Home');
    if (kind === "bar")
      assert.equal(
        await region.locator(".recharts-bar-rectangle").count(),
        count,
      );
    await page
      .getByRole("button", {
        name: `Desplazar ${label} a la derecha`,
        exact: true,
      })
      .click();
    await page.waitForFunction(
      (label) =>
        [...document.querySelectorAll(".scrollable-chart__viewport")].find(
          (e) => e.getAttribute("aria-label") === label,
        ).scrollLeft > 0,
      label,
    );
    await slider.press('End');
    await page.waitForFunction((label) => {
      const el = [
        ...document.querySelectorAll(".scrollable-chart__viewport"),
      ].find((e) => e.getAttribute("aria-label") === label);
      return el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
    }, label);
    const end = await region.evaluate((el) => {
      const tick = [...el.querySelectorAll(".chart-category-tick")]
          .at(-1)
          .getBoundingClientRect(),
        box = el.getBoundingClientRect();
      return tick.left < box.right && tick.right > box.left;
    });
    assert(end, "Última categoría inaccesible");
    await region.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      (label) =>
        [...document.querySelectorAll(".scrollable-chart__viewport")].find(
          (e) => e.getAttribute("aria-label") === label,
        ).scrollLeft > 0,
      label,
    );
    await region.evaluate((el) => {
      el.scrollLeft = 0;
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "El gráfico desborda la página",
    );
  }
  try {
    assert.equal(
      (
        await context.request.post(api + "/auth/login/", {
          data: {
            username: "conversion_smoke",
            password: "Conversion-local-123!",
          },
        })
      ).status(),
      200,
    );
    const data = await (
      await context.request.get(
        api + "/cambios/estadisticas/?desde=2026-01-01&hasta=2026-12-31",
      )
    ).json();
    await page.goto(app + "/cambios/estadisticas");
    await page.locator("input[type=date]").nth(0).fill("2026-01-01");
    await page.locator("input[type=date]").nth(1).fill("2026-12-31");
    await page
      .locator("form")
      .getByRole("button", { name: "Generar estadísticas", exact: true })
      .click();
    await checkChart(
      "Cantidades por producto",
      data.por_producto_concesionario.length,
    );
    const chart = page.locator(".grafico-rechazos");
    await page.getByRole('heading',{name:'Cantidades por producto',exact:true}).click();
    await chart.scrollIntoViewIfNeeded();
    await chart.screenshot({
      path: path.join(out, "grafico-cambios-scroll.png"),
    });
    const boxes = await chart
      .locator(".chart-category-tick")
      .evaluateAll((els) =>
        els.map((e) => {
          const b = e.getBoundingClientRect();
          return { left: b.left, right: b.right };
        }),
      );
    for (let i = 1; i < boxes.length; i++)
      assert(boxes[i - 1].right < boxes[i].left + 1, "Etiquetas superpuestas");
    const firstBar = chart.locator(".recharts-bar-rectangle path").first();
    await firstBar.hover();
    await page
      .locator(".recharts-tooltip-wrapper")
      .filter({ visible: true })
      .waitFor();
    // Menos datos: el mismo componente vuelve a ocupar el ancho disponible.
    const options = await page
      .locator("form select option")
      .evaluateAll((els) =>
        els.map((e) => ({ value: e.value, text: e.textContent })),
      );
    const choice =
      options.find((o) => o.value && o.text === "auca") ||
      options.find((o) => o.value);
    await page.locator("form select").selectOption(choice.value);
    await page
      .locator("form")
      .getByRole("button", { name: "Generar estadísticas", exact: true })
      .click();
    const small = await (
      await context.request.get(
        api +
          `/cambios/estadisticas/?desde=2026-01-01&hasta=2026-12-31&concesionario_id=${choice.value}`,
      )
    ).json();
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll(".chart-category-tick").length === count,
      small.por_producto.length,
    );
    const viewport = page.getByRole("region", {
      name: "Cantidades por producto",
      exact: true,
    });
    const compact = await viewport.evaluate((el) => ({
      full: el.scrollWidth,
      visible: el.clientWidth,
    }));
    if (small.por_producto.length <= 4)
      assert(Math.abs(compact.full - compact.visible) < 3);
    await page.goto(app + "/rechazos/estadisticas");
    await page.locator("input[type=date]").nth(0).fill("2026-01-01");
    await page.locator("input[type=date]").nth(1).fill("2026-12-31");
    await page
      .getByRole("button", { name: "Generar estadísticas", exact: true })
      .click();
    const rejects = await (
      await context.request.get(
        api + "/rechazos/estadisticas/?desde=2026-01-01&hasta=2026-12-31",
      )
    ).json();
    await checkChart("Rechazos por motivo", rejects.por_motivo.length);
    // Grandes series sintéticas interceptadas sólo en este navegador, nunca en la BD.
    const km = await (
      await context.request.get(api + "/kilometrajes/estadisticas/")
    ).json();
    km.por_chofer = Array.from({ length: 35 }, (_, i) => ({
      id: i + 1,
      chofer_id: i + 1,
      nombre: `Chofer de prueba número ${i + 1}`,
      kilometros: String(100 + i),
      viajes: 1,
    }));
    km.por_destino = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      destino_id: i + 1,
      nombre: `Destino de distribución número ${i + 1}`,
      kilometros: String(90 + i),
      viajes: 1,
    }));
    await context.route("**/api/kilometrajes/estadisticas/**", (r) =>
      r.fulfill({ json: km }),
    );
    await page.goto(app + "/kilometrajes/estadisticas");
    await checkChart("Kilómetros por chofer", 35);
    await checkChart("Kilómetros por destino", 30);
    const control = await (
      await context.request.get(api + "/control-diario/estadisticas/")
    ).json();
    control.por_producto = Array.from({ length: 30 }, (_, i) => ({
      producto__nombre: `Producto de prueba presentación ${i + 1}`,
      total: String(i + 1),
    }));
    control.por_distribuidor = Array.from({ length: 30 }, (_, i) => ({
      ubicacion__nombre: `Distribuidor de prueba número ${i + 1}`,
      total: String(i + 1),
    }));
    control.por_fecha = Array.from({ length: 90 }, (_, i) => ({
      control__fecha: new Date(Date.UTC(2026, 0, i + 1))
        .toISOString()
        .slice(0, 10),
      total: String(i + 1),
    }));
    await context.route("**/api/control-diario/estadisticas/**", (r) =>
      r.fulfill({ json: control }),
    );
    await page.goto(app + "/control-diario/estadisticas");
    await checkChart("Cantidad por producto", 30);
    await checkChart("Cantidades por distribuidor", 30);
    await checkChart("Evolución diaria", 90, "line");
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
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(app + "/panel");
    await page
      .getByRole("region", { name: "Entradas y salidas", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 1000 });
    if (await page.locator(".sidebar.sidebar-open").count())
      await page.locator(".sidebar-open .sidebar-close").click();
    await page.waitForFunction(
      () =>
        document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "OK: gráficos completos sin comprimir, barras de scroll, botones, teclado, última categoría visible, etiquetas sin solaparse, tooltip, cambios de filtros, 7 series grandes, panel y responsive.",
    );
  } catch (e) {
    await page.screenshot({
      path: path.join(out, "graficos-scroll-fallo.png"),
      fullPage: false,
    });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
