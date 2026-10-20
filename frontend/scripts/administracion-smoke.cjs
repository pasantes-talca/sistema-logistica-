// Ejecutar sólo con core.smoke_administracion: puertos locales y SQLite efímero.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
  await context.routeWebSocket("**",()=>{});
  await context.route("https://fonts.googleapis.com/**",r=>r.fulfill({contentType:"text/css",body:""}));
  const page=await context.newPage(), errors=[];
  const app="http://127.0.0.1:5180", api="http://127.0.0.1:8770/api";
  const out=path.join(__dirname,"..","test-artifacts");fs.mkdirSync(out,{recursive:true});
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  async function login(user,password="Prueba-local-492!"){
    await page.goto(app+"/login");await page.getByLabel("Usuario",{exact:true}).fill(user);await page.getByLabel("Contraseña",{exact:true}).fill(password);await page.getByRole("button",{name:"Ingresar al sistema",exact:true}).click();await page.waitForURL("**/panel");await page.locator('.app-header').waitFor();await page.waitForLoadState('networkidle');
  }
  async function logout(){await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.waitForURL('**/login');}
  async function shot(name){await page.waitForTimeout(250);await page.screenshot({path:path.join(out,`admin-${name}.png`)});}
  try{
    await login("administrador");
    const user=await context.request.get(api+"/auth/usuario/");const body=await user.json();
    assert(body.es_administrador);assert(!body.es_staff);assert(!body.es_superusuario);
    for(const label of ['Repartos y recargas','Rechazos','Recibos de cambios','Viáticos','Kilometrajes','Control diario','Expedición','Administración'])assert(await page.getByRole('link',{name:label,exact:true}).first().isVisible(),label);
    await page.getByRole('link',{name:'Administración',exact:true}).click();await page.waitForURL('**/administracion/usuarios');
    const root=page.getByRole('row').filter({has:page.getByText('arielgarro',{exact:true})});await root.waitFor();
    assert(await root.getByRole('button',{name:'Editar',exact:true}).isDisabled());
    assert(await root.getByRole('button',{name:'Restablecer contraseña',exact:true}).isDisabled());
    await shot('usuarios-claro');
    await page.getByRole('button',{name:'Crear usuario',exact:true}).click();
    const dialog=page.getByRole('dialog');
    assert.equal(await dialog.getByRole('checkbox').count(),8,'El admin operativo no debe otorgar el rol Administrador');
    await dialog.getByLabel('Nombre de usuario *',{exact:true}).fill('operador.ui');
    await dialog.getByLabel('Nombre *',{exact:true}).fill('Operador');
    await dialog.getByLabel('Apellido',{exact:true}).fill('Interfaz');
    await dialog.getByLabel('Contraseña inicial *',{exact:true}).fill('Acceso-Cambios-682!');
    await dialog.getByLabel('Repetir contraseña *',{exact:true}).fill('Acceso-Cambios-682!');
    await dialog.getByRole('checkbox',{name:'Recibos de cambios y enlace a Stock de pallets',exact:true}).check();
    await dialog.getByRole('button',{name:'Guardar usuario',exact:true}).click();await dialog.waitFor({state:'hidden'});
    const row=page.getByRole('row').filter({has:page.getByText('operador.ui',{exact:true})});await row.waitFor();
    assert((await row.innerText()).includes('Recibos de cambios'));
    await row.getByRole('button',{name:'Editar',exact:true}).click();
    await dialog.getByLabel('Estado',{exact:true}).selectOption('false');
    await dialog.getByRole('button',{name:'Guardar usuario',exact:true}).click();await dialog.waitFor({state:'hidden'});
    assert((await row.innerText()).includes('Inactivo'));
    await row.getByRole('button',{name:'Editar',exact:true}).click();
    await dialog.getByLabel('Estado',{exact:true}).selectOption('true');
    await dialog.getByRole('checkbox',{name:'Rechazos',exact:true}).check();
    await dialog.getByRole('button',{name:'Guardar usuario',exact:true}).click();await dialog.waitFor({state:'hidden'});
    await row.getByRole('button',{name:'Restablecer contraseña',exact:true}).click();
    await dialog.getByLabel('Contraseña nueva *',{exact:true}).fill('Cambio-Validado-682!');
    await dialog.getByLabel('Repetir contraseña *',{exact:true}).fill('Cambio-Validado-682!');
    await dialog.getByRole('button',{name:'Restablecer contraseña',exact:true}).click();await dialog.waitFor({state:'hidden'});
    await page.getByRole('link',{name:'Catálogos',exact:true}).click();
    await page.getByLabel('Catálogo',{exact:true}).selectOption('concesionarios');
    await page.getByRole('button',{name:'Agregar registro',exact:true}).click();
    await dialog.getByLabel('Nombre *',{exact:true}).fill('Concesionario UI');
    await dialog.getByRole('button',{name:'Guardar cambios',exact:true}).click();await dialog.waitFor({state:'hidden'});
    const cat=page.getByRole('row').filter({has:page.getByText('Concesionario UI',{exact:true})});await cat.waitFor();
    await cat.getByRole('button',{name:'Editar',exact:true}).click();
    await dialog.getByLabel('Activo',{exact:true}).selectOption('false');
    await dialog.getByLabel('Motivo de la modificación *',{exact:true}).fill('Prueba de desactivación con trazabilidad');
    await dialog.getByRole('button',{name:'Guardar cambios',exact:true}).click();await dialog.waitFor({state:'hidden'});
    await shot('catalogos');
    await page.getByRole('link',{name:'Auditoría general',exact:true}).click();
    await page.getByText('Crear usuario',{exact:true}).first().waitFor();
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CSV',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'auditoria-sistema.csv');
    await page.getByRole('button',{name:'Ver detalle',exact:true}).first().click();
    assert(!(await dialog.innerText()).includes('Acceso-Cambios-682!'));assert(!(await dialog.innerText()).includes('Cambio-Validado-682!'));
    await page.getByRole('button',{name:'Cerrar ventana',exact:true}).click();
    await page.getByRole('button',{name:'Activar tema oscuro',exact:true}).click();await shot('auditoria-oscuro');
    for(const width of [1024,768,390]){
      await page.setViewportSize({width,height:900});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Desborde a ${width}`);
    }
    await page.setViewportSize({width:1440,height:1000});
    await logout();await login('operador.ui','Cambio-Validado-682!');
    assert.equal(await page.getByRole('link',{name:'Administración',exact:true}).count(),0);
    assert(await page.getByRole('link',{name:'Recibos de cambios',exact:true}).first().isVisible());
    assert(await page.getByRole('link',{name:'Rechazos',exact:true}).first().isVisible());
    assert.equal(await page.getByRole('link',{name:'Repartos y recargas',exact:true}).count(),0);
    await page.goto(app+'/administracion/usuarios');await page.getByRole('heading',{name:'No tenés acceso a esta sección',exact:true}).waitFor();
    assert.equal((await context.request.get(api+'/administracion/usuarios/')).status(),403);
    assert.equal((await context.request.get(api+'/repartos/')).status(),403);
    await page.goto(app+'/panel');await logout();await login('arielgarro');
    assert.equal(await page.getByRole('link',{name:'Administración',exact:true}).count(),0);
    assert(await page.getByRole('link',{name:'Repartos y recargas',exact:true}).first().isVisible());
    assert.equal((await context.request.get(api+'/administracion/usuarios/')).status(),403);
    await page.goto(app+'/administracion/usuarios');await page.getByRole('heading',{name:'No tenés acceso a esta sección',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('OK: administrador sin staff/superusuario, cuentas protegidas, crear/editar/asignar/desactivar/reactivar/restablecer, catálogos auditados, CSV, tema oscuro, responsive, login y logout CSRF, roles reales y URL directa bloqueada.');
  }catch(e){await shot('fallo');console.error(e);console.error(errors);process.exitCode=1;}finally{await browser.close();}
})();
