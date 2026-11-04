// Pruebas de apps-script/Comidas.gs con una hoja de mentira: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const { cargarScript, aClave } = require('./hoja-falsa.js');

const K = 'secreta';
const hoyK = aClave(new Date());
const reg = (id, extra) => Object.assign({ id, fecha: hoyK, comida: 'desayuno', nombre: 'Licuado de proteína', porcion: 1, kcal: 371, p: 33.4, c: 49.9, g: 5.9,
  origen: 'guardada', ref: 'g-licuado', registrado: Date.now() }, extra || {});
const lote = ops => ({ k: K, action: 'batch', args: [ops.map((o, i) => Object.assign({ id: 'op' + i }, o))] });

test('Sin clave puesta en el script: avisa que falta (no deja entrar)', () => {
  const s = cargarScript();
  const r = s.post({ k: 'lo-que-sea', action: 'ping' });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /falta poner tu clave/);
});

test('Clave en las Propiedades del script (para publicar con clasp): funciona sin escribirla en el código', () => {
  const s = cargarScript(null, { CLAVE: K });
  assert.strictEqual(s.get({ k: K }).result, 'ok');
  assert.match(s.post({ k: 'otra', action: 'data' }).error, /Clave incorrecta/);
  // Si están las dos, gana la de Propiedades
  const d = cargarScript('vieja', { CLAVE: K });
  assert.strictEqual(d.get({ k: K }).result, 'ok');
  assert.match(d.get({ k: 'vieja' }).error, /Clave incorrecta/);
});

test('Clave incorrecta: no lee ni escribe nada', () => {
  const s = cargarScript(K);
  assert.strictEqual(s.post({ k: 'otra', action: 'data' }).ok, false);
  assert.match(s.get({}).error, /Clave incorrecta/);           // abrir la URL en el navegador
  assert.strictEqual(s.get({ k: K }).result, 'ok');
});

