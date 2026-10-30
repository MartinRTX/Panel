/* Panel v1 – el tablero de Martin (app instalable, como Gym y Finanzas).
 * Hoy: lo de tu hoja de Gym y de Finanzas, solo para ver. Lee los MISMOS Apps Script que usan esas apps (acción "data").
 * Comidas (comidas.js): registro, metas, comidas guardadas, plan y resumen. Se guarda primero en el celular y
 * se sube a la hoja "Comidas 2026" en cuanto está conectada.
 * Mientras Gym o Finanzas no estén conectadas, Hoy muestra datos de ejemplo (ejemplo.js).
 */
const VERSION_APP = '1.3';

/* ===================== Utilidades ===================== */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const $ = id => document.getElementById(id);
const { r1, claveDia, sumarDias, difDias, diaSemana, lunesDe } = CALC;
function hoy() { return claveDia(new Date()); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DCORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fechaDe = k => new Date(k + 'T12:00:00');
function fechaLarga(k) { const d = fechaDe(k); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
function diaCorto(k) { const d = fechaDe(k); return DCORTO[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3); }
function diaRelativo(k) { const n = difDias(hoy(), k); return n === 0 ? 'Hoy' : n === -1 ? 'Ayer' : n === 1 ? 'Mañana' : fechaLarga(k); }
const FMT0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const FMT2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function money(n, sinCentavos) { const v = Math.round((n || 0) * 100) / 100; return (v < 0 ? '−' : '') + (sinCentavos ? FMT0 : FMT2).format(Math.abs(v)).replace('MX', ''); }
const NUM1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const fmt1 = n => n === null || n === undefined ? '—' : NUM1.format(n);
const fmt0 = n => Math.round(Number(n) || 0).toLocaleString('es-MX');
function haceCuanto(ts) {
  if (!ts) return 'nunca';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora'; if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h';
  const d = Math.round(h / 24); return 'hace ' + d + (d === 1 ? ' día' : ' días');
}
function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} }

/* ----- APK de Android (Capacitor, carpeta apk/): mismos archivos; dentro del APK los botones abren tus otras APK ----- */
const NATIVO = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function nativo(plugin, metodo, opts) {
  try { return window.Capacitor.nativePromise(plugin, metodo, opts || {}).catch(() => null); } catch (e) { return Promise.resolve(null); }
}
// Paquete de cada APK; si no está instalada se abre su página en el navegador. "gasto" abre Finanzas directo en registrar gasto.
// "comida" abre Gym en su pestaña Comida (gymmb://accion/comida, como su widget; un APK de Panel anterior solo abre Gym).
const APKS = { gym: { paquete: 'com.martinrtx.gym' }, finanzas: { paquete: 'com.martinrtx.finanzas' },
               gasto: { paquete: 'com.martinrtx.finanzas', extra: 'finanzas_accion', valor: 'gasto' },
               comida: { paquete: 'com.martinrtx.gym', uri: 'gymmb://accion/comida' } };
function abrirApp(ev, k) {
  if (!NATIVO) return true;               // en el navegador, el link normal
  if (ev) ev.preventDefault();
  vibrar(8);
  nativo('Panel', 'abrirApp', Object.assign({ url: CONFIG.APPS[k] || CONFIG.APPS.gym }, APKS[k])).then(r => { if (!r) toast('No pude abrir ' + (k === 'gym' ? 'Gym' : 'Finanzas')); });
  return false;
}
function saludo() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

let TOAST_T = null, TOAST_FN = null;
function toast(msg, accion) {
  const t = $('toast');
  t.innerHTML = '<span>' + esc(msg) + '</span>' + (accion ? '<button onclick="accionToast()">' + esc(accion.txt) + '</button>' : '');
  TOAST_FN = accion ? accion.fn : null;
  t.classList.add('show');
  clearTimeout(TOAST_T); TOAST_T = setTimeout(() => { t.classList.remove('show'); TOAST_FN = null; }, accion ? 5000 : 2800);
}
function accionToast() { const f = TOAST_FN; TOAST_FN = null; $('toast').classList.remove('show'); if (f) f(); }

const SVG = {
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  izq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  der: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  pesa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
  grafica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h16M6 15l4-5 3 3 5-7"/></svg>',
  menos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M9 15h6"/></svg>',
  mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  lapiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>'
};

/* ===================== Conexión con tus hojas ===================== */
// La URL sale de config.js (o de lo que pegues en Ajustes); la clave solo vive en este celular.
const FUENTES = {
  gym: { nombre: 'Gym', conf: 'URL_GYM', hoja: 'Entrenamiento 2026 – Martin', app: ['gym_api', 'gym_key'] },
  fin: { nombre: 'Finanzas', conf: 'URL_FINANZAS', hoja: 'Mis finanzas 2026', app: ['fin_api', 'fin_key'] },
  com: { nombre: 'Comidas', conf: 'URL_COMIDAS', hoja: 'Comidas 2026', app: null }
};
const urlValida = u => /^https:\/\/script\.google\.com\/(macros|a\/macros\/[\w.-]+)\/s\/[\w-]+\/exec$/.test(String(u || '').trim());
const conexiones = () => LS.get('pan_conexion', {});
function urlConfig(f) { const u = typeof CONFIG !== 'undefined' ? CONFIG[FUENTES[f].conf] : ''; return urlValida(u) ? u.trim() : ''; }
function urlDe(f) { const c = conexiones()[f] || {}; return urlValida(c.url) ? c.url.trim() : urlConfig(f); }
function claveDe(f) { return String((conexiones()[f] || {}).clave || ''); }
const conectada = f => !!(urlDe(f) && claveDe(f));
function guardarConexion(f, datos) { const c = conexiones(); c[f] = Object.assign({}, c[f], datos); LS.set('pan_conexion', c); }

