// Datos de ejemplo para Hoy mientras Gym o Finanzas no estén conectadas (engrane > Conexión).
// Tienen la misma forma que lo que mandan tus scripts de Apps Script, así que pasan por los mismos cálculos.
// Se arman con la fecha de hoy para que siempre se vean al día. Nada de esto se sube a ninguna hoja.
const EJEMPLO = (() => {
  const { sumarDias, lunesDe, diaSemana, GRUPOS3 } = CALC;
  const dm = k => k.slice(8, 10) + '/' + k.slice(5, 7);

  function gym(hoy) {
    const lunes = lunesDe(hoy), idx = (diaSemana(hoy) + 6) % 7;
    // Entrenas lunes, martes, jueves y viernes; la rotación sigue desde el último que hiciste
    const patron = [true, true, false, true, true, false, false];
    const semana = patron.map((x, i) => x && i < idx);
    let ultimo = 'Legs', fechaUlt = sumarDias(lunes, -3);
    semana.forEach((x, i) => { if (x) { ultimo = GRUPOS3[(GRUPOS3.indexOf(ultimo) + 1) % 3]; fechaUlt = sumarDias(lunes, i); } });
    const semanas = [7.5, 9.2, 10.4, 8.8, 12.1].map((km, i) => ({ d: dm(sumarDias(lunes, (i - 5) * 7)), km }))
      .concat([{ d: dm(lunes), km: idx >= 1 ? (idx >= 3 ? 7.3 : 4.2) : 0 }]);
    const pesos = [80.6, 80.2, 79.9, 79.7, 79.2, 79.0, 78.7, 78.5], cints = [92, 91.5, 91.5, 91, 90.5, 90, 89.5, 89];
    const serie = pesos.map((p, i) => ({ d: dm(sumarDias(lunes, (i - 7) * 7 - 1)), peso: p, cint: cints[i] }));
    return {
      todayKey: hoy, sugGrupo: GRUPOS3[(GRUPOS3.indexOf(ultimo) + 1) % 3], ultimoGrupo: ultimo, ultimoGrupoFecha: fechaUlt, dias: [1, 2, 4, 5],
      resumen: { semana, diasSemana: semana.filter(Boolean).length, promedio7: 78.5, cambioSemana: -0.2, cintura: 89, cambioCintura: -3 },
      trotes: { semanas, km7: semanas[5].km },
      cuerpo: { serie, actual: 89, base: 92, meta: 84 },
      ultimoPeso: 78.3,
      carrera: { fecha: '2026-11-21', nombre: '5 km' }
    };
  }

  function finanzas(hoy) {
    const mk = hoy.slice(0, 7), d1 = mk + '-01', dia = Number(hoy.slice(8, 10));
    const f = n => mk + '-' + String(n).padStart(2, '0');
    const c = (nombre, tipo, saldoCorte, limite) => ({ nombre, tipo, saldoCorte, fechaCorte: d1, archivada: false, limite: limite || null });
    // Solo los movimientos de los días que ya pasaron este mes
    const mov = (n, tipo, monto, cuenta, categoria, extra) => n > dia ? null : Object.assign({ fecha: f(n), tipo, monto, cuenta, aCuenta: '', categoria: categoria || '', persona: '' }, extra || {});
    return {
      hoja: 'Ejemplo',
      cuentas: [c('BBVA Débito', 'Débito', 2400), c('Revolut', 'Ahorro', 4900), c('Mercado Pago', 'Débito', 1250), c('Efectivo', 'Efectivo', 1400),
        c('BBVA Oro', 'Crédito', -33500, 60000), c('Revolut Premium Grey', 'Crédito', -11800), c('Mercado Pago Crédito', 'Crédito', -6000),
        c('Préstamo Mercado Pago', 'Préstamo', -3100)],
      categorias: [['Comida y antojos', 400], ['Salidas', 2000], ['Gasolina', 1500], ['Carro', 800], ['Familia y casa', 300],
        ['Salud y cuidado personal', 1800], ['Suscripciones y seguros', 1000], ['Gustos y compras', 700], ['Viajes', 0],
        ['Intereses y comisiones', 0], ['Otros', 500]].map(x => ({ nombre: x[0], tipo: 'Gasto', presupuesto: x[1] }))
        .concat(['Sueldo', 'Bonos y apoyos'].map(n => ({ nombre: n, tipo: 'Ingreso', presupuesto: null }))),
      personas: [['Aaron', 19500], ['Ale', 3000], ['Lore', -1200]].map(x => ({ nombre: x[0], saldoCorte: x[1], fechaCorte: d1, archivada: false })),
      movs: [
        mov(2, 'Gasto', 139, 'BBVA Oro', 'Suscripciones y seguros'), mov(3, 'Gasto', 650, 'BBVA Débito', 'Gasolina'),
        mov(5, 'Gasto', 480, 'BBVA Oro', 'Salidas'), mov(7, 'Gasto', 185, 'Efectivo', 'Comida y antojos'),
        mov(10, 'Gasto', 652.4, 'BBVA Oro', 'Suscripciones y seguros'), mov(12, 'Gasto', 1290, 'BBVA Oro', 'Gustos y compras'),
        mov(13, 'Gasto', 450, 'Mercado Pago', 'Salud y cuidado personal'), mov(15, 'Ingreso', 7500, 'BBVA Débito', 'Sueldo'),
        mov(16, 'Traspaso', 3000, 'BBVA Débito', '', { aCuenta: 'BBVA Oro' }), mov(17, 'Gasto', 700, 'BBVA Débito', 'Gasolina'),
        mov(19, 'Gasto', 920, 'BBVA Oro', 'Salidas'), mov(21, 'Gasto', 240, 'Mercado Pago', 'Comida y antojos'),
        mov(22, 'Gasto', 120, 'Efectivo', 'Familia y casa'), mov(24, 'Presté', 500, 'Efectivo', '', { persona: 'Ale' }),
        mov(25, 'Me pagaron', 1500, 'BBVA Débito', '', { persona: 'Aaron' }), mov(26, 'Gasto', 172.84, 'Revolut', 'Suscripciones y seguros')
      ].filter(Boolean)
    };
  }

  return { gym, finanzas };
})();
if (typeof module !== 'undefined') module.exports = EJEMPLO;
