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

test('Clave incorrecta: no lee ni escribe nada', () => {
  const s = cargarScript(K);
  assert.strictEqual(s.post({ k: 'otra', action: 'data' }).ok, false);
  assert.match(s.get({}).error, /Clave incorrecta/);           // abrir la URL en el navegador
  assert.strictEqual(s.get({ k: K }).result, 'ok');
});

test('instalar: "Hoja 1" se vuelve Registro y se crean las demás pestañas con encabezados', () => {
  const s = cargarScript(K);
  s.instalar();
  assert.deepStrictEqual(s.lb.hojas.map(h => h.nombre), ['Registro', 'Guardadas', 'Plan', 'Metas', 'Resumen']);
  assert.strictEqual(s.lb.getSheetByName('Registro').celda(1, 1), 'ID');
  assert.strictEqual(s.lb.getSheetByName('Metas').celda(2, 1), 'Calorías (kcal)');
  assert.match(s.lb.getSheetByName('Resumen').formulas['2,1'], /^=IFERROR\(QUERY\(Registro!B2:I, "select B, sum\(F\)/);
});

test('Hoja nueva: data regresa vacío y sin metas (la app sube las suyas)', () => {
  const s = cargarScript(K);
  const r = s.post({ k: K, action: 'data', args: [120] });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual([r.result.registro, r.result.guardadas, r.result.plan, r.result.metas], [[], [], [], null]);
  assert.strictEqual(r.result.version, 1);
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
