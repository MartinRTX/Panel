/* Comidas: registro del día con macros contra tus metas, comidas guardadas de un toque, la comida de tu mamá en 3 toques,
 * plan de la semana y resumen semanal.
 * Todo se guarda primero en el celular (pan_db). Cada cambio entra a una cola (pan_cola) que se sube a la hoja
 * "Comidas 2026" en cuanto está conectada; si no hay señal, se reintenta solo.
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
function metas() { const m = DB && DB.metas; return m && m.kcal ? m : Object.assign({}, CONFIG.METAS); }
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
let ENVIANDO = false, BAJANDO = false, ENVIOS = 0, ENVIO_T = null;
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
    for (let vuelta = 0; vuelta < 50; vuelta++) {
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
    const base = { registro: d.registro || [], guardadas: d.guardadas || [], plan: d.plan || [], metas: d.metas && d.metas.kcal ? d.metas : null };
    // La primera vez que este celular lee la hoja: sube tus comidas guardadas que la hoja no tenga (tus dos de siempre)
    // y tus metas si la hoja aún no tiene. Después, lo que diga la hoja manda.
    if (!LS.get('pan_primera_ok', false)) DB.guardadas.forEach(g => {
      if (base.guardadas.some(x => x.id === g.id)) return;
      base.guardadas.push(g);
      if (!cola().some(op => op.tag === 'gua:' + g.id)) encolar({ id: uid(), action: 'guardarGuardada', args: [g], tag: 'gua:' + g.id });
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

/* ===================== Registrar ===================== */
function registrar(item, aviso) {
  const r = Object.assign({ id: uid(), registrado: Date.now(), porcion: 1, origen: 'manual', ref: '' }, item);
  cambiar('guardarRegistro', [r], 'reg:' + r.id);
  vibrar(10);
  if (!HOJA_FN) pintar();
  toast(aviso || 'Agregado ✓', { txt: 'Deshacer', fn: () => { cambiar('borrarRegistro', [r.id], 'reg:' + r.id); pintar(); } });
  return r;
}
function registrarGuardada(gid, comida, fecha, porcion) {
  const g = DB.guardadas.find(x => x.id === gid);
  if (!g) return;
  const f = porcion || 1;
  registrar(Object.assign({ fecha: fecha || DIA || hoy(), comida: comida || g.comida || 'snack', nombre: g.nombre, porcion: f, origen: 'guardada', ref: g.id }, CALC.macrosDe(g, f)),
    (g.ico || '') + ' ' + g.nombre + ' ✓');
}
function borrarRegistro(id) {
  const r = DB.registro.find(x => x.id === id);
  if (!r) return;
  cambiar('borrarRegistro', [id], 'reg:' + id);
  vibrar(8); pintar();
  toast('Quitado', { txt: 'Deshacer', fn: () => { cambiar('guardarRegistro', [r], 'reg:' + r.id); pintar(); } });
}
function icoDe(r) {
  const g = r.ref && DB.guardadas.find(x => x.id === r.ref), s = CALC.SUELTOS.find(x => x.nombre === r.nombre);
  return r.origen === 'casera' ? '🍲' : g ? (g.ico || '🍽️') : s ? s.ico : r.origen === 'plan' ? '📅' : '🍽️';
}

