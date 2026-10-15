// Pruebas visuales contra core.smoke_conversion (SQLite efímero, nunca la BD real).
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
    viewport: { width: 1440, height: 1050 },
    reducedMotion: "reduce",
  });
  await context.routeWebSocket("**", () => {});
  await context.route("https://fonts.googleapis.com/**", (r) =>
    r.fulfill({ contentType: "text/css", body: "" }),
  );
  const page = await context.newPage(),
    errors = [],
    contrast = [];
  const app = "http://127.0.0.1:5179",
    out = path.join(__dirname, "..", "test-artifacts");
  fs.mkdirSync(out, { recursive: true });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.setDefaultTimeout(15000);
  const theme = () => page.locator("html").getAttribute("data-theme");
  async function shot(name) {
    await page.screenshot({ path: path.join(out, `tema-${name}.png`) });
  }
  async function audit(route) {
    const findings = await page.evaluate(() => {
      const rgb = (s) => s.match(/[\d.]+/g)?.map(Number) || [255, 255, 255, 0];
      const lum = (c) =>
        c
          .slice(0, 3)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((v, c, i) => v + c * [0.2126, 0.7152, 0.0722][i], 0);
      const rows = [];
      for (const el of document.querySelectorAll("main *, .login-card *")) {
        if (
          ![...el.childNodes].some(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          ) ||
          el.closest(
            "svg,.panel-hero,.dashboard-bienvenida,.sidebar,.login-visual",
          )
        )
          continue;
        const b = el.getBoundingClientRect(),
          st = getComputedStyle(el);
        if (
          !b.width ||
          !b.height ||
          b.top > innerHeight ||
          b.bottom < 0 ||
          st.visibility === "hidden"
        )
          continue;
        let bg = [255, 255, 255],
          layers = [],
          node = el;
        while (node) {
          const cs = getComputedStyle(node);
          if (cs.backgroundImage !== "none") {
            layers = [];
            break;
          }
          layers.push(rgb(cs.backgroundColor));
          node = node.parentElement;
        }
        if (!layers.length) continue;
        for (const layer of layers.reverse()) {
          const a = layer[3] ?? 1;
          bg = bg.map((v, i) => v * (1 - a) + layer[i] * a);
        }
        const fg = rgb(st.color),
          l1 = lum(fg),
          l2 = lum(bg),
          ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 4.45)
          rows.push({
            tag: el.tagName,
            class: el.className,
            text: el.textContent.trim().slice(0, 65),
            ratio: +ratio.toFixed(2),
            fg: st.color,
            bg,
          });
      }
      return rows;
    });
    if (findings.length) contrast.push({ route, findings });
  }
  try {
    await page.goto(`${app}/login`);
    assert.equal(await theme(), "light");
    await page
      .getByRole("button", { name: "Activar tema oscuro", exact: true })
      .click();
    assert.equal(await theme(), "dark");
    await shot("login-oscuro");
    await audit("login");
    await page.locator("#username").fill("conversion_smoke");
    await page.locator("#password").fill("Conversion-local-123!");
    await page
      .getByRole("button", { name: "Ingresar al sistema", exact: true })
      .click();
    await page.waitForURL("**/panel");
    await page.locator(".app-header .theme-toggle").waitFor();
    assert.equal(await theme(), "dark");
    await page.reload();
    await page.locator(".panel-principal-page").waitFor();
    assert.equal(await theme(), "dark");
    const routes = [
      "/panel",
      "/repartos/inicio",
      "/repartos",
      "/repartos/nuevo",
      "/repartos/recargas",
      "/repartos/planillas",
      "/rechazos/inicio",
      "/rechazos",
      "/rechazos/nuevo",
      "/rechazos/estadisticas",
      "/cambios/inicio",
      "/cambios",
      "/cambios/nuevo",
      "/cambios/estadisticas",
      "/viaticos/inicio",
      "/viaticos",
      "/viaticos/nuevo",
      "/viaticos/resumen",
      "/kilometrajes/inicio",
      "/kilometrajes",
      "/kilometrajes/nuevo",
      "/kilometrajes/estadisticas",
      "/control-diario/inicio",
      "/control-diario",
      "/control-diario/nuevo",
      "/control-diario/estadisticas",
      "/asistente",
      "/expedicion/inicio",
      "/expedicion/ordenes",
      "/expedicion/pendientes",
      "/expedicion/stock",
      "/expedicion/movimientos",
      "/expedicion/materiales",
      "/expedicion/empleados",
      "/expedicion/conteos",
      "/expedicion/auditoria",
      "/expedicion/configuracion",
      "/expedicion/fleteros",
    ];
    for (const route of routes) {
      await page.goto(app + route);
      await page.locator(".app-header .theme-toggle").waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(await theme(), "dark", route);
      assert.equal(
        await page
          .getByRole("button", { name: "Activar tema claro", exact: true })
          .count(),
        1,
        `${route}: selector duplicado`,
      );
      const bodyBg = await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.equal(bodyBg, "rgb(11, 20, 34)");
      await audit(route);
      if (
        [
          "/panel",
          "/repartos/nuevo",
          "/expedicion/ordenes",
          "/expedicion/configuracion",
        ].includes(route)
      )
        await shot(route.slice(1).replaceAll("/", "-"));
      console.log("OK", route);
    }
    for (const [endpoint, makeRoutes] of [
      ["repartos/", (id) => [`/repartos/${id}/editar`]],
      ["rechazos/", (id) => [`/rechazos/${id}/editar`]],
      [
        "cambios/recibos/",
        (id) => [`/cambios/recibos/${id}`, `/cambios/recibos/${id}/editar`],
      ],
    ]) {
      const response = await context.request.get(
        "http://127.0.0.1:8769/api/" + endpoint,
      );
      assert(response.ok(), endpoint);
      const records = await response.json(),
        id = (Array.isArray(records) ? records : records.results)[0].id;
      for (const route of makeRoutes(id)) {
        await page.goto(app + route);
        await page.waitForLoadState("networkidle");
        await audit(route);
        assert.equal(await theme(), "dark");
        console.log("OK", route);
      }
    }
    await page.goto(app + "/expedicion/ordenes");
    await page
      .getByRole("button", { name: "Nueva orden", exact: true })
      .click();
    const dialog = page.locator(".eo-dialog");
    await dialog.waitFor();
    assert.equal(
      await dialog.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(19, 31, 49)",
    );
    await shot("orden-modal");
    await audit("modal-orden");
    await page.keyboard.press("Escape");
    await page.goto(app + "/cambios/estadisticas");
    await page.locator('input[type="date"]').nth(0).fill("2026-01-01");
    await page.locator('input[type="date"]').nth(1).fill("2026-12-31");
    await page
      .getByRole("button", { name: "Generar estadísticas", exact: true })
      .last()
      .click();
    await page.locator(".chart-category-tick").first().waitFor();
    await page.locator(".scrollable-chart").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.equal(
      await page
        .locator(".chart-category-tick text")
        .first()
        .evaluate((el) => getComputedStyle(el).fill),
      "rgb(169, 186, 208)",
    );
    await page.locator(".recharts-bar-rectangle").first().hover();
    await page.waitForTimeout(150);
    const tooltip = page.locator(".recharts-default-tooltip").first();
    assert.equal(
      await tooltip.evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(19, 31, 49)",
    );
    await shot("estadisticas");
    await audit("graficos");
    const other = await context.newPage();
    await other.goto(app + "/login");
    await page
      .getByRole("button", { name: "Activar tema claro", exact: true })
      .click();
    await other.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await page.reload();
    assert.equal(await theme(), "light");
    await page
      .getByRole("button", { name: "Activar tema oscuro", exact: true })
      .click();
    await other.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    await other.close();
    for (const width of [1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(app + "/expedicion/ordenes");
      await page.locator(".app-header .theme-toggle").waitFor();
      assert(await page.locator(".app-header .theme-toggle").isVisible());
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `Desborde a ${width}`,
      );
      await shot(`responsive-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.emulateMedia({ media: "print" });
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(243, 246, 250)",
    );
    assert.equal(await page.locator(".theme-toggle").isVisible(), false);
    await page.emulateMedia({ media: "screen" });
    assert.equal(await theme(), "dark");
    const legacy = await browser.newContext();
    await legacy.addInitScript(() =>
      localStorage.setItem("expedicion-tema", "oscuro"),
    );
    const legacyPage = await legacy.newPage();
    await legacyPage.goto(app + "/login");
    assert.equal(
      await legacyPage.locator("html").getAttribute("data-theme"),
      "dark",
    );
    await legacy.close();
    const blocked = await browser.newContext();
    await blocked.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      }),
    );
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(app + "/login");
    await blockedPage
      .getByRole("button", { name: "Activar tema oscuro", exact: true })
      .click();
    assert.equal(
      await blockedPage.locator("html").getAttribute("data-theme"),
      "dark",
    );
    await blocked.close();
    fs.writeFileSync(
      path.join(out, "tema-contraste.json"),
      JSON.stringify(contrast, null, 2),
    );
    assert.deepEqual(errors, []);
    console.log(
      "OK: 38 rutas más edición/detalle, login, modal, gráficos, persistencia, pestañas, preferencia anterior, almacenamiento bloqueado, responsive e impresión.",
    );
    console.log(
      "Hallazgos de contraste para revisar:",
      contrast.reduce((n, x) => n + x.findings.length, 0),
    );
  } catch (error) {
    await shot("fallo");
    console.error(error);
    console.error(errors);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
