/* Semana: lo que SÍ se hace en Panel.
 * - Hábitos del día (en Hoy): agua, sueño, ánimo y los tuyos, en un toque. Se guardan en la hoja "Comidas 2026" (pestaña Hábitos).
 * - Objetivos de la semana (en Hoy): de 1 a 3, medidos solos con lo de Gym, Finanzas, tus comidas y tus hábitos.
 * - Revisión de la semana (hoja que sube desde abajo): Gym, comida, dinero y hábitos juntos; lo que salió bien,
 *   lo que hay que mejorar y tus objetivos para la que viene. El domingo Hoy te la recuerda.
 * Hábitos y objetivos van por la misma cola que el plan de comidas (pan_cola): primero el celular, luego la hoja.
 */
const DIAS_SEM = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/* ===================== Hábitos ===================== */
const ANIMOS = ['😣', '😕', '😐', '🙂', '😄'];
const SUENOS = [[5, '≤5'], [6, '6'], [7, '7'], [8, '8'], [9, '9+']];
let HAB_AYER = false;
function habitoDe(f) {
  return Object.assign({ id: 'hab-' + f, fecha: f, agua: null, sueno: null, animo: null, extras: [] }, (DB.habitos || []).find(h => h.fecha === f) || {});
}
// Tus hábitos propios (Ajustes › Tus hábitos). Si este celular no los tiene, se sacan de lo que marcaste
function habExtras() {
  const l = LS.get('pan_hab_extra', null);
  if (Array.isArray(l)) return l;
  const vistos = [];
  (DB.habitos || []).slice(-30).forEach(h => (h.extras || []).forEach(e => { if (vistos.indexOf(e) < 0) vistos.push(e); }));
  return vistos;
}
function guardarHab(cambios) {
  const f = HAB_AYER ? sumarDias(hoy(), -1) : hoy(), h = Object.assign(habitoDe(f), cambios);
  cambiar('guardarHabito', [h], 'hab:' + f);
  vibrar(6);
  if (!HOJA_FN) pintar(); else refrescarHoja();
  if (typeof programarAvisos === 'function') programarAvisos();
}
function habAgua(v) { guardarHab({ agua: habitoDe(HAB_AYER ? sumarDias(hoy(), -1) : hoy()).agua === v ? null : v }); }
function habSueno(v) { guardarHab({ sueno: habitoDe(HAB_AYER ? sumarDias(hoy(), -1) : hoy()).sueno === v ? null : v }); }
function habAnimo(v) { guardarHab({ animo: habitoDe(HAB_AYER ? sumarDias(hoy(), -1) : hoy()).animo === v ? null : v }); }
function habExtra(nombre) {
  const h = habitoDe(HAB_AYER ? sumarDias(hoy(), -1) : hoy()), ya = (h.extras || []).indexOf(nombre) >= 0;
  guardarHab({ extras: ya ? h.extras.filter(e => e !== nombre) : (h.extras || []).concat([nombre]) });
}
function verHabDia(ayer) { HAB_AYER = !!ayer; pintar(); vibrar(5); }
const chip = (on, fn, arg, txt, etiqueta) => '<button class="chip' + (on ? ' on' : '') + '" aria-pressed="' + !!on + '"' + clic(fn, arg) + (etiqueta ? ' aria-label="' + esc(etiqueta) + '"' : '') + '>' + txt + '</button>';
function tarjetaHabitos() {
  const f = HAB_AYER ? sumarDias(hoy(), -1) : hoy(), h = habitoDe(f), ex = habExtras();
  const listos = [h.agua !== null, h.sueno !== null, h.animo !== null].filter(Boolean).length;
  let x = '<div class="card hab"><div class="row between" style="margin-bottom:4px"><div class="t1">✅ Tus hábitos</div>' +
    '<div class="seg mini">' + chip(!HAB_AYER, 'verHabDia', false, 'Hoy') + chip(HAB_AYER, 'verHabDia', true, 'Ayer') + '</div></div>';
  x += '<div class="habrow"><span>💧 Agua <small>2 L</small></span><div class="chips">' + chip(h.agua === true, 'habAgua', true, 'Sí') + chip(h.agua === false, 'habAgua', false, 'No') + '</div></div>';
  x += '<div class="habrow"><span>😴 Dormí <small>horas</small></span><div class="chips">' + SUENOS.map(([v, t]) => chip(h.sueno !== null && (v === 9 ? h.sueno >= 9 : v === 5 ? h.sueno <= 5 : h.sueno === v), 'habSueno', v, t, t + ' horas')).join('') + '</div></div>';
  x += '<div class="habrow"><span>Ánimo</span><div class="chips">' + ANIMOS.map((e, i) => chip(h.animo === i + 1, 'habAnimo', i + 1, e, 'Ánimo ' + (i + 1) + ' de 5')).join('') + '</div></div>';
  x += '<div class="chips extras">' + ex.map(n => chip((h.extras || []).indexOf(n) >= 0, 'habExtra', n, ((h.extras || []).indexOf(n) >= 0 ? '✓ ' : '') + esc(n))).join('') +
    '<button class="chip mas"' + clic('abrirAjustes', 'habitos') + '>' + (ex.length ? '＋' : '＋ Agrega los tuyos (leer, sin refresco…)') + '</button></div>';
  if (listos === 3 && !HAB_AYER) x += '<div class="muted small" style="margin-top:8px">Listo por hoy ✓ Se guarda en tu hoja "Comidas 2026".</div>';
  return x + '</div>';
}
// Ajustes › Tus hábitos
function bloqueHabitosAjustes() {
  const ex = habExtras();
  return '<div class="fl" id="aj-habitos">Tus hábitos</div><div class="hint" style="margin:-4px 2px 8px">Además de agua, sueño y ánimo. Salen como botones en Hoy (hasta 6).</div>' +
    (ex.length ? '<div class="list">' + ex.map(n => '<div class="it" style="min-height:52px"><div class="tx"><div class="d1">' + esc(n) + '</div></div>' +
      '<button class="x"' + clic('quitarHabExtra', n) + ' aria-label="Quitar ' + esc(n) + '">' + SVG.x + '</button></div>').join('') + '</div>' : '') +
    (ex.length < 6 ? '<div class="row"><input class="inp" id="nuevoHab" placeholder="p. ej. Leer 10 min" maxlength="30" autocomplete="off">' +
      '<button class="btn sm" style="flex:none"' + clic('agregarHabExtra') + '>Agregar</button></div>' : '');
}
function agregarHabExtra() {
  const n = String($('nuevoHab').value || '').replace(/,/g, ' ').trim().slice(0, 30), ex = habExtras();
  if (!n) return toast('Escribe el hábito');
  if (ex.some(e => e.toLowerCase() === n.toLowerCase())) return toast('Ya lo tienes');
  LS.set('pan_hab_extra', ex.concat([n]).slice(0, 6)); vibrar(); refrescarHoja();
}
function quitarHabExtra(n) { LS.set('pan_hab_extra', habExtras().filter(e => e !== n)); refrescarHoja(); toast('Quitado (lo que ya marcaste se queda en la hoja)'); }

