// Solo contra core.smoke_administracion (SQLite efimero).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER});
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.routeWebSocket('**',()=>{});
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try {
    await page.goto('http://127.0.0.1:5180/login');
    await page.getByLabel('Usuario',{exact:true}).fill('administrador');
    await page.locator('input[type=password]').fill('Prueba-local-492!');
    await page.getByRole('button',{name:'Ingresar al sistema',exact:true}).click();
    await page.waitForURL('**/panel');
    const modules=page.locator('.nav-module');await modules.first().waitFor();
    assert.equal(await modules.count(),7);
    for(const module of await modules.all()) {
      const button=module.locator('button.nav-module-title'), sub=module.locator('.nav-subitems');
      const url=page.url();
      assert.equal(await button.getAttribute('aria-expanded'),'false');
      await button.locator('span').click();assert.equal(await button.getAttribute('aria-expanded'),'true');assert(await sub.isVisible());
      await button.locator('svg').last().click();assert.equal(await button.getAttribute('aria-expanded'),'false');assert(!await sub.isVisible());
      assert.equal(page.url(),url,'La fila no debe navegar');
      await button.focus();await button.press('Enter');assert(await sub.isVisible());
      await button.press('Space');assert(!await sub.isVisible());
    }
    await page.goto('http://127.0.0.1:5180/expedicion/ordenes');
    const exp=page.locator('.nav-module').filter({has:page.locator('button[aria-controls="submenu-expedicion"]')});
    const button=exp.locator('button.nav-module-title');await button.waitFor();
    assert.equal(await button.getAttribute('aria-expanded'),'true');
    await button.click();assert.equal(await button.getAttribute('aria-expanded'),'false');
    await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');
    await page.setViewportSize({width:390,height:844});
    await page.locator('.menu-toggle').click();
    const sidebar=page.locator('.sidebar');assert(await sidebar.evaluate(e=>e.classList.contains('sidebar-open')));
    await button.click();assert(await sidebar.evaluate(e=>e.classList.contains('sidebar-open')));
    await button.click();assert(await sidebar.evaluate(e=>e.classList.contains('sidebar-open')));
    await exp.locator('a[href="/expedicion/inicio"]').click();await page.waitForURL('**/expedicion/inicio');
    assert(!await sidebar.evaluate(e=>e.classList.contains('sidebar-open')));
    await page.locator('.menu-toggle').click();
    await page.getByRole('link',{name:'Ir al inicio',exact:true}).click();
    await page.waitForURL('**/panel');
    assert(!await sidebar.evaluate(e=>e.classList.contains('sidebar-open')));
    assert.deepEqual(errors,[]);
    console.log('OK: toda la fila alterna los 7 modulos, incluido texto y flecha; teclado, seccion activa, enlaces internos y menu movil correctos.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
