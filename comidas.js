/* Comidas: lo que comes se registra en tu app Gym; aquí lo ves contra tus metas, con tu plan de la semana y tu resumen.
 * Las metas, el plan y tus platillos guardados son de Panel: viven primero en el celular (pan_db) y cada cambio entra a una
 * cola (pan_cola) que se sube a la hoja "Comidas 2026"; si no hay señal, se reintenta solo. Las metas también se le mandan a Gym.
 */
const NOMBRE_COMIDA = {}, ICO_COMIDA = {};
CALC.COMIDAS.forEach(([k, n, i]) => { NOMBRE_COMIDA[k] = n; ICO_COMIDA[k] = i; });
const DIAS_HOJA = 120;      // cuántos días de registro baja la app de la hoja
let DB = null;
let SUB = ['dia', 'semana', 'resumen'].indexOf(LS.get('pan_sub', 'dia')) >= 0 ? LS.get('pan_sub', 'dia') : 'dia';
let DIA = null, SEM = null, SEM_RES = null;        // null = hoy / esta semana

/* ===================== Datos en el celular ===================== */
function dbNueva() {
  return { registro: [], plan: [], metas: Object.assign({}, CONFIG.METAS),
           guardadas: CALC.SEMILLAS.map(s => Object.assign({}, s, { creada: hoy() })) };
}
function iniciarComidas() {
  DB = LS.get('pan_db', null);
  if (!DB || !Array.isArray(DB.registro)) { DB = dbNueva(); guardarDB(); }
  // Lo que iba en camino cuando se cerró la app se vuelve a mandar (en la hoja no se duplica)
  const q = cola();
  if (q.some(x => x.enviado)) LS.set('pan_cola', q.map(x => Object.assign(x, { enviado: false })));
}
function guardarDB() { if (!LS.set('pan_db', DB)) toast('Tu celular no tiene espacio: exporta un respaldo en Ajustes'); }
// Metas: las calcula la app Gym (con tu peso, tus días de gym, tus km y cómo vas bajando) y Panel solo las muestra.
// Mientras Gym no las mande (script de Gym 8.1+), se usan las de Panel.
function metasDeGym() { const g = typeof COMGYM !== 'undefined' && COMGYM && COMGYM.metasGym; return g && g.deGym && g.kcal ? g : null; }
function metas() {
  const g = metasDeGym();
  if (g) return { kcal: g.kcal, p: g.p, c: g.c, g: g.g, deGym: true, auto: g.auto, mant: g.mant, porque: g.porque || '' };
  const m = DB && DB.metas; return m && m.kcal ? m : Object.assign({}, CONFIG.METAS);
}
const r0 = n => Math.round(Number(n) || 0);
const macrosTexto = x => fmt0(x.kcal) + ' kcal · P ' + r0(x.p) + ' · C ' + r0(x.c) + ' · G ' + r0(x.g);
const macrosHtml = x => '<span class="mac">' + fmt0(x.kcal) + ' kcal · <i class="p">P ' + r0(x.p) + '</i> · <i class="c">C ' + r0(x.c) + '</i> · <i class="g">G ' + r0(x.g) + '</i></span>';
function guardadasOrdenadas(comida) {
  return DB.guardadas.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (comida ? (b.comida === comida ? 1 : 0) - (a.comida === comida ? 1 : 0) : 0) ||
    String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

// Un cambio: lo mismo se aplica aquí y en la hoja (por ID; repetirlo no duplica nada)
function aplicarOp(db, op) {
  const a = op.args || [];
  const pon = (lista, x) => { const i = lista.findIndex(y => y.id === x.id); if (i >= 0) lista[i] = x; else lista.push(x); };
  switch (op.action) {
    case 'guardarRegistro': pon(db.registro, Object.assign({}, a[0])); break;
    case 'borrarRegistro': db.registro = db.registro.filter(x => x.id !== a[0]); break;
    case 'guardarGuardada': pon(db.guardadas, Object.assign({}, a[0])); break;
    case 'borrarGuardada': db.guardadas = db.guardadas.filter(x => x.id !== a[0]); break;
    case 'guardarPlan': pon(db.plan, Object.assign({}, a[0])); break;
    case 'borrarPlan': db.plan = db.plan.filter(x => x.id !== a[0]); break;
    case 'guardarMetas': db.metas = Object.assign({}, a[0]); break;
  }
}
function cambiar(action, args, tag) {
  const op = { id: uid(), action, args, tag: tag || null };
  aplicarOp(DB, op); guardarDB(); encolar(op);
}

/* ===================== Cola para subir a la hoja ===================== */
let ENVIANDO = false, BAJANDO = false, ENVIOS = 0, ENVIO_T = null, COM_ERROR = null;
// Antes de mandar nada: que la URL sea de verdad el script de Comidas (si fuera el de Gym, tus comidas se rechazarían
// y se perderían de la cola). Se revisa una vez por URL.
async function verificarComidas() {
  const u = urlDe('com');
  if (LS.get('pan_com_ok', '') === u) return true;
  const d = await llamar('com', { action: 'data', args: [1] });
  revisarScript('com', d);
  LS.set('pan_com_ok', u); COM_ERROR = null;
  return true;
}
function cola() { return LS.get('pan_cola', []); }
function encolar(op) {
  // Del mismo dato solo cuenta el último cambio (si aún no va en camino)
  let q = cola();
  if (op.tag) q = q.filter(x => x.tag !== op.tag || x.enviado);
  q.push(op);
  if (!LS.set('pan_cola', q)) toast('Tu celular no tiene espacio: exporta un respaldo en Ajustes');
  pintarSync();
  clearTimeout(ENVIO_T); ENVIO_T = setTimeout(enviar, 1500);
}
async function enviar() {
  if (ENVIANDO || !conectada('com') || navigator.onLine === false || !cola().length) return;
  ENVIANDO = true; pintarSync();
  let fallo = false;
  const rechazados = [];
  try {
    let verificada = true;
    try { await verificarComidas(); }
    catch (e) {
      // URL o clave equivocada: no se manda nada (se queda todo en la cola) hasta que la corrijas; sin señal, se reintenta
      verificada = false;
      if (/Esa URL|Clave/.test(e.message)) COM_ERROR = mensajeError(e); else fallo = true;
    }
    if (verificada) COM_ERROR = null;
    for (let vuelta = 0; verificada && vuelta < 50; vuelta++) {
      const lote = cola().slice(0, 80);
      if (!lote.length) break;
      const ids = new Set(lote.map(x => x.id));
      LS.set('pan_cola', cola().map(x => ids.has(x.id) ? Object.assign(x, { enviado: true }) : x));
      let res;
      try { res = await llamar('com', { action: 'batch', args: [lote.map(x => ({ id: x.id, action: x.action, args: x.args }))] }, 90000); }
      catch (e) {
        fallo = true;
        LS.set('pan_cola', cola().map(x => ids.has(x.id) ? Object.assign(x, { enviado: false }) : x));
        if (/Clave/.test(e.message)) toast('Comidas: ' + mensajeError(e));
        break;
      }
      ENVIOS++;
      const listos = new Set(), intentos = {};
      (Array.isArray(res) ? res : []).forEach(r => {
        if (r.ok) return listos.add(r.id);
        const op = lote.find(o => o.id === r.id);
        // Un error pasajero de Google no tira el dato: se reintenta 3 veces antes de avisarte
        if (op && (op.intentos || 0) < 2) { intentos[r.id] = (op.intentos || 0) + 1; fallo = true; return; }
        listos.add(r.id);
        rechazados.push({ cuando: hoy(), msg: String(r.error || 'Error') });
      });
      LS.set('pan_cola', cola().filter(x => !listos.has(x.id))
        .map(x => ids.has(x.id) ? Object.assign(x, { enviado: false }, intentos[x.id] ? { intentos: intentos[x.id] } : {}) : x));
      if (!listos.size || fallo) { fallo = true; break; }
    }
  } finally { ENVIANDO = false; pintarSync(); }
  if (rechazados.length) {
    LS.set('pan_rechazados', LS.get('pan_rechazados', []).concat(rechazados).slice(-20));
    toast('La hoja de Comidas no aceptó ' + (rechazados.length === 1 ? 'un cambio' : rechazados.length + ' cambios') + '; mira Ajustes');
  }
  if (fallo) { clearTimeout(ENVIO_T); ENVIO_T = setTimeout(enviar, 20000); }
}
// Baja lo de la hoja (por si registraste desde otro celular) y le encima lo que aún no se sube
async function bajarComidas(avisar, intento) {
  if (!conectada('com') || BAJANDO || ENVIANDO) return;
  BAJANDO = true;
  const n0 = ENVIOS;
  let repetir = false;
  try {
    const d = await llamar('com', { action: 'data', args: [DIAS_HOJA] }, 60000);
    if (ENVIOS !== n0 && (intento || 0) < 2) { repetir = true; return; }   // se subió algo mientras leía: se vuelve a leer
    try { revisarScript('com', d); } catch (e) { COM_ERROR = e.message; if (avisar) toast('Comidas: ' + COM_ERROR); return; }   // nunca se borra lo tuyo con datos de otra hoja
    COM_ERROR = null;
    const base = { registro: d.registro || [], guardadas: d.guardadas || [], plan: d.plan || [], metas: d.metas && d.metas.kcal ? d.metas : null };
    // La primera vez que este celular lee esta hoja: sube lo que tengas en el celular y la hoja no tenga
    // (tus dos comidas de siempre, y cualquier registro o plan que no haya llegado) y tus metas si la hoja aún no tiene.
    // Después, lo que diga la hoja manda.
    if (!LS.get('pan_primera_ok', false)) [['guardadas', 'guardarGuardada', 'gua:'], ['registro', 'guardarRegistro', 'reg:'], ['plan', 'guardarPlan', 'plan:']].forEach(([lista, accion, tag]) => {
      (DB[lista] || []).forEach(x => {
        if (base[lista].some(y => y.id === x.id)) return;
        if (lista !== 'guardadas' && x.fecha < sumarDias(hoy(), -DIAS_HOJA)) return;
        base[lista].push(x);
        if (!cola().some(op => op.tag === tag + x.id)) encolar({ id: uid(), action: accion, args: [x], tag: tag + x.id });
      });
    });
    if (!base.metas) { base.metas = metas(); if (!cola().some(op => op.tag === 'metas')) encolar({ id: uid(), action: 'guardarMetas', args: [base.metas], tag: 'metas' }); }
    LS.set('pan_primera_ok', true);
    cola().forEach(op => aplicarOp(base, op));
    DB = base; guardarDB();
    LS.set('pan_ult_com', Date.now());
    if (avisar) toast('Comidas al día ✓');
    if (TAB === 'comidas' && !HOJA_FN) pintar();
  } catch (e) {
    if (avisar) toast('Comidas: ' + mensajeError(e));
  } finally {
    BAJANDO = false;
    if (repetir) bajarComidas(avisar, (intento || 0) + 1);
  }
}
async function sincronizar(avisar) {
  if (!conectada('com')) return;
  await enviar();
  if (!cola().some(x => !x.intentos)) await bajarComidas(avisar);
}

/* ===================== Lo que comes: lo registras en tu app Gym ===================== */
// Panel lee la pestaña "Comidas" de tu hoja de Gym (acción comidasPanel del script de Gym 8.1, repo Gym-script) y solo la muestra.
// Con un script de Gym más viejo, usa lo que ya manda la app Gym (hoy y ayer).
// Lo que registraste en Panel antes de este cambio (DB.registro) se sigue sumando, marcado como "de Panel".
const DIAS_GYM = 42;
let COMGYM = LS.get('pan_comgym', null);     // { dias: { fecha: [items] }, ts, metasGym }
let COMGYM_ERROR = null, LEYENDO_GYM = false, REG_CACHE = null;
async function leerComidasGym(avisar) {
  if (!conectada('gym') || LEYENDO_GYM) return;
  LEYENDO_GYM = true;
  try {
    const d = await llamar('gym', { action: 'comidasPanel', args: [DIAS_GYM] }, 60000);
    if (!d || typeof d.dias !== 'object') throw new Error('Esa URL no es la de tu script de Gym');
    COMGYM = { dias: d.dias, ts: Date.now(), metasGym: d.metas || null };
    LS.set('pan_comgym', COMGYM); COMGYM_ERROR = null; REG_CACHE = null;
  } catch (e) {
    COMGYM_ERROR = /Acción desconocida/.test(e.message) ? 'sin-panel-gs' : mensajeError(e);
    if (avisar && COMGYM_ERROR !== 'sin-panel-gs') toast('Comidas de Gym: ' + COMGYM_ERROR);
  } finally {
    LEYENDO_GYM = false;
    if (!HOJA_FN) pintar();
  }
}
// Días de Gym: lo de comidasPanel y, encima, lo que la app Gym mandó más reciente para hoy y ayer
function diasGym() {
  const dias = Object.assign({}, COMGYM && COMGYM.dias);
  const g = DATOS.gym;
  if (g && !g.ejemplo && g.d && g.d.comidasDias && (!COMGYM || g.ts > COMGYM.ts)) Object.assign(dias, g.d.comidasDias);
  return dias;
}
// Todo lo que comiste: lo de Gym y lo que quedó registrado en Panel antes
function registroTodo() {
  if (REG_CACHE && REG_CACHE.dia === hoy() && REG_CACHE.ts === (COMGYM && COMGYM.ts) && REG_CACHE.gts === (DATOS.gym && DATOS.gym.ts) && REG_CACHE.n === DB.registro.length) return REG_CACHE.r;
  const r = CALC.deGym(diasGym()).concat(DB.registro.map(x => Object.assign({}, x, { origen: 'panel' })));
  REG_CACHE = { r, dia: hoy(), ts: COMGYM && COMGYM.ts, gts: DATOS.gym && DATOS.gym.ts, n: DB.registro.length };
  return r;
}
const hayGym = () => conectada('gym') && !DATOS.gym.ejemplo;
// Registrar: en tu app Gym (en el APK abre directo su pestaña Comida)
function abrirGymComida() {
  if (NATIVO) return abrirApp(null, 'comida');
  try { window.open(CONFIG.APPS.gym, '_blank', 'noopener'); } catch (e) { location.href = CONFIG.APPS.gym; }
}
// Lo de antes que registraste en Panel: solo se puede quitar (lo nuevo va en Gym)
function borrarRegistro(id) {
  const r = DB.registro.find(x => x.id === id);
  if (!r) return;
  cambiar('borrarRegistro', [id], 'reg:' + id);
  vibrar(8); pintar();
  toast('Quitado', { txt: 'Deshacer', fn: () => { cambiar('guardarRegistro', [r], 'reg:' + r.id); pintar(); } });
}
// Lee kcal y macros de un formulario: números positivos; sin kcal, se calculan
function macrosForm(x) {
  const n = v => { const t = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(t) && t >= 0 ? Math.min(t, 9999) : null; };
  const p = n(x.p) || 0, c = n(x.c) || 0, g = n(x.g) || 0, k = n(x.kcal);
  return { kcal: Math.round(k !== null && x.kcal !== '' ? k : p * 4 + c * 4 + g * 9), p: r1(p), c: r1(c), g: r1(g) };
}

// Antes (1.3) Panel le mandaba sus metas a Gym; ya no: lo que quedó pendiente de mandar se descarta
LS.del('pan_metas_gym');

/* ===================== Pantalla Comidas ===================== */
function pintarComidas() {
  let h = '<div class="seg" role="tablist">' + [['dia', 'Día'], ['semana', 'Plan semanal'], ['resumen', 'Resumen']]
    .map(([k, t]) => '<button role="tab" aria-selected="' + (SUB === k) + '" class="' + (SUB === k ? 'on' : '') + '" onclick="verSub(\'' + k + '\')">' + t + '</button>').join('') + '</div>';
  if (!hayGym()) h += '<div class="note info">Lo que comes se registra en tu app <b>Gym</b> y aquí lo ves con tus metas, tu plan y tu resumen. ' +
    'Para eso conecta Gym (engrane › Conexión).</div>';
  else if (COMGYM_ERROR === 'sin-panel-gs' && !LS.get('pan_aviso_panelgs', false)) h += '<div class="note">Solo veo hoy y ayer de tu app Gym. Para ver tus semanas completas, ' +
    'tu script de Gym tiene que ser la versión 8.1 o más nueva (se publica solo desde GitHub; no pegues nada a mano). <button class="link" style="padding:4px 0 0;min-height:0;color:inherit;text-decoration:underline" ' +
    'onclick="LS.set(\'pan_aviso_panelgs\',true);pintar()">Entendido</button></div>';
  else if (COMGYM_ERROR && COMGYM_ERROR !== 'sin-panel-gs') h += '<div class="note red">No pude leer tus comidas de Gym: ' + esc(COMGYM_ERROR) + '</div>';
  return h + (SUB === 'semana' ? vistaSemana() : SUB === 'resumen' ? vistaResumen() : vistaDia());
}
function verSub(k) { SUB = k; LS.set('pan_sub', k); pintar(true); vibrar(6); }

/* ----- Día ----- */
function anillo(v, meta) {
  const R = 54, C = 2 * Math.PI * R, p = meta > 0 ? Math.min(1, v / meta) : 0, pasa = v > meta * 1.1;
  return '<div class="anillo"><svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="' + R + '" fill="none" stroke="var(--card2)" stroke-width="12"/>' +
    '<circle cx="64" cy="64" r="' + R + '" fill="none" stroke="' + (pasa ? 'var(--bad)' : 'var(--kcal)') + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (C * p).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg>' +
    '<div class="c"><div><b>' + fmt0(v) + '</b><span>de ' + fmt0(meta) + ' kcal</span></div></div></div>';
}
function barraMacro(nombre, v, meta, color) {
  const p = meta > 0 ? v / meta : 0;
  return '<div class="mb" style="--c:var(' + color + ')"><div class="top2"><span>' + nombre + '</span><b>' + r0(v) + ' <span class="muted">/ ' + r0(meta) + ' g</span></b></div>' +
    '<div class="bar"><div class="' + (p > 1.1 ? 'pasa' : '') + '" style="width:' + Math.min(100, p * 100).toFixed(1) + '%"></div></div></div>';
}
// La tarjeta del anillo y las barras (también la usa Hoy)
function tarjetaMacros(f, conTexto) {
  const t = CALC.totalesDia(registroTodo(), f), m = metas(), faltaP = r0(m.p - t.p), quedan = r0(m.kcal - t.kcal);
  return '<div class="macros">' + anillo(t.kcal, m.kcal) + '<div class="mbars">' +
    barraMacro('Proteína', t.p, m.p, '--prot') + barraMacro('Carbs', t.c, m.c, '--carb') + barraMacro('Grasa', t.g, m.g, '--gras') + '</div></div>' +
    (conTexto === false ? '' : '<div class="resta">' + (t.n === 0 ? 'Aún no registras nada ' + (f === hoy() ? 'hoy' : 'ese día') + ' en Gym.' :
      (faltaP > 0 ? 'Te faltan <b>' + faltaP + ' g de proteína</b>' : '<b class="green">Proteína cumplida ✓</b>') + ' · ' +
      (quedan >= 0 ? 'te quedan <b>' + fmt0(quedan) + ' kcal</b>' : 'te pasaste <b class="red">' + fmt0(-quedan) + ' kcal</b>')) +
      (t.porComida && registroTodo().some(r => r.fecha === f && r.sinMacros) ? '<br><span class="small">Algo de ese día solo tiene proteína (de antes): no suma calorías.</span>' : '') + '</div>');
}
// En Hoy: cómo vas con la comida (lo de Gym contra tus metas); tocarla abre Comidas
function tarjetaComidaHoy(k) {
  if (!hayGym() && !DB.registro.some(r => r.fecha === k)) return '';
  return '<div class="card" role="button" tabindex="0" onclick="verTab(\'comidas\')" style="cursor:pointer"><div class="row between" style="margin-bottom:8px"><div class="t1">🍽️ Comida de hoy</div>' +
    '<span class="muted">Ver ›</span></div>' + tarjetaMacros(k) + '</div>';
}
const mismoNombre = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
// ¿Ya comiste lo que planeaste? 'si' (lo mismo; la comida de mamá cuenta con cualquier cosa a mediodía),
// 'otra' (en ese tiempo registraste otra cosa) o '' (nada todavía)
function planHecho(p, items) {
  if (items.some(r => p.gid === 'casera' ? r.comida === 'comida' : mismoNombre(r.nombre, p.nombre) || (p.gid && r.ref === p.gid))) return 'si';
  return items.some(r => r.comida === p.comida) ? 'otra' : '';
}
function vistaDia() {
  const f = DIA || hoy(), reg = registroTodo(), t = CALC.totalesDia(reg, f), desde = sumarDias(hoy(), -(DIAS_GYM - 1));
  let h = '<div class="daynav"><button class="arrow" onclick="moverDia(-1)" aria-label="Día anterior"' + (f <= desde ? ' disabled' : '') + '>' + SVG.izq + '</button>' +
    '<div class="nm">' + diaRelativo(f) + '<small>' + (f === hoy() ? fechaLarga(f) : diaCorto(f)) + '</small></div>' +
    '<button class="arrow" onclick="moverDia(1)" aria-label="Día siguiente"' + (f >= hoy() ? ' disabled' : '') + '>' + SVG.der + '</button></div>';
  h += '<div class="card">' + tarjetaMacros(f) + '</div>';
  if (f === hoy()) h += '<button class="btn com block" style="margin-bottom:12px" onclick="abrirGymComida()">＋ Registrar en Gym</button>';
  // El plan de ese día: qué ya comiste y qué falta
  const plan = DB.plan.filter(p => p.fecha === f).sort((a, b) => ordenComida(a.comida) - ordenComida(b.comida)), delDia = reg.filter(r => r.fecha === f);
  if (plan.length) h += '<div class="fl" style="margin-top:4px">Tu plan de ' + (f === hoy() ? 'hoy' : 'ese día') + '</div><div class="card flat" style="padding:6px 14px">' + plan.map(p => {
    const ok = planHecho(p, delDia);
    return '<div class="qrow"><span>' + esc(NOMBRE_COMIDA[p.comida]) + ' · ' + esc((p.ico || '') + ' ' + p.nombre) + '</span><b class="' + (ok === 'si' ? 'green' : 'muted') + '">' +
      (ok === 'si' ? '✓' : ok === 'otra' ? 'otra cosa' : 'pendiente') + '</b></div>';
  }).join('') + '</div>';
  CALC.COMIDAS.forEach(([k, nombre, ico]) => {
    const items = t.porComida[k], sub = CALC.sumar(items);
    if (!items.length) return;
    h += '<div class="list"><div class="comida-h"><div class="t1">' + ico + ' ' + nombre + '</div><div class="muted mac">' + fmt0(sub.kcal) + ' kcal · <i class="p">' + r0(sub.p) + ' g P</i></div></div>' +
      items.map(r => '<div class="it"><div class="ic">' + (r.origen === 'gym' ? '🏋️' : '📱') + '</div><div class="tx"><div class="d1">' + esc(r.nombre) +
        (Number(r.porcion) !== 1 ? ' <span class="muted">×' + fmt1(r.porcion) + '</span>' : '') + '</div><div class="d2">' +
        (r.sinMacros ? '<span class="mac"><i class="p">P ' + r0(r.p) + '</i> · solo proteína</span>' : macrosHtml(r)) + (r.hora ? ' · ' + esc(r.hora) : '') + (r.origen === 'panel' ? ' · de Panel' : '') + '</div></div>' +
        (r.origen === 'panel' ? '<button class="x" data-id="' + esc(r.id) + '" onclick="borrarRegistro(this.dataset.id)" aria-label="Quitar ' + esc(r.nombre) + '">' + SVG.x + '</button>' : '') + '</div>').join('') + '</div>';
  });
  if (!t.n) h += '<div class="card empty">' + (hayGym() ? 'Nada registrado ' + (f === hoy() ? 'hoy' : 'ese día') + '. Lo que anotes en Gym aparece aquí.' : 'Conecta Gym para ver lo que comes.') + '</div>';
  return h;
}
const ordenComida = k => CALC.COMIDAS.findIndex(c => c[0] === k);
function moverDia(n) {
  const f = sumarDias(DIA || hoy(), n);
  if (f > hoy() || f < sumarDias(hoy(), -(DIAS_GYM - 1))) return;
  DIA = f === hoy() ? null : f; pintar(); vibrar(5);
}

/* ----- Comidas guardadas: crear, editar, favorita, borrar ----- */
let ED = null;
function abrirEditorGuardada(id) {
  const g = id ? DB.guardadas.find(x => x.id === id) : null;
  ED = g ? Object.assign({ nueva: false }, g) : { nueva: true, id: 'g-' + uid(), nombre: '', comida: (PL && PL.k) || 'snack', ico: '🍽️', fav: true, kcal: '', p: '', c: '', g: '', detalle: '', origen: 'manual', creada: hoy() };
  const volver = HOJA_FN;
  ED.volver = volver && volver !== hojaEditorGuardada ? volver : null;
  if (HOJA_FN) { HOJA_FN = hojaEditorGuardada; refrescarHoja(); $('sheet').scrollTop = 0; } else abrirHoja(hojaEditorGuardada);
}
function hojaEditorGuardada() {
  let h = cabeza(ED.nueva ? 'Nueva comida guardada' : 'Editar comida guardada');
  h += '<div class="fl">Nombre</div><div class="row"><input class="inp" style="width:64px;text-align:center;font-size:22px;padding:8px" value="' + esc(ED.ico) + '" oninput="ED.ico=this.value" maxlength="4" aria-label="Ícono">' +
    '<input class="inp" value="' + esc(ED.nombre) + '" placeholder="p. ej. Avena con plátano" oninput="ED.nombre=this.value" maxlength="80"></div>';
  h += '<div class="fl">Normalmente es</div><div class="pick">' + CALC.COMIDAS.map(([k, n, i]) => '<button class="' + (ED.comida === k ? 'on' : '') + '" onclick="ED.comida=\'' + k + '\';refrescarHoja()">' + i + ' ' + n + '</button>').join('') + '</div>';
  h += '<div class="fl">Por porción</div><div class="g4">' + [['kcal', 'kcal'], ['p', 'Prot. g'], ['c', 'Carbs g'], ['g', 'Grasa g']].map(([k, t]) =>
    '<div><label>' + t + '</label><input class="inp" type="number" inputmode="decimal" min="0" step="any" value="' + esc(ED[k]) + '" oninput="ED.' + k + '=this.value"></div>').join('') + '</div>';
  h += '<div class="fl">Qué lleva (opcional)</div><input class="inp" value="' + esc(ED.detalle) + '" placeholder="Ingredientes o cantidades" oninput="ED.detalle=this.value" maxlength="200">';
  h += interruptor(ED.fav, 'ED.fav=!ED.fav;refrescarHoja()', 'Favorita ⭐', 'Sale como botón de un toque en ' + NOMBRE_COMIDA[ED.comida].toLowerCase());
  return h + '<div class="actbar">' + (ED.nueva ? '<button class="btn ghost" onclick="volverDeEditor()">Cancelar</button>' : '<button class="btn danger" onclick="borrarGuardada()">Borrar</button>') +
    '<button class="btn" onclick="guardarGuardadaForm()">Guardar</button></div>';
}
function volverDeEditor() { if (ED && ED.volver) { HOJA_FN = ED.volver; refrescarHoja(); } else cerrarHoja(); }
function guardarGuardadaForm() {
  const nombre = String(ED.nombre || '').trim(), m = macrosForm(ED);
  if (!nombre) return toast('Ponle nombre');
  if (!m.kcal) return toast('Pon las kcal o los macros');
  const g = Object.assign({ id: ED.id, nombre: nombre.slice(0, 80), comida: ED.comida, ico: String(ED.ico || '🍽️').trim().slice(0, 4) || '🍽️', fav: !!ED.fav,
    detalle: String(ED.detalle || '').slice(0, 200), origen: ED.origen === 'semilla' ? 'editada' : (ED.origen || 'manual'), creada: ED.creada || hoy() }, m);
  cambiar('guardarGuardada', [g], 'gua:' + g.id);
  toast('Guardada ✓'); vibrar();
  volverDeEditor();
}
function borrarGuardada() {
  const g = DB.guardadas.find(x => x.id === ED.id);
  if (!g || !confirm('¿Borrar "' + g.nombre + '" de tus comidas guardadas? Lo que ya registraste no cambia.')) return;
  cambiar('borrarGuardada', [g.id], 'gua:' + g.id);
  toast('Borrada', { txt: 'Deshacer', fn: () => { cambiar('guardarGuardada', [g], 'gua:' + g.id); refrescarHoja(); pintar(); } });
  volverDeEditor();
}

/* ----- Plan semanal: con lo que más comes (de Gym), tus platillos guardados y la comida de mamá ----- */
const idPlan = (f, k) => 'plan-' + f + '-' + k;
// La comida de mamá cambia cada día: en el plan va un plato normal estimado
const MAMA_PLAN = () => Object.assign({ gid: 'casera', nombre: 'Comida de mamá (aprox.)', ico: '🍲' }, CALC.casera({ prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 2 }));
const frecuentes = () => CALC.frecuentes(registroTodo(), 20);
function vistaSemana() {
  const lunes = SEM || lunesDe(hoy()), m = metas(), n = difDias(lunesDe(hoy()), lunes) / 7;
  let h = '<div class="daynav"><button class="arrow" onclick="moverSemana(-1)" aria-label="Semana anterior">' + SVG.izq + '</button><div class="nm">' +
    (n === 0 ? 'Esta semana' : n === 1 ? 'La próxima semana' : n === -1 ? 'La semana pasada' : 'Semana del ' + diaCorto(lunes)) + '<small>' + diaCorto(lunes) + ' – ' + diaCorto(sumarDias(lunes, 6)) + '</small></div>' +
    '<button class="arrow" onclick="moverSemana(1)" aria-label="Semana siguiente">' + SVG.der + '</button></div>';
  h += '<div class="btns" style="margin-bottom:12px"><button class="btn sm ghost" onclick="llenarSiempre()">Llenar con lo de siempre</button><button class="btn sm ghost" onclick="copiarSemana()">Copiar la anterior</button></div>';
  const reg = registroTodo();
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i), items = DB.plan.filter(p => p.fecha === f), t = CALC.sumar(items), d = fechaDe(f), comido = reg.filter(r => r.fecha === f);
    h += '<div class="card pdia' + (f === hoy() ? ' hoy' : '') + '"><div class="cab"><div class="t1">' + DIAS[d.getDay()] + ' ' + d.getDate() + (f === hoy() ? ' · hoy' : '') + '</div>' +
      '<div class="muted mac">' + (items.length ? fmt0(t.kcal) + ' / ' + fmt0(m.kcal) + ' kcal · <i class="p">' + r0(t.p) + ' g P</i>' : 'Sin plan') + '</div></div>' +
      CALC.COMIDAS.map(([k, nombre]) => {
        const p = items.find(x => x.comida === k), ok = p && f <= hoy() && planHecho(p, comido) === 'si';
        return '<button class="slot" onclick="elegirPlan(\'' + f + '\',\'' + k + '\')"><span class="k">' + nombre + '</span><span class="n' + (p ? '' : ' vacio') + '">' +
          (p ? esc((p.ico || '') + ' ' + p.nombre) : '+ Elegir') + '</span>' + (p ? '<span class="kc">' + (ok ? '<b class="green">✓</b> ' : '') + fmt0(p.kcal) + ' kcal</span>' : '') + '</button>';
      }).join('') + '</div>';
  }
  return h + '<div class="hint" style="text-align:center">✓ = ya lo registraste en Gym ese día.</div>';
}
function moverSemana(n) { SEM = sumarDias(SEM || lunesDe(hoy()), 7 * n); if (SEM === lunesDe(hoy())) SEM = null; pintar(); vibrar(5); }
let PL = null;
function elegirPlan(f, k) { PL = { f, k, frec: frecuentes() }; abrirHoja(hojaPlan); }
function hojaPlan() {
  const actual = DB.plan.find(p => p.id === idPlan(PL.f, PL.k)), marca = id => actual && actual.gid === id ? ' ✓' : '';
  const fila = (id, ico, nombre, sub) => '<button class="it" data-id="' + esc(id) + '" onclick="ponerPlan(this.dataset.id)"><div class="ic">' + esc(ico) + '</div>' +
    '<div class="tx"><div class="d1">' + esc(nombre) + marca(id) + '</div><div class="d2">' + sub + '</div></div></button>';
  const frec = PL.frec.slice().sort((a, b) => (b.comida === PL.k) - (a.comida === PL.k) || b.n - a.n);
  let h = cabeza(NOMBRE_COMIDA[PL.k] + ' · ' + diaCorto(PL.f));
  if (frec.length) h += '<div class="fl">Lo que más comes (de Gym)</div><div class="list">' +
    frec.map(x => fila(x.id, '🏋️', x.nombre, macrosHtml(x) + ' · ' + x.n + (x.n === 1 ? ' vez' : ' veces'))).join('') + '</div>';
  h += '<div class="fl">Tus platillos</div><div class="list">' + guardadasOrdenadas(PL.k).map(g => fila(g.id, g.ico || '🍽️', g.nombre, macrosHtml(g))).join('') +
    fila('casera', '🍲', 'Comida de mamá (aprox.)', 'Cambia cada día: cuenta un plato normal') + '</div>';
  if (actual) h += '<button class="btn danger block" onclick="quitarPlan()">Quitar del plan</button>';
  return h;
}
function planDe(gid, f, k, frec) {
  let base = null;
  if (gid === 'casera') base = MAMA_PLAN();
  else if (/^frec-/.test(gid)) { const x = (frec || frecuentes()).find(y => y.id === gid); if (x) base = Object.assign({ gid: x.id, nombre: x.nombre, ico: '🏋️' }, CALC.macrosDe(x, 1)); }
  else { const g = DB.guardadas.find(x => x.id === gid); if (g) base = Object.assign({ gid: g.id, nombre: g.nombre, ico: g.ico }, CALC.macrosDe(g, 1)); }
  return base ? Object.assign({ id: idPlan(f, k), fecha: f, comida: k, porcion: 1 }, base) : null;
}
function ponerPlan(gid) {
  const p = planDe(gid, PL.f, PL.k, PL.frec);
  if (!p) return;
  cambiar('guardarPlan', [p], 'plan:' + p.id); vibrar(8); cerrarHoja();
}
function quitarPlan() { const id = idPlan(PL.f, PL.k); cambiar('borrarPlan', [id], 'plan:' + id); cerrarHoja(); }
// En los huecos vacíos: tu desayuno y tu cena más frecuentes en Gym (o tus favoritos de Panel) y la comida de mamá a mediodía
function llenarSiempre() {
  const lunes = SEM || lunesDe(hoy()), frec = frecuentes();
  const de = k => { const x = frec.find(y => y.comida === k && y.n >= 2); if (x) return x.id; const g = DB.guardadas.find(y => y.fav && y.comida === k); return g ? g.id : null; };
  const elegidos = { desayuno: de('desayuno'), comida: 'casera', cena: de('cena') };
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i);
    Object.keys(elegidos).forEach(k => {
      if (!elegidos[k] || DB.plan.some(p => p.id === idPlan(f, k))) return;
      const p = planDe(elegidos[k], f, k, frec);
      if (p) { cambiar('guardarPlan', [p], 'plan:' + p.id); n++; }
    });
  }
  toast(n ? 'Listo: ' + n + ' comidas al plan' : 'La semana ya estaba llena'); vibrar(); pintar();
}
function copiarSemana() {
  const lunes = SEM || lunesDe(hoy()), antes = sumarDias(lunes, -7), fin = sumarDias(antes, 6);
  const prev = DB.plan.filter(p => p.fecha >= antes && p.fecha <= fin);
  if (!prev.length) return toast('La semana anterior no tiene plan');
  prev.forEach(p => { const f = sumarDias(p.fecha, 7), q = Object.assign({}, p, { id: idPlan(f, p.comida), fecha: f }); cambiar('guardarPlan', [q], 'plan:' + q.id); });
  toast('Copiadas ' + prev.length + ' comidas de la semana anterior'); vibrar(); pintar();
}

