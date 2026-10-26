// APIs simuladas; no modifica la BD ni envía correos reales. Vite en 5181 y VITE_API_URL en 8771.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_BROWSER, headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errores = [];
    page.on("pageerror",e=>errores.push(e.message));
    await page.routeWebSocket("**",()=>{});
    await page.route("https://fonts.googleapis.com/**",r=>r.fulfill({contentType:"text/css",body:""}));
    const destinos = [
      ["Gatica / C. Araujo",110], ["Martins",12], ["Tunuyán",154], ["Aibak / Las Heras",30],
      ["Marthos / Luján",30], ["Sharp / Mai-Gua",5], ["Muedaz",20], ["Porro",20], ["G. Cruz",20],
    ].map(([nombre,distancia_km],i)=>({id:i+1,nombre,distancia_km:String(distancia_km),activo:true}));
    let control = null, fallar = true, envios = 0;
    const guardados = [], corregidos = [];
    const total = registros => registros.reduce((s,r)=>s+r.cantidad_viajes*Number(destinos.find(d=>d.id===r.destino).distancia_km),0).toFixed(2);
    await page.route("http://127.0.0.1:8771/api/**", async r => {
      const req = r.request(), p = new URL(req.url()).pathname;
      const headers = {"Access-Control-Allow-Origin":"http://127.0.0.1:5181","Access-Control-Allow-Credentials":"true",
        "Access-Control-Allow-Headers":"Content-Type,X-CSRFToken","Access-Control-Allow-Methods":"GET,POST,PUT,OPTIONS"};
      const responder = (json,status=200)=>r.fulfill({json,status,headers});
      if(req.method()==="OPTIONS") return r.fulfill({status:204,headers});
      if(p==="/api/auth/usuario/") return responder({autenticado:true,id:1,username:"prueba",first_name:"Operador",last_name:"Prueba",nombre_completo:"Operador Prueba",es_administrador:true,puede_administrar:true,es_superusuario:false,es_staff:false,grupos:["ADMINISTRADOR"]});
      if(p==="/api/maestros/choferes/") return responder([{id:1,nombre:"OLGUIN",activo:true,disponible:true}]);
      if(p==="/api/kilometrajes/destinos/") return responder(destinos);
      if(p==="/api/kilometrajes/" && req.method()==="GET") return responder(control?[control]:[]);
      if(p==="/api/kilometrajes/" && req.method()==="POST") {
        const body=req.postDataJSON(); guardados.push(body);
        if(fallar) return responder({error:"Error de prueba; los datos se conservan"},400);
        control={...body,id:41,chofer_nombre:"OLGUIN",version:1,estado:"BORRADOR",columnas:destinos,
          total_km:total(body.registros),envio_estado:"PENDIENTE",enviado_en:null,error_envio:""};
        return responder(control,201);
      }
      if(p==="/api/kilometrajes/41/" && req.method()==="GET") return responder(control);
      if(p==="/api/kilometrajes/41/" && req.method()==="PUT") {
        const body=req.postDataJSON(); corregidos.push(body);
        assert.equal(body.version,control.version);
        control={...control,...body,version:control.version+1,total_km:total(body.registros),estado:"BORRADOR",envio_estado:"PENDIENTE",enviado_en:null};
        return responder(control);
      }
      if(p==="/api/kilometrajes/41/finalizar/") {
        const body=req.postDataJSON(); assert.equal(body.confirmar,true); assert.equal(body.version,control.version);
        envios++;
        control={...control,estado:"FINALIZADA",envio_estado:"ENVIADO",enviado_en:"2026-10-26T12:00:00Z"};
        return responder(control);
      }
      if(p.includes("/exportar/")) return r.fulfill({headers,contentType:p.includes("xlsx")?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/pdf",body:Buffer.from("archivo de prueba")});
      return responder([]);
    });
    await page.goto("http://127.0.0.1:5181/kilometrajes/nuevo");
    await page.getByLabel("Chofer",{exact:true}).waitFor({timeout:10000}).catch(async e=>{console.error("DEBUG",page.url(),errores,await page.locator("body").innerText());throw e;});
    await page.getByLabel("Chofer",{exact:true}).selectOption("1");
    await page.getByLabel("Desde",{exact:true}).fill("2026-08-26");
    await page.getByLabel("Hasta",{exact:true}).fill("2026-09-25");
    await page.getByRole("button",{name:"Abrir planilla",exact:true}).click();
    await page.locator(".pk-tabla").waitFor();
    assert.equal(await page.locator(".pk-tabla tbody tr").count(),31); // Incluye el 31 de agosto, faltante en el ejemplo.
    await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).fill("29");
    await page.getByLabel("05/09/2026 · Gatica / C. Araujo · viajes",{exact:true}).fill("2");
    await page.getByLabel("12/09/2026 · Marthos / Luján · viajes",{exact:true}).fill("1");
    await page.getByLabel("01/09/2026 · Porro · viajes",{exact:true}).fill("1");
    assert.equal(await page.locator(".pk-total output").innerText(),"415 km");
    assert.equal(guardados.length,0);
    await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).press("Enter");
    assert.equal(await page.getByLabel("28/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).evaluate(el=>el===document.activeElement),true);
    assert.equal(guardados.length,0,"Enter mueve la celda; no guarda la planilla");
    await page.getByRole("button",{name:"Guardar borrador",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"No se guardó"}).waitFor();
    assert.equal(await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).inputValue(),"29");
    fallar=false;
    await page.getByRole("button",{name:"Guardar borrador",exact:true}).click();
    await page.waitForURL("**/kilometrajes/41");
    assert.equal(control.total_km,"415.00");
    const download=page.waitForEvent("download");
    await page.getByRole("button",{name:"Descargar Excel",exact:true}).click();
    assert.equal((await download).suggestedFilename(),"kilometraje-41.xlsx");
    await page.reload();
    await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).waitFor();
    assert.equal(await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).inputValue(),"29");
    await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).fill("30");
    assert.equal(await page.getByRole("button",{name:"Finalizar y enviar",exact:true}).isDisabled(),true);
    await page.getByLabel("Motivo de la modificación *",{exact:true}).fill("Agregar un viaje");
    await page.getByRole("button",{name:"Guardar borrador",exact:true}).click();
    await page.getByText("Borrador guardado · versión 2",{exact:true}).waitFor();
    assert.equal(corregidos.length,1);
    assert.equal(control.total_km,"420.00");
    await page.getByRole("button",{name:"Finalizar y enviar",exact:true}).click();
    assert.equal(envios,0);
    await page.getByRole("button",{name:"Sí, finalizar y enviar",exact:true}).click();
    await page.getByRole("status").filter({hasText:"aceptó el envío"}).waitFor();
    assert.equal(envios,1);
    assert.equal(await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).isDisabled(),true);
    await page.getByRole("button",{name:"Editar esta planilla",exact:true}).click();
    assert.equal(await page.getByLabel("27/08/2026 · Sharp / Mai-Gua · viajes",{exact:true}).isEnabled(),true);
    const out=path.join(__dirname,"..","test-artifacts"); fs.mkdirSync(out,{recursive:true});
    for(const width of [1440,768,390]) {
      await page.setViewportSize({width,height:1000});
      for(const theme of ["light","dark"]) {
        await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,`Overflow ${width} ${theme}: `+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(e=>[e.tagName,e.className,e.getBoundingClientRect().width]))));
        const scroll=await page.locator(".pk-scroll").evaluate(el=>({w:el.clientWidth,total:el.scrollWidth}));
        assert.ok(scroll.total>scroll.w,`Barra horizontal ${width}`);
        await page.screenshot({path:path.join(out,`planilla-km-${width}-${theme}.png`),fullPage:true});
      }
    }
    await page.goto("http://127.0.0.1:5181/kilometrajes/nuevo");
    await page.getByLabel("Chofer",{exact:true}).selectOption("1");
    await page.getByLabel("Desde",{exact:true}).fill("2026-08-26");
    await page.getByLabel("Hasta",{exact:true}).fill("2026-09-25");
    await page.getByRole("button",{name:"Abrir planilla",exact:true}).click();
    await page.waitForURL("**/kilometrajes/41");
    assert.equal(guardados.length,2,"Abrir existente no vuelve a crear");
    assert.deepEqual(errores,[]);
    console.log("OK: matriz 31 días, 415 km, borrador, error sin perder datos, reapertura, edición, bloqueo hasta guardar, confirmación de envío, descargas y claro/oscuro 1440/768/390 sin overflow.");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