// Todo por POST con text/plain (Apps Script no contesta la verificación previa de CORS) y la clave en el cuerpo, nunca en el link
async function llamar(f, cuerpo, ms) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ms || 30000) : null;
  try {
    const r = await fetch(urlDe(f), { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ k: claveDe(f) }, cuerpo)), signal: ctl ? ctl.signal : undefined });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'Error de la API');
    return j.result;
  } finally { clearTimeout(t); }
}
function mensajeError(e) {
  const m = String(e && e.message || e);
  if (e && e.name === 'AbortError') return 'Google tardó demasiado en contestar. Intenta de nuevo.';
  if (/Clave/.test(m)) return 'La clave no coincide con la de Apps Script.';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Sin conexión con Google. Revisa tu internet.';
  if (/JSON|Unexpected token|<!DOCTYPE/i.test(m)) return 'Apps Script no dejó entrar: revisa que la implementación diga "Cualquier usuario".';
  return m;
}

/* ===================== Datos de Hoy (Gym y Finanzas, solo lectura) ===================== */
const DATOS = { gym: null, fin: null };     // { d, ts, ejemplo, error }
const CARGANDO = {};
let ULT_HOY = 0;
function cargarCache() {
  ['gym', 'fin'].forEach(f => {
    if (!conectada(f)) { DATOS[f] = { d: f === 'gym' ? EJEMPLO.gym(hoy()) : EJEMPLO.finanzas(hoy()), ts: Date.now(), ejemplo: true, error: null }; return; }
    const c = LS.get('pan_' + f, null);
    DATOS[f] = { d: c ? c.d : null, ts: c ? c.ts : 0, ejemplo: false, error: null };
  });
}
const toma = (o, ks) => { const x = {}; if (o) ks.forEach(k => { if (o[k] !== undefined) x[k] = o[k]; }); return x; };
// Solo lo que usa Hoy (para no llenar el celular con el catálogo de ejercicios o el historial)
function recortarGym(d) {
  return Object.assign(toma(d, ['todayKey', 'sugGrupo', 'ultimoGrupo', 'ultimoGrupoFecha', 'dias', 'ultimoPeso', 'comidasDias', 'macros7']), {
    resumen: toma(d.resumen, ['semana', 'diasSemana', 'promedio7', 'cambioSemana', 'cintura', 'cambioCintura', 'km7']),
    trotes: toma(d.trotes, ['semanas', 'km7']), cuerpo: toma(d.cuerpo, ['serie', 'actual', 'meta', 'base']),
    carrera: d.carrera && d.carrera.fecha ? toma(d.carrera, ['fecha', 'nombre']) : null });
}
function recortarFin(d) {
  return { hoja: d.hoja || '',
    cuentas: (d.cuentas || []).map(c => toma(c, ['nombre', 'tipo', 'saldoCorte', 'fechaCorte', 'archivada', 'limite'])),
    categorias: (d.categorias || []).map(c => toma(c, ['nombre', 'tipo', 'presupuesto'])),
    personas: (d.personas || []).map(p => toma(p, ['nombre', 'saldoCorte', 'fechaCorte', 'archivada'])),
    movs: (d.movs || []).map(m => toma(m, ['fecha', 'tipo', 'monto', 'cuenta', 'aCuenta', 'categoria', 'persona'])) };
}
// Qué script contestó: así una URL pegada en el lugar equivocado se avisa en vez de mostrar datos raros
function queScript(d) {
  if (d && Array.isArray(d.registro) && Array.isArray(d.guardadas)) return 'com';
  if (d && Array.isArray(d.cuentas)) return 'fin';
  if (d && (d.sugGrupo !== undefined || d.exercises || d.resumen || d.todayKey)) return 'gym';
  return null;
}
function revisarScript(f, d) {
  const es = queScript(d);
  if (es === f) return;
  throw new Error('Esa URL ' + (es ? 'es la de tu script de ' + FUENTES[es].nombre : 'no es de tu script') + ', no la de ' + FUENTES[f].nombre +
    '. Corrige ' + FUENTES[f].conf + ' en config.js (o pega la correcta aquí).');
}
// Dos partes con la misma URL: una está mal
function urlsRepetidas() {
  const vistas = {}, rep = [];
  ['gym', 'fin', 'com'].forEach(f => { const u = urlDe(f); if (!u) return; if (vistas[u]) rep.push([vistas[u], f]); else vistas[u] = f; });
  return rep.map(([a, b]) => FUENTES[a].nombre + ' y ' + FUENTES[b].nombre);
}
async function actualizarFuente(f, avisar) {
  if (!conectada(f) || CARGANDO[f]) return;
  CARGANDO[f] = true;
  try {
    const d = await llamar(f, { action: 'data', args: [] });
    revisarScript(f, d);
    const rec = f === 'gym' ? recortarGym(d) : recortarFin(d), ts = Date.now();
    LS.set('pan_' + f, { d: rec, ts });
    DATOS[f] = { d: rec, ts, ejemplo: false, error: null };
  } catch (e) {
    DATOS[f] = Object.assign({}, DATOS[f], { error: mensajeError(e) });
    if (avisar) toast(FUENTES[f].nombre + ': ' + mensajeError(e));
  } finally {
    CARGANDO[f] = false;
    if (TAB === 'hoy' && !HOJA_FN) pintar();
  }
}
async function actualizarHoy(avisar) {
  ULT_HOY = Date.now();
  const algo = conectada('gym') || conectada('fin');
  if (avisar && !algo) return abrirAjustes('conexion');
  if (avisar) toast('Actualizando…');
  await Promise.all([actualizarFuente('gym', avisar), actualizarFuente('fin', avisar), leerComidasGym(avisar)]);
}