test('instalar: "Hoja 1" se vuelve Registro y se crean las demás pestañas con encabezados', () => {
  const s = cargarScript(K);
  s.instalar();
  assert.deepStrictEqual(s.lb.hojas.map(h => h.nombre), ['Registro', 'Guardadas', 'Plan', 'Metas', 'Hábitos', 'Objetivos', 'Resumen']);
  assert.strictEqual(s.lb.getSheetByName('Hábitos').celda(1, 3), 'Agua');
  assert.strictEqual(s.lb.getSheetByName('Registro').celda(1, 1), 'ID');
  assert.strictEqual(s.lb.getSheetByName('Metas').celda(2, 1), 'Calorías (kcal)');
  assert.match(s.lb.getSheetByName('Resumen').formulas['2,1'], /^=IFERROR\(QUERY\(Registro!B2:I, "select B, sum\(F\)/);
});

test('Hoja nueva: data regresa vacío y sin metas (la app sube las suyas)', () => {
  const s = cargarScript(K);
  const r = s.post({ k: K, action: 'data', args: [120] });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual([r.result.registro, r.result.guardadas, r.result.plan, r.result.metas, r.result.habitos, r.result.objetivos], [[], [], [], null, [], []]);
  assert.strictEqual(r.result.version, 2);
  assert.strictEqual(s.post({ k: K, action: 'version' }).result, 2);
});

test('Un lote con todo: registro, guardadas, plan y metas; se lee igual que como se mandó', () => {
  const s = cargarScript(K);
  const g = { id: 'g-licuado', nombre: 'Licuado de proteína', comida: 'desayuno', kcal: 371, p: 33.4, c: 49.9, g: 5.9, fav: true, ico: '🥤', detalle: 'leche, plátano…', origen: 'semilla', creada: hoyK };
  const r = s.post(lote([
    { action: 'guardarGuardada', args: [g] },
    { action: 'guardarRegistro', args: [reg('r1')] },
    { action: 'guardarRegistro', args: [reg('r2', { comida: 'cena', nombre: '2 quesadillas de harina con frijol', kcal: 491, p: 23.1, c: 54.9, g: 21.3, porcion: 1.5 })] },
    { action: 'guardarPlan', args: [{ id: 'plan-' + hoyK + '-desayuno', fecha: hoyK, comida: 'desayuno', gid: 'g-licuado', nombre: 'Licuado de proteína', porcion: 1, kcal: 371, p: 33.4, c: 49.9, g: 5.9, ico: '🥤' }] },
    { action: 'guardarMetas', args: [{ kcal: 2300, p: 140, c: 291, g: 64 }] }
  ]));
  assert.strictEqual(r.ok, true);
  assert.ok(r.result.every(x => x.ok), JSON.stringify(r.result));
  const d = s.post({ k: K, action: 'data', args: [120] }).result;
  assert.strictEqual(d.registro.length, 2);
  assert.deepStrictEqual(d.registro.map(x => [x.id, x.comida, x.kcal, x.porcion]), [['r1', 'desayuno', 371, 1], ['r2', 'cena', 491, 1.5]]);
  assert.strictEqual(d.registro[0].p, 33.4);
  assert.strictEqual(d.guardadas[0].fav, true);
  assert.strictEqual(d.guardadas[0].ico, '🥤');
  assert.strictEqual(d.plan[0].gid, 'g-licuado');
  assert.deepStrictEqual(d.metas, { kcal: 2300, p: 140, c: 291, g: 64 });
  // En la hoja la comida se ve con su nombre
  assert.strictEqual(s.lb.getSheetByName('Registro').celda(3, 3), 'Cena');
});

test('Mandar el mismo cambio dos veces no duplica; editar sobrescribe; borrar quita la fila', () => {
  const s = cargarScript(K);
  s.post(lote([{ action: 'guardarRegistro', args: [reg('r1')] }, { action: 'guardarRegistro', args: [reg('r2')] }]));
  s.post(lote([{ action: 'guardarRegistro', args: [reg('r1')] }]));                                  // reintento
  s.post(lote([{ action: 'guardarRegistro', args: [reg('r2', { nombre: 'Licuado doble', porcion: 2, kcal: 742 })] }]));   // edición
  let d = s.post({ k: K, action: 'data' }).result;
  assert.deepStrictEqual(d.registro.map(x => x.id), ['r1', 'r2']);
  assert.strictEqual(d.registro[1].nombre, 'Licuado doble');
  s.post(lote([{ action: 'borrarRegistro', args: ['r1'] }, { action: 'borrarRegistro', args: ['no-existe'] }, { action: 'guardarRegistro', args: [reg('r3')] }]));
  d = s.post({ k: K, action: 'data' }).result;
  assert.deepStrictEqual(d.registro.map(x => x.id), ['r2', 'r3']);
});

test('Un cambio malo no frena a los demás del lote', () => {
  const s = cargarScript(K);
  const r = s.post(lote([
    { action: 'guardarRegistro', args: [reg('bien1')] },
    { action: 'guardarRegistro', args: [reg('mal1', { comida: 'merienda' })] },
    { action: 'guardarRegistro', args: [reg('mal2', { fecha: '29/10/2026' })] },
    { action: 'guardarRegistro', args: [reg('id con espacios')] },
    { action: 'guardarMetas', args: [{ kcal: 200, p: 140, c: 10, g: 10 }] },
    { action: 'inventada', args: [] },
    { action: 'guardarRegistro', args: [reg('bien2')] }
  ]));
  assert.deepStrictEqual(r.result.map(x => x.ok), [true, false, false, false, false, false, true]);
  assert.match(r.result[1].error, /Comida inválida/);
  assert.match(r.result[2].error, /Fecha inválida/);
  assert.match(r.result[4].error, /fuera de rango/);
  assert.deepStrictEqual(s.post({ k: K, action: 'data' }).result.registro.map(x => x.id), ['bien1', 'bien2']);
});

test('Texto que parece fórmula se guarda como texto (no se ejecuta en Sheets)', () => {
  const s = cargarScript(K);
  s.post(lote([{ action: 'guardarRegistro', args: [reg('x1', { nombre: '=IMPORTXML("http://malo","//a")' })] }]));
  // La hoja de mentira quita el apóstrofo igual que Sheets: si llegó sin apóstrofo, aquí se vería distinto
  const h = s.lb.getSheetByName('Registro');
  assert.strictEqual(h.celda(2, 4), '=IMPORTXML("http://malo","//a")');
  assert.strictEqual(typeof h.formulas['2,4'], 'undefined');
});

test('Números locos se recortan: nada negativo ni gigantesco', () => {
  const s = cargarScript(K);
  s.post(lote([{ action: 'guardarRegistro', args: [reg('n1', { kcal: -50, p: 99999, porcion: 0 })] }]));
  const x = s.post({ k: K, action: 'data' }).result.registro[0];
  assert.deepStrictEqual([x.kcal, x.p, x.porcion], [0, 1000, 1]);
});

test('Más de 1000 filas: la pestaña crece sola', () => {
  const s = cargarScript(K);
  const ops = [];
  for (let i = 0; i < 1100; i++) ops.push({ action: 'guardarRegistro', args: [reg('m' + i)] });
  const r = s.post(lote(ops));
  assert.ok(r.result.every(x => x.ok), (r.result.find(x => !x.ok) || {}).error);
  assert.strictEqual(s.post({ k: K, action: 'data' }).result.registro.length, 1100);
});

test('data solo manda los últimos N días de registro', () => {
  const s = cargarScript(K);
  const hace = n => aClave(new Date(Date.now() - n * 864e5));
  s.post(lote([{ action: 'guardarRegistro', args: [reg('viejo', { fecha: hace(200) })] }, { action: 'guardarRegistro', args: [reg('nuevo', { fecha: hace(3) })] }]));
  assert.deepStrictEqual(s.post({ k: K, action: 'data', args: [120] }).result.registro.map(x => x.id), ['nuevo']);
  assert.deepStrictEqual(s.post({ k: K, action: 'data', args: [400] }).result.registro.map(x => x.id), ['viejo', 'nuevo']);
});

// Lunes de esta semana (aaaa-mm-dd), como lo calcula Panel
const lunesK = (() => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return aClave(d); })();

test('Hábitos: un renglón por día; cambiarlo lo sobrescribe y se lee igual', () => {
  const s = cargarScript(K);
  const h = extra => Object.assign({ id: 'hab-' + hoyK, fecha: hoyK, agua: true, sueno: 7.5, animo: 4, extras: ['Leer', 'Sin refresco'] }, extra || {});
  assert.ok(s.post(lote([{ action: 'guardarHabito', args: [h()] }])).result[0].ok);
  assert.ok(s.post(lote([{ action: 'guardarHabito', args: [h({ agua: false, sueno: null, extras: ['Leer'] })] }])).result[0].ok);
  const d = s.post({ k: K, action: 'data', args: [120] }).result;
  assert.deepStrictEqual(d.habitos, [{ id: 'hab-' + hoyK, fecha: hoyK, agua: false, sueno: null, animo: 4, extras: ['Leer'] }]);
  assert.strictEqual(s.lb.getSheetByName('Hábitos').celda(2, 3), 'No');
});

test('Hábitos: valores raros se recortan (sueño 0–16 h en medias horas, ánimo 1–5, comas fuera de los nombres)', () => {
  const s = cargarScript(K);
  s.post(lote([{ action: 'guardarHabito', args: [{ id: 'hab-x', fecha: hoyK, agua: 'quizá', sueno: 30, animo: 9, extras: ['Correr, nadar', '=MAL()'] }] }]));
  const x = s.post({ k: K, action: 'data' }).result.habitos[0];
  assert.deepStrictEqual([x.agua, x.sueno, x.animo], [null, 16, 5]);
  assert.deepStrictEqual(x.extras, ['Correr  nadar', '=MAL()']);
  assert.strictEqual(typeof s.lb.getSheetByName('Hábitos').formulas['2,6'], 'undefined');
});

test('Objetivos: se guardan por semana (lunes), se editan, se marcan y se borran', () => {
  const s = cargarScript(K);
  const o = (id, extra) => Object.assign({ id, lunes: lunesK, tipo: 'gym', meta: 4, texto: '', hecho: false }, extra || {});
  const r = s.post(lote([
    { action: 'guardarObjetivo', args: [o('obj-1')] },
    { action: 'guardarObjetivo', args: [o('obj-2', { tipo: 'gasto', meta: 2500 })] },
    { action: 'guardarObjetivo', args: [o('obj-3', { tipo: 'libre', meta: null, texto: 'Llamar a mi abuela' })] },
    { action: 'guardarObjetivo', args: [o('obj-mal', { tipo: 'volar' })] },
    { action: 'guardarObjetivo', args: [o('obj-mal2', { lunes: aClave(new Date(new Date(lunesK + 'T12:00:00').getTime() + 864e5)) })] },
    { action: 'guardarObjetivo', args: [o('obj-mal3', { tipo: 'libre', texto: '  ' })] }
  ]));
  assert.deepStrictEqual(r.result.map(x => x.ok), [true, true, true, false, false, false]);
  assert.match(r.result[3].error, /Tipo de objetivo inválido/);
  assert.match(r.result[4].error, /lunes/);
  s.post(lote([{ action: 'guardarObjetivo', args: [o('obj-3', { tipo: 'libre', meta: null, texto: 'Llamar a mi abuela', hecho: true })] }, { action: 'borrarObjetivo', args: ['obj-1'] }]));
  const d = s.post({ k: K, action: 'data' }).result;
  assert.deepStrictEqual(d.objetivos.map(x => [x.id, x.tipo, x.meta, x.texto, x.hecho, x.lunes]),
    [['obj-2', 'gasto', 2500, '', false, lunesK], ['obj-3', 'libre', 0, 'Llamar a mi abuela', true, lunesK]]);
  // En la hoja se lee con palabras
  assert.strictEqual(s.lb.getSheetByName('Objetivos').celda(2, 3), 'Gasto máximo ($)');
});
