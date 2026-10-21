// Solo SQLite efímero core.smoke_administracion. Nunca usa la BD operativa.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER});
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
  await context.routeWebSocket('**', () => {});
  await context.route('https://fonts.googleapis.com/**', r => r.fulfill({body: '', contentType: 'text/css'}));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if(m.type() === 'error') errors.push(m.text());});
  const app = 'http://127.0.0.1:5180', api = 'http://127.0.0.1:8770/api';
  async function login(username) {
    await page.goto(app + '/login');
    await page.getByLabel('Usuario', {exact: true}).fill(username);
    await page.getByLabel('Contraseña', {exact: true}).fill('Prueba-local-492!');
    await page.getByRole('button', {name: 'Ingresar al sistema', exact: true}).click();
    await page.waitForURL('**/panel');
  }
  async function logout() { await page.getByRole('button', {name: 'Cerrar sesión', exact: true}).click(); await page.waitForURL('**/login'); }
  const out = path.join(__dirname, '..', 'test-artifacts'); fs.mkdirSync(out, {recursive: true});
  try {
    await login('administrador');
    const sections = [['panel','Panel de control'], ['permisos','Roles y permisos por acción'], ['base-datos','Base de datos y respaldos'], ['errores','Registros de errores e incidencias'], ['reportes','Reportes de operaciones y actividad'], ['notificaciones','Notificaciones operativas'], ['seguridad','Seguridad'], ['estado','Estado del sistema']];
    for (const [slug, heading] of sections) {
      await page.goto(app + '/administracion/' + slug);
      await page.getByRole('heading', {name: heading, exact: true}).waitFor();
      await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('[role="alert"]').count(), 0, slug);
    }
    await page.goto(app + '/administracion/panel');
    await page.waitForLoadState('networkidle');
    await page.screenshot({path: path.join(out, 'admin-panel-control.png')});
    await page.goto(app + '/administracion/permisos');
    await page.getByLabel('Usuario a configurar').selectOption({label: 'cbagnardi'});
    const create = page.getByRole('checkbox', {name: 'Recibos de cambios y enlace a Stock de pallets: crear', exact: true});
    await create.uncheck();
    await page.getByLabel('Motivo del cambio').fill('Perfil de consulta para ensayo local');
    await page.getByRole('button', {name: 'Guardar permisos por acción', exact: true}).click();
    await page.getByText('Permisos guardados.', {exact: false}).waitFor();
    for (const removed of ['catalogos','configuracion']) {
      await page.goto(app + '/administracion/' + removed);
      await page.waitForURL('**/administracion/panel');
    }
    const tabs = page.getByRole('navigation',{name:'Administración',exact:true});
    assert.equal(await tabs.getByRole('link',{name:'Catálogos',exact:true}).count(),0);
    assert.equal(await tabs.getByRole('link',{name:'Configuración',exact:true}).count(),0);
    await page.goto(app + '/administracion/seguridad');
    await page.getByLabel('Duración máxima de sesión (horas)').fill('6');
    await page.getByLabel('Motivo de la modificación').fill('Política de prueba');
    await page.getByRole('button', {name:'Guardar política de seguridad', exact:true}).click();
    await page.getByText('Política de seguridad guardada con auditoría.', {exact:true}).waitFor();
    const prefs = await (await context.request.get(api + '/administracion/preferencias/')).json(); assert.equal(prefs.sesion_horas,6);
    await page.goto(app + '/administracion/reportes');
    await page.waitForLoadState('networkidle');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', {name:'Exportar actividad CSV', exact:true}).click();
    assert.equal((await downloaded).suggestedFilename(),'actividad-sistema.csv');
    await page.goto(app + '/administracion/seguridad');
    await page.waitForLoadState('networkidle');
    const root = page.getByRole('row').filter({has:page.getByText('arielgarro',{exact:true})});
    assert(await root.getByRole('button',{name:'Cerrar sesiones',exact:true}).isDisabled());
    if(await page.getByRole('button',{name:'Activar tema oscuro',exact:true}).count()) await page.getByRole('button',{name:'Activar tema oscuro',exact:true}).click();
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(out,'admin-seguridad-oscuro.png')});
    for(const width of [1024,768,390]) {
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Desborde ${width}`);
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(app+'/panel'); await logout(); await login('cbagnardi');
    const csrf = (await context.cookies()).find(c => c.name === 'csrftoken').value;
    assert.equal((await context.request.post(api+'/cambios/recibos/',{data:{},headers:{'X-CSRFToken':csrf}})).status(),403);
    assert.equal((await context.request.get(api+'/administracion/estado/')).status(),403);
    await logout(); await login('arielgarro');
    assert.equal(await page.getByRole('link',{name:'Administración',exact:true}).count(),0);
    for(const [slug] of sections) assert.equal((await context.request.get(api+'/administracion/'+({ 'configuracion':'preferencias','base-datos':'estado','notificaciones':'alertas','seguridad':'sesiones' }[slug] || slug)+'/')).status(),403);
    assert.deepEqual(errors,[]);
    console.log('OK: ocho pantallas, rutas eliminadas redirigen al panel, seguridad auditada, CSV, responsive y exclusion de arielgarro.');
  } catch(e) { await page.screenshot({path:path.join(out,'admin-herramientas-fallo.png')}); console.error(e); console.error(errors); process.exitCode=1; }
  finally {await browser.close();}
})();
