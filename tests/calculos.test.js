// Pruebas de calculos.js (rutina de hoy, saldos, presupuesto, macros y resumen) y de los datos de ejemplo: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const CALC = require('../calculos.js');
global.CALC = CALC;
const EJEMPLO = require('../ejemplo.js');

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' ' + a + ' ≈ ' + b);
const JUE = '2026-10-29', SAB = '2026-10-31';

/* ----- Gym ----- */
test('Rutina de hoy: con datos de hoy manda la hoja (sugGrupo)', () => {
  const g = CALC.gymHoy({ todayKey: JUE, sugGrupo: 'Pull', ultimoGrupo: 'Push', ultimoGrupoFecha: '2026-10-28', dias: [1, 2, 3, 4, 5] }, JUE, 4);
  assert.deepStrictEqual([g.grupo, g.entreno, g.descansa, g.proximo], ['Pull', false, false, 'Legs']);
  assert.strictEqual(g.nombre, 'Espalda y bíceps');
});

test('Rutina de hoy: si ya entrenaste hoy, lo dice y el próximo es el siguiente', () => {
  const g = CALC.gymHoy({ todayKey: JUE, sugGrupo: 'Legs', ultimoGrupo: 'Pull', ultimoGrupoFecha: JUE }, JUE, 4);
  assert.deepStrictEqual([g.grupo, g.entreno, g.proximo], ['Pull', true, 'Legs']);
});

test('Rutina de hoy: con datos viejos avanza desde lo último que entrenaste, no por fecha', () => {
  // La hoja se leyó el lunes (y decía Legs); el último entreno fue Legs el lunes: hoy jueves toca Push, aunque pasaron 3 días
  const g = CALC.gymHoy({ todayKey: '2026-10-26', sugGrupo: 'Legs', ultimoGrupo: 'Legs', ultimoGrupoFecha: '2026-10-26' }, JUE, 4);
  assert.strictEqual(g.grupo, 'Push');
  // Sin último grupo conocido: lo que diga la hoja
  assert.strictEqual(CALC.gymHoy({ todayKey: '2026-10-26', sugGrupo: 'Legs' }, JUE).grupo, 'Legs');
});

test('Día de descanso según tus días de gym', () => {
  const g = CALC.gymHoy({ todayKey: SAB, sugGrupo: 'Push', ultimoGrupo: 'Legs', ultimoGrupoFecha: JUE, dias: [1, 2, 3, 4, 5] }, SAB, 4);
  assert.strictEqual(g.descansa, true);
  assert.strictEqual(g.grupo, 'Push');
});

test('Semana: días de gym y km; si los datos son de la semana pasada, van en ceros', () => {
  const d = { todayKey: JUE, resumen: { semana: [true, true, false, false, false, false, false], diasSemana: 2 }, trotes: { semanas: [{ d: '19/10', km: 10 }, { d: '26/10', km: 6.5 }] } };
  const g = CALC.gymHoy(d, JUE, 4);
  assert.deepStrictEqual([g.diasSemana, g.kmSemana, g.fresca], [2, 6.5, true]);
  const viejo = CALC.gymHoy(Object.assign({}, d, { todayKey: '2026-10-24' }), JUE, 4);
  assert.deepStrictEqual([viejo.diasSemana, viejo.kmSemana, viejo.fresca, viejo.semana.filter(Boolean).length], [0, 0, false, 0]);
});

test('Peso y cintura con tendencia', () => {
  const g = CALC.gymHoy({ todayKey: JUE, ultimoPeso: 78.3, resumen: { cambioSemana: -0.26 },
    cuerpo: { serie: [{ d: '12/10', peso: 79, cint: 90 }, { d: '19/10', peso: 78.8, cint: null }, { d: '26/10', peso: 78.5, cint: 89.5 }] } }, JUE);
  assert.strictEqual(g.peso.ultimo, 78.3);
  assert.strictEqual(g.peso.cambio, -0.3);           // a 1 decimal
  assert.strictEqual(g.cintura.ultima, 89.5);
  assert.strictEqual(g.cintura.cambio, -0.5);        // contra la medición anterior (se salta la semana sin cintura)
  assert.deepStrictEqual(g.peso.serie.map(x => x.v), [79, 78.8, 78.5]);
});

test('Gym sin datos raros no truena', () => {
  const g = CALC.gymHoy({}, JUE);
  assert.strictEqual(g.grupo, 'Push');
  assert.strictEqual(g.peso.ultimo, null);
  assert.strictEqual(g.cintura.ultima, null);
});

