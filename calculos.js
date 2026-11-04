// Cálculos de Panel sin pantalla: qué rutina toca, saldos y presupuesto (igual que tu app Finanzas), macros y resumen semanal.
// Lo cargan index.html (antes de app.js) y las pruebas (node --test tests/*.test.js).
const CALC = (() => {
  const pad = n => String(n).padStart(2, '0');
  const r1 = x => Math.round((Number(x) || 0) * 10) / 10;
  const r2 = x => Math.round((Number(x) || 0) * 100) / 100;
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const vacio = v => v === null || v === undefined || v === '';

  /* ===================== Fechas (aaaa-mm-dd, hora local) ===================== */
  function claveDia(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sumarDias(k, n) { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return claveDia(d); }
  function difDias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
  const diaSemana = k => new Date(k + 'T12:00:00').getDay();          // 0 domingo … 6 sábado
  const lunesDe = k => sumarDias(k, -((diaSemana(k) + 6) % 7));      // la semana va de lunes a domingo

  /* ===================== Gym ===================== */
  const GRUPOS3 = ['Push', 'Pull', 'Legs'];
  const NOMBRE_GRUPO = { Push: 'Pecho, hombro y tríceps', Pull: 'Espalda y bíceps', Legs: 'Pierna', Trote: 'Correr' };
  const siguiente = g => GRUPOS3[(GRUPOS3.indexOf(g) + 1) % 3];

  // Lo de Hoy a partir de lo que manda tu script de Gym (la misma acción "data" que usa la app Gym).
  // La rotación la decide la hoja (sugGrupo): solo avanza cuando entrenas. Si los datos son de otro día,
  // se hace lo mismo que la app Gym: el siguiente después del último que entrenaste.
  function gymHoy(d, hoy, metaDias, respaldoCarrera) {
    d = d || {};
    const r = d.resumen || {}, t = d.trotes || {}, cu = d.cuerpo || {};
    const ultimo = GRUPOS3.indexOf(d.ultimoGrupo) >= 0 ? d.ultimoGrupo : null;
    const entreno = !!(ultimo && d.ultimoGrupoFecha === hoy);
    let grupo;
    if (entreno) grupo = ultimo;
    else if (d.todayKey === hoy || !ultimo) grupo = GRUPOS3.indexOf(d.sugGrupo) >= 0 ? d.sugGrupo : (ultimo ? siguiente(ultimo) : 'Push');
    else grupo = siguiente(ultimo);
    const dias = Array.isArray(d.dias) && d.dias.length ? d.dias : [1, 2, 3, 4, 5];
    // La semana de los datos: si son de la semana pasada, esta semana va en ceros
    const fresca = !!d.todayKey && lunesDe(d.todayKey) === lunesDe(hoy);
    const semana = fresca && Array.isArray(r.semana) ? r.semana.slice(0, 7).map(Boolean) : [];
    while (semana.length < 7) semana.push(false);
    const diasSemana = fresca ? (vacio(r.diasSemana) ? semana.filter(Boolean).length : num(r.diasSemana)) : 0;
    const semanas = Array.isArray(t.semanas) ? t.semanas.map(s => ({ d: String(s.d || ''), km: r1(s.km) })) : [];
    const kmSemana = fresca ? (semanas.length ? semanas[semanas.length - 1].km : r1(t.km7)) : 0;
    // Cuerpo: peso (promedio semanal en la serie) y cintura del domingo
    const serie = Array.isArray(cu.serie) ? cu.serie : [];
    const pesos = serie.filter(x => !vacio(x.peso)).map(x => ({ d: x.d, v: num(x.peso) }));
    const cints = serie.filter(x => !vacio(x.cint)).map(x => ({ d: x.d, v: num(x.cint) }));
    const ultCint = cints.length ? cints[cints.length - 1].v : (!vacio(cu.actual) ? num(cu.actual) : (!vacio(r.cintura) ? num(r.cintura) : null));
    // Semana de la carrera (igual que la app Gym): de lunes al día de la carrera es descarga (mitad de series, mismo peso),
    // la víspera se descansa y el día de la carrera no hay gym. La fecha es la de Gym (respaldo: config.js)
    const car = d.carrera && d.carrera.fecha ? String(d.carrera.fecha).slice(0, 10) : (respaldoCarrera && respaldoCarrera.fecha) || null;
    const semanaCarrera = !!car && car >= hoy && lunesDe(car) === lunesDe(hoy);
    const visperaCarrera = !!car && sumarDias(car, -1) === hoy, diaCarrera = car === hoy;
    return {
      semanaCarrera, visperaCarrera, diaCarrera,
      grupo, nombre: NOMBRE_GRUPO[grupo] || '', entreno, proximo: siguiente(grupo),
      descansa: !entreno && (dias.indexOf(diaSemana(hoy)) < 0 || visperaCarrera || diaCarrera), ultimo, ultimoFecha: d.ultimoGrupoFecha || null,
      diasSemana, metaDias: metaDias || 4, semana, kmSemana, semanas, fresca, fechaDatos: d.todayKey || null,
      peso: { ultimo: vacio(d.ultimoPeso) ? (pesos.length ? pesos[pesos.length - 1].v : null) : num(d.ultimoPeso),
              promedio7: vacio(r.promedio7) ? null : num(r.promedio7), cambio: vacio(r.cambioSemana) ? null : r1(r.cambioSemana), serie: pesos },
      cintura: { ultima: ultCint, cambio: cints.length >= 2 ? r1(cints[cints.length - 1].v - cints[cints.length - 2].v) : null,
                 desdeInicio: vacio(r.cambioCintura) ? null : r1(r.cambioCintura), meta: vacio(cu.meta) ? null : num(cu.meta), serie: cints },
      carrera: d.carrera && d.carrera.fecha ? { fecha: String(d.carrera.fecha).slice(0, 10), nombre: String(d.carrera.nombre || ''), km: num(d.carrera.km) || null }
        : respaldoCarrera && respaldoCarrera.fecha ? { fecha: respaldoCarrera.fecha, nombre: respaldoCarrera.nombre || '', km: null } : null
    };
  }

  /* ===================== Finanzas (mismas cuentas que la app Finanzas) ===================== */
  const esDeuda = c => c.tipo === 'Crédito' || c.tipo === 'Préstamo';
  // Saldo de hoy: el saldo al corte más lo que registraste desde esa fecha
  function saldo(c, movs) {
    let s = num(c.saldoCorte);
    movs.forEach(m => {
      if (m.fecha < c.fechaCorte) return;
      if (m.cuenta === c.nombre) {
        if (m.tipo === 'Ingreso' || m.tipo === 'Reembolso' || m.tipo === 'Ajuste' || m.tipo === 'Me pagaron' || m.tipo === 'Me prestaron') s += num(m.monto);
        else s -= num(m.monto);   // Gasto, Traspaso (sale), Presté, Le pagué
      }
      if (m.tipo === 'Traspaso' && m.aCuenta === c.nombre) s += num(m.monto);
    });
    return r2(s);
  }
  // Positivo: te debe. Negativo: le debes.
  function saldoPersona(p, movs) {
    let s = num(p.saldoCorte);
    movs.forEach(m => {
      if (m.persona !== p.nombre || m.fecha < p.fechaCorte) return;
      if (m.tipo === 'Presté' || m.tipo === 'Le pagué') s += num(m.monto);
      else if (m.tipo === 'Me pagaron' || m.tipo === 'Me prestaron') s -= num(m.monto);
    });
    return r2(s);
  }
  // Lo de Hoy: saldo por cuenta, patrimonio SIN personas, gasto del mes por categoría y personas aparte.
  // Solo usa las pestañas nuevas (Cuentas, Categorías, Personas y Registro); el historial viejo no se toca.
  function finanzasHoy(d, hoy) {
    d = d || {};
    const movs = (d.movs || []).filter(m => m && m.fecha), mk = hoy.slice(0, 7);
    const cuentas = (d.cuentas || []).filter(c => !c.archivada).map(c => ({ nombre: c.nombre, tipo: c.tipo, deuda: esDeuda(c), saldo: saldo(c, movs),
      limite: vacio(c.limite) ? null : num(c.limite) }));
    const disponible = r2(cuentas.filter(c => !c.deuda).reduce((a, c) => a + c.saldo, 0));
    const deuda = r2(cuentas.filter(c => c.deuda).reduce((a, c) => a - c.saldo, 0));
    const personas = (d.personas || []).map(p => ({ nombre: p.nombre, saldo: saldoPersona(p, movs), archivada: !!p.archivada }))
      .filter(p => p.saldo !== 0);
    const teDeben = personas.filter(p => p.saldo > 0).sort((a, b) => b.saldo - a.saldo);
    const debes = personas.filter(p => p.saldo < 0).map(p => ({ nombre: p.nombre, saldo: -p.saldo })).sort((a, b) => b.saldo - a.saldo);
    // Gasto del mes: gastos menos reembolsos de cada categoría (como "Este mes" en Finanzas)
    const porCat = {};
    movs.forEach(m => {
      if (m.fecha.slice(0, 7) !== mk || (m.tipo !== 'Gasto' && m.tipo !== 'Reembolso')) return;
      porCat[m.categoria] = (porCat[m.categoria] || 0) + (m.tipo === 'Gasto' ? 1 : -1) * num(m.monto);
    });
    const cats = (d.categorias || []).filter(c => c.tipo === 'Gasto');
    const categorias = cats.map(c => ({ nombre: c.nombre, gastado: r2(porCat[c.nombre] || 0), presupuesto: vacio(c.presupuesto) ? null : num(c.presupuesto) }))
      .concat(Object.keys(porCat).filter(n => !cats.some(c => c.nombre === n)).map(n => ({ nombre: n || 'Sin categoría', gastado: r2(porCat[n]), presupuesto: null })))
      .filter(c => c.gastado !== 0 || c.presupuesto);
    categorias.sort((a, b) => pctUso(b) - pctUso(a) || b.gastado - a.gastado);
    const gastado = r2(categorias.reduce((a, c) => a + c.gastado, 0));
    const presupuesto = r2(cats.reduce((a, c) => a + (num(c.presupuesto) || 0), 0));
    const [y, m] = mk.split('-').map(Number), diasMes = new Date(y, m, 0).getDate();
    return {
      cuentas, disponible, deuda, neto: r2(disponible - deuda),
      teDeben, debes, totalTeDeben: r2(teDeben.reduce((a, p) => a + p.saldo, 0)), totalDebes: r2(debes.reduce((a, p) => a + p.saldo, 0)),
      mes: mk, categorias, gastado, presupuesto, avanceMes: Number(hoy.slice(8, 10)) / diasMes, hoja: d.hoja || ''
    };
  }
  // Qué tanto del presupuesto llevas (sin presupuesto: al final de la lista)
  function pctUso(c) { return c.presupuesto ? c.gastado / c.presupuesto : (c.gastado > 0 ? -1 : -2); }

  /* ===================== Comidas ===================== */
  const COMIDAS = [['desayuno', 'Desayuno', '🌅'], ['comida', 'Comida', '🍲'], ['cena', 'Cena', '🌙'], ['snack', 'Snacks', '🍎']];
  const MAC = ['kcal', 'p', 'c', 'g'];
  const macrosDe = (x, f) => { const o = {}; MAC.forEach(k => { o[k] = k === 'kcal' ? Math.round(num(x[k]) * (f || 1)) : r1(num(x[k]) * (f || 1)); }); return o; };
  function sumar(lista) {
    const t = { kcal: 0, p: 0, c: 0, g: 0 };
    (lista || []).forEach(x => MAC.forEach(k => { t[k] += num(x[k]); }));
    return macrosDe(t, 1);
  }
  function delDia(registro, fecha) { return (registro || []).filter(r => r.fecha === fecha); }
  function totalesDia(registro, fecha) {
    const items = delDia(registro, fecha), tot = sumar(items), porComida = {};
    COMIDAS.forEach(([k]) => { porComida[k] = items.filter(r => r.comida === k); });
    return Object.assign(tot, { n: items.length, porComida });
  }
  // "Cumplí": proteína al 95 % o más de la meta y calorías entre 85 % y 110 % de la meta
  function cumple(tot, metas) {
    const prot = num(tot.p) >= 0.95 * num(metas.p), kcal = num(tot.kcal) >= 0.85 * num(metas.kcal) && num(tot.kcal) <= 1.10 * num(metas.kcal);
    return { prot, kcal, ambas: prot && kcal };
  }
  // Semana de lunes a domingo: promedios solo de los días que registraste (los vacíos no bajan el promedio).
  // Hoy va aparte mientras no termina (a mediodía todavía no "fallaste" la meta).
  function resumenSemana(registro, lunes, metas, hoy) {
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const f = sumarDias(lunes, i), t = totalesDia(registro, f);
      dias.push({ fecha: f, kcal: t.kcal, p: t.p, c: t.c, g: t.g, n: t.n, futuro: !!hoy && f > hoy, enCurso: f === hoy, cumple: t.n ? cumple(t, metas) : null });
    }
    const con = dias.filter(d => d.n > 0 && !d.enCurso && !d.futuro), n = con.length, h = dias.find(d => d.enCurso && d.n > 0);
    return {
      lunes, dias, diasConRegistro: n, hoy: h || null,
      promKcal: n ? Math.round(con.reduce((a, d) => a + d.kcal, 0) / n) : null,
      promP: n ? r1(con.reduce((a, d) => a + d.p, 0) / n) : null,
      cumpleProt: con.filter(d => d.cumple.prot).length, cumpleKcal: con.filter(d => d.cumple.kcal).length, cumpleAmbas: con.filter(d => d.cumple.ambas).length
    };
  }
  // Metas: con kcal y proteína, la grasa es el 25 % de las calorías y los carbohidratos lo que queda
  function repartirMetas(kcal, p, pctGrasa) {
    kcal = Math.max(800, Math.round(num(kcal))); p = Math.max(0, Math.round(num(p)));
    const g = Math.round(kcal * (pctGrasa || 0.25) / 9), c = Math.max(0, Math.round((kcal - p * 4 - g * 9) / 4));
    return { kcal, p, c, g };
  }

  /* ----- Alimentos base por 100 g (los mismos valores del catálogo de tu app Gym: USDA y tabla mexicana) ----- */
  const A = (n, p, c, g, kcal) => ({ n, p, c, g, kcal });
  const BASE = {
    pollo: A('Pollo (pierna o muslo)', 24.6, 0, 8.6, 176), res: A('Res guisada', 33.4, 0, 7.7, 212), cerdo: A('Cerdo guisado', 26.8, 0, 8.9, 194),
    picadillo: A('Picadillo', 10.2, 8.2, 6.7, 160), huevo: A('Huevo revuelto', 10.0, 1.6, 11.0, 149), atun: A('Atún', 19.4, 0, 1.0, 86),
    pescado: A('Pescado', 26.2, 0, 2.7, 128), arroz: A('Arroz rojo', 3.4, 25.6, 5.4, 176), frijol: A('Frijoles de olla', 5.8, 11.5, 0.3, 69),
    pasta: A('Pasta', 5.8, 30.9, 0.9, 158), sopa: A('Sopa de fideo', 1.6, 8.6, 1.6, 54), papa: A('Papa', 1.7, 20.0, 0.1, 86),
    verdura: A('Calabacitas', 0.9, 4.3, 0.3, 20), nopal: A('Nopales', 1.4, 3.3, 0.1, 15), aceite: A('Aceite', 0, 0, 100, 884),
    tortMaiz: A('Tortilla de maíz', 5.8, 49.5, 1.1, 224), tortHarina: A('Tortilla de harina', 7.2, 47.7, 9.8, 295),
    leche: A('Leche semidescremada', 3.3, 4.8, 2.0, 50), platano: A('Plátano', 1.1, 22.8, 0.3, 89), fresa: A('Fresas', 0.4, 9.1, 0.1, 35),
    whey: A('Proteína en polvo', 78.1, 6.3, 1.6, 352), queso: A('Queso Oaxaca', 22.8, 9.6, 18.5, 297), refritos: A('Frijoles refritos', 6.1, 18.3, 3.9, 128)
  };
  function deIngredientes(items) {
    const t = { kcal: 0, p: 0, c: 0, g: 0 };
    items.forEach(([id, q]) => { const a = BASE[id]; if (a) MAC.forEach(k => { t[k] += a[k] * q / 100; }); });
    return macrosDe(t, 1);
  }
  // Tus dos comidas de siempre (cantidades estándar; cámbialas en la app cuando midas las tuyas)
  const SEMILLAS = [
    Object.assign({ id: 'g-licuado', nombre: 'Licuado de proteína', comida: 'desayuno', ico: '🥤', fav: true, origen: 'semilla',
      detalle: '250 ml de leche · 1 plátano · 100 g de fresas · 1 scoop de proteína · 5 g de creatina' },
      deIngredientes([['leche', 250], ['platano', 118], ['fresa', 100], ['whey', 30]])),
    Object.assign({ id: 'g-quesadillas', nombre: '2 quesadillas de harina con frijol', comida: 'cena', ico: '🌮', fav: true, origen: 'semilla',
      detalle: '2 tortillas de harina · 60 g de queso Oaxaca · 60 g de frijoles refritos' },
      deIngredientes([['tortHarina', 80], ['queso', 60], ['refritos', 60]]))
  ];

  /* ----- La comida de tu mamá en 3 toques: qué carne, con qué viene y qué tan grande (como el tupper de tu app Gym) ----- */
  const CASERA = {
    proteinas: [['pollo', 'Pollo', '🍗', 120], ['res', 'Res', '🥩', 110], ['cerdo', 'Cerdo', '🐖', 110], ['picadillo', 'Picadillo', '🍖', 220],
      ['huevo', 'Huevo', '🥚', 110], ['atun', 'Atún', '🐟', 100], ['pescado', 'Pescado', '🐠', 120], ['sin', 'Sin carne', '🥗', 0]],
    lados: [['arroz', 'Arroz', '🍚', 150], ['frijol', 'Frijoles', '🫘', 120], ['sopa', 'Sopa de fideo', '🍜', 250], ['pasta', 'Pasta', '🍝', 140],
      ['papa', 'Papa', '🥔', 150], ['verdura', 'Verduras', '🥕', 120], ['nopal', 'Nopales', '🌵', 100]],
    tamanos: [['chico', 'Chico', 0.75], ['normal', 'Normal', 1], ['grande', 'Grande', 1.3]],
    aceite: 7     // g de aceite del guisado en un plato normal
  };
  // sel = { prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 2, tortTipo: 'maiz' }
  function casera(sel) {
    sel = sel || {};
    const f = (CASERA.tamanos.find(t => t[0] === sel.tam) || CASERA.tamanos[1])[2], items = [];
    const pr = CASERA.proteinas.find(x => x[0] === sel.prot);
    if (pr && pr[3]) items.push([pr[0], Math.round(pr[3] * f)]);
    (sel.lados || []).forEach(l => { const x = CASERA.lados.find(y => y[0] === l); if (x) items.push([x[0], Math.round(x[3] * f)]); });
    if (items.length) items.push(['aceite', Math.round(CASERA.aceite * f)]);
    const nt = Math.max(0, Math.round(num(sel.tort)));
    if (nt) items.push(sel.tortTipo === 'harina' ? ['tortHarina', 40 * nt] : ['tortMaiz', 30 * nt]);
    return deIngredientes(items);
  }
  function nombreCasera(sel) {
    sel = sel || {};
    const pr = CASERA.proteinas.find(x => x[0] === sel.prot);
    const partes = [pr && pr[0] !== 'sin' ? pr[1].toLowerCase() : (pr ? 'sin carne' : '')].filter(Boolean)
      .concat((sel.lados || []).map(l => (CASERA.lados.find(y => y[0] === l) || [l, l])[1].toLowerCase()));
    const t = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : (partes[0] || 'comida');
    const nt = Math.round(num(sel.tort));
    return 'Comida de mamá: ' + t + (nt ? ' + ' + nt + ' tortilla' + (nt > 1 ? 's' : '') + (sel.tortTipo === 'harina' ? ' de harina' : '') : '') +
      (sel.tam && sel.tam !== 'normal' ? ' (' + sel.tam + ')' : '');
  }

  /* ----- Comidas registradas en tu app Gym (pestaña Comidas de su hoja) ----- */
  const TIEMPO_GYM = { d: 'desayuno', c: 'comida', n: 'cena', s: 'snack' };
  // Sin tiempo anotado, por la hora (como sugiere la app Gym)
  const tiempoPorHora = h => { const x = Number(String(h || '').slice(0, 2)); return isNaN(x) || !h ? 'snack' : x >= 5 && x < 11 ? 'desayuno' : x >= 11 && x < 17 ? 'comida' : x >= 17 && x < 23 ? 'cena' : 'snack'; };
  // dias = { 'aaaa-mm-dd': [{ h, m, n, p, c, f, k, … }] } → registros como los de Panel. Lo de antes que solo tiene proteína queda marcado
  function deGym(dias) {
    const out = [];
    Object.keys(dias || {}).sort().forEach(f => (dias[f] || []).forEach((x, i) => {
      out.push({ id: 'gym-' + (x.id || f + '-' + i), fecha: f, comida: TIEMPO_GYM[x.m] || tiempoPorHora(x.h), nombre: String(x.n || 'Comida'), hora: String(x.h || ''),
        porcion: 1, kcal: Math.round(num(x.k)), p: r1(x.p), c: r1(x.c), g: r1(x.f), sinMacros: vacio(x.k), origen: 'gym', ref: String(x.ref || '') });
    }));
    return out;
  }
  // Lo que más comes (para el plan): por nombre, cuántas veces, en qué comida suele ir y con los macros de la última vez
  function frecuentes(registro, max) {
    const por = {};
    (registro || []).filter(r => r.origen === 'gym' && !r.sinMacros && r.kcal > 0).forEach(r => {
      const k = String(r.nombre).trim().toLowerCase();
      const x = por[k] = por[k] || { nombre: String(r.nombre).trim(), n: 0, tiempos: {}, ultima: '' };
      x.n++; x.tiempos[r.comida] = (x.tiempos[r.comida] || 0) + 1;
      if (r.fecha >= x.ultima) Object.assign(x, { ultima: r.fecha, kcal: r.kcal, p: r.p, c: r.c, g: r.g });
    });
    return Object.keys(por).map(k => por[k]).map(x => ({ id: 'frec-' + x.nombre.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/g, '-').slice(0, 50), nombre: x.nombre, n: x.n,
      comida: Object.keys(x.tiempos).sort((a, b) => x.tiempos[b] - x.tiempos[a])[0], kcal: x.kcal, p: x.p, c: x.c, g: x.g }))
      .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es')).slice(0, max || 20);
  }

  // Snacks y cosas sueltas para llenar rápido (por porción)
  const SUELTOS = [
    ['Manzana', '🍎', 94, 0.5, 25, 0.4], ['Plátano', '🍌', 105, 1.3, 27, 0.4], ['Yogurt griego', '🥛', 100, 17, 6, 0.7],
    ['Puño de cacahuates', '🥜', 164, 6.8, 6, 13.9], ['Scoop con agua', '💪', 106, 23.4, 1.9, 0.5], ['2 huevos', '🥚', 143, 12.6, 0.7, 9.5],
    ['Pan dulce', '🥐', 260, 4.3, 35.6, 11.5], ['Refresco (lata)', '🥤', 149, 0, 36.9, 0], ['Barra de proteína', '🍫', 200, 20, 22, 7],
    ['2 tacos de asada', '🌮', 412, 18.6, 40.4, 19.6]
  ].map(([nombre, ico, kcal, p, c, g]) => ({ nombre, ico, kcal, p, c, g }));

  /* ===================== Semana: revisión del domingo, objetivos y hábitos ===================== */
  // Gym manda las semanas como 'dd/mm': ¿cae entre ese lunes y su domingo? (se prueba con el año del lunes y del domingo)
  function ddmmEn(ddmm, lunes) {
    const m = /^(\d{2})\/(\d{2})$/.exec(String(ddmm || ''));
    if (!m) return false;
    const dom = sumarDias(lunes, 6);
    return [lunes.slice(0, 4), dom.slice(0, 4)].some(y => { const k = y + '-' + m[2] + '-' + m[1]; return k >= lunes && k <= dom; });
  }
  // Gym en una semana: días que entrenaste, km, peso y cintura de esa semana (con su cambio) y récords.
  // Días: los manda el script de Gym por semana (diasSemanas); si aún no, lo que Panel fue guardando (anotadas: { lunes: n })
  function semanaGym(d, lunes, metaDias, anotadas) {
    d = d || {};
    const r = d.resumen || {}, t = d.trotes || {}, cu = d.cuerpo || {}, dom = sumarDias(lunes, 6);
    const ds = (Array.isArray(r.diasSemanas) ? r.diasSemanas : []).find(x => x && x.l === lunes);
    let dias = ds ? num(ds.n) : null;
    if (dias === null && d.todayKey && lunesDe(d.todayKey) === lunes) dias = vacio(r.diasSemana) ? (r.semana || []).filter(Boolean).length : num(r.diasSemana);
    if (dias === null && anotadas && !vacio(anotadas[lunes])) dias = num(anotadas[lunes]);
    const semanas = Array.isArray(t.semanas) ? t.semanas : [], iKm = semanas.findIndex(x => ddmmEn(x.d, lunes));
    const serie = Array.isArray(cu.serie) ? cu.serie : [];
    const deSerie = campo => {
      const conValor = serie.filter(x => !vacio(x[campo])), i = conValor.findIndex(x => ddmmEn(x.d, lunes));
      if (i < 0) return { v: null, cambio: null };
      return { v: num(conValor[i][campo]), cambio: i > 0 ? r1(num(conValor[i][campo]) - num(conValor[i - 1][campo])) : null };
    };
    return { lunes, dias, metaDias: metaDias || 4, km: iKm >= 0 ? r1(semanas[iKm].km) : null, kmAntes: iKm > 0 ? r1(semanas[iKm - 1].km) : null,
      peso: deSerie('peso'), cintura: deSerie('cint'),
      records: (Array.isArray(r.records) ? r.records : []).filter(x => x && x.k >= lunes && x.k <= dom) };
  }
  // Lo que gastaste esa semana (gastos menos reembolsos, como Finanzas) por categoría, y cómo se compara
  function gastoEntre(movs, desde, hasta) {
    const porCat = {};
    let total = 0;
    (movs || []).forEach(m => {
      if (!m || !m.fecha || m.fecha < desde || m.fecha > hasta || (m.tipo !== 'Gasto' && m.tipo !== 'Reembolso')) return;
      const v = (m.tipo === 'Gasto' ? 1 : -1) * num(m.monto);
      porCat[m.categoria || 'Sin categoría'] = (porCat[m.categoria || 'Sin categoría'] || 0) + v; total += v;
    });
    return { total: r2(total), porCat };
  }
  function gastoSemana(d, lunes) {
    const movs = (d && d.movs) || [], x = gastoEntre(movs, lunes, sumarDias(lunes, 6));
    const conAlgo = l => movs.some(m => m && m.fecha && m.fecha >= l && m.fecha <= sumarDias(l, 6));   // semanas sin nada registrado no se comparan
    const antes = conAlgo(sumarDias(lunes, -7)) ? gastoEntre(movs, sumarDias(lunes, -7), sumarDias(lunes, -1)).total : null;
    let suma4 = 0, n4 = 0;
    for (let i = 1; i <= 4; i++) {
      const l = sumarDias(lunes, -7 * i);
      if (!conAlgo(l)) continue;
      suma4 += gastoEntre(movs, l, sumarDias(l, 6)).total; n4++;
    }
    const cats = Object.keys(x.porCat).map(n => ({ nombre: n, gastado: r2(x.porCat[n]) })).filter(c => c.gastado > 0).sort((a, b) => b.gastado - a.gastado);
    return { total: x.total, cats, antes, prom4: n4 ? r2(suma4 / n4) : null };
  }
  // Hábitos de la semana: cuántos días los marcaste, agua, sueño, ánimo y los tuyos (solo hasta hoy)
  function resumenHabitos(habitos, lunes, hoy) {
    const dom = sumarDias(lunes, 6), hasta = hoy && hoy < dom ? hoy : dom;
    const dias = (habitos || []).filter(h => h && h.fecha >= lunes && h.fecha <= hasta);
    const suenos = dias.filter(h => !vacio(h.sueno)).map(h => num(h.sueno)), animos = dias.filter(h => !vacio(h.animo)).map(h => num(h.animo));
    const extras = {};
    dias.forEach(h => (h.extras || []).forEach(e => { extras[e] = (extras[e] || 0) + 1; }));
    const prom = a => a.length ? r1(a.reduce((x, y) => x + y, 0) / a.length) : null;
    return { lunes, transcurridos: hasta < lunes ? 0 : difDias(lunes, hasta) + 1, marcados: dias.length, agua: dias.filter(h => h.agua === true).length,
      suenoProm: prom(suenos), noches7: suenos.filter(v => v >= 7).length, animoProm: prom(animos), extras };
  }
  // Objetivos de la semana: qué se mide y de dónde sale (ctx = { gym, gasto, comida, habitos } de esa semana)
  const OBJETIVOS = {
    gym: { nombre: 'Entrenar', unidad: 'días', ico: '🏋️', max: 7 }, km: { nombre: 'Correr', unidad: 'km', ico: '🏃', max: 100 },
    comida: { nombre: 'Cumplir la comida', unidad: 'días', ico: '🍽️', max: 7 }, gasto: { nombre: 'Gastar menos de', unidad: '$', ico: '💸', max: 1000000 },
    agua: { nombre: 'Tomar agua', unidad: 'días', ico: '💧', max: 7 }, sueno: { nombre: 'Dormir 7 h o más', unidad: 'noches', ico: '😴', max: 7 },
    libre: { nombre: 'Libre', unidad: '', ico: '✍️', max: 1 }
  };
  function valorObjetivo(o, ctx) {
    ctx = ctx || {};
    switch (o.tipo) {
      case 'gym': return ctx.gym ? ctx.gym.dias : null;
      case 'km': return ctx.gym ? ctx.gym.km : null;
      case 'comida': return ctx.comida ? ctx.comida.cumpleAmbas + (ctx.comida.hoy && ctx.comida.hoy.cumple && ctx.comida.hoy.cumple.ambas ? 1 : 0) : null;
      case 'gasto': return ctx.gasto ? ctx.gasto.total : null;
      case 'agua': return ctx.habitos ? ctx.habitos.agua : null;
      case 'sueno': return ctx.habitos ? ctx.habitos.noches7 : null;
      case 'libre': return o.hecho ? 1 : 0;
    }
    return null;
  }
  // terminada: la semana ya pasó. Gasto: se cumple quedándote abajo; lo demás, llegando a la meta.
  function progresoObjetivo(o, ctx, terminada) {
    const meta = o.tipo === 'libre' ? 1 : num(o.meta), v = valorObjetivo(o, ctx);
    if (v === null || v === undefined) return { valor: null, meta, pct: 0, logrado: null };
    if (o.tipo === 'gasto') {
      const dentro = v <= meta;
      return { valor: r2(v), meta, pct: meta ? Math.min(1, v / meta) : 1, logrado: terminada || !dentro ? dentro : null, pasado: !dentro };
    }
    const ok = v >= meta;
    return { valor: o.tipo === 'km' ? r1(v) : v, meta, pct: meta ? Math.min(1, v / meta) : 1, logrado: ok ? true : terminada ? false : null };
  }
  // Metas que se proponen al elegir un objetivo, con lo de la semana anterior
  function sugerirMeta(tipo, ctx, metaDias) {
    ctx = ctx || {};
    if (tipo === 'gym') return metaDias || 4;
    if (tipo === 'km') return Math.max(5, Math.ceil(num(ctx.gym && ctx.gym.km)));
    if (tipo === 'gasto') { const g = ctx.gasto && (ctx.gasto.prom4 || ctx.gasto.total); return g ? Math.max(100, Math.round(g * 0.9 / 100) * 100) : 2000; }
    if (tipo === 'libre') return 1;
    return 5;
  }

  return { pad, r1, r2, claveDia, sumarDias, difDias, diaSemana, lunesDe, GRUPOS3, NOMBRE_GRUPO, gymHoy, saldo, saldoPersona, finanzasHoy,
           COMIDAS, MAC, macrosDe, sumar, delDia, totalesDia, cumple, resumenSemana, repartirMetas, BASE, deIngredientes, SEMILLAS, CASERA, casera,
           nombreCasera, SUELTOS, deGym, frecuentes, tiempoPorHora,
           ddmmEn, semanaGym, gastoSemana, resumenHabitos, OBJETIVOS, valorObjetivo, progresoObjetivo, sugerirMeta };
})();
if (typeof module !== 'undefined') module.exports = CALC;