/* ===================== Objetivos ===================== */
// Para qué semana se eligen: de viernes a domingo, para la que viene; antes, para esta
const lunesObjetivos = () => { const k = hoy(), d = diaSemana(k); return d === 0 || d >= 5 ? sumarDias(lunesDe(k), 7) : lunesDe(k); };
const objetivosDe = l => (DB.objetivos || []).filter(o => o.lunes === l);
function ctxSemana(lunes) {
  const gd = DATOS.gym && DATOS.gym.d, fd = DATOS.fin && DATOS.fin.d;
  return {
    gym: gd ? CALC.semanaGym(gd, lunes, CONFIG.META_DIAS_GYM, LS.get('pan_semgym', {})) : null,
    gasto: fd ? CALC.gastoSemana(fd, lunes) : null,
    comida: hayGym() || DB.registro.length ? CALC.resumenSemana(registroTodo(), lunes, metas(), hoy()) : null,
    habitos: CALC.resumenHabitos(DB.habitos, lunes, hoy()),
    ejemplo: { gym: !!(DATOS.gym && DATOS.gym.ejemplo), fin: !!(DATOS.fin && DATOS.fin.ejemplo) }
  };
}
// Lo que tiene que hacer Panel cada vez que lee tu hoja de Gym: anotar los días de gym de esta semana
// (para la revisión, mientras el script de Gym no los mande por semana)
function anotarSemanaGym(d) {
  if (!d || !d.todayKey) return;
  const r = d.resumen || {}, a = LS.get('pan_semgym', {}), l = lunesDe(d.todayKey);
  a[l] = r.diasSemana !== undefined && r.diasSemana !== null ? Number(r.diasSemana) : (r.semana || []).filter(Boolean).length;
  const ks = Object.keys(a).sort();
  ks.slice(0, Math.max(0, ks.length - 12)).forEach(k => delete a[k]);
  LS.set('pan_semgym', a);
}
function textoObjetivo(o) {
  const T = CALC.OBJETIVOS[o.tipo] || CALC.OBJETIVOS.libre, n = Number(o.meta) || 0;
  if (o.tipo === 'libre') return o.texto || 'Objetivo';
  if (o.tipo === 'gasto') return T.nombre + ' ' + money(n, true);
  if (o.tipo === 'km') return T.nombre + ' ' + fmt1(n) + ' km';
  if (o.tipo === 'sueno') return 'Dormir 7 h o más ' + n + (n === 1 ? ' noche' : ' noches');
  if (o.tipo === 'agua') return 'Agua ' + n + (n === 1 ? ' día' : ' días');
  return T.nombre + ' ' + n + (n === 1 ? ' día' : ' días');
}
function valorTexto(o, p) {
  if (p.valor === null) return 'sin datos';
  if (o.tipo === 'libre') return p.valor ? 'hecho' : 'pendiente';
  if (o.tipo === 'gasto') return money(p.valor, true) + ' de ' + money(p.meta, true);
  return (o.tipo === 'km' ? fmt1(p.valor) : p.valor) + ' / ' + (o.tipo === 'km' ? fmt1(p.meta) : p.meta);
}
function filaObjetivo(o, ctx, terminada, conQuitar) {
  const T = CALC.OBJETIVOS[o.tipo] || CALC.OBJETIVOS.libre, p = CALC.progresoObjetivo(o, ctx, terminada);
  const marca = p.logrado === true ? '<b class="green">✓</b> ' : p.logrado === false ? '<b class="red">✗</b> ' : '';
  const clase = o.tipo === 'gasto' ? (p.pasado ? 'over' : p.pct > 0.85 ? 'warn' : '') : p.logrado ? 'ok' : '';
  const libre = o.tipo === 'libre';
  return '<div class="obj">' + (libre && !terminada ? '<button class="objlibre"' + clic('marcarLibre', o.id) + ' aria-pressed="' + !!o.hecho + '">' : '<div class="top2">') +
    '<span>' + T.ico + ' ' + esc(textoObjetivo(o)) + '</span><b class="num">' + marca + valorTexto(o, p) + '</b>' + (libre && !terminada ? '</button>' : '</div>') +
    (libre ? '' : '<div class="meter obj"><div class="' + clase + '" style="width:' + (p.pct * 100).toFixed(1) + '%"></div></div>') +
    (conQuitar ? '<button class="link quitar"' + clic('quitarObjetivo', o.id) + '>Quitar</button>' : '') + '</div>';
}
function marcarLibre(id) {
  const o = (DB.objetivos || []).find(x => x.id === id);
  if (!o) return;
  cambiar('guardarObjetivo', [Object.assign({}, o, { hecho: !o.hecho })], 'obj:' + o.id);
  vibrar(8); if (HOJA_FN) refrescarHoja(); else pintar();
}
function quitarObjetivo(id) {
  const o = (DB.objetivos || []).find(x => x.id === id);
  if (!o) return;
  cambiar('borrarObjetivo', [id], 'obj:' + id);
  refrescarHoja();
  toast('Objetivo quitado', { txt: 'Deshacer', fn: () => { cambiar('guardarObjetivo', [o], 'obj:' + o.id); refrescarHoja(); } });
}
// En Hoy: los objetivos de esta semana con su avance
function tarjetaObjetivos() {
  const l = lunesDe(hoy()), objs = objetivosDe(l), dow = diaSemana(hoy()), proxima = objetivosDe(sumarDias(l, 7));
  let x = '';
  // Domingo (o lunes sin objetivos): la revisión
  if ((dow === 0 && !proxima.length) || (dow === 1 && !objs.length && objetivosDe(sumarDias(l, -7)).length + (DB.habitos || []).length > 0))
    x += '<button class="card revision" ' + clic('abrirRevision') + '><span class="ic">🗓️</span><span class="tx"><b>' + (dow === 0 ? 'Es domingo: revisa tu semana' : 'Revisa cómo te fue la semana pasada') +
      '</b><span class="muted">Gym, comida, dinero y hábitos juntos, y tus objetivos para ' + (dow === 0 ? 'la que viene' : 'esta') + '. 2 minutos.</span></span><span class="muted">›</span></button>';
  if (!objs.length) return x + (dow >= 1 && dow <= 4 ? '<button class="card objvacio"' + clic('abrirRevision', 'objetivos') + '><span>🎯 Ponte 1 a 3 objetivos para esta semana</span><span class="muted">›</span></button>' : '');
  const ctx = ctxSemana(l);
  return x + '<div class="card"><div class="row between"><div class="t1">🎯 Objetivos de la semana</div><button class="link" style="padding:0;min-height:32px"' + clic('abrirRevision') + '>Revisión ›</button></div>' +
    objs.map(o => filaObjetivo(o, ctx, false)).join('') + '</div>';
}