/* ----- Pantalla Hoy ----- */
function pintarHoy() {
  const k = hoy();
  const fl = fechaLarga(k);
  let h = '<div class="saludo"><div class="fecha">' + fl[0].toUpperCase() + fl.slice(1) + '</div><div class="hola">' + saludo() + ', Martin</div></div>' + rapidos();
  const rep = urlsRepetidas(), ej = ['gym', 'fin'].filter(f => DATOS[f].ejemplo), sinClave = ej.filter(f => urlDe(f) && !claveDe(f));
  const ir = txt => ' <button class="link" style="padding:0;min-height:0;color:inherit;text-decoration:underline" onclick="abrirAjustes(\'conexion\')">' + txt + '</button>';
  if (rep.length) h += '<div class="note red" style="margin-top:12px"><b>' + rep.join(', ') + ' tienen la misma URL</b>: una de las dos está mal. Revisa config.js.' + ir('Ver conexión') + '</div>';
  if (ej.length) h += '<div class="note" style="margin-top:12px">' + (ej.length === 2 ? 'Gym y Finanzas muestran' : FUENTES[ej[0]].nombre + ' muestra') + ' <b>datos de ejemplo</b>' +
    (sinClave.length ? ': falta poner tu clave en esta app. Si la pusiste en Chrome, en la APK se pone otra vez (no comparten datos).' + ir('Poner clave') : ' hasta que conectes tus hojas.' + ir('Conectar')) + '</div>';
  h += '<h2>Gym ' + tagFuente('gym') + '</h2>' + seccionGym(k);
  h += '<h2>Finanzas ' + tagFuente('fin') + '</h2>' + seccionFin(k);
  return h;
}
function tagFuente(f) {
  const x = DATOS[f];
  if (x.ejemplo) return '<button class="tag ej" onclick="abrirAjustes(\'conexion\')">Ejemplo</button>';
  if (CARGANDO[f] && !x.d) return '<span class="tag">Cargando…</span>';
  if (x.error) return '<button class="tag err" onclick="actualizarHoy(true)">Sin actualizar</button>';
  return '<button class="tag ok" onclick="actualizarHoy(true)">' + haceCuanto(x.ts) + '</button>';
}
function rapidos() {
  const A = CONFIG.APPS, a = (k, cls, ico, txt) => '<a class="rapido" href="' + esc(A[k]) + '" target="_blank" rel="noopener" onclick="return abrirApp(event,\'' + k + '\')"><span class="ic ' + cls + '">' + ico + '</span>' + txt + '</a>';
  return '<div class="rapidos">' + a('gym', 'gym', SVG.pesa, 'Abrir Gym') + a('finanzas', 'fin', SVG.grafica, 'Abrir Finanzas') + a('gasto', 'gasto', SVG.menos, 'Registrar gasto') +
    '<button class="rapido" onclick="abrirGymComida()"><span class="ic com">' + SVG.mas + '</span>Registrar comida</button></div>';
}
function errorFuente(f) {
  const x = DATOS[f];
  if (x.d) return x.error ? '<div class="note red">No pude actualizar ' + FUENTES[f].nombre + ': ' + esc(x.error) + ' Te muestro lo último que leí (' + haceCuanto(x.ts) + ').</div>' : '';
  if (x.error) return '<div class="card"><div class="t1">No pude leer tu hoja de ' + FUENTES[f].nombre + '</div><p class="muted">' + esc(x.error) + '</p>' +
    '<div class="btns"><button class="btn sm" onclick="actualizarHoy(true)">Reintentar</button><button class="btn sm ghost" onclick="abrirAjustes(\'conexion\')">Revisar conexión</button></div></div>';
  return '<div class="card empty">Leyendo tu hoja de ' + FUENTES[f].nombre + '…</div>';
}
// Línea pequeña con la tendencia (sin ejes: solo para ver hacia dónde va)
function spark(vals, color) {
  if (!vals || vals.length < 2) return '';
  const W = 100, H = 30, mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => (i * W / (vals.length - 1)).toFixed(1) + ',' + (H - 3 - (v - mn) / rg * (H - 6)).toFixed(1));
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(' ') +
    '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
}
function tendencia(v, unidad, texto) {
  if (v === null || v === undefined) return '<div class="d">' + texto + '</div>';
  const fl = v < 0 ? '▼ ' : v > 0 ? '▲ ' : '= ';
  return '<div class="d ' + (v < 0 ? 'bien' : v > 0 ? 'mal' : '') + '">' + fl + fmt1(Math.abs(v)) + ' ' + unidad + ' ' + texto + '</div>';
}
function seccionGym(k) {
  const x = DATOS.gym;
  if (!x.d) return errorFuente('gym');
  const g = CALC.gymHoy(x.d, k, CONFIG.META_DIAS_GYM);
  let h = errorFuente('gym');
  const lbl = g.entreno ? 'Hoy ya entrenaste' : g.descansa ? 'Hoy descansas · cuando vuelvas toca' : 'Hoy te toca';
  const linea = g.entreno ? 'Lo que sigue cuando vuelvas: <b>' + g.proximo + '</b>'
    : g.ultimo ? 'Última vez: <b>' + g.ultimo + '</b>' + (g.ultimoFecha ? ' · ' + diaCorto(g.ultimoFecha) : '') + '. La rotación avanza solo cuando entrenas.' : 'La rotación avanza solo cuando entrenas.';
  h += '<div class="hero gym"><div class="lbl">' + lbl + '</div><div class="big">' + esc(g.grupo) + '<small>' + esc(g.nombre) + '</small></div><div class="of">' + linea + '</div>' +
    '<div class="pie"><div class="rot">' + CALC.GRUPOS3.map(n => '<span class="' + (n === g.grupo ? 'on' + (g.entreno ? ' hecho' : '') : '') + '">' + n + '</span>').join('') + '</div>' +
    '<a class="btnh" href="' + esc(CONFIG.APPS.gym) + '" target="_blank" rel="noopener" onclick="return abrirApp(event,\'gym\')">' + (g.entreno || g.descansa ? 'Abrir Gym' : 'A entrenar') + ' ›</a></div></div>';
  // Semana: días de gym, km de trote, peso y cintura
  const iHoy = (diaSemana(k) + 6) % 7, L = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const prev = g.semanas.length >= 2 ? g.semanas[g.semanas.length - 2].km : null, ult = g.semanas.slice(-6), mx = Math.max.apply(null, ult.map(s => s.km).concat([1]));
  h += '<div class="grid2">' +
    '<div class="stat"><div class="muted">Gym esta semana</div><div class="v">' + g.diasSemana + '<small>de ' + g.metaDias + ' días</small></div>' +
      '<div class="semdots">' + L.map((d, i) => '<div class="' + (g.semana[i] ? 'si' : '') + (i === iHoy ? ' hoy' : '') + '"><i></i>' + d + '</div>').join('') + '</div></div>' +
    '<div class="stat"><div class="muted">Trote esta semana</div><div class="v">' + fmt1(g.kmSemana) + '<small>km</small></div>' +
      '<div class="d">' + (prev !== null ? 'La pasada: ' + fmt1(prev) + ' km' : '&nbsp;') + '</div>' +
      (ult.length ? '<div class="barritas">' + ult.map((s, i) => '<i class="' + (i === ult.length - 1 && g.fresca ? 'act' : '') + '" style="height:' + Math.max(8, s.km / mx * 100) + '%"></i>').join('') + '</div>' : '') + '</div>' +
    '<div class="stat"><div class="muted">Último peso</div><div class="v">' + fmt1(g.peso.ultimo) + '<small>kg</small></div>' +
      tendencia(g.peso.cambio, 'kg', 'vs semana pasada') + spark(g.peso.serie.slice(-8).map(p => p.v), 'var(--gym)') + '</div>' +
    '<div class="stat"><div class="muted">Cintura</div><div class="v">' + fmt1(g.cintura.ultima) + '<small>cm</small></div>' +
      tendencia(g.cintura.cambio, 'cm', 'vs la anterior') + spark(g.cintura.serie.slice(-8).map(p => p.v), 'var(--gras)') + '</div></div>';
  if (!g.fresca && g.fechaDatos) h += '<div class="muted small" style="margin:-4px 4px 12px">Lo de la semana se pone en ceros: tu hoja de Gym no se ha leído desde el ' + diaCorto(g.fechaDatos) + '.</div>';
  return h + tarjetaCarrera(k, g) + tarjetaComidaHoy(k);
}
function tarjetaCarrera(k, g) {
  const c = CONFIG.CARRERA && CONFIG.CARRERA.fecha ? CONFIG.CARRERA : (g.carrera ? { nombre: 'Carrera ' + g.carrera.nombre, fecha: g.carrera.fecha } : null);
  if (!c) return '';
  const n = difDias(k, c.fecha);
  if (n < 0) return '<div class="card"><div class="t1">🏅 Ya pasó tu ' + esc(c.nombre.toLowerCase()) + ' (' + diaCorto(c.fecha) + ')</div><div class="muted">Cambia la fecha de tu próxima carrera en config.js.</div></div>';
  const sem = Math.floor(n / 7), d = n % 7;
  const falta = n === 0 ? '¡Es hoy! Calienta bien y sal tranquilo el primer kilómetro.' : n === 1 ? 'Es mañana: descansa, hidrátate y cena ligero.'
    : 'Faltan ' + (sem ? sem + (sem === 1 ? ' semana' : ' semanas') + (d ? ' y ' + d + (d === 1 ? ' día' : ' días') : '') : n + ' días') + '.';
  return '<div class="card carrera"><div class="dias"><div><b>' + n + '</b><span>' + (n === 1 ? 'día' : 'días') + '</span></div></div>' +
    '<div class="tx"><div class="t1">🏁 ' + esc(c.nombre) + '</div><div class="muted" style="text-transform:none">' + fechaLarga(c.fecha) + '</div>' +
    '<div class="muted" style="margin-top:4px">' + falta + (n > 1 ? ' Esta semana llevas <b style="color:var(--ink)">' + fmt1(g.kmSemana) + ' km</b>.' : '') + '</div></div></div>';
}
// Íconos de las categorías (los mismos de tu app Finanzas)
const ICONO_CAT = { 'Comida y antojos': '🌮', 'Salidas': '🎉', 'Gasolina': '⛽', 'Carro': '🚗', 'Familia y casa': '🏠', 'Salud y cuidado personal': '💊',
  'Suscripciones y seguros': '🔁', 'Gustos y compras': '🛍️', 'Viajes': '✈️', 'Intereses y comisiones': '🏦', 'Otros': '📦' };
