// Prueba la app en un Chromium del tamaño de un Pixel, sin tocar Google: las URL de Apps Script se contestan aquí mismo
// (Gym y Finanzas con los datos de ejemplo; Comidas con apps-script/Comidas.gs corriendo sobre una hoja de mentira).
//   node herramientas/probar.js [carpeta-para-capturas]
// Revisa: que no haya errores en la consola, Hoy, Comidas (un toque, mamá, a mano, plan, resumen), metas, conexión,
// que lo registrado sin conexión se suba al conectar, y que la app abra sin señal.
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
  // Apps Script de mentira
  let llamadasCom = 0;
  await ctx.route('https://script.google.com/**', async ruta => {
    const u = ruta.request().url(), cuerpo = JSON.parse(ruta.request().postData() || '{}');
    let r;
    if (/GYMTEST/.test(u)) r = cuerpo.k === 'secreta' ? { ok: true, result: EJEMPLO.gym(CALC.claveDia(new Date())) } : { ok: false, error: 'Clave incorrecta' };
    else if (/FINTEST/.test(u)) r = cuerpo.k === 'secreta' ? { ok: true, result: Object.assign(EJEMPLO.finanzas(CALC.claveDia(new Date())), { historial: [{ fecha: '2025-07-01', tipo: 'Gasto', monto: 1, categoria: 'X' }] }) } : { ok: false, error: 'Clave incorrecta' };
    else { llamadasCom++; r = hoja.post(cuerpo); }
    await ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
  });
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

  // 2. Comidas: un toque, comida de mamá, a mano
  await pagina.click('#tComidas');
  await pagina.waitForSelector('.anillo');
  await pagina.locator('.comida-acc button.una', { hasText: 'Licuado' }).first().click();
  await pagina.waitForTimeout(200);
  ok(/371/.test(await pagina.locator('.anillo').innerText()), 'el licuado de un toque suma 371 kcal');
  await pagina.locator('.comida-acc button.una', { hasText: 'Comida de mamá' }).click();
  await pagina.waitForSelector('.sheet.show');
  await pagina.locator('.sheet .pick button', { hasText: 'Res' }).click();
  await pagina.locator('.sheet button.switch').click();
  await pagina.fill('.sheet input[placeholder^="Nombre"]', 'Bistec en salsa de mamá');
  await foto('3-casera');
  await pagina.locator('.sheet .actbar .btn').click();
  await pagina.waitForTimeout(400);
  ok(/Bistec en salsa de mamá/.test(await texto()), 'comida de mamá registrada y guardada como favorita');
  await pagina.click('nav .fab');
  await pagina.waitForSelector('.sheet.show');
  await pagina.locator('.sheet .pick button', { hasText: 'Snacks' }).click();
  await pagina.locator('.sheet .seg button', { hasText: 'A mano' }).click();
  await pagina.locator('.sheet .quick button', { hasText: 'Yogurt griego' }).click();
  await pagina.locator('.sheet .actbar .btn').click();
  await pagina.waitForTimeout(400);
  t = await texto();
  ok(/Yogurt griego/.test(t), 'snack a mano con relleno rápido');
  await foto('4-comidas-dia');
  // Editar porción
  await pagina.locator('.it button.tx', { hasText: 'Yogurt griego' }).click();
  await pagina.locator('.sheet .pick button', { hasText: '×2' }).click();
  await pagina.locator('.sheet .actbar .btn:not(.danger)').click();
  await pagina.waitForTimeout(300);
  ok(/Yogurt griego ×2/.test(await texto()), 'editar porción ×2');

  // 3. Plan semanal y resumen
  await pagina.locator('.seg button', { hasText: 'Plan semanal' }).click();
  await pagina.locator('button', { hasText: 'Llenar con lo de siempre' }).click();
  await pagina.waitForTimeout(300);
  ok((await pagina.locator('.slot .n:not(.vacio)').count()) === 21, 'llenar la semana: 7 desayunos, 7 comidas y 7 cenas');
  await foto('5-plan');
  await pagina.locator('.seg button', { hasText: 'Resumen' }).click();
  await pagina.waitForTimeout(200);
  ok(/Promedio de calorías|Hoy llevas/.test(await texto()), 'resumen semanal');
  await foto('6-resumen');
  await pagina.locator('.seg button', { hasText: 'Día' }).click();
  ok(await pagina.locator('.quick button', { hasText: 'quesadillas' }).count() >= 1, 'el plan de hoy aparece para registrarlo de un toque');

  // 4. Ajustes: tema oscuro, metas, conexión
  await pagina.click('.appbar .iconbtn');
  await pagina.waitForSelector('.sheet.show');
  await pagina.locator('.sheet .seg button', { hasText: 'Oscuro' }).click();
  await pagina.fill('#m-kcal', '2400');
  await pagina.locator('.sheet button', { hasText: 'Repartir el resto' }).click();
  ok(await pagina.inputValue('#m-c') !== '291', 'repartir recalcula carbs');
  await pagina.locator('.sheet button', { hasText: 'Guardar metas' }).click();
  await foto('7-ajustes');
  const pendientes = await pagina.evaluate(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length);
  ok(pendientes > 0, 'sin conexión, los cambios esperan en el celular (' + pendientes + ')');
  // Conectar las tres
  for (const [f, u] of [['gym', 'GYMTEST'], ['fin', 'FINTEST'], ['com', 'COMTEST']]) {
    await pagina.fill('#u-' + f, 'https://script.google.com/macros/s/' + u + '/exec');
    await pagina.fill('#k-' + f, 'secreta');
    await pagina.locator('#u-' + f + ' ~ .btns .btn:not(.ghost)').click();
    await pagina.waitForTimeout(700);
  }
  await pagina.waitForFunction(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length === 0, null, { timeout: 15000 }).catch(() => {});
  ok(await pagina.evaluate(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length) === 0, 'al conectar Comidas se sube todo lo pendiente');
  const d = hoja.post({ k: 'secreta', action: 'data', args: [30] }).result;
  ok(d.registro.length === 3 && d.guardadas.length === 3 && d.plan.length === 21 && d.metas && d.metas.kcal === 2400,
    'la hoja quedó con 3 registros, 3 guardadas (licuado, quesadillas y la de mamá), 21 del plan y metas de 2400 (' + [d.registro.length, d.guardadas.length, d.plan.length, d.metas && d.metas.kcal].join(', ') + ')');
  ok(d.registro.some(r => r.nombre === 'Yogurt griego' && r.porcion === 2), 'la edición de porción llegó a la hoja');
  await pagina.click('.sheet .grab .x');
  await pagina.click('#tHoy');
  await pagina.waitForTimeout(500);
  t = await texto();
  ok(!/datos de ejemplo/.test(t) && /Patrimonio neto/.test(t), 'conectadas: Hoy ya no dice "ejemplo"');
  ok((await pagina.locator('#sync').innerText()).includes('Al día'), 'la pastilla dice "Al día"');
  await foto('8-hoy-conectado');

  // 5. Otro celular registró algo: al volver a abrir, se baja
  const hoyNav = await pagina.evaluate(() => hoy());     // la fecha del celular (su zona horaria)
  hoja.post({ k: 'secreta', action: 'batch', args: [[{ id: 'x', action: 'guardarRegistro', args: [{ id: 'otro1', fecha: hoyNav, comida: 'snack', nombre: 'Manzana', kcal: 94, p: 0.5, c: 25, g: 0.4 }] }]] });
  await pagina.reload();
  await pagina.click('#tComidas');
  await pagina.waitForTimeout(1200);
  ok(/Manzana/.test(await texto()), 'lo registrado en la hoja desde otro lado aparece');

  // 6. Sin señal: la app abre con lo guardado
  await ctx.setOffline(true);
  await pagina.reload();
  await pagina.waitForSelector('.anillo', { timeout: 8000 }).catch(() => {});
  ok(await pagina.locator('.anillo').count() === 1, 'abre sin señal (service worker)');
  await pagina.locator('.comida-acc button', { hasText: '+ Agregar' }).first().click();
  await pagina.locator('.sheet .it button.tx').first().click();
  await pagina.waitForTimeout(300);
  ok((await pagina.locator('#sync').innerText()).includes('sin subir'), 'sin señal: el cambio queda pendiente');
  await ctx.setOffline(false);
  await pagina.evaluate(() => window.dispatchEvent(new Event('online')));
  await pagina.waitForFunction(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length === 0, null, { timeout: 15000 }).catch(() => {});
  ok(await pagina.evaluate(() => JSON.parse(localStorage.getItem('pan_cola') || '[]').length) === 0, 'al volver la señal se sube');

  ok(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await navegador.close();
  servidor.close();
  console.log(fallas ? '\n' + fallas + ' fallas' : '\nTodo bien. Capturas en ' + SALIDA);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