/* ----- Finanzas ----- */
const FIN = {
  cuentas: [{ nombre: 'Débito', tipo: 'Débito', saldoCorte: 1000, fechaCorte: '2026-10-01' }, { nombre: 'Oro', tipo: 'Crédito', saldoCorte: -5000, fechaCorte: '2026-10-01' },
    { nombre: 'Vieja', tipo: 'Débito', saldoCorte: 50, fechaCorte: '2026-10-01', archivada: true }],
  categorias: [{ nombre: 'Gasolina', tipo: 'Gasto', presupuesto: 1500 }, { nombre: 'Salidas', tipo: 'Gasto', presupuesto: 0 }, { nombre: 'Sueldo', tipo: 'Ingreso', presupuesto: null }],
  personas: [{ nombre: 'Aaron', saldoCorte: 500, fechaCorte: '2026-10-01' }, { nombre: 'Lore', saldoCorte: -200, fechaCorte: '2026-10-01' }, { nombre: 'Ale', saldoCorte: 0, fechaCorte: '2026-10-01' }],
  movs: [
    { fecha: '2026-09-30', tipo: 'Gasto', monto: 999, cuenta: 'Débito', categoria: 'Gasolina' },        // antes del corte: no cuenta
    { fecha: '2026-10-05', tipo: 'Gasto', monto: 200, cuenta: 'Débito', categoria: 'Gasolina' },
    { fecha: '2026-10-06', tipo: 'Reembolso', monto: 50, cuenta: 'Débito', categoria: 'Gasolina' },
    { fecha: '2026-10-07', tipo: 'Traspaso', monto: 1000, cuenta: 'Débito', aCuenta: 'Oro' },
    { fecha: '2026-10-08', tipo: 'Ingreso', monto: 3000, cuenta: 'Débito', categoria: 'Sueldo' },
    { fecha: '2026-10-09', tipo: 'Presté', monto: 300, cuenta: 'Débito', persona: 'Ale' },
    { fecha: '2026-10-10', tipo: 'Gasto', monto: 400, cuenta: 'Oro', categoria: 'Ropa vieja' }          // categoría que ya no existe
  ]
};

test('Saldos por cuenta como en la app Finanzas (corte + movimientos desde el corte)', () => {
  const F = CALC.finanzasHoy(FIN, JUE);
  assert.deepStrictEqual(F.cuentas.map(c => [c.nombre, c.saldo]), [['Débito', 2550], ['Oro', -4400]]);   // la archivada no sale
  assert.deepStrictEqual([F.disponible, F.deuda], [2550, 4400]);
});

test('Patrimonio neto SIN personas; personas aparte', () => {
  const F = CALC.finanzasHoy(FIN, JUE);
  assert.strictEqual(F.neto, 2550 - 4400);
  assert.deepStrictEqual(F.teDeben.map(p => [p.nombre, p.saldo]), [['Aaron', 500], ['Ale', 300]]);
  assert.deepStrictEqual(F.debes.map(p => [p.nombre, p.saldo]), [['Lore', 200]]);
  assert.deepStrictEqual([F.totalTeDeben, F.totalDebes], [800, 200]);
});

test('Gasto del mes por categoría: gastos menos reembolsos, solo de este mes', () => {
  const F = CALC.finanzasHoy(FIN, JUE);
  const gas = F.categorias.find(c => c.nombre === 'Gasolina');
  assert.deepStrictEqual([gas.gastado, gas.presupuesto], [150, 1500]);
  assert.ok(F.categorias.some(c => c.nombre === 'Ropa vieja' && c.gastado === 400 && c.presupuesto === null));
  assert.ok(!F.categorias.some(c => c.nombre === 'Salidas'));          // sin gasto y sin presupuesto: no estorba
  assert.deepStrictEqual([F.gastado, F.presupuesto], [550, 1500]);
  cerca(F.avanceMes, 29 / 31, 1e-9);
  // En noviembre, lo de octubre ya no cuenta
  assert.strictEqual(CALC.finanzasHoy(FIN, '2026-11-02').gastado, 0);
});

test('Los datos de ejemplo pasan por los mismos cálculos', () => {
  const g = CALC.gymHoy(EJEMPLO.gym(JUE), JUE, 4);
  assert.ok(CALC.GRUPOS3.includes(g.grupo));
  assert.strictEqual(g.diasSemana, 2);                         // lunes y martes
  const F = CALC.finanzasHoy(EJEMPLO.finanzas(JUE), JUE);
  assert.ok(F.cuentas.length >= 6 && F.categorias.length > 3);
  assert.ok(F.teDeben.length && F.debes.length);
  assert.strictEqual(F.neto, Math.round((F.disponible - F.deuda) * 100) / 100);
  // El día 1 del mes casi no hay gastos de ejemplo (no se inventan días que no han pasado)
  assert.ok(CALC.finanzasHoy(EJEMPLO.finanzas('2026-11-01'), '2026-11-01').gastado < 200);
});