const ICONO_CUENTA = { 'Débito': '🏦', 'Ahorro': '🐷', 'Efectivo': '💵', 'Crédito': '💳', 'Préstamo': '📄' };
let VER_CATS = false;
function seccionFin(k) {
  const x = DATOS.fin;
  if (!x.d) return errorFuente('fin');
  const F = CALC.finanzasHoy(x.d, k);
  let h = errorFuente('fin');
  h += '<div class="hero fin"><div class="lbl">Patrimonio neto</div><div class="big">' + money(F.neto, true) + '</div>' +
    '<div class="of">Cuentas <b>' + money(F.disponible, true) + '</b> − deudas con bancos <b>' + money(F.deuda, true) + '</b></div>' +
    '<div class="of small" style="opacity:.8;margin-top:4px">No incluye lo que te deben ni lo que debes a personas (va aparte, abajo).</div></div>';
  // Saldo por cuenta
  // Las deudas se muestran en positivo con "debes" abajo (en la hoja van en negativo)
  const it = c => '<div class="it"><div class="ic">' + (ICONO_CUENTA[c.tipo] || '•') + '</div><div class="tx"><div class="d1">' + esc(c.nombre) + '</div><div class="d2">' + esc(c.tipo) +
    (c.deuda && c.limite && c.saldo < 0 ? ' · usas ' + Math.round(-c.saldo / c.limite * 100) + '% de ' + money(c.limite, true) : '') + '</div></div>' +
    '<div class="m num' + (c.saldo < 0 ? ' red' : '') + '">' + money(c.deuda ? Math.abs(c.saldo) : c.saldo) + (c.deuda ? '<small>' + (c.saldo <= 0 ? 'debes' : 'a favor') + '</small>' : '') + '</div></div>';
  const disp = F.cuentas.filter(c => !c.deuda), deu = F.cuentas.filter(c => c.deuda);
  h += '<div class="list">' + (disp.length ? '<div class="sub"><span>Disponible</span><span class="num">' + money(F.disponible, true) + '</span></div>' + disp.map(it).join('') : '') +
    (deu.length ? '<div class="sub"><span>Deudas con bancos</span><span class="num">' + money(F.deuda, true) + '</span></div>' + deu.map(it).join('') : '') +
    (F.cuentas.length ? '' : '<div class="empty">Tu hoja no tiene cuentas activas.</div>') + '</div>';
  // Gasto del mes contra presupuesto
  const mes = MESES[Number(F.mes.slice(5, 7)) - 1], pctT = F.presupuesto ? F.gastado / F.presupuesto : 0, resta = r1(F.presupuesto - F.gastado);
  const clase = p => p > 1 ? 'over' : p > F.avanceMes + 0.1 ? 'warn' : '';
  h += '<div class="card"><div class="row between"><div class="t1">Gasto de ' + mes + '</div><div class="muted">va el ' + Math.round(F.avanceMes * 100) + '% del mes</div></div>' +
    '<div class="amt" style="margin-top:6px">' + money(F.gastado, true) + (F.presupuesto ? ' <span class="muted" style="font:500 14px var(--txt)">de ' + money(F.presupuesto, true) + '</span>' : '') + '</div>' +
    (F.presupuesto ? '<div class="meter"><div class="' + clase(pctT) + '" style="width:' + Math.min(100, pctT * 100).toFixed(1) + '%"></div><i class="marca" style="left:' + (F.avanceMes * 100).toFixed(1) + '%"></i></div>' +
      '<div class="legend"><span>' + (resta >= 0 ? 'Te quedan <b style="color:var(--ink)">' + money(resta, true) + '</b>' : 'Te pasaste por <b class="red">' + money(-resta, true) + '</b>') + '</span><span>La rayita es hoy</span></div>' : '<div class="muted">Sin presupuestos en tu hoja.</div>') + '</div>';
  const cats = VER_CATS ? F.categorias : F.categorias.slice(0, 6);
  if (cats.length) h += '<div class="list">' + cats.map(c => {
    const p = c.presupuesto ? c.gastado / c.presupuesto : 0;
    return '<div class="cat"><div class="top2"><span class="nm">' + (ICONO_CAT[c.nombre] || '•') + ' ' + esc(c.nombre) + '</span><span class="num"><b>' + money(c.gastado, true) + '</b>' +
      (c.presupuesto ? ' <span class="muted">/ ' + money(c.presupuesto, true) + '</span>' : '') + '</span></div>' +
      (c.presupuesto ? '<div class="meter"><div class="' + clase(p) + '" style="width:' + Math.min(100, p * 100).toFixed(1) + '%"></div></div>' : '<div class="muted small">Sin presupuesto</div>') + '</div>';
  }).join('') + (F.categorias.length > 6 ? '<div class="cat" style="text-align:center"><button class="link" onclick="VER_CATS=!VER_CATS;pintar()">' + (VER_CATS ? 'Ver menos' : 'Ver las ' + (F.categorias.length - 6) + ' restantes') + '</button></div>' : '') + '</div>';
  // Personas: aparte, sin sumarlas al patrimonio
  const q = p => '<div class="qrow"><span>' + esc(p.nombre) + '</span><b>' + money(p.saldo, true) + '</b></div>';
  h += '<h2>Personas · aparte</h2><div class="card"><div class="cols">' +
    '<div><div class="t">Te deben</div><div class="amt green">' + money(F.totalTeDeben, true) + '</div>' + (F.teDeben.map(q).join('') || '<div class="muted small">Nadie</div>') + '</div>' +
    '<div><div class="t">Debes</div><div class="amt red">' + money(F.totalDebes, true) + '</div>' + (F.debes.map(q).join('') || '<div class="muted small">A nadie</div>') + '</div></div>' +
    '<div class="muted small" style="margin-top:12px">Préstamos con personas: se ven aquí y no se suman ni restan a tu patrimonio neto.</div></div>';
  return h;
}

