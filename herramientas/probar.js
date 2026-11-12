// Prueba la app en un Chromium del tamaño de un Pixel, sin tocar Google: las URL de Apps Script se contestan aquí mismo
// (Gym y Finanzas con los datos de ejemplo; Comidas con apps-script/Comidas.gs corriendo sobre una hoja de mentira).
//   node herramientas/probar.js [carpeta-para-capturas]
// Revisa: que no haya errores en la consola, Hoy, hábitos, objetivos y la revisión de la semana, Comidas (lo de Gym, plan, resumen), metas, conexión,
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
  // CAMBIOS['/app.js'] = texto => nuevo: simula que se publicó un archivo distinto (prueba del service worker)
  const CAMBIOS = {};
  const servidor = http.createServer((req, res) => {
    const ruta = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(RAIZ, ruta.replace(/\/$/, '/index.html'));
    if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(CAMBIOS[ruta] ? CAMBIOS[ruta](fs.readFileSync(f, 'utf8')) : fs.readFileSync(f));
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
  const gymMetas = { p: 120, kcal: 1850, c: 200, g: 59, fib: 25, auto: true, mant: 2300, mantReal: 1850, porque: 'vas lento (0 %/sem)', deGym: true };
  // conPanel: script de Gym 8.9+ (acción "panel": todo en una llamada). conPanelGs: script 8.1+ (comidasPanel aparte)
  let conPanel = true, conPanelGs = true, llamadasCom = 0;
  const llamadasGym = [], dispositivos = new Set();
  const paquetePanel = () => {
    const d = EJEMPLO.gym(hoyH), g = CALC.gymHoy(d, hoyH, 4);
    return { version: 2, scriptVersion: '8.9', todayKey: d.todayKey, sugGrupo: d.sugGrupo, ultimoGrupo: d.ultimoGrupo, ultimoGrupoFecha: d.ultimoGrupoFecha, dias: d.dias, ultimoPeso: d.ultimoPeso,
      descargaCarrera: g.semanaCarrera, carrera: Object.assign({ km: 5 }, d.carrera),
      hoy: { grupo: g.grupo, entreno: g.entreno, proximo: g.proximo, descansa: g.descansa, semanaCarrera: g.semanaCarrera, visperaCarrera: g.visperaCarrera, diaCarrera: g.diaCarrera },
      resumen: d.resumen, trotes: d.trotes, cuerpo: d.cuerpo,
      comidas: { dias: gymComidas, desde: CALC.sumarDias(hoyH, -41), hoy: hoyH, metas: gymMetas, version: 1 } };
  };
  const contestar = async ruta => {
    const u = ruta.request().url(), cuerpo = JSON.parse(ruta.request().postData() || '{}');
    let r;
    if (/GYMTEST/.test(u)) {
      llamadasGym.push(cuerpo.action);
      if (!/^[0-9a-f]{32}$/.test(cuerpo.d || '')) dispositivos.add('FALTA'); else dispositivos.add(cuerpo.d);
      if (cuerpo.k !== 'secreta') r = { ok: false, error: 'Clave incorrecta' };
      else if (cuerpo.action === 'panel' && conPanel) r = { ok: true, result: paquetePanel() };
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
  ok(llamadasGym.includes('panel') && !llamadasGym.includes('data') && !llamadasGym.includes('comidasPanel'),
    'Gym se lee en UNA llamada (panel), sin bajar el paquete completo de la app (' + [...new Set(llamadasGym)].join(', ') + ')');
  ok(await pagina.evaluate(() => DATOS.gym.d.hoy && CALC.gymHoy(DATOS.gym.d, hoy(), 4).deGym === true && !DATOS.gym.d.exercises), 'la rutina de hoy es la que decidió Gym');
  ok(dispositivos.size === 1 && !dispositivos.has('FALTA') && await pagina.evaluate(() => JSON.parse(localStorage.getItem('pan_disp')) === dispositivo()),
    'cada llamada lleva el identificador de este celular (siempre el mismo)');
  await pagina.click('.appbar .iconbtn'); await pagina.waitForSelector('.sheet.show');
  const aj = await pagina.locator('.sheet').innerText();
  ok(/Las calcula tu app Gym/.test(aj) && /1,850 kcal/.test(aj) && !(await pagina.locator('#m-kcal').count()), 'Ajustes muestra las metas de Gym sin editarlas aquí');
  ok(/mantenimiento real anda en ~1,850 kcal \(bastante menos/.test(aj), 'Ajustes muestra el mantenimiento real');
  // Platillo nuevo: las casillas (data-input) y los botones (data-click) del editor funcionan sin JS en el HTML
  await pagina.click('.sheet .it:has-text("Nuevo platillo")');
  await pagina.fill('.sheet input[placeholder^="p. ej."]', 'Molletes de prueba');
  await pagina.fill('.sheet .g4 input >> nth=0', '420');
  await pagina.click('.sheet .switch');
  await pagina.click('.sheet .actbar .btn:has-text("Guardar")');
  await pagina.waitForTimeout(300);
  const subio = await pagina.waitForFunction(() => !JSON.parse(localStorage.getItem('pan_cola') || '[]').length, null, { timeout: 8000 }).then(() => true).catch(() => false);
  ok(subio && await pagina.evaluate(() => DB.guardadas.some(g => g.nombre === 'Molletes de prueba' && Number(g.kcal) === 420 && g.fav === false)) &&
    (hoja.post({ k: 'secreta', action: 'data', args: [30] }).result.guardadas || []).some(g => g.nombre === 'Molletes de prueba'), 'editor de platillos: escribir, interruptor, guardar y subir a la hoja');
  if (await pagina.locator('.sheet.show').count()) await pagina.click('.sheet .grab .x');

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

  // 5b. Hábitos y objetivos (se suben a la hoja) y la revisión de la semana
  await pagina.click('#tHoy');
  await pagina.waitForSelector('.card.hab');
  await pagina.locator('.hab .habrow:has-text("Agua") .chip', { hasText: 'Sí' }).click();
  await pagina.locator('.hab .habrow:has-text("Dormí") .chip', { hasText: '7' }).click();
  await pagina.locator('.hab .habrow:has-text("Ánimo") .chip >> nth=3').click();
  await pagina.locator('.hab .chip.mas').click();
  await pagina.waitForSelector('#nuevoHab');
  await pagina.fill('#nuevoHab', 'Leer 10 min');
  await pagina.locator('.sheet .btn', { hasText: 'Agregar' }).click();
  ok(/Leer 10 min/.test(await pagina.locator('.sheet').innerText()), 'Ajustes: agregar un hábito propio');
  await pagina.click('.sheet .grab .x');
  await pagina.locator('.hab .chip', { hasText: 'Leer 10 min' }).click();
  await pagina.waitForTimeout(300);
  ok(await pagina.evaluate(() => { const h = habitoDe(hoy()); return h.agua === true && h.sueno === 7 && h.animo === 4 && h.extras.join() === 'Leer 10 min'; }), 'hábitos de hoy: agua, sueño, ánimo y uno propio');
  await pagina.locator('.hab .seg.mini .chip', { hasText: 'Ayer' }).click();
  await pagina.locator('.hab .habrow:has-text("Dormí") .chip', { hasText: '6' }).click();
  ok(await pagina.evaluate(() => habitoDe(sumarDias(hoy(), -1)).sueno === 6 && habitoDe(hoy()).sueno === 7), 'hábitos: también se marca ayer');
  await pagina.locator('.hab .seg.mini .chip', { hasText: 'Hoy' }).click();
  await foto('9-habitos');
  // Revisión y un objetivo nuevo
  await pagina.evaluate(() => abrirRevision());
  await pagina.waitForSelector('.sheet.show');
  let rv = await pagina.locator('.sheet').innerText();
  ok(/gym y cuerpo/i.test(rv) && /dinero/i.test(rv) && /hábitos/i.test(rv) && /comida/i.test(rv), 'revisión: gym, comida, dinero y hábitos');
  ok(/Días de gym/.test(rv) && /Gastaste/.test(rv), 'revisión: días de gym y lo que gastaste');
  await foto('10-revision');
  await pagina.locator('.sheet #rev-objetivos + .card .pick button', { hasText: 'Entrenar' }).click();
  await pagina.locator('.sheet .stepper button', { hasText: '＋' }).click();
  await pagina.locator('.sheet .actbar .btn', { hasText: 'Agregar' }).click();
  await pagina.locator('.sheet #rev-objetivos + .card .pick button', { hasText: 'Otro' }).click();
  await pagina.fill('#noTexto', 'Llamar a mi abuela');
  await pagina.locator('.sheet .actbar .btn', { hasText: 'Agregar' }).click();
  await pagina.waitForTimeout(300);
  ok(await pagina.evaluate(() => { const o = objetivosDe(lunesObjetivos()); return o.length === 2 && o[0].tipo === 'gym' && o[0].meta === CONFIG.META_DIAS_GYM + 1 && o[1].texto === 'Llamar a mi abuela'; }), 'revisión: elegir objetivos (Entrenar 5 días y uno libre)');
  await foto('11-objetivos');
  await pagina.click('.sheet .grab .x');
  const subioHab = await pagina.waitForFunction(() => !JSON.parse(localStorage.getItem('pan_cola') || '[]').length, null, { timeout: 10000 }).then(() => true).catch(() => false);
  const dh = hoja.post({ k: 'secreta', action: 'data', args: [30] }).result;
  ok(subioHab && dh.habitos.length === 2 && dh.objetivos.length === 2 && dh.habitos.some(h => h.extras.join() === 'Leer 10 min'), 'hábitos y objetivos llegan a la hoja (' + dh.habitos.length + ' días, ' + dh.objetivos.length + ' objetivos)');
  // Con un script de Comidas viejo (1) los hábitos esperan en la cola: no se mandan ni se pierden
  ok(await pagina.evaluate(() => { localStorage.setItem('pan_com_v', '1'); const r = !enviable({ action: 'guardarHabito' }) && enviable({ action: 'guardarPlan' }); localStorage.setItem('pan_com_v', '2'); return r; }),
    'script de Comidas 1: hábitos y objetivos esperan en la cola');
  // Objetivos de esta semana en Hoy (si la revisión los puso para esta semana)
  if (await pagina.evaluate(() => lunesObjetivos() === lunesDe(hoy()))) ok(/Objetivos de la semana/.test(await texto()), 'Hoy muestra los objetivos de la semana con su avance');
  await foto('12-hoy-objetivos');
  await pagina.click('#tComidas');

  // 6. Sin señal: la app abre con lo guardado
  await ctx.setOffline(true);
  await pagina.reload();
  await pagina.waitForSelector('#view .seg', { timeout: 8000 }).catch(() => {});
  await pagina.locator('.seg button', { hasText: 'Día' }).click().catch(() => {});
  ok(await pagina.locator('.anillo').count() === 1 && /Mi licuado/.test(await texto()), 'abre sin señal con lo último de Gym');
  await ctx.setOffline(false);


  // 7. URL equivocada (la de Gym pegada en Comidas, como en config.js con dos URL iguales): se avisa y no se pierde nada
  // Otro celular en limpio (otro contexto: nada guardado), con la URL de Gym también en Comidas
  const ctx2 = await navegador.newContext({ viewport: { width: 412, height: 915 }, colorScheme: 'dark', serviceWorkers: 'block', timezoneId: 'America/Hermosillo' });
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

  // 7b. Script de Gym 8.1 a 8.8 (sin "panel"): como antes, data + comidasPanel, y se ve lo mismo
  conPanel = false; llamadasGym.length = 0;
  const ctx4 = await navegador.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block', timezoneId: 'America/Hermosillo' });
  await ctx4.route('https://script.google.com/**', ruta => ctx.__ruta(ruta));
  await ctx4.addInitScript(() => { if (!localStorage.getItem('pan_conexion')) localStorage.setItem('pan_conexion', JSON.stringify({
    gym: { url: 'https://script.google.com/macros/s/GYMTEST/exec', clave: 'secreta' } })); });
  const p4 = await ctx4.newPage();
  p4.on('pageerror', e => errores.push(String(e)));
  await p4.goto(base);
  await p4.waitForSelector('.hero.gym');
  await p4.waitForFunction(() => metas().deGym, null, { timeout: 8000 }).catch(() => {});
  await p4.click('#tComidas');
  await p4.click('.daynav .arrow >> nth=0');
  const t4 = await p4.locator('#view').innerText();
  ok(/quesadillas de harina/.test(t4) && ['panel', 'data', 'comidasPanel'].every(a => llamadasGym.includes(a)) && await p4.evaluate(() => metas().kcal === 1850 && !DATOS.gym.d.hoy),
    'script de Gym 8.1–8.8: Panel lee como antes (data + comidasPanel) y muestra lo mismo');
  await p4.reload(); await p4.waitForSelector('#view .seg'); await p4.waitForTimeout(1200);     // quedó en la pestaña Comidas
  ok(llamadasGym.filter(a => a === 'panel').length === 1, 'y no vuelve a pedir "panel" hasta el día siguiente');

  // 8. Script de Gym sin Panel.gs: solo hoy y ayer (lo que ya manda la app Gym) y un aviso
  conPanelGs = false;
  const ctx3 = await navegador.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block', timezoneId: 'America/Hermosillo' });
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
  ok(/versión 8.1 o más nueva/.test(t3) && /Mi licuado/.test(t3), 'script de Gym viejo: muestra hoy (de la app Gym) y avisa que se actualice');

  // Service worker todo o nada: un app.js publicado sin cambiar VERSION no se mezcla con la versión instalada…
  CAMBIOS['/app.js'] = x => x + '\n/*NUEVO*/';
  await pagina.reload(); await pagina.waitForTimeout(800);
  const mezcla = await pagina.evaluate(async () => {
    const servido = (await (await fetch('app.js')).text()).includes('/*NUEVO*/');
    const c = await caches.open((await caches.keys()).find(k => /^panel-v/.test(k)));
    return { servido, guardado: (await (await c.match('app.js')).text()).includes('/*NUEVO*/') };
  });
  ok(!mezcla.servido && !mezcla.guardado, 'service worker: un archivo nuevo no se mezcla con la versión instalada');
  // …y config.js sí va primero por la red
  CAMBIOS['/config.js'] = x => x + '\n/*CONFIG-NUEVO*/';
  ok(await pagina.evaluate(async () => (await (await fetch('config.js')).text()).includes('/*CONFIG-NUEVO*/')), 'service worker: config.js va primero por la red');
  // Al subir VERSION llega la versión nueva completa y la app se recarga sola
  CAMBIOS['/sw.js'] = x => x.replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-prueba'");
  await pagina.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await pagina.waitForFunction(async () => (await caches.keys()).some(k => /-prueba$/.test(k)), null, { timeout: 15000 }).catch(() => {});
  await pagina.waitForTimeout(1500);
  const nueva = await pagina.evaluate(async () => ({ caches: await caches.keys(), app: (await (await fetch('app.js')).text()).includes('/*NUEVO*/') }));
  ok(nueva.app && nueva.caches.length === 1 && /-prueba$/.test(nueva.caches[0]), 'service worker: con VERSION nueva baja todo junto y borra lo viejo');
  delete CAMBIOS['/app.js']; delete CAMBIOS['/config.js']; delete CAMBIOS['/sw.js'];
  // En Chrome la política de seguridad no deja correr JS metido en el HTML (ni on…= ni data-click fuera de ACCIONES)
  const bloqueado = await pagina.evaluate(async () => {
    window.__inyectado = 0;
    const d = document.createElement('div');
    d.innerHTML = '<img src="x.png" onerror="window.__inyectado=1"><button id="malo" data-click="eval" data-args=\'["window.__inyectado=2"]\'>x</button>';
    document.body.appendChild(d); d.querySelector('#malo').click();
    await new Promise(r => setTimeout(r, 400)); d.remove(); return window.__inyectado;
  });
  ok(bloqueado === 0, 'JS metido en el HTML no corre (política de seguridad y lista de acciones)');
  const otros = errores.filter(e => !/Content Security Policy|x\.png|404/.test(e));   // lo bloqueado a propósito arriba no cuenta
  ok(!otros.length, 'sin errores en la consola' + (otros.length ? ': ' + otros.join(' | ') : ''));
  await navegador.close();
  servidor.close();
  console.log(fallas ? '\n' + fallas + ' fallas' : '\nTodo bien. Capturas en ' + SALIDA);
  process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
