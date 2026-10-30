// Prueba la app en un Chromium del tamaño de un Pixel, sin tocar Google: las URL de Apps Script se contestan aquí mismo
// (Gym y Finanzas con los datos de ejemplo; Comidas con apps-script/Comidas.gs corriendo sobre una hoja de mentira).
//   node herramientas/probar.js [carpeta-para-capturas]
// Revisa: que no haya errores en la consola, Hoy, Comidas (lo de Gym, plan, resumen), metas (y que lleguen a Gym), conexión,
// que el plan y las metas guardados sin conexión se suban al conectar, que la app abra sin señal y los avisos de URL.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
global.CALC = require('../calculos.js');
const EJEMPLO = require('../ejemplo.js');
const { cargarScript } = require('../tests/hoja-falsa.js');

const RAIZ = path.join(__dirname, '..');
const SALIDA = process.argv[2] || path.join(RAIZ, 'capturas');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
let fallas = 0;
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fallas++; };

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const servidor = http.createServer((req, res) => {
    const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  }).listen(0);
  const base = 'http://localhost:' + servidor.address().port + '/';

  const hoja = cargarScript('secreta');
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, colorScheme: 'dark', locale: 'es-MX', timezoneId: 'America/Hermosillo', serviceWorkers: 'allow' });
  const errores = [];
  const pagina = await ctx.newPage();
  pagina.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  pagina.on('pageerror', e => errores.push(String(e)));
  // Apps Script de mentira. Gym: lo de ejemplo más una pestaña Comidas con 7 días (en la fecha de Hermosillo, como el celular)
  const hoyH = CALC.claveDia(new Date(Date.now() - 7 * 3600e3));
  const it = (h, m, n, p, c, f, k, id) => ({ h, m, n, q: 1, u: '', p, c, f, k, fib: 2, src: 'receta', ref: '', id });
  const gymComidas = {};
  for (let i = 0; i < 7; i++) {
    const f = CALC.sumarDias(hoyH, -i);
    gymComidas[f] = [it('07:30', 'd', 'Mi licuado', 40, 60, 10, 490, 'l' + i), it('14:10', 'c', 'Tupper: pollo, arroz y frijoles', 45, 80, 26, 750, 't' + i)]
      .concat(i ? [it('20:30', 'n', '2 quesadillas de harina', 23, 55, 21, 491, 'q' + i)] : []);
  }
  // Las metas que calcula la app Gym (script 8.1): Panel solo las muestra
  const gymMetas = { p: 120, kcal: 1850, c: 200, g: 59, fib: 25, auto: true, mant: 2300, porque: 'vas lento (0 %/sem)', deGym: true };
  let conPanelGs = true, llamadasCom = 0;
  const contestar = async ruta => {
    const u = ruta.request().url(), cuerpo = JSON.parse(ruta.request().postData() || '{}');
    let r;
    if (/GYMTEST/.test(u)) {
      if (cuerpo.k !== 'secreta') r = { ok: false, error: 'Clave incorrecta' };
      else if (cuerpo.action === 'data') r = { ok: true, result: Object.assign(EJEMPLO.gym(hoyH), { comidasDias: { [hoyH]: gymComidas[hoyH] }, metaProteina: gymMetas.p }) };
      else if (!conPanelGs || cuerpo.action !== 'comidasPanel') r = { ok: false, error: 'Acción desconocida' };
      else r = { ok: true, result: { dias: gymComidas, desde: CALC.sumarDias(hoyH, -41), hoy: hoyH, metas: gymMetas, version: 1 } };
    }
    else if (/FINTEST/.test(u)) r = cuerpo.k === 'secreta' ? { ok: true, result: Object.assign(EJEMPLO.finanzas(hoyH), { historial: [{ fecha: '2025-07-01', tipo: 'Gasto', monto: 1, categoria: 'X' }] }) } : { ok: false, error: 'Clave incorrecta' };
    else { llamadasCom++; r = hoja.post(cuerpo); }
    await ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
  };
  ctx.__ruta = contestar;
  await ctx.route('https://script.google.com/**', contestar);
  const foto = async nombre => { await pagina.waitForTimeout(350); await pagina.screenshot({ path: path.join(SALIDA, nombre + '.png'), fullPage: true }); };
  const texto = async () => pagina.locator('#view').innerText();

  // 1. Primera vez: Hoy con datos de ejemplo
  await pagina.goto(base);
  await pagina.waitForSelector('.hero.gym');
  let t = await texto();
  ok(/Hoy te toca|Hoy ya entrenaste|Hoy descansas/.test(t), 'Hoy muestra la rutina que toca');
  ok(/Patrimonio neto/.test(t) && /Te deben/.test(t) && /Debes/.test(t), 'Hoy muestra patrimonio y personas aparte');
  ok(/datos de ejemplo/.test(t), 'avisa que son datos de ejemplo');
  ok(/Carrera de 5 km/.test(t), 'cuenta regresiva a la carrera');
  ok(await pagina.locator('a.rapido[href*="martinrtx.github.io/Gym"]').count() === 1 && await pagina.locator('a.rapido[href*="accion=gasto"]').count() === 1, 'botones rápidos a Gym y Finanzas');
  await foto('1-hoy-oscuro');
  await pagina.emulateMedia({ colorScheme: 'light' });
  await foto('2-hoy-claro');

  // 2. Comidas sin Gym conectado: pide conectarlo; el + abre la app Gym
  await pagina.click('#tComidas');
  await pagina.waitForSelector('.anillo');
  ok(/se registra en tu app Gym/.test(await texto()), 'sin Gym: explica que lo que comes se registra en Gym');
  const [pedido] = await Promise.all([ctx.waitForEvent('request', { predicate: r => /martinrtx\.github\.io\/Gym/.test(r.url()), timeout: 5000 }).catch(() => null), pagina.click('nav .fab')]);
  ok(!!pedido, 'el + abre la app Gym');
  for (const pg of ctx.pages()) if (pg !== pagina) await pg.close();

  // 3. Plan semanal (sin Gym: tus platillos y la comida de mamá) y resumen
  await pagina.locator('.seg button', { hasText: 'Plan semanal' }).click();
  await pagina.locator('button', { hasText: 'Llenar con lo de siempre' }).click();
  await pagina.waitForTimeout(300);
  ok((await pagina.locator('.slot .n:not(.vacio)').count()) === 21, 'llenar la semana: 7 desayunos, 7 comidas y 7 cenas');
  await pagina.locator('.seg button', { hasText: 'Resumen' }).click();
  ok(/Conecta Gym/.test(await texto()), 'resumen sin Gym: pide conectarlo');

  // 4. Ajustes: tema oscuro, metas, conexión
  await pagina.click('.appbar .iconbtn');
  await pagina.waitForSelector('.sheet.show');
  await pagina.locator('.sheet .seg button', { hasText: 'Oscuro' }).click();
  await pagina.fill('#m-kcal', '2400');
  await pagina.locator('.sheet button', { hasText: 'Repartir el resto' }).click();
  ok(await pagina.inputValue('#m-c') !== '291', 'repartir recalcula carbs');
  await pagina.locator('.sheet button', { hasText: 'Guardar metas' }).click();
  await pagina.waitForTimeout(300);
  await foto('7-ajustes');
  for (const [f, u] of [['gym', 'GYMTEST'], ['fin', 'FINTEST'], ['com', 'COMTEST']]) {
    await pagina.fill('#u-' + f, 'https://script.google.com/macros/s/' + u + '/exec');
    await pagina.fill('#k-' + f, 'secreta');
    await pagina.locator('#u-' + f + ' ~ .btns .btn:not(.ghost)').click();
    await pagina.waitForTimeout(700);
  }
  await pagina.waitForFunction(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length === 0, null, { timeout: 15000 }).catch(() => {});
  ok(await pagina.evaluate(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length) === 0, 'al conectar Comidas se sube el plan y las metas');
  const d = hoja.post({ k: 'secreta', action: 'data', args: [30] }).result;
  ok(d.plan.length === 21 && d.metas && d.metas.kcal === 2400, 'la hoja Comidas 2026 tiene el plan y las metas (' + [d.plan.length, d.metas && d.metas.kcal].join(', ') + ')');
  await pagina.click('.sheet .grab .x');
  // Con Gym conectado, las metas son las que calcula Gym (Panel ya no las edita ni se las manda)
  await pagina.waitForFunction(() => metas().deGym, null, { timeout: 8000 }).catch(() => {});
  ok(await pagina.evaluate(() => metas().kcal === 1850 && metas().p === 120), 'las metas son las de Gym (1,850 kcal y 120 g)');
  await pagina.click('.appbar .iconbtn'); await pagina.waitForSelector('.sheet.show');
  const aj = await pagina.locator('.sheet').innerText();
  ok(/Las calcula tu app Gym/.test(aj) && /1,850 kcal/.test(aj) && !(await pagina.locator('#m-kcal').count()), 'Ajustes muestra las metas de Gym sin editarlas aquí');
  await pagina.click('.sheet .grab .x');

  // 5. Con Gym conectado: Hoy y Comidas muestran lo registrado en Gym
  await pagina.click('#tHoy');
  await pagina.waitForTimeout(800);
  t = await texto();
  ok(!/datos de ejemplo/.test(t) && /Patrimonio neto/.test(t), 'conectadas: Hoy ya no dice "ejemplo"');
  ok(/Comida de hoy/.test(t) && /1,240/.test(t), 'Hoy muestra la comida de hoy de Gym (1,240 kcal)');
  ok((await pagina.locator('#sync').innerText()).includes('Al día'), 'la pastilla dice "Al día"');
  await foto('8-hoy-conectado');
  await pagina.click('#tComidas');
  await pagina.locator('.seg button', { hasText: 'Día' }).click();
  await pagina.waitForTimeout(300);
  t = await texto();
  ok(/Mi licuado/.test(t) && /Tupper: pollo/.test(t) && /1,240/.test(t), 'Día: lo registrado en Gym con sus kcal');
  ok(/Tu plan de hoy/i.test(t), 'Día: el plan de hoy con lo que ya comiste');
  await foto('4-comidas-dia');
  await pagina.click('.daynav .arrow >> nth=0');
  ok(/quesadillas de harina/.test(await texto()), 'ayer: la cena registrada en Gym');
  await pagina.locator('.seg button', { hasText: 'Plan semanal' }).click();
  await pagina.locator('.slot').nth(4).click();     // martes, desayuno
  ok(/Lo que más comes/i.test(await pagina.locator('.sheet').innerText()), 'el plan ofrece lo que más comes en Gym');
  await pagina.locator('.sheet .it', { hasText: 'Mi licuado' }).click();
  await pagina.waitForTimeout(200);
  ok(/Mi licuado/.test(await texto()), 'elegir del plan algo que comes en Gym');
  await foto('5-plan');
  await pagina.locator('.seg button', { hasText: 'Resumen' }).click();
  await pagina.waitForTimeout(200);
  t = await texto();
  ok(/Promedio de calorías/.test(t) || /Los promedios cuentan los días completos/.test(t), 'resumen semanal con lo de Gym');
  await foto('6-resumen');

  // 6. Sin señal: la app abre con lo guardado
  await ctx.setOffline(true);
  await pagina.reload();
  await pagina.waitForSelector('#view .seg', { timeout: 8000 }).catch(() => {});
  await pagina.locator('.seg button', { hasText: 'Día' }).click().catch(() => {});
  ok(await pagina.locator('.anillo').count() === 1 && /Mi licuado/.test(await texto()), 'abre sin señal con lo último de Gym');
  await ctx.setOffline(false);

  // 7. URL equivocada (la de Gym pegada en Comidas, como en config.js con dos URL iguales): se avisa y no se pierde nada
  // Otro celular en limpio (otro contexto: nada guardado), con la URL de Gym también en Comidas
  const ctx2 = await navegador.newContext({ viewport: { width: 412, height: 915 }, colorScheme: 'dark', serviceWorkers: 'block' });
  await ctx2.route('https://script.google.com/**', ruta => ctx.__ruta(ruta));
  await ctx2.addInitScript(() => { if (!localStorage.getItem('pan_conexion')) localStorage.setItem('pan_conexion', JSON.stringify({
    gym: { url: 'https://script.google.com/macros/s/GYMTEST/exec', clave: 'secreta' }, com: { url: 'https://script.google.com/macros/s/GYMTEST/exec', clave: 'secreta' } })); });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errores.push(String(e)));
  const antes = llamadasCom;
  await p2.goto(base);
  await p2.waitForSelector('.hero.gym');
  await p2.click('#tComidas');
  await p2.locator('.seg button', { hasText: 'Plan semanal' }).click();
  await p2.locator('button', { hasText: 'Llenar con lo de siempre' }).click();
  await p2.waitForTimeout(2500);
  ok((await p2.locator('#sync').innerText()).includes('Revisa Comidas'), 'Comidas con la URL de Gym: la pastilla avisa');
  ok(await p2.evaluate(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length) > 0 && llamadasCom === antes, 'no se manda nada al script equivocado y la cola se conserva');
  await p2.click('#tHoy');
  ok(/tienen la misma URL/.test(await p2.locator('#view').innerText()), 'Hoy avisa que dos partes tienen la misma URL');
  await p2.click('.appbar .iconbtn');
  ok(/es la de tu script de Gym, no la de Comidas/.test(await p2.locator('.sheet').innerText()), 'Ajustes explica cuál URL está mal');
  // Al corregirla se sube todo
  await p2.fill('#u-com', 'https://script.google.com/macros/s/COMTEST2/exec');
  await p2.locator('#u-com ~ .btns .btn:not(.ghost)').click();
  await p2.waitForFunction(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length === 0, null, { timeout: 15000 }).catch(() => {});
  ok(await p2.evaluate(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length) === 0, 'al corregir la URL se sube lo pendiente');

  // 8. Script de Gym sin Panel.gs: solo hoy y ayer (lo que ya manda la app Gym) y un aviso
  conPanelGs = false;
  const ctx3 = await navegador.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
  await ctx3.route('https://script.google.com/**', ruta => ctx.__ruta(ruta));
  await ctx3.addInitScript(() => { if (!localStorage.getItem('pan_conexion')) localStorage.setItem('pan_conexion', JSON.stringify({
    gym: { url: 'https://script.google.com/macros/s/GYMTEST/exec', clave: 'secreta' } })); });
  const p3 = await ctx3.newPage();
  p3.on('pageerror', e => errores.push(String(e)));
  await p3.goto(base);
  await p3.waitForSelector('.hero.gym');
  await p3.click('#tComidas');
  await p3.waitForTimeout(1500);
  const t3 = await p3.locator('#view').innerText();
  ok(/Panel\.gs/.test(t3) && /Mi licuado/.test(t3), 'sin Panel.gs: muestra hoy (de la app Gym) y avisa qué agregar');

  ok(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await navegador.close();
  servidor.close();
  console.log(fallas ? '\n' + fallas + ' fallas' : '\nTodo bien. Capturas en ' + SALIDA);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