/* ===================== Pestañas y pantalla ===================== */
let TAB = LS.get('pan_tab', 'hoy') === 'comidas' ? 'comidas' : 'hoy', DIA_PINTADO = null;
function verTab(t) { TAB = t; LS.set('pan_tab', t); pintar(true); window.scrollTo(0, 0); vibrar(6); }
function pintar(anima) {
  DIA_PINTADO = hoy();
  $('titulo').textContent = TAB === 'hoy' ? 'Hoy' : 'Comidas';
  $('tHoy').classList.toggle('on', TAB === 'hoy'); $('tComidas').classList.toggle('on', TAB === 'comidas');
  const v = $('view');
  v.innerHTML = TAB === 'hoy' ? pintarHoy() : pintarComidas();
  if (anima) { v.classList.remove('anima'); void v.offsetWidth; v.classList.add('anima'); }
  pintarSync();
}
// La pastilla de arriba: cómo van tus comidas con la hoja
function pintarSync() {
  const el = $('sync'), n = cola().length;
  if (!conectada('com')) { el.className = 'sync'; el.textContent = '📱 En el celular'; }
  else if (COM_ERROR) { el.className = 'sync pend'; el.textContent = '⚠ Revisa Comidas'; }
  else if (ENVIANDO) { el.className = 'sync'; el.textContent = 'Subiendo…'; }
  else if (n) { el.className = 'sync pend'; el.textContent = n + ' sin subir' + (navigator.onLine === false ? ' · sin señal' : ''); }
  else { el.className = 'sync ok'; el.textContent = '✓ Al día'; }
}
function tocarSync() {
  if (!conectada('com') || COM_ERROR) return abrirAjustes('conexion');
  toast('Sincronizando…'); sincronizar(true); actualizarHoy();
}

