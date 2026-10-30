// Pruebas de apps-script/Panel-Gym.gs (va dentro del Apps Script de Gym) con una hoja de mentira y lo mínimo de AppGym.gs.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { libroNuevo, aClave } = require('./hoja-falsa.js');

const COMIDAS_COLS = ['Fecha', 'Hora', 'Comida', 'Alimento', 'Cantidad', 'Unidad', 'Proteína (g)', 'Carbohidratos (g)', 'Grasa (g)', 'Calorías (kcal)', 'Fibra (g)', 'Fuente', 'Referencia', 'Id'];
// Lo que sale del vm viene de otro "mundo": se compara ya pasado por JSON
const j = x => JSON.parse(JSON.stringify(x));
const hace = n => aClave(new Date(Date.now() - n * 864e5));

function cargar(filas, cfg) {
  const lb = libroNuevo('Entrenamiento 2026 – Martin');
  const sh = lb.insertSheet('Comidas');
  sh.getRange(1, 1, 1, COMIDAS_COLS.length).setValues([COMIDAS_COLS]);
  filas.forEach((f, i) => sh.getRange(i + 2, 1, 1, COMIDAS_COLS.length).setValues([f]));
  const props = { CFG_clave1: JSON.stringify(cfg || { metaProteina: 120 }) };
  const ctx = {
    U: { key: 'clave1', metaProteina: 120 }, COMIDAS_COLS,
    ss_: () => lb, key_: d => aClave(new Date(d)), num_: v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v),
    props_: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }),
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Date, JSON, Math, String, Number, Object, Array, Error, isNaN
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Panel-Gym.gs'), 'utf8'), ctx, { filename: 'Panel-Gym.gs' });
  return { ctx, props, sh };
}
const fila = (dias, tiempo, nombre, p, c, f, k) => [new Date(hace(dias) + 'T12:00:00'), '08:10', tiempo, nombre, 1, '', p, c, f, k, 2, 'receta', 'licuado', 'id' + nombre + dias];

test('comidasPanel: días recientes con sus macros, sin los viejos', () => {
  const { ctx } = cargar([fila(50, 'Desayuno', 'Viejo', 10, 10, 10, 170), fila(1, 'Desayuno', 'Mi licuado', 40, 60, 10, 490),
    fila(0, 'Comida', 'Tupper: pollo, arroz y frijoles', 45, 80, 26, 750), fila(0, 'Colación', 'Manzana', 0.5, 25, 0.4, 94), fila(0, 'Cena', 'Algo viejo', 16, '', '', '')]);
  const r = ctx.comidasPanel_(42);
  assert.deepStrictEqual(j(Object.keys(r.dias).sort()), [hace(1), hace(0)].sort());
  assert.deepStrictEqual(j(r.dias[hace(0)].map(x => [x.m, x.n, x.k])), [['c', 'Tupper: pollo, arroz y frijoles', 750], ['s', 'Manzana', 94], ['n', 'Algo viejo', null]]);
  assert.strictEqual(r.dias[hace(1)][0].p, 40);
  assert.strictEqual(r.hoy, hace(0));
  assert.strictEqual(r.metas.p, 120);
  assert.strictEqual(r.metas.kcal, null);
});

test('comidasPanel sin pestaña Comidas: vacío, sin tronar', () => {
  const { ctx } = cargar([]);
  assert.deepStrictEqual(j(ctx.comidasPanel_().dias), {});
});

test('metasPanel: guarda la proteína como meta de Gym y las demás aparte, sin tocar lo demás de tu configuración', () => {
  const { ctx, props } = cargar([], { metaProteina: 120, dias: [1, 2, 3], comidas: [{ t: 'Licuado', g: 32 }] });
  const r = ctx.metasPanel_({ kcal: 2300, p: 140, c: 291, g: 64 });
  assert.deepStrictEqual(j([r.p, r.kcal, r.c, r.g]), [140, 2300, 291, 64]);
  const cfg = JSON.parse(props.CFG_clave1);
  assert.strictEqual(cfg.metaProteina, 140);
  assert.deepStrictEqual(cfg.dias, [1, 2, 3]);
  assert.strictEqual(cfg.comidas.length, 1);
  assert.strictEqual(ctx.U.metaProteina, 140);
  assert.strictEqual(ctx.metasPanel_().kcal, 2300);              // sin argumentos: solo lee
  assert.throws(() => ctx.metasPanel_({ kcal: 300, p: 140, c: 1, g: 1 }), /Calorías fuera de rango/);
});
