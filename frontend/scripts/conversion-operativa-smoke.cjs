// Exclusivamente core.smoke_conversion: SQLite efímero, sin PostgreSQL real.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_BROWSER});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.routeWebSocket('**',()=>{});
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('dialog',d=>d.accept());
  const output=path.join(__dirname,'..','test-artifacts');fs.mkdirSync(output,{recursive:true});
  try{
    assert.equal((await context.request.post('http://127.0.0.1:8769/api/auth/login/',{data:{username:'conversion_smoke',password:'Conversion-local-123!'}})).status(),200);
    const api='http://127.0.0.1:8769/api';
    const r=await(await context.request.get(api+'/repartos/')).json();assert.equal(r.length,905);
    const x=await(await context.request.get(api+'/rechazos/')).json();assert.equal(x.length,61);
    const c=await(await context.request.get(api+'/cambios/recibos/')).json();assert.equal(c.length,87);
    assert(r.every(v=>v.recargas_autorizadas===true));
    for(const [route,count,link] of [['/repartos',905,'Editar'],['/rechazos',61,'Editar'],['/cambios',87,'Ver detalle']]){
      await page.goto('http://127.0.0.1:5179'+route);
      await page.getByText(`${count} registros`,{exact:true}).waitFor();
      assert.equal(await page.getByRole('link',{name:link,exact:true}).count(),count);
      assert(!/histórico de planilla|recibos operativos|rechazos operativos|repartos operativos/i.test(await page.locator('main').innerText()));
      await page.screenshot({path:path.join(output,'normales-'+route.slice(1)+'.png')});
    }
    const autorizado=r.find(v=>v.fecha==='2026-02-21'&&v.personal.find(p=>p.rol==='CHOFER')?.empleado_nombre==='TORRES LEONARDO JESUS');
    assert(autorizado);assert.equal(autorizado.recargas,3);assert.equal(autorizado.recargas_totales,12);
    await page.goto(`http://127.0.0.1:5179/repartos/${autorizado.id}/editar`);
    await page.getByText('Este reparto tiene recargas autorizadas en Drive:',{exact:false}).waitFor();
    await page.locator('textarea').fill('Observación editada sin recalcular autorización');
    await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
    await page.waitForURL('**/repartos');
    const editado=await(await context.request.get(`${api}/repartos/${autorizado.id}/`)).json();
    assert.equal(editado.recargas,3);assert.equal(editado.recargas_totales,12);
    assert.equal(editado.observaciones,'Observación editada sin recalcular autorización');
    await page.goto(`http://127.0.0.1:5179/rechazos/${x[0].id}/editar`);await page.locator('input').first().waitFor();
    await page.goto(`http://127.0.0.1:5179/cambios/recibos/${c[0].id}`);await page.getByRole('link',{name:/Editar/}).waitFor();
    await page.goto('http://127.0.0.1:5179/repartos/recargas');
    const dates=page.locator('input[type=date]');await dates.nth(0).fill('2026-01-01');await dates.nth(1).fill('2026-12-31');
    await page.getByRole('button',{name:'Generar reporte',exact:true}).last().click();await page.locator('.resumen-reporte').waitFor();
    const reporte=await(await context.request.get(api+'/repartos/reporte-recargas/?desde=2026-01-01&hasta=2026-12-31')).json();
    assert.equal(reporte.total_general,r.reduce((s,v)=>s+v.recargas_totales,0));
    assert.equal(reporte.total_por_empleados,r.reduce((s,v)=>s+v.recargas*v.cantidad_personas,0));
    if(reporte.diferencia_autorizada)await page.getByText('Los totales autorizados de Drive difieren',{exact:false}).waitFor();
    await page.getByRole('button',{name:'Resúmenes guardados de Drive',exact:true}).click();await page.getByLabel('Período original',{exact:false}).waitFor();
    await page.goto('http://127.0.0.1:5179/cambios/estadisticas');await page.getByRole('button',{name:'Resumen guardado de Drive',exact:true}).click();await page.locator('.hc-hoja-original tbody tr').nth(96).waitFor();
    await page.goto('http://127.0.0.1:5179/rechazos/estadisticas');await page.locator('input[type=date]').first().waitFor();
    assert(!/histórico/i.test(await page.locator('main').innerText()));
    await page.goto('http://127.0.0.1:5179/panel');
    for(const [label,value] of [['Repartos registrados','905'],['Rechazos registrados','61'],['Recibos registrados','87']])await page.locator('.dashboard-kpi-card').filter({has:page.getByText(label,{exact:true})}).getByText(value,{exact:true}).waitFor();
    assert(!/históricos/i.test(await page.locator('main').innerText()));
    await page.goto('http://127.0.0.1:5179/cambios');await page.getByText('87 registros',{exact:true}).waitFor();
    for(const width of [1366,1024,768,390]){await page.setViewportSize({width,height:1000});if(await page.locator('.sidebar.sidebar-open').count())await page.locator('.sidebar-open .sidebar-close').click();if(width<940)await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    assert.deepEqual(errors,[]);
    console.log('OK: 905/61/87 registros en rutas normales, edición real conserva recargas Drive, reportes y totales autorizados, resumen guardado, panel, responsive y consola.');
  }catch(e){await page.screenshot({path:path.join(output,'conversion-fallo.png'),fullPage:false});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