/* ===================== Hoja inferior ===================== */
let HOJA_FN = null, RECARGA_PENDIENTE = false;
function abrirHoja(fn) {
  const nueva = !HOJA_FN;
  HOJA_FN = fn;
  const s = $('sheet');
  s.innerHTML = fn(); s.scrollTop = 0;
  s.classList.add('show'); $('scrim').classList.add('show');
  if (nueva) { try { history.pushState({ hoja: 1 }, ''); } catch (e) {} }   // el gesto de "atrás" cierra la hoja
}
function refrescarHoja() { if (!HOJA_FN) return; const s = $('sheet'), y = s.scrollTop; s.innerHTML = HOJA_FN(); s.scrollTop = y; }
function cerrarHoja(desdeAtras) {
  if (!HOJA_FN) return;
  HOJA_FN = null;
  $('sheet').classList.remove('show'); $('scrim').classList.remove('show');
  if (!desdeAtras && history.state && history.state.hoja) { try { history.back(); } catch (e) {} }
  if (RECARGA_PENDIENTE) location.reload();
  else pintar();
}
// Siempre queda una entrada extra en el historial (la "guardia"): el gesto atrás cierra la hoja abierta,
// en Comidas regresa a Hoy, y en Hoy sale (en el APK la app se va al fondo, como Gym y Finanzas).
function ponerGuardia() { if (!(history.state && (history.state.guardia || history.state.hoja))) { try { history.pushState({ guardia: 1 }, ''); } catch (e) {} } }
window.addEventListener('popstate', () => {
  if (HOJA_FN) return cerrarHoja(true);
  if (history.state && (history.state.guardia || history.state.hoja)) return;
  if (TAB !== 'hoy') { verTab('hoy'); ponerGuardia(); return; }
  if (NATIVO) { nativo('App', 'minimizeApp'); ponerGuardia(); } else history.back();
});
const cabeza = titulo => '<div class="grab"><h3 id="hojaTitulo">' + titulo + '</h3><button class="x" onclick="cerrarHoja()" aria-label="Cerrar">' + SVG.x + '</button></div>';
const interruptor = (on, fn, titulo, sub) => '<button class="switch" role="switch" aria-checked="' + !!on + '" onclick="' + fn + '"><span><span class="t1" style="font-size:15px">' + titulo + '</span>' +
  (sub ? '<br><span class="muted">' + sub + '</span>' : '') + '</span><span class="knob"></span></button>';