/* ----- Comidas ----- */
test('Comidas de siempre: licuado y quesadillas con los valores del catálogo de Gym', () => {
  const [lic, ques] = CALC.SEMILLAS;
  assert.deepStrictEqual([lic.id, lic.comida, lic.kcal, lic.p], ['g-licuado', 'desayuno', 371, 33.4]);
  assert.deepStrictEqual([ques.id, ques.comida, ques.kcal, ques.p], ['g-quesadillas', 'cena', 491, 23.1]);
});

test('Metas: repartir el resto (grasa 25 % de las kcal, carbs lo que queda)', () => {
  const m = CALC.repartirMetas(2300, 140);
  assert.deepStrictEqual(m, { kcal: 2300, p: 140, c: 291, g: 64 });
  assert.ok(Math.abs(m.p * 4 + m.c * 4 + m.g * 9 - m.kcal) <= 4);
});

test('Comida de mamá en 3 toques: plato normal de pollo con arroz, frijoles y 2 tortillas', () => {
  const sel = { prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 2 };
  const m = CALC.casera(sel);
  assert.strictEqual(m.kcal, 754);
  cerca(m.p, 45.1, 0.05);
  assert.strictEqual(CALC.nombreCasera(sel), 'Comida de mamá: pollo, arroz y frijoles + 2 tortillas');
  assert.ok(CALC.casera(Object.assign({}, sel, { tam: 'grande' })).kcal > m.kcal);
  assert.strictEqual(CALC.casera({ prot: 'sin', lados: [] }).kcal, 0);
});

test('Totales del día y "cumplí"', () => {
  const reg = [{ fecha: JUE, comida: 'desayuno', kcal: 371, p: 33.4, c: 49.9, g: 5.9 }, { fecha: JUE, comida: 'cena', kcal: 491, p: 23.1, c: 54.9, g: 21.3 },
    { fecha: '2026-10-28', comida: 'comida', kcal: 700, p: 40, c: 70, g: 25 }];
  const t = CALC.totalesDia(reg, JUE);
  assert.deepStrictEqual([t.kcal, t.p, t.n, t.porComida.desayuno.length, t.porComida.comida.length], [862, 56.5, 2, 1, 0]);
  const m = { kcal: 2300, p: 140 };
  assert.deepStrictEqual(CALC.cumple({ kcal: 2200, p: 135 }, m), { prot: true, kcal: true, ambas: true });
  assert.deepStrictEqual(CALC.cumple({ kcal: 2600, p: 150 }, m), { prot: true, kcal: false, ambas: false });
  assert.deepStrictEqual(CALC.cumple({ kcal: 2300, p: 120 }, m), { prot: false, kcal: true, ambas: false });
});

test('Resumen semanal: promedios solo de los días registrados y días que cumpliste', () => {
  const m = { kcal: 2300, p: 140, c: 291, g: 64 }, d = (f, kcal, p) => ({ fecha: f, comida: 'comida', kcal, p, c: 0, g: 0 });
  const reg = [d('2026-10-26', 2250, 142), d('2026-10-27', 1800, 100), d('2026-10-28', 2400, 145), d('2026-10-25', 5000, 10), d('2026-11-02', 5000, 10)];
  const R = CALC.resumenSemana(reg, '2026-10-26', m, JUE);
  assert.strictEqual(R.diasConRegistro, 3);
  assert.strictEqual(R.promKcal, 2150);
  assert.strictEqual(R.promP, 129);
  assert.deepStrictEqual([R.cumpleProt, R.cumpleKcal, R.cumpleAmbas], [2, 2, 2]);
  assert.strictEqual(R.dias.length, 7);
  assert.strictEqual(R.dias[4].futuro, true);           // viernes 30 todavía no llega
  // Hoy (jueves) va aparte mientras no termina
  const R2 = CALC.resumenSemana(reg.concat([d(JUE, 900, 60)]), '2026-10-26', m, JUE);
  assert.deepStrictEqual([R2.diasConRegistro, R2.promKcal, R2.hoy.kcal], [3, 2150, 900]);
  assert.strictEqual(CALC.lunesDe('2026-11-01'), '2026-10-26');   // domingo: su semana empezó el lunes anterior
});