/* ----- Resumen semanal ----- */
function vistaResumen() {
  const lunes = SEM_RES || lunesDe(hoy()), m = metas(), R = CALC.resumenSemana(registroTodo(), lunes, m, hoy()), n = difDias(lunesDe(hoy()), lunes) / 7;
  let h = '<div class="daynav"><button class="arrow" onclick="moverResumen(-1)" aria-label="Semana anterior">' + SVG.izq + '</button><div class="nm">' +
    (n === 0 ? 'Esta semana' : n === -1 ? 'La semana pasada' : 'Semana del ' + diaCorto(lunes)) + '<small>' + diaCorto(lunes) + ' – ' + diaCorto(sumarDias(lunes, 6)) + '</small></div>' +
    '<button class="arrow" onclick="moverResumen(1)" aria-label="Semana siguiente"' + (n >= 0 ? ' disabled' : '') + '>' + SVG.der + '</button></div>';
  if (!R.diasConRegistro) return h + '<div class="card empty">' + (n !== 0 ? 'Esa semana no tiene comidas registradas.' : R.hoy
    ? 'Hoy llevas ' + fmt0(R.hoy.kcal) + ' kcal y ' + r0(R.hoy.p) + ' g de proteína. Los promedios cuentan los días completos: empiezan mañana.'
    : (hayGym() ? 'Esta semana aún no registras comidas en Gym. En cuanto anotes algo, aquí ves tus promedios.' : 'Conecta Gym para ver tus promedios.')) + '</div>';
  const pk = R.promKcal / m.kcal, pp = R.promP / m.p;
  h += '<div class="grid2">' +
    '<div class="stat"><div class="muted">Promedio de calorías</div><div class="v">' + fmt0(R.promKcal) + '<small>kcal</small></div><div class="d ' + (pk >= 0.85 && pk <= 1.1 ? 'bien' : 'mal') + '">' + Math.round(pk * 100) + '% de ' + fmt0(m.kcal) + '</div></div>' +
    '<div class="stat"><div class="muted">Promedio de proteína</div><div class="v">' + r0(R.promP) + '<small>g</small></div><div class="d ' + (pp >= 0.95 ? 'bien' : 'mal') + '">' + Math.round(pp * 100) + '% de ' + r0(m.p) + ' g</div></div></div>';
  h += '<div class="card"><div class="row between"><div><div class="muted">Días que cumpliste</div><div class="amt" style="font-size:30px">' + R.cumpleAmbas + ' <span class="muted" style="font:500 15px var(--txt)">de ' + R.diasConRegistro + ' registrados</span></div></div>' +
    '<div style="text-align:right" class="small"><div><b>' + R.cumpleProt + '</b> <span class="muted">con proteína</span></div><div><b>' + R.cumpleKcal + '</b> <span class="muted">en rango de kcal</span></div></div></div>';
  const mx = Math.max(m.kcal * 1.25, ...R.dias.map(d => d.kcal)), L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  h += '<div class="barsem"><div class="linea" style="bottom:' + (m.kcal / mx * 100).toFixed(1) + '%"></div>' + R.dias.map(d =>
    '<div class="col"><i class="' + (!d.n ? 'vacio' : d.cumple.ambas && !d.enCurso ? 'ok' : '') + '" style="' + (d.enCurso ? 'opacity:.45;' : '') + 'height:' + (d.n ? Math.max(4, d.kcal / mx * 100) : 3).toFixed(1) + '%" title="' + fmt0(d.kcal) + ' kcal"></i></div>').join('') + '</div>' +
    '<div class="dsem">' + R.dias.map((d, i) => '<div>' + L[i] + '<b>' + (d.n ? r0(d.p) + ' g' : '·') + '</b></div>').join('') + '</div>' +
    '<div class="muted small" style="margin-top:10px">Barras: kcal del día (verde = cumpliste; la línea punteada es tu meta). Abajo: proteína.' +
    (R.hoy ? ' Hoy va en curso (barra clara) y cuenta hasta mañana.' : '') + '</div></div>';
  h += '<div class="hint" style="margin:-2px 4px 14px">Cumplir = proteína al 95 % o más de tu meta y calorías entre 85 % y 110 %. Los promedios solo cuentan los días completos que registraste.</div>';
  // Semanas anteriores
  const filas = [];
  for (let i = 1; i <= 4; i++) {
    const l = sumarDias(lunes, -7 * i), x = CALC.resumenSemana(registroTodo(), l, m, hoy());
    if (x.diasConRegistro) filas.push('<div class="it"><div class="tx"><div class="d1">Semana del ' + diaCorto(l) + '</div><div class="d2">' + x.diasConRegistro + ' días registrados · cumpliste ' + x.cumpleAmbas + '</div></div>' +
      '<div class="m">' + fmt0(x.promKcal) + '<small>' + r0(x.promP) + ' g prot.</small></div></div>');
  }
  if (filas.length) h += '<h2>Semanas anteriores</h2><div class="list">' + filas.join('') + '</div>';
  return h;
}
function moverResumen(n) { const l = sumarDias(SEM_RES || lunesDe(hoy()), 7 * n); if (l > lunesDe(hoy())) return; SEM_RES = l === lunesDe(hoy()) ? null : l; pintar(); vibrar(5); }