/* ===================== Ajustes ===================== */
function aplicarTema(t) {
  const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme;
  const oscuro = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name=theme-color]').forEach(m => m.setAttribute('content', oscuro ? '#0B0D12' : '#F3F4F8'));
}
function elegirTema(t) { LS.set('pan_tema', t); aplicarTema(t); vibrar(); refrescarHoja(); }
function abrirAjustes(seccion) {
  abrirHoja(hojaAjustes);
  if (seccion) setTimeout(() => { const el = $('aj-' + seccion); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 120);
}
function hojaAjustes() {
  const tema = LS.get('pan_tema', 'auto'), m = metas(), rech = LS.get('pan_rechazados', []), metasPend = LS.get('pan_metas_gym', null);
  let h = cabeza('Ajustes');
  h += '<div class="fl">Tema</div><div class="seg">' + [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']]
    .map(([k, t]) => '<button class="' + (tema === k ? 'on' : '') + '" onclick="elegirTema(\'' + k + '\')">' + t + '</button>').join('') + '</div>';
  // Metas de comida
  h += '<div class="fl" id="aj-metas">Metas de comida por día</div><div class="g4">' +
    [['kcal', 'kcal'], ['p', 'Proteína g'], ['c', 'Carbs g'], ['g', 'Grasa g']].map(([k, t]) =>
      '<div><label for="m-' + k + '">' + t + '</label><input class="inp" id="m-' + k + '" type="number" inputmode="numeric" min="0" value="' + Math.round(m[k]) + '" oninput="sumaMetas()"></div>').join('') + '</div>' +
    '<div class="hint" id="sumaMetas">' + textoSumaMetas(m) + '</div>' +
    '<div class="btns" style="margin-top:10px"><button class="btn sm ghost" onclick="repartir()">Repartir el resto</button><button class="btn sm" onclick="guardarMetasForm()">Guardar metas</button></div>' +
    '<div class="hint">"Repartir" deja tus kcal y tu proteína, pone la grasa en 25 % de las calorías y los carbohidratos con lo que queda. ' +
    'Tus metas mandan: la proteína se vuelve tu meta en la app Gym y las demás también se guardan allá.</div>' +
    (metasPend ? '<div class="hint amber">Gym todavía no tiene estas metas: ' + (conectada('gym') ? 'falta agregar Panel.gs a su script (GYM-PANEL.md).' : 'conecta Gym.') + '</div>' : '');
  // Conexión
  const rep = urlsRepetidas();
  h += '<div class="fl" id="aj-conexion">Conexión con tus hojas</div>' +
    (rep.length ? '<div class="note red"><b>' + rep.join(', ') + ' tienen la misma URL.</b> Cada hoja tiene su propio Apps Script: copia cada URL desde ' +
      'su hoja (Extensiones › Apps Script › Implementar › Gestionar implementaciones).</div>' : '') +
    '<div class="hint" style="margin:0 2px 10px">La URL va en <b>config.js</b> (o pégala aquí). La clave es la misma que pusiste en cada Apps Script y solo se guarda en este celular.</div>' +
    ['gym', 'fin', 'com'].map(bloqueConexion).join('');
  if (rech.length) h += '<div class="note red"><b>La hoja de Comidas no aceptó ' + rech.length + (rech.length === 1 ? ' cambio' : ' cambios') + ':</b><br>' +
    rech.slice(-3).map(r => esc(r.cuando + ' · ' + r.msg)).join('<br>') + '<br><button class="link" style="color:inherit;padding:6px 0 0;min-height:0" onclick="LS.del(\'pan_rechazados\');refrescarHoja()">Entendido</button></div>';
  // Comidas guardadas
  h += '<div class="fl" id="aj-guardadas">Platillos para el plan</div><div class="hint" style="margin:-4px 2px 8px">Lo que comes lo registras en Gym; estos solo sirven para armar tu plan semanal (además de lo que más comes).</div><div class="list">' + guardadasOrdenadas().map(g =>
    '<button class="it" data-id="' + esc(g.id) + '" onclick="abrirEditorGuardada(this.dataset.id)"><div class="ic">' + esc(g.ico || '🍽️') + '</div><div class="tx"><div class="d1">' + esc(g.nombre) + (g.fav ? ' ⭐' : '') + '</div>' +
    '<div class="d2">' + esc(NOMBRE_COMIDA[g.comida] || '') + ' · ' + macrosTexto(g) + '</div></div><span class="muted">' + SVG.lapiz.replace('<svg', '<svg width="18" height="18"') + '</span></button>').join('') +
    '<button class="it" onclick="abrirEditorGuardada()"><div class="ic">＋</div><div class="tx"><div class="d1">Nuevo platillo</div></div></button></div>';
  // Datos
  const n = cola().length;
  h += '<div class="fl">Tus datos</div><div class="card flat" style="margin:0">' +
    '<div class="muted">Plan, metas y platillos: ' + (n ? n + (n === 1 ? ' cambio' : ' cambios') + (conectada('com') ? ' sin subir' : ' esperando a que conectes la hoja Comidas 2026') : 'todo subido') + '.' +
    (DB.registro.length ? ' Además tienes ' + DB.registro.length + ' comidas que registraste en Panel antes de pasar todo a Gym: se siguen sumando.' : '') + '</div>' +
    '<div class="btns" style="margin-top:10px">' + (conectada('com') ? '<button class="btn sm ghost" onclick="sincronizar(true)">Subir ahora</button>' : '') +
    '<button class="btn sm ghost" onclick="exportar()">Exportar respaldo</button></div></div>';
  h += '<div class="hint" style="text-align:center;margin:18px 0 6px">Panel ' + VERSION_APP + ' · Gym, Finanzas y Comidas en un vistazo</div>';
  return h;
}
function bloqueConexion(f) {
  const F = FUENTES[f], c = conexiones()[f] || {}, deConfig = !!urlConfig(f), x = f === 'com' ? { error: COM_ERROR } : DATOS[f];
  let estado;
  if (conectada(f)) estado = x && x.error ? '<span class="tag err">Con error</span>' : '<span class="tag ok">Conectada</span>';
  else estado = '<span class="tag ej">' + (!urlDe(f) ? 'Falta la URL' : 'Falta la clave') + '</span>';
  const app = F.app ? [LS.get(F.app[0], ''), LS.get(F.app[1], '')] : null;
  const detecta = app && urlValida(app[0]) && app[1] && (app[0] !== urlDe(f) || app[1] !== claveDe(f));
  return '<div class="conx"><div class="row between"><div class="t1">' + F.nombre + '</div>' + estado + '</div>' +
    '<div class="muted small">Hoja "' + esc(F.hoja) + '"' + (deConfig ? ' · URL tomada de config.js' : '') + (f !== 'com' ? ' · solo lectura' : '') + '</div>' +
    (x && x.error && conectada(f) ? '<div class="muted small red" style="margin-top:4px">' + esc(x.error) + '</div>' : '') +
    '<input class="inp" id="u-' + f + '" placeholder="' + (deConfig ? 'Usando la URL de config.js' : 'https://script.google.com/macros/s/…/exec') + '" value="' + esc(c.url || '') + '" autocomplete="off" spellcheck="false" inputmode="url">' +
    '<input class="inp" id="k-' + f + '" type="password" placeholder="Clave" value="' + esc(c.clave || '') + '" autocomplete="off">' +
    '<div class="btns" style="margin-top:10px"><button class="btn sm" onclick="probarConexion(\'' + f + '\')">Guardar y probar</button>' +
    (c.url || c.clave ? '<button class="btn sm ghost" onclick="olvidarConexion(\'' + f + '\')">Quitar</button>' : '') + '</div>' +
    (detecta ? '<button class="btn sm ghost block" style="margin-top:8px" onclick="usarDeApp(\'' + f + '\')">Usar la conexión de tu app ' + F.nombre + ' (la encontré en este Chrome)</button>' : '') + '</div>';
}
async function probarConexion(f) {
  const u = $('u-' + f).value.trim(), k = $('k-' + f).value.trim();
  if (u && !urlValida(u)) return toast('Esa URL no parece de Apps Script (termina en /exec)');
  if (!u && !urlConfig(f)) return toast('Falta la URL: pégala aquí o en config.js');
  if (!k) return toast('Falta la clave');
  const otraHoja = f === 'com' && urlDe('com') !== (u || urlConfig('com'));
  guardarConexion(f, { url: u, clave: k });
  if (otraHoja) LS.del('pan_primera_ok');      // hoja nueva: tus comidas guardadas se vuelven a revisar contra ella
  toast('Probando ' + FUENTES[f].nombre + '…');
  if (f === 'com') {
    try { LS.del('pan_com_ok'); await verificarComidas(); toast('Comidas conectada ✓ Subiendo lo de tu celular…'); sincronizar(true); }
    catch (e) { COM_ERROR = mensajeError(e); toast('Comidas: ' + COM_ERROR); }
  } else {
    DATOS[f] = { d: (LS.get('pan_' + f, null) || {}).d || null, ts: 0, ejemplo: false, error: null };
    await actualizarFuente(f, true);
    if (f === 'gym') { COMGYM_ERROR = null; await leerComidasGym(); }    // lo que comes y tus metas, también desde Gym
    if (!DATOS[f].error) toast(FUENTES[f].nombre + ' conectada ✓');
  }
  refrescarHoja();
}
function olvidarConexion(f) {
  const c = conexiones(); delete c[f]; LS.set('pan_conexion', c);
  if (f !== 'com') { LS.del('pan_' + f); cargarCache(); }
  toast(FUENTES[f].nombre + ': conexión quitada'); refrescarHoja();
}
// Gym y Finanzas viven en martinrtx.github.io igual que Panel: si las usas en este Chrome, su conexión ya está aquí
function usarDeApp(f) {
  const a = FUENTES[f].app;
  guardarConexion(f, { url: LS.get(a[0], ''), clave: LS.get(a[1], '') });
  DATOS[f] = { d: null, ts: 0, ejemplo: false, error: null };
  actualizarFuente(f, true).then(() => { if (!DATOS[f].error) toast(FUENTES[f].nombre + ' conectada ✓'); refrescarHoja(); });
  refrescarHoja();
}
function textoSumaMetas(m) {
  const t = Math.round(m.p * 4 + m.c * 4 + m.g * 9), dif = t - Math.round(m.kcal);
  return 'Tus macros suman ' + fmt0(t) + ' kcal' + (Math.abs(dif) > 40 ? ' (' + (dif > 0 ? '+' : '−') + fmt0(Math.abs(dif)) + ' vs tu meta)' : ' ✓');
}
function leerMetasForm() { const v = k => Math.max(0, Math.round(Number($('m-' + k).value) || 0)); return { kcal: v('kcal'), p: v('p'), c: v('c'), g: v('g') }; }
function sumaMetas() { $('sumaMetas').textContent = textoSumaMetas(leerMetasForm()); }
function repartir() {
  const m = leerMetasForm(), r = CALC.repartirMetas(m.kcal, m.p);
  ['kcal', 'p', 'c', 'g'].forEach(k => { $('m-' + k).value = r[k]; });
  sumaMetas(); vibrar();
}
function guardarMetasForm() {
  const m = leerMetasForm();
  if (m.kcal < 800 || m.kcal > 6000) return toast('Las calorías deben estar entre 800 y 6,000');
  cambiar('guardarMetas', [m], 'metas');
  metasAGym(m).then(ok => toast(ok ? 'Metas guardadas ✓ (también en Gym)' : 'Metas guardadas ✓'));
  vibrar(); refrescarHoja();
}
function exportar() {
  const blob = new Blob([JSON.stringify({ app: 'Panel', version: VERSION_APP, fecha: new Date().toISOString(), comidas: DB, sinSubir: cola() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'panel-comidas-' + hoy() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ===================== Arranque ===================== */
function arrancar() {
  aplicarTema(LS.get('pan_tema', 'auto'));
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTema(LS.get('pan_tema', 'auto'))); } catch (e) {}
  iniciarComidas();
  cargarCache();
  // Accesos directos del ícono: ?accion=comida (registrar) y ?accion=semana (plan)
  const p = new URLSearchParams(location.search), accion = p.get('accion');
  if (accion === 'comida' || accion === 'semana') { TAB = 'comidas'; if (accion === 'semana') SUB = 'semana'; }
  if (p.toString() || location.hash) history.replaceState(null, '', location.pathname);
  ponerGuardia();
  pintar();
  if (accion === 'comida') setTimeout(() => abrirGymComida(), 300);
  actualizarHoy(); sincronizar();
  if ('serviceWorker' in navigator) {
    const tenia = !!navigator.serviceWorker.controller;
    let recargada = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!tenia || recargada) return;
      recargada = true;
      if (HOJA_FN) RECARGA_PENDIENTE = true; else location.reload();   // no te cierra lo que estás capturando
    });
    navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
  }
  // Al volver a la app: si cambió el día se repinta; si pasaron 5 minutos, se actualiza
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (DIA_PINTADO !== hoy()) { if (!conectada('gym') || !conectada('fin')) cargarCache(); if (!HOJA_FN) pintar(); }
    if (Date.now() - ULT_HOY > 5 * 60000) { actualizarHoy(); sincronizar(); }
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  });
  window.addEventListener('online', () => { pintarSync(); sincronizar(); });
  window.addEventListener('offline', pintarSync);
}
document.addEventListener('DOMContentLoaded', arrancar);