/* ===================== Pantalla Comidas ===================== */
function pintarComidas() {
  let h = '<div class="seg" role="tablist">' + [['dia', 'Día'], ['semana', 'Plan semanal'], ['resumen', 'Resumen']]
    .map(([k, t]) => '<button role="tab" aria-selected="' + (SUB === k) + '" class="' + (SUB === k ? 'on' : '') + '" onclick="verSub(\'' + k + '\')">' + t + '</button>').join('') + '</div>';
  if (!conectada('com') && !LS.get('pan_aviso_local', false)) h += '<div class="note info">Tus comidas se guardan en este celular. Cuando conectes la hoja "Comidas 2026" se suben solas, con todo lo que hayas registrado. ' +
    '<button class="link" style="padding:4px 0 0;min-height:0;color:inherit;text-decoration:underline" onclick="LS.set(\'pan_aviso_local\',true);pintar()">Entendido</button></div>';
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
function vistaDia() {
  const f = DIA || hoy(), t = CALC.totalesDia(DB.registro, f), m = metas();
  let h = '<div class="daynav"><button class="arrow" onclick="moverDia(-1)" aria-label="Día anterior">' + SVG.izq + '</button>' +
    '<div class="nm">' + diaRelativo(f) + '<small>' + (f === hoy() ? fechaLarga(f) : diaCorto(f)) + '</small></div>' +
    '<button class="arrow" onclick="moverDia(1)" aria-label="Día siguiente"' + (f >= hoy() ? ' disabled' : '') + '>' + SVG.der + '</button></div>';
  const faltaP = r0(m.p - t.p), quedan = r0(m.kcal - t.kcal);
  h += '<div class="card"><div class="macros">' + anillo(t.kcal, m.kcal) + '<div class="mbars">' +
    barraMacro('Proteína', t.p, m.p, '--prot') + barraMacro('Carbs', t.c, m.c, '--carb') + barraMacro('Grasa', t.g, m.g, '--gras') + '</div></div>' +
    '<div class="resta">' + (t.n === 0 ? 'Aún no registras nada ' + (f === hoy() ? 'hoy' : 'ese día') + '.' :
      (faltaP > 0 ? 'Te faltan <b>' + faltaP + ' g de proteína</b>' : '<b class="green">Proteína cumplida ✓</b>') + ' · ' +
      (quedan >= 0 ? 'te quedan <b>' + fmt0(quedan) + ' kcal</b>' : 'te pasaste <b class="red">' + fmt0(-quedan) + ' kcal</b>')) + '</div></div>';
  // Lo que planeaste para este día y aún no registras
  const pend = DB.plan.filter(p => p.fecha === f && t.porComida[p.comida] &&
    !t.porComida[p.comida].some(r => (p.gid === 'casera' ? r.origen === 'casera' : p.gid && r.ref === p.gid) || r.ref === 'plan:' + p.id));
  if (pend.length) h += '<div class="fl" style="margin-top:4px">Del plan de ' + (f === hoy() ? 'hoy' : 'ese día') + '</div><div class="quick">' +
    pend.sort((a, b) => ordenComida(a.comida) - ordenComida(b.comida)).map(p => '<button data-id="' + esc(p.id) + '" onclick="registrarPlan(this.dataset.id)">+ ' +
      esc(p.ico || ICO_COMIDA[p.comida]) + ' ' + esc(p.nombre) + '</button>').join('') + '</div>';
  CALC.COMIDAS.forEach(([k, nombre, ico]) => {
    const items = t.porComida[k], sub = CALC.sumar(items);
    h += '<div class="list"><div class="comida-h"><div class="t1">' + ico + ' ' + nombre + '</div><div class="muted mac">' + (items.length ? fmt0(sub.kcal) + ' kcal · <i class="p">' + r0(sub.p) + ' g P</i>' : '') + '</div></div>' +
      items.map(r => '<div class="it"><div class="ic">' + esc(icoDe(r)) + '</div><button class="tx" style="background:none;border:0;padding:0;text-align:left;min-width:0" data-id="' + esc(r.id) + '" onclick="abrirEditorRegistro(this.dataset.id)">' +
        '<div class="d1">' + esc(r.nombre) + (Number(r.porcion) !== 1 ? ' <span class="muted">×' + fmt1(r.porcion) + '</span>' : '') + '</div><div class="d2">' + macrosHtml(r) + '</div></button>' +
        '<button class="x" data-id="' + esc(r.id) + '" onclick="borrarRegistro(this.dataset.id)" aria-label="Quitar ' + esc(r.nombre) + '">' + SVG.x + '</button></div>').join('') +
      '<div class="comida-acc">' + unToque(k, f, items) + '<button onclick="abrirAgregar(\'' + k + '\')">+ Agregar</button></div></div>';
  });
  return h;
}
const ordenComida = k => CALC.COMIDAS.findIndex(c => c[0] === k);
// Botones de un toque: tus favoritas de esa comida que aún no registras ese día (y la comida de mamá a mediodía)
function unToque(k, f, items) {
  let h = DB.guardadas.filter(g => g.fav && g.comida === k && !items.some(r => r.ref === g.id)).slice(0, 2)
    .map(g => '<button class="una" data-id="' + esc(g.id) + '" onclick="registrarGuardada(this.dataset.id,\'' + k + '\',\'' + f + '\')">+ ' + esc(g.ico || '') + ' ' + esc(g.nombre) + '</button>').join('');
  if (k === 'comida' && !items.some(r => r.origen === 'casera')) h += '<button class="una" onclick="abrirAgregar(\'comida\',\'casera\')">🍲 Comida de mamá</button>';
  return h;
}
function moverDia(n) {
  const f = sumarDias(DIA || hoy(), n);
  if (f > hoy()) return;
  DIA = f === hoy() ? null : f; pintar(); vibrar(5);
}

/* ----- Agregar: guardadas, casera o a mano ----- */
let AG = null;
function comidaPorHora() { const h = new Date().getHours(); return h >= 5 && h < 11 ? 'desayuno' : h >= 11 && h < 17 ? 'comida' : h >= 17 && h < 23 ? 'cena' : 'snack'; }
function abrirAgregar(comida, modo) {
  const f = TAB === 'comidas' && SUB === 'dia' && DIA ? DIA : hoy();
  AG = { comida: comida || comidaPorHora(), modo: modo || 'guardadas', porcion: 1, fecha: f, fav: false, nombreFav: '',
         casera: Object.assign({ prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 2, tortTipo: 'maiz' }, LS.get('pan_casera', {})),
         manual: { nombre: '', kcal: '', p: '', c: '', g: '' }, guardarManual: false };
  abrirHoja(hojaAgregar);
}
function hojaAgregar() {
  let h = cabeza('Agregar comida') + '<div class="muted" style="margin:-2px 2px 10px">' + diaRelativo(AG.fecha) + (AG.fecha !== hoy() ? ' · ' + diaCorto(AG.fecha) : '') + '</div>';
  h += '<div class="pick">' + CALC.COMIDAS.map(([k, n, i]) => '<button class="' + (AG.comida === k ? 'on' : '') + '" onclick="AG.comida=\'' + k + '\';refrescarHoja()">' + i + ' ' + n + '</button>').join('') + '</div>';
  h += '<div class="seg" style="margin-top:12px">' + [['guardadas', 'Guardadas'], ['casera', 'De mamá'], ['manual', 'A mano']]
    .map(([k, t]) => '<button class="' + (AG.modo === k ? 'on' : '') + '" onclick="AG.modo=\'' + k + '\';refrescarHoja()">' + t + '</button>').join('') + '</div>';
  return h + (AG.modo === 'casera' ? cuerpoCasera() : AG.modo === 'manual' ? cuerpoManual() : cuerpoGuardadas());
}
function cuerpoGuardadas() {
  let h = '<div class="row between" style="margin:2px 2px 8px"><span class="muted">Porción</span><div class="pick">' + [[0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2']]
    .map(([v, t]) => '<button class="' + (AG.porcion === v ? 'on' : '') + '" style="min-width:48px" onclick="AG.porcion=' + v + ';refrescarHoja()">' + t + '</button>').join('') + '</div></div>';
  const lista = guardadasOrdenadas(AG.comida);
  h += '<div class="list">' + (lista.map(g => {
    const m = CALC.macrosDe(g, AG.porcion);
    return '<div class="it"><div class="ic">' + esc(g.ico || '🍽️') + '</div><button class="tx" style="background:none;border:0;padding:0;text-align:left;min-width:0;min-height:44px" data-id="' + esc(g.id) +
      '" onclick="agregarGuardada(this.dataset.id)"><div class="d1">' + esc(g.nombre) + (g.fav ? ' ⭐' : '') + '</div><div class="d2">' + macrosHtml(m) + '</div></button>' +
      '<button class="x" data-id="' + esc(g.id) + '" onclick="abrirEditorGuardada(this.dataset.id)" aria-label="Editar ' + esc(g.nombre) + '">' + SVG.lapiz + '</button></div>';
  }).join('') || '<div class="empty">Aún no tienes comidas guardadas.</div>') + '</div>';
  return h + '<button class="btn ghost block" onclick="abrirEditorGuardada()">＋ Nueva comida guardada</button>' +
    '<div class="hint">Toca una para agregarla a ' + NOMBRE_COMIDA[AG.comida].toLowerCase() + '. El lápiz la edita.</div>';
}
function agregarGuardada(id) {
  registrarGuardada(id, AG.comida, AG.fecha, AG.porcion);
  cerrarHoja();
}
function cuerpoCasera() {
  const s = AG.casera, CA = CALC.CASERA, m = CALC.casera(s);
  const chip = (on, fn, txt) => '<button class="' + (on ? 'on' : '') + '" onclick="' + fn + '">' + txt + '</button>';
  let h = '<div class="fl">¿Qué carne?</div><div class="pick">' + CA.proteinas.map(([k, n, i]) => chip(s.prot === k, 'AG.casera.prot=\'' + k + '\';refrescarHoja()', i + ' ' + n)).join('') + '</div>';
  h += '<div class="fl">¿Con qué? (las que lleve)</div><div class="pick">' + CA.lados.map(([k, n, i]) => chip(s.lados.indexOf(k) >= 0, 'ladoCasera(\'' + k + '\')', i + ' ' + n)).join('') + '</div>';
  h += '<div class="fl">¿Qué tan lleno el plato?</div><div class="seg">' + CA.tamanos.map(([k, n]) => '<button class="' + (s.tam === k ? 'on' : '') + '" onclick="AG.casera.tam=\'' + k + '\';refrescarHoja()">' + n + '</button>').join('') + '</div>';
  h += '<div class="fl">Tortillas</div><div class="row between"><div class="stepper"><button onclick="AG.casera.tort=Math.max(0,AG.casera.tort-1);refrescarHoja()" aria-label="Una menos">−</button><b class="num">' + s.tort +
    '</b><button onclick="AG.casera.tort=Math.min(8,AG.casera.tort+1);refrescarHoja()" aria-label="Una más">+</button></div><div class="seg" style="margin:0;min-width:170px">' +
    [['maiz', 'Maíz'], ['harina', 'Harina']].map(([k, n]) => '<button class="' + (s.tortTipo === k ? 'on' : '') + '" onclick="AG.casera.tortTipo=\'' + k + '\';refrescarHoja()">' + n + '</button>').join('') + '</div></div>';
  h += '<div class="preview"><div style="min-width:0"><div class="t1" style="font-size:14.5px">' + esc(CALC.nombreCasera(s)) + '</div><div class="small">' + macrosHtml(m) + '</div></div><div class="amt" style="white-space:nowrap">' + fmt0(m.kcal) + '<span class="small"> kcal</span></div></div>';
  h += '<div class="hint">Son porciones aproximadas (un plato normal ≈ 1 pieza de carne, 1 taza de arroz y 1 cucharón de frijoles).</div>';
  h += interruptor(AG.fav, 'AG.fav=!AG.fav;refrescarHoja()', 'Guardar como favorita', 'Para repetirla de un toque cuando vuelva a tocar');
  if (AG.fav) h += '<input class="inp" style="margin-top:8px" placeholder="Nombre, p. ej. Pollo en salsa verde de mamá" value="' + esc(AG.nombreFav) + '" oninput="AG.nombreFav=this.value" maxlength="80">';
  return h + '<div class="actbar"><button class="btn com" onclick="agregarCasera()">Agregar a ' + NOMBRE_COMIDA[AG.comida].toLowerCase() + '</button></div>';
}
function ladoCasera(k) { const l = AG.casera.lados, i = l.indexOf(k); if (i >= 0) l.splice(i, 1); else l.push(k); refrescarHoja(); }
function agregarCasera() {
  const s = AG.casera, m = CALC.casera(s);
  if (!m.kcal) return toast('Elige al menos la carne o un acompañamiento');
  LS.set('pan_casera', s);
  const detalle = CALC.nombreCasera(s).replace(/^Comida de mamá: /, '');
  let nombre = CALC.nombreCasera(s), ref = '';
  if (AG.fav) {
    nombre = String(AG.nombreFav || '').trim() || nombre;
    const g = Object.assign({ id: 'g-' + uid(), nombre: nombre.slice(0, 80), comida: AG.comida, ico: '🍲', fav: true, origen: 'casera', detalle, creada: hoy() }, m);
    cambiar('guardarGuardada', [g], 'gua:' + g.id);
    ref = g.id;
  }
  registrar(Object.assign({ fecha: AG.fecha, comida: AG.comida, nombre: nombre.slice(0, 80), porcion: 1, origen: 'casera', ref }, m), AG.fav ? 'Agregada y guardada como favorita ⭐' : 'Comida de mamá agregada ✓');
  cerrarHoja();
}
function cuerpoManual() {
  const x = AG.manual;
  let h = '<div class="fl">Rápidos</div><div class="quick">' + CALC.SUELTOS.map((s, i) => '<button onclick="rellenarSuelto(' + i + ')">' + s.ico + ' ' + esc(s.nombre) + '</button>').join('') + '</div>';
  h += '<div class="fl">¿Qué comiste?</div><input class="inp" id="mn-nombre" placeholder="Nombre" value="' + esc(x.nombre) + '" oninput="AG.manual.nombre=this.value" maxlength="80">';
  h += '<div class="g4" style="margin-top:10px">' + [['kcal', 'kcal'], ['p', 'Prot. g'], ['c', 'Carbs g'], ['g', 'Grasa g']].map(([k, t]) =>
    '<div><label for="mn-' + k + '">' + t + '</label><input class="inp" id="mn-' + k + '" type="number" inputmode="decimal" min="0" step="any" value="' + esc(x[k]) + '" oninput="AG.manual.' + k + '=this.value"></div>').join('') + '</div>';
  h += '<div class="hint">Si dejas las kcal vacías se calculan con los macros (4 · P + 4 · C + 9 · G).</div>';
  h += interruptor(AG.guardarManual, 'AG.guardarManual=!AG.guardarManual;refrescarHoja()', 'Guardar en mis comidas', 'Para agregarla de un toque la próxima vez');
  return h + '<div class="actbar"><button class="btn com" onclick="agregarManual()">Agregar a ' + NOMBRE_COMIDA[AG.comida].toLowerCase() + '</button></div>';
}
function rellenarSuelto(i) { const s = CALC.SUELTOS[i]; AG.manual = { nombre: s.nombre, kcal: s.kcal, p: s.p, c: s.c, g: s.g, ico: s.ico }; refrescarHoja(); vibrar(5); }
// Lee kcal y macros de un formulario: números positivos; sin kcal, se calculan
function macrosForm(x) {
  const n = v => { const t = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(t) && t >= 0 ? Math.min(t, 9999) : null; };
  const p = n(x.p) || 0, c = n(x.c) || 0, g = n(x.g) || 0, k = n(x.kcal);
  return { kcal: Math.round(k !== null && x.kcal !== '' ? k : p * 4 + c * 4 + g * 9), p: r1(p), c: r1(c), g: r1(g) };
}
function agregarManual() {
  const x = AG.manual, nombre = String(x.nombre || '').trim(), m = macrosForm(x);
  if (!nombre) return toast('Ponle nombre');
  if (!m.kcal) return toast('Pon las kcal o los macros');
  let ref = '';
  if (AG.guardarManual) {
    const g = Object.assign({ id: 'g-' + uid(), nombre: nombre.slice(0, 80), comida: AG.comida, ico: x.ico || '🍽️', fav: false, origen: 'manual', detalle: '', creada: hoy() }, m);
    cambiar('guardarGuardada', [g], 'gua:' + g.id);
    ref = g.id;
  }
  registrar(Object.assign({ fecha: AG.fecha, comida: AG.comida, nombre: nombre.slice(0, 80), porcion: 1, origen: ref ? 'guardada' : 'manual', ref }, m), nombre + ' ✓');
  cerrarHoja();
}

/* ----- Editar algo que ya registraste ----- */
let ER = null;
function abrirEditorRegistro(id) {
  const r = DB.registro.find(x => x.id === id);
  if (!r) return;
  const por = Number(r.porcion) || 1;
  ER = { r, comida: r.comida, nombre: r.nombre, porcion: por, base: CALC.macrosDe(r, 1 / por), kcal: r.kcal, p: r.p, c: r.c, g: r.g };
  abrirHoja(hojaEditorRegistro);
}
function hojaEditorRegistro() {
  let h = cabeza('Editar') + '<div class="pick">' + CALC.COMIDAS.map(([k, n, i]) => '<button class="' + (ER.comida === k ? 'on' : '') + '" onclick="ER.comida=\'' + k + '\';refrescarHoja()">' + i + ' ' + n + '</button>').join('') + '</div>';
  h += '<div class="fl">Nombre</div><input class="inp" value="' + esc(ER.nombre) + '" oninput="ER.nombre=this.value" maxlength="80">';
  h += '<div class="fl">Porción</div><div class="pick">' + [0.5, 0.75, 1, 1.25, 1.5, 2].map(v => '<button class="' + (ER.porcion === v ? 'on' : '') + '" style="min-width:52px" onclick="porcionER(' + v + ')">×' + fmt1(v) + '</button>').join('') + '</div>';
  h += '<div class="g4" style="margin-top:12px">' + [['kcal', 'kcal'], ['p', 'Prot. g'], ['c', 'Carbs g'], ['g', 'Grasa g']].map(([k, t]) =>
    '<div><label>' + t + '</label><input class="inp" type="number" inputmode="decimal" min="0" step="any" value="' + esc(ER[k]) + '" oninput="ER.' + k + '=this.value"></div>').join('') + '</div>';
  return h + '<div class="actbar"><button class="btn danger" onclick="cerrarHoja();borrarRegistro(ER.r.id)">Quitar</button><button class="btn" onclick="guardarER()">Guardar</button></div>';
}
function porcionER(v) { ER.porcion = v; Object.assign(ER, CALC.macrosDe(ER.base, v)); refrescarHoja(); }
function guardarER() {
  const nombre = String(ER.nombre || '').trim();
  if (!nombre) return toast('Ponle nombre');
  const r = Object.assign({}, ER.r, { comida: ER.comida, nombre: nombre.slice(0, 80), porcion: ER.porcion }, macrosForm(ER));
  cambiar('guardarRegistro', [r], 'reg:' + r.id);
  toast('Guardado ✓'); cerrarHoja();
}

/* ----- Comidas guardadas: crear, editar, favorita, borrar ----- */
let ED = null;
function abrirEditorGuardada(id) {
  const g = id ? DB.guardadas.find(x => x.id === id) : null;
  ED = g ? Object.assign({ nueva: false }, g) : { nueva: true, id: 'g-' + uid(), nombre: '', comida: (AG && AG.comida) || 'snack', ico: '🍽️', fav: true, kcal: '', p: '', c: '', g: '', detalle: '', origen: 'manual', creada: hoy() };
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

/* ----- Plan semanal ----- */
const idPlan = (f, k) => 'plan-' + f + '-' + k;
// La comida de mamá cambia cada día: en el plan va un plato normal estimado; el día que la comes registras lo que fue
const MAMA_PLAN = () => Object.assign({ gid: 'casera', nombre: 'Comida de mamá (aprox.)', ico: '🍲' }, CALC.casera({ prot: 'pollo', lados: ['arroz', 'frijol'], tam: 'normal', tort: 2 }));
function vistaSemana() {
  const lunes = SEM || lunesDe(hoy()), m = metas(), n = difDias(lunesDe(hoy()), lunes) / 7;
  let h = '<div class="daynav"><button class="arrow" onclick="moverSemana(-1)" aria-label="Semana anterior">' + SVG.izq + '</button><div class="nm">' +
    (n === 0 ? 'Esta semana' : n === 1 ? 'La próxima semana' : n === -1 ? 'La semana pasada' : 'Semana del ' + diaCorto(lunes)) + '<small>' + diaCorto(lunes) + ' – ' + diaCorto(sumarDias(lunes, 6)) + '</small></div>' +
    '<button class="arrow" onclick="moverSemana(1)" aria-label="Semana siguiente">' + SVG.der + '</button></div>';
  h += '<div class="btns" style="margin-bottom:12px"><button class="btn sm ghost" onclick="llenarSiempre()">Llenar con lo de siempre</button><button class="btn sm ghost" onclick="copiarSemana()">Copiar la anterior</button></div>';
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i), items = DB.plan.filter(p => p.fecha === f), t = CALC.sumar(items), d = fechaDe(f);
    h += '<div class="card pdia' + (f === hoy() ? ' hoy' : '') + '"><div class="cab"><div class="t1">' + DIAS[d.getDay()] + ' ' + d.getDate() + (f === hoy() ? ' · hoy' : '') + '</div>' +
      '<div class="muted mac">' + (items.length ? fmt0(t.kcal) + ' / ' + fmt0(m.kcal) + ' kcal · <i class="p">' + r0(t.p) + ' g P</i>' : 'Sin plan') + '</div></div>' +
      CALC.COMIDAS.map(([k, nombre]) => {
        const p = items.find(x => x.comida === k);
        return '<button class="slot" onclick="elegirPlan(\'' + f + '\',\'' + k + '\')"><span class="k">' + nombre + '</span><span class="n' + (p ? '' : ' vacio') + '">' +
          (p ? esc((p.ico || '') + ' ' + p.nombre) : '+ Elegir') + '</span>' + (p ? '<span class="kc">' + fmt0(p.kcal) + ' kcal</span>' : '') + '</button>';
      }).join('') + '</div>';
  }
  return h + '<div class="hint" style="text-align:center">El plan aparece en "Día" para registrarlo de un toque.</div>';
}
function moverSemana(n) { SEM = sumarDias(SEM || lunesDe(hoy()), 7 * n); if (SEM === lunesDe(hoy())) SEM = null; pintar(); vibrar(5); }
let PL = null;
function elegirPlan(f, k) { PL = { f, k }; abrirHoja(hojaPlan); }
function hojaPlan() {
  const actual = DB.plan.find(p => p.id === idPlan(PL.f, PL.k));
  let h = cabeza(NOMBRE_COMIDA[PL.k] + ' · ' + diaCorto(PL.f));
  h += '<div class="list">' + guardadasOrdenadas(PL.k).map(g => '<button class="it" data-id="' + esc(g.id) + '" onclick="ponerPlan(this.dataset.id)"><div class="ic">' + esc(g.ico || '🍽️') + '</div>' +
    '<div class="tx"><div class="d1">' + esc(g.nombre) + (actual && actual.gid === g.id ? ' ✓' : '') + '</div><div class="d2">' + macrosHtml(g) + '</div></div></button>').join('') +
    '<button class="it" onclick="ponerPlan(\'casera\')"><div class="ic">🍲</div><div class="tx"><div class="d1">Comida de mamá (aprox.)' + (actual && actual.gid === 'casera' ? ' ✓' : '') + '</div>' +
    '<div class="d2">Cambia cada día: cuenta un plato normal y ese día registras lo que fue</div></div></button></div>';
  if (actual) h += '<button class="btn danger block" onclick="quitarPlan()">Quitar del plan</button>';
  return h;
}
function planDe(gid, f, k) {
  const base = gid === 'casera' ? MAMA_PLAN() : (() => { const g = DB.guardadas.find(x => x.id === gid); return g ? Object.assign({ gid: g.id, nombre: g.nombre, ico: g.ico }, CALC.macrosDe(g, 1)) : null; })();
  return base ? Object.assign({ id: idPlan(f, k), fecha: f, comida: k, porcion: 1 }, base) : null;
}
function ponerPlan(gid) {
  const p = planDe(gid, PL.f, PL.k);
  if (!p) return;
  cambiar('guardarPlan', [p], 'plan:' + p.id); vibrar(8); cerrarHoja();
}
function quitarPlan() { const id = idPlan(PL.f, PL.k); cambiar('borrarPlan', [id], 'plan:' + id); cerrarHoja(); }
// Desayuno y cena favoritos en los huecos vacíos, y la comida de mamá a mediodía
function llenarSiempre() {
  const lunes = SEM || lunesDe(hoy()), fav = k => DB.guardadas.find(g => g.fav && g.comida === k);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(lunes, i);
    [['desayuno', fav('desayuno')], ['comida', { id: 'casera' }], ['cena', fav('cena')]].forEach(([k, g]) => {
      if (!g || DB.plan.some(p => p.id === idPlan(f, k))) return;
      const p = planDe(g.id, f, k);
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
function registrarPlan(id) {
  const p = DB.plan.find(x => x.id === id);
  if (!p) return;
  const f = DIA || hoy();
  if (p.gid === 'casera') return abrirAgregar(p.comida, 'casera');
  if (DB.guardadas.some(g => g.id === p.gid)) return registrarGuardada(p.gid, p.comida, f, p.porcion || 1);
  registrar({ fecha: f, comida: p.comida, nombre: p.nombre, porcion: 1, origen: 'plan', ref: 'plan:' + p.id, kcal: p.kcal, p: p.p, c: p.c, g: p.g }, p.nombre + ' ✓');
}

/* ----- Resumen semanal ----- */
function vistaResumen() {
  const lunes = SEM_RES || lunesDe(hoy()), m = metas(), R = CALC.resumenSemana(DB.registro, lunes, m, hoy()), n = difDias(lunesDe(hoy()), lunes) / 7;
  let h = '<div class="daynav"><button class="arrow" onclick="moverResumen(-1)" aria-label="Semana anterior">' + SVG.izq + '</button><div class="nm">' +
    (n === 0 ? 'Esta semana' : n === -1 ? 'La semana pasada' : 'Semana del ' + diaCorto(lunes)) + '<small>' + diaCorto(lunes) + ' – ' + diaCorto(sumarDias(lunes, 6)) + '</small></div>' +
    '<button class="arrow" onclick="moverResumen(1)" aria-label="Semana siguiente"' + (n >= 0 ? ' disabled' : '') + '>' + SVG.der + '</button></div>';
  if (!R.diasConRegistro) return h + '<div class="card empty">' + (n !== 0 ? 'Esa semana no tiene comidas registradas.' : R.hoy
    ? 'Hoy llevas ' + fmt0(R.hoy.kcal) + ' kcal y ' + r0(R.hoy.p) + ' g de proteína. Los promedios cuentan los días completos: empiezan mañana.'
    : 'Esta semana aún no registras comidas. En cuanto agregues algo, aquí ves tus promedios.') + '</div>';
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
    const l = sumarDias(lunes, -7 * i), x = CALC.resumenSemana(DB.registro, l, m, hoy());
    if (x.diasConRegistro) filas.push('<div class="it"><div class="tx"><div class="d1">Semana del ' + diaCorto(l) + '</div><div class="d2">' + x.diasConRegistro + ' días registrados · cumpliste ' + x.cumpleAmbas + '</div></div>' +
      '<div class="m">' + fmt0(x.promKcal) + '<small>' + r0(x.promP) + ' g prot.</small></div></div>');
  }
  if (filas.length) h += '<h2>Semanas anteriores</h2><div class="list">' + filas.join('') + '</div>';
  return h;
}
function moverResumen(n) { const l = sumarDias(SEM_RES || lunesDe(hoy()), 7 * n); if (l > lunesDe(hoy())) return; SEM_RES = l === lunesDe(hoy()) ? null : l; pintar(); vibrar(5); }