/* ===================== Revisión de la semana (hoja) ===================== */
let REV = null;
function abrirRevision(seccion) {
  const k = hoy(), dow = diaSemana(k);
  // Lunes: la semana que acaba de terminar; el resto, esta
  REV = { lunes: dow === 1 ? sumarDias(lunesDe(k), -7) : lunesDe(k) };
  abrirHoja(hojaRevision);
  if (seccion) setTimeout(() => { const el = $('rev-' + seccion); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 150);
}
function moverRevision(n) {
  const l = sumarDias(REV.lunes, 7 * n);
  if (l > lunesDe(hoy()) || l < sumarDias(lunesDe(hoy()), -7 * 7)) return;
  REV.lunes = l; refrescarHoja(); vibrar(5);
}
function nombreSemana(l) {
  const n = difDias(lunesDe(hoy()), l) / 7;
  return n === 0 ? 'Esta semana' : n === -1 ? 'La semana pasada' : n === 1 ? 'La semana que viene' : 'Semana del ' + diaCorto(l);
}
// Lo que salió bien y lo que hay que mejorar (frases cortas, solo con datos de verdad)
function balanceSemana(ctx, terminada) {
  const bien = [], mal = [], g = ctx.gym, c = ctx.comida, $g = ctx.gasto, h = ctx.habitos;
  if (g && !ctx.ejemplo.gym) {
    if (g.dias !== null && g.dias >= g.metaDias) bien.push('Entrenaste ' + g.dias + ' días (tu meta: ' + g.metaDias + ').');
    else if (g.dias !== null && terminada) mal.push('Entrenaste ' + g.dias + ' de ' + g.metaDias + ' días.');
    if (g.km !== null && g.kmAntes !== null && g.km > g.kmAntes + 0.5) bien.push('Corriste ' + fmt1(g.km - g.kmAntes) + ' km más que la semana anterior.');
    if (g.records.length) bien.push(g.records.length === 1 ? 'Récord en ' + g.records[0].ej + '.' : g.records.length + ' récords: ' + g.records.slice(0, 3).map(r => r.ej).join(', ') + '.');
    if (g.peso.cambio !== null && g.peso.cambio <= -0.2) bien.push('Tu peso promedio bajó ' + fmt1(-g.peso.cambio) + ' kg.');
    else if (g.peso.cambio !== null && g.peso.cambio >= 0.4) mal.push('Tu peso promedio subió ' + fmt1(g.peso.cambio) + ' kg.');
    if (g.cintura.cambio !== null && g.cintura.cambio < 0) bien.push('Tu cintura bajó ' + fmt1(-g.cintura.cambio) + ' cm.');
  }
  if (c && c.diasConRegistro >= 3) {
    const x = c.cumpleAmbas / c.diasConRegistro;
    if (x >= 0.7) bien.push('Cumpliste la comida ' + c.cumpleAmbas + ' de ' + c.diasConRegistro + ' días.');
    else mal.push('Cumpliste la comida ' + c.cumpleAmbas + ' de ' + c.diasConRegistro + ' días' + (c.cumpleProt < c.cumpleKcal ? ': lo que más falla es la proteína.' : c.cumpleKcal < c.cumpleProt ? ': lo que más falla son las calorías.' : '.'));
  }
  if ($g && !ctx.ejemplo.fin && $g.prom4) {
    if ($g.total < $g.prom4 * 0.85) bien.push('Gastaste ' + money($g.prom4 - $g.total, true) + ' menos que tu promedio.');
    else if ($g.total > $g.prom4 * 1.2 && (terminada || $g.total > $g.prom4 * 1.5)) mal.push('Gastaste ' + money($g.total - $g.prom4, true) + ' más que tu promedio' + ($g.cats[0] ? ' (sobre todo en ' + $g.cats[0].nombre + ').' : '.'));
  }
  if (h.suenoProm !== null && h.marcados >= 3) {
    if (h.suenoProm >= 7) bien.push('Dormiste ' + fmt1(h.suenoProm) + ' h en promedio.');
    else if (h.suenoProm < 6.5) mal.push('Dormiste ' + fmt1(h.suenoProm) + ' h en promedio: lo ideal es 7 o más.');
  }
  return { bien: bien.slice(0, 4), mal: mal.slice(0, 3) };
}
function hojaRevision() {
  const l = REV.lunes, dom = sumarDias(l, 6), terminada = dom < hoy(), ctx = ctxSemana(l), objs = objetivosDe(l);
  const n = difDias(lunesDe(hoy()), l) / 7;
  let h = cabeza('Revisión de la semana');
  h += '<div class="daynav"><button class="arrow"' + clic('moverRevision', -1) + ' aria-label="Semana anterior"' + (n <= -7 ? ' disabled' : '') + '>' + SVG.izq + '</button>' +
    '<div class="nm">' + nombreSemana(l) + '<small>' + diaCorto(l) + ' – ' + diaCorto(dom) + (terminada ? '' : ' · va en curso') + '</small></div>' +
    '<button class="arrow"' + clic('moverRevision', 1) + ' aria-label="Semana siguiente"' + (n >= 0 ? ' disabled' : '') + '>' + SVG.der + '</button></div>';
  if (ctx.ejemplo.gym || ctx.ejemplo.fin) h += '<div class="note">' + (ctx.ejemplo.gym && ctx.ejemplo.fin ? 'Gym y Finanzas son' : ctx.ejemplo.gym ? 'Gym es' : 'Finanzas es') + ' de ejemplo hasta que conectes tus hojas.</div>';
  // Objetivos de esa semana
  if (objs.length) {
    const ok = objs.filter(o => CALC.progresoObjetivo(o, ctx, terminada).logrado === true).length;
    h += '<div class="card"><div class="row between"><div class="t1">🎯 Objetivos</div><b class="' + (terminada ? (ok === objs.length ? 'green' : '') : '') + '">' + ok + ' de ' + objs.length + (terminada ? ' cumplidos' : ' van cumplidos') + '</b></div>' +
      objs.map(o => filaObjetivo(o, ctx, terminada)).join('') + '</div>';
  }
  // Lo bueno y lo que falta
  const B = balanceSemana(ctx, terminada);
  if (B.bien.length || B.mal.length) h += '<div class="card balance">' + (B.bien.length ? '<div class="t1">👏 Lo que salió bien</div><ul>' + B.bien.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
    (B.mal.length ? '<div class="t1"' + (B.bien.length ? ' style="margin-top:10px"' : '') + '>🔧 Para mejorar</div><ul>' + B.mal.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') + '</div>';
  // Gym
  const g = ctx.gym;
  h += '<h2>🏋️ Gym y cuerpo</h2>';
  if (!g) h += '<div class="card empty">Conecta Gym para verlo aquí.</div>';
  else {
    h += '<div class="grid2">' +
      stat('Días de gym', g.dias === null ? '—' : g.dias, 'de ' + g.metaDias, g.dias === null ? 'Sin datos de esa semana' : '', g.dias !== null && g.dias >= g.metaDias ? 'bien' : '') +
      // Semana en curso: la anterior solo de referencia (comparar media semana contra una completa no dice nada)
      stat('Trote', g.km === null ? '—' : fmt1(g.km), 'km', g.kmAntes === null || g.km === null ? '' : !terminada && g.km < g.kmAntes ? 'La anterior: ' + fmt1(g.kmAntes) + ' km'
        : (g.km >= g.kmAntes ? '▲ ' : '▼ ') + fmt1(Math.abs(g.km - g.kmAntes)) + ' km vs la anterior', g.km !== null && g.kmAntes !== null && (terminada || g.km >= g.kmAntes) ? (g.km >= g.kmAntes ? 'bien' : 'mal') : '') +
      stat('Peso promedio', g.peso.v === null ? '—' : fmt1(g.peso.v), 'kg', g.peso.v === null && !terminada ? 'Sale al cerrar la semana' : g.peso.cambio === null ? '' : (g.peso.cambio <= 0 ? '▼ ' : '▲ ') + fmt1(Math.abs(g.peso.cambio)) + ' kg', g.peso.cambio === null ? '' : g.peso.cambio <= 0 ? 'bien' : 'mal') +
      stat('Cintura', g.cintura.v === null ? '—' : fmt1(g.cintura.v), 'cm', g.cintura.cambio === null ? '' : (g.cintura.cambio <= 0 ? '▼ ' : '▲ ') + fmt1(Math.abs(g.cintura.cambio)) + ' cm', g.cintura.cambio === null ? '' : g.cintura.cambio <= 0 ? 'bien' : 'mal') + '</div>';
    if (g.records.length) h += '<div class="list">' + g.records.slice(0, 5).map(r => '<div class="it"><div class="ic">🏆</div><div class="tx"><div class="d1">' + esc(r.ej) + '</div><div class="d2">' +
      esc((r.w ? r.w + ' ' + (r.unit || '') + ' × ' + r.r : '') + (r.tipo ? ' · récord de ' + r.tipo : '')) + '</div></div><div class="m">' + diaCorto(r.k).split(' ').slice(0, 2).join(' ') + '</div></div>').join('') + '</div>';
  }
  // Comida
  const c = ctx.comida, m = metas();
  h += '<h2>🍽️ Comida</h2>';
  if (!c || !c.diasConRegistro) h += '<div class="card empty">' + (c && c.hoy ? 'Hoy llevas ' + fmt0(c.hoy.kcal) + ' kcal. Los días completos se cuentan desde mañana.' : 'Sin comidas registradas en Gym esa semana.') + '</div>';
  else h += '<div class="grid2">' + stat('Días que cumpliste', c.cumpleAmbas, 'de ' + c.diasConRegistro, c.cumpleProt + ' con proteína · ' + c.cumpleKcal + ' en kcal', c.cumpleAmbas / c.diasConRegistro >= 0.7 ? 'bien' : 'mal') +
    stat('Promedio', fmt0(c.promKcal), 'kcal', r0(c.promP) + ' g de proteína (meta ' + r0(m.p) + ')', c.promP >= 0.95 * m.p ? 'bien' : 'mal') + '</div>';
  // Dinero
  const $g = ctx.gasto;
  h += '<h2>💸 Dinero</h2>';
  if (!$g) h += '<div class="card empty">Conecta Finanzas para verlo aquí.</div>';
  else {
    const vs = (v, txt) => v === null || v === undefined ? '' : '<div class="qrow"><span>' + txt + '</span><b class="' + ($g.total <= v ? 'green' : 'red') + '">' + ($g.total <= v ? '▼ ' : '▲ ') + money(Math.abs($g.total - v), true) + '</b></div>';
    h += '<div class="card"><div class="muted">Gastaste' + (terminada ? '' : ' (hasta hoy)') + '</div><div class="amt">' + money($g.total, true) + '</div>' +
      vs($g.antes, 'vs la semana anterior (' + money($g.antes, true) + ')') + vs($g.prom4, 'vs tu promedio (' + money($g.prom4 || 0, true) + ')') +
      ($g.cats.length ? '<div class="fl" style="margin:12px 0 4px">En qué</div>' + $g.cats.slice(0, 4).map(x => '<div class="qrow"><span>' + (ICONO_CAT[x.nombre] || '•') + ' ' + esc(x.nombre) + '</span><b>' + money(x.gastado, true) + '</b></div>').join('') : '') + '</div>';
  }
  // Hábitos
  const hb = ctx.habitos;
  h += '<h2>✅ Hábitos</h2>';
  if (!hb.marcados) h += '<div class="card empty">' + (hb.transcurridos ? 'No marcaste hábitos esa semana. Se marcan en Hoy, en un toque.' : 'La semana aún no empieza.') + '</div>';
  else {
    h += '<div class="grid2">' + stat('Días que marcaste', hb.marcados, 'de ' + hb.transcurridos, '💧 agua ' + hb.agua + (hb.agua === 1 ? ' día' : ' días'), '') +
      stat('Sueño', hb.suenoProm === null ? '—' : fmt1(hb.suenoProm), 'h', hb.suenoProm === null ? '' : hb.noches7 + ' noches de 7 h o más', hb.suenoProm === null ? '' : hb.suenoProm >= 7 ? 'bien' : 'mal') + '</div>';
    const ex = Object.keys(hb.extras);
    if (hb.animoProm !== null || ex.length) h += '<div class="card">' + (hb.animoProm !== null ? '<div class="qrow" style="border:0"><span>Ánimo promedio</span><b>' + ANIMOS[Math.max(0, Math.min(4, Math.round(hb.animoProm) - 1))] + ' ' + fmt1(hb.animoProm) + ' de 5</b></div>' : '') +
      ex.map(e => '<div class="qrow"><span>' + esc(e) + '</span><b>' + hb.extras[e] + (hb.extras[e] === 1 ? ' día' : ' días') + '</b></div>').join('') + '</div>';
  }
  // Objetivos para la semana que viene (o esta, de lunes a jueves)
  const lo = lunesObjetivos(), objsN = objetivosDe(lo), ctxN = ctxSemana(lo);
  h += '<h2 id="rev-objetivos">🎯 ' + (lo === lunesDe(hoy()) ? 'Objetivos de esta semana' : 'Objetivos para la semana que viene') + '</h2>';
  h += '<div class="card">' + (objsN.length ? objsN.map(o => filaObjetivo(o, ctxN, false, true)).join('') : '<div class="muted">Elige de 1 a 3. Se miden solos con lo que ya registras: no tienes que anotar nada más.</div>') +
    (objsN.length < 3 ? '<div class="pick" style="margin-top:12px">' + Object.keys(CALC.OBJETIVOS).filter(t => t === 'libre' || !objsN.some(o => o.tipo === t))
      .map(t => '<button' + clic('nuevoObjetivo', t, lo) + '>' + CALC.OBJETIVOS[t].ico + ' ' + (t === 'libre' ? 'Otro' : CALC.OBJETIVOS[t].nombre) + '</button>').join('') + '</div>' : '') + '</div>';
  return h;
}
function stat(titulo, v, unidad, d, clase) {
  return '<div class="stat"><div class="muted">' + titulo + '</div><div class="v">' + v + '<small>' + unidad + '</small></div>' + (d ? '<div class="d ' + (clase || '') + '">' + d + '</div>' : '') + '</div>';
}

/* ----- Elegir un objetivo nuevo ----- */
let NO = null;
function nuevoObjetivo(tipo, lunes) {
  const base = ctxSemana(sumarDias(lunes, -7));
  NO = { tipo, lunes, meta: CALC.sugerirMeta(tipo, base, CONFIG.META_DIAS_GYM), texto: '' };
  HOJA_FN = hojaNuevoObjetivo; refrescarHoja(); $('sheet').scrollTop = 0;
}
function hojaNuevoObjetivo() {
  const T = CALC.OBJETIVOS[NO.tipo];
  let h = cabeza(T.ico + ' ' + (NO.tipo === 'libre' ? 'Otro objetivo' : T.nombre));
  if (NO.tipo === 'libre') h += '<div class="fl">¿Qué te propones?</div><input class="inp" id="noTexto" value="' + esc(NO.texto) + '" placeholder="p. ej. Llamar a mi abuela" maxlength="80"' + alEscribir('noCampo', 'texto') + '>' +
    '<div class="hint">Lo palomeas tú en Hoy cuando lo hagas.</div>';
  else if (NO.tipo === 'gasto') h += '<div class="fl">Máximo en la semana</div><input class="inp" id="noMeta" type="number" inputmode="numeric" min="0" step="100" value="' + esc(NO.meta) + '"' + alEscribir('noCampo', 'meta') + '>' +
    '<div class="hint">Cuenta todos tus gastos de la semana en Finanzas (menos reembolsos). Te propuse un 10 % menos que tu promedio.</div>';
  else h += '<div class="fl">Meta</div><div class="stepper"><button' + clic('noPaso', -1) + ' aria-label="Menos">−</button><b id="noMetaV">' + (NO.tipo === 'km' ? fmt1(NO.meta) : NO.meta) + '</b><span class="muted">' + T.unidad + '</span>' +
    '<button' + clic('noPaso', 1) + ' aria-label="Más">＋</button></div><div class="hint">' + ({ gym: 'Cuenta los días que registras en Gym.', km: 'Los km de tus trotes en Gym.', comida: 'Un día cumple con proteína al 95 % y calorías entre 85 y 110 % de tu meta.',
      agua: 'Los días que marques 💧 Sí en Hoy.', sueno: 'Las noches que marques 7 horas o más en Hoy.' }[NO.tipo] || '') + '</div>';
  return h + '<div class="actbar"><button class="btn ghost"' + clic('volverARevision') + '>Cancelar</button><button class="btn"' + clic('guardarNuevoObjetivo') + '>Agregar</button></div>';
}
function noCampo(k, v) { if (k === 'texto' || k === 'meta') NO[k] = v; }
function noPaso(n) {
  const T = CALC.OBJETIVOS[NO.tipo], paso = NO.tipo === 'km' ? (NO.meta >= 10 ? 2 : 1) : 1;
  NO.meta = Math.max(1, Math.min(T.max, (Number(NO.meta) || 0) + n * paso));
  $('noMetaV').textContent = NO.tipo === 'km' ? fmt1(NO.meta) : NO.meta; vibrar(5);
}
function volverARevision() { HOJA_FN = hojaRevision; refrescarHoja(); setTimeout(() => { const el = $('rev-objetivos'); if (el) el.scrollIntoView({ block: 'start' }); }, 30); }
function guardarNuevoObjetivo() {
  const texto = String(NO.texto || '').trim(), meta = NO.tipo === 'libre' ? 0 : Math.round(Number(NO.meta) || 0);
  if (NO.tipo === 'libre' && !texto) return toast('Escribe tu objetivo');
  if (NO.tipo !== 'libre' && meta <= 0) return toast('Pon una meta mayor a 0');
  if (objetivosDe(NO.lunes).length >= 3) return toast('Máximo 3 por semana: así sí se cumplen');
  const o = { id: 'obj-' + NO.lunes + '-' + uid(), lunes: NO.lunes, tipo: NO.tipo, meta, texto: texto.slice(0, 80), hecho: false };
  cambiar('guardarObjetivo', [o], 'obj:' + o.id);
  toast('Objetivo agregado ✓'); vibrar();
  if (typeof programarAvisos === 'function') programarAvisos();
  volverARevision();
}
