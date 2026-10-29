/**
 * Comidas 2026 – API de la app Panel (Apps Script pegado en la hoja "Comidas 2026").
 *
 * Para instalar (una sola vez; los pasos completos están en MANANA.md):
 *  1. En la hoja "Comidas 2026": Extensiones > Apps Script. Borra lo que haya y pega este archivo completo.
 *  2. En la línea de CLAVE pon tu clave (puede ser la misma de Gym y Finanzas). Guarda (💾).
 *  3. Arriba elige la función "instalar" y toca Ejecutar. Acepta los permisos: crea las pestañas.
 *  4. Implementar > Nueva implementación > ⚙️ "Aplicación web". Ejecutar como: Yo. Quién tiene acceso: Cualquier usuario.
 *     Implementar y copia la "URL de la app web" (termina en /exec): va en config.js de Panel.
 * Para actualizarlo después: pega el archivo nuevo y en Implementar > Gestionar implementaciones > ✏️ (editar)
 * elige Versión: Nueva versión > Implementar. Así la URL /exec sigue siendo la misma.
 *
 * Este archivo vive en GitHub, que es público: ahí la clave NUNCA se escribe, solo en tu Apps Script.
 *
 * Pestañas (se crean solas): Registro (lo que comes), Guardadas (tus comidas de un toque), Plan (la semana),
 * Metas (kcal y macros) y Resumen (fórmulas para que veas tus totales por día directo en la hoja).
 * La app manda los cambios con un ID: si un cambio llega dos veces, se sobrescribe y nunca se duplica.
 */

const CLAVE = 'PON_AQUI_TU_CLAVE';
const VERSION = 1;

const H = { registro: 'Registro', guardadas: 'Guardadas', plan: 'Plan', metas: 'Metas', resumen: 'Resumen' };
const ENC = {
  // Registro: una fila por cosa que comiste (kcal y macros ya multiplicados por la porción)
  Registro: ['ID', 'Fecha', 'Comida', 'Nombre', 'Porción', 'kcal', 'Proteína (g)', 'Carbs (g)', 'Grasa (g)', 'Origen', 'Guardada', 'Registrado'],
  // Guardadas: kcal y macros de UNA porción
  Guardadas: ['ID', 'Nombre', 'Comida', 'kcal', 'Proteína (g)', 'Carbs (g)', 'Grasa (g)', 'Favorita', 'Ícono', 'Detalle', 'Origen', 'Creada'],
  // Plan: una comida por día y tiempo (desayuno, comida, cena, snack)
  Plan: ['ID', 'Fecha', 'Comida', 'Guardada', 'Nombre', 'Porción', 'kcal', 'Proteína (g)', 'Carbs (g)', 'Grasa (g)', 'Ícono'],
  Metas: ['Meta', 'Valor']
};
const COMIDAS = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena', snack: 'Snack' };
const METAS = [['kcal', 'Calorías (kcal)', 800, 6000], ['p', 'Proteína (g)', 0, 500], ['c', 'Carbs (g)', 0, 1000], ['g', 'Grasa (g)', 0, 400]];

/* ===================== Entrada ===================== */
function doGet(e) {
  return responder(() => {
    // Por GET solo se contesta "ping": los datos van por POST para que la clave nunca viaje en la URL.
    revisarClave(e && e.parameter && e.parameter.k);
    return 'ok';
  });
}

function doPost(e) {
  return responder(() => {
    const cuerpo = JSON.parse(e.postData.contents);
    revisarClave(cuerpo.k);
    asegurarEstructura();
    if (cuerpo.action === 'ping') return 'ok';
    if (cuerpo.action === 'data') return leerTodo((cuerpo.args || [])[0]);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (cuerpo.action !== 'batch') return ejecutar(cuerpo.action, cuerpo.args || []);
      const ops = (cuerpo.args && cuerpo.args[0]) || [];
      return ops.map(op => {
        try { ejecutar(op.action, op.args || []); return { id: op.id, ok: true }; }
        catch (err) { return { id: op.id, ok: false, error: String(err.message || err) }; }
      });
    } finally { lock.releaseLock(); }
  });
}

function responder(fn) {
  let salida;
  try { salida = { ok: true, result: fn() }; }
  catch (err) { salida = { ok: false, error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

function revisarClave(k) {
  if (CLAVE === 'PON_AQUI_TU_CLAVE') throw new Error('Clave: falta poner tu clave en el código de Apps Script');
  if (!k || String(k) !== CLAVE) throw new Error('Clave incorrecta');
}

function ejecutar(accion, args) {
  switch (accion) {
    case 'guardarRegistro': return guardarRegistro(args[0]);
    case 'borrarRegistro': return borrar(H.registro, args[0]);
    case 'guardarGuardada': return guardarGuardada(args[0]);
    case 'borrarGuardada': return borrar(H.guardadas, args[0]);
    case 'guardarPlan': return guardarPlan(args[0]);
    case 'borrarPlan': return borrar(H.plan, args[0]);
    case 'guardarMetas': return guardarMetas(args[0]);
    default: throw new Error('Acción desconocida: ' + accion);
  }
}

/* ===================== Instalación ===================== */
// Ejecútala una vez desde el editor (botón Ejecutar): crea las pestañas y pide los permisos.
function instalar() {
  asegurarEstructura();
  Logger.log('Listo: pestañas creadas en "' + libro().getName() + '". Ahora: Implementar > Nueva implementación > Aplicación web.');
}

function asegurarEstructura() {
  const lb = libro();
  // La pestaña vacía que trae toda hoja nueva ("Hoja 1") se vuelve Registro
  if (!lb.getSheetByName(H.registro)) {
    const hs = lb.getSheets();
    if (hs.length === 1 && hs[0].getLastRow() === 0 && /^(Hoja|Sheet)\s?1$/i.test(hs[0].getName())) hs[0].setName(H.registro);
  }
  Object.keys(ENC).forEach(nombre => {
    let h = lb.getSheetByName(nombre);
    if (!h) h = lb.insertSheet(nombre);
    if (h.getLastRow() === 0) {
      h.getRange(1, 1, 1, ENC[nombre].length).setValues([ENC[nombre]]).setFontWeight('bold');
      h.setFrozenRows(1);
      formato(nombre, h);
    }
  });
  if (!lb.getSheetByName(H.resumen)) hojaResumen(lb.insertSheet(H.resumen));
}
function formato(nombre, h) {
  if (nombre === H.registro) {
    h.getRange('B:B').setNumberFormat('dd/mm/yyyy'); h.getRange('L:L').setNumberFormat('dd/mm/yyyy hh:mm');
    h.getRange('E:E').setNumberFormat('0.##'); h.getRange('F:F').setNumberFormat('0'); h.getRange('G:I').setNumberFormat('0.#');
  } else if (nombre === H.guardadas) {
    h.getRange('D:D').setNumberFormat('0'); h.getRange('E:G').setNumberFormat('0.#'); h.getRange('L:L').setNumberFormat('dd/mm/yyyy');
  } else if (nombre === H.plan) {
    h.getRange('B:B').setNumberFormat('dd/mm/yyyy'); h.getRange('G:G').setNumberFormat('0'); h.getRange('H:J').setNumberFormat('0.#');
  } else if (nombre === H.metas) {
    h.getRange(2, 1, METAS.length + 1, 1).setValues(METAS.map(m => [m[1]]).concat([['Actualizado']]));
    h.getRange(METAS.length + 2, 2).setNumberFormat('dd/mm/yyyy hh:mm');
  }
}
// Resumen: totales por día con fórmulas (la app no lo usa; es para que lo veas en la hoja)
function hojaResumen(h) {
  h.getRange(1, 1, 1, 7).setValues([['Fecha', 'kcal', 'Proteína (g)', 'Carbs (g)', 'Grasa (g)', '¿Proteína?', '¿kcal en rango?']]).setFontWeight('bold');
  h.setFrozenRows(1);
  h.getRange('A2').setFormula('=IFERROR(QUERY(Registro!B2:I, "select B, sum(F), sum(G), sum(H), sum(I) where B is not null group by B order by B desc ' +
    'label sum(F) \'\', sum(G) \'\', sum(H) \'\', sum(I) \'\'", 0), "")');
  h.getRange('F2').setFormula('=ARRAYFORMULA(IF(A2:A = "", "", IF(C2:C >= 0.95 * Metas!B3, "✓", "")))');
  h.getRange('G2').setFormula('=ARRAYFORMULA(IF(A2:A = "", "", IF((B2:B >= 0.85 * Metas!B2) * (B2:B <= 1.1 * Metas!B2), "✓", "")))');
  h.getRange('A:A').setNumberFormat('dd/mm/yyyy'); h.getRange('B:B').setNumberFormat('0'); h.getRange('C:E').setNumberFormat('0.#');
}

/* ===================== Utilidades ===================== */
function libro() { return SpreadsheetApp.getActiveSpreadsheet(); }
function hoja(nombre) {
  const h = libro().getSheetByName(nombre);
  if (!h) throw new Error('No existe la pestaña "' + nombre + '"');
  return h;
}
function zona() { return libro().getSpreadsheetTimeZone(); }
function aTexto(f) { return f instanceof Date ? Utilities.formatDate(f, zona(), 'yyyy-MM-dd') : (f ? String(f).slice(0, 10) : ''); }
function aFecha(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t))) throw new Error('Fecha inválida: ' + t);
  return Utilities.parseDate(String(t), zona(), 'yyyy-MM-dd');
}
function numero(v) { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[,\s]/g, '')); return isFinite(n) ? n : 0; }
// Un número dentro de un rango, con 1 decimal (las kcal sin decimales)
function cantidad(v, max, entero) { const n = Math.min(max, Math.max(0, numero(v))); return entero ? Math.round(n) : Math.round(n * 10) / 10; }
function filas(h, ncol) { const n = h.getLastRow() - 1; return n > 0 ? h.getRange(2, 1, n, ncol).getValues() : []; }
// Texto que escribes en la app: si empieza con = + - @ Sheets lo trataría como fórmula. El apóstrofo inicial lo deja como texto y no se ve.
function texto(v, max) { const t = String(v == null ? '' : v).trim().slice(0, max || 200); return /^[=+\-@]/.test(t) ? "'" + t : t; }
function id(v) {
  const t = String(v == null ? '' : v);
  if (!/^[\w:.-]{1,80}$/.test(t)) throw new Error('ID inválido');
  return t;
}
function comida(v) { if (!COMIDAS[v]) throw new Error('Comida inválida: ' + v); return COMIDAS[v]; }
function claveComida(v) {
  const t = String(v || '').toLowerCase().replace(/s$/, '');
  return COMIDAS[t] ? t : 'snack';
}

// Índice ID → fila de cada pestaña, armado una vez por llamada (así un lote de 80 cambios no lee la columna 80 veces)
let INDICE = {};
function indice(nombre) {
  if (INDICE[nombre]) return INDICE[nombre];
  const h = hoja(nombre), n = h.getLastRow() - 1, mapa = {};
  let ultima = 1;
  if (n > 0) h.getRange(2, 1, n, 1).getValues().forEach((r, i) => { if (r[0] !== '') { mapa[String(r[0])] = i + 2; ultima = i + 2; } });
  INDICE[nombre] = { mapa, ultima };
  return INDICE[nombre];
}
// Si ya existe esa fila (reintento o edición) se sobrescribe; si no, va en la siguiente fila libre
function escribir(nombre, clave, fila) {
  const ix = indice(nombre), h = hoja(nombre);
  let r = ix.mapa[clave];
  if (!r) { r = ix.ultima + 1; ix.ultima = r; ix.mapa[clave] = r; }
  if (r > h.getMaxRows()) h.insertRowsAfter(h.getMaxRows(), 500);   // la pestaña se llenó: 500 filas más
  h.getRange(r, 1, 1, fila.length).setValues([fila]);
  return true;
}
function borrar(nombre, clave) {
  const r = indice(nombre).mapa[id(clave)];
  if (r) { hoja(nombre).deleteRow(r); delete INDICE[nombre]; }
  return true;
}

/* ===================== Lectura ===================== */
// Lo que la app necesita: el registro de los últimos `dias` días, tus guardadas, el plan desde hace un mes y tus metas
function leerTodo(dias) {
  dias = Math.min(800, Math.max(1, Math.round(numero(dias) || 120)));
  const hace = n => Utilities.formatDate(new Date(Date.now() - n * 864e5), zona(), 'yyyy-MM-dd');
  const desde = hace(dias), desdePlan = hace(35);
  const registro = filas(hoja(H.registro), ENC.Registro.length).filter(r => r[0] !== '' && aTexto(r[1]) >= desde).map(r => ({
    id: String(r[0]), fecha: aTexto(r[1]), comida: claveComida(r[2]), nombre: String(r[3]), porcion: numero(r[4]) || 1,
    kcal: numero(r[5]), p: numero(r[6]), c: numero(r[7]), g: numero(r[8]), origen: String(r[9] || ''), ref: String(r[10] || ''),
    registrado: r[11] instanceof Date ? r[11].getTime() : null }));
  const guardadas = filas(hoja(H.guardadas), ENC.Guardadas.length).filter(r => r[0] !== '').map(r => ({
    id: String(r[0]), nombre: String(r[1]), comida: claveComida(r[2]), kcal: numero(r[3]), p: numero(r[4]), c: numero(r[5]), g: numero(r[6]),
    fav: String(r[7]) === 'Sí', ico: String(r[8] || ''), detalle: String(r[9] || ''), origen: String(r[10] || ''), creada: aTexto(r[11]) }));
  const plan = filas(hoja(H.plan), ENC.Plan.length).filter(r => r[0] !== '' && aTexto(r[1]) >= desdePlan).map(r => ({
    id: String(r[0]), fecha: aTexto(r[1]), comida: claveComida(r[2]), gid: String(r[3] || ''), nombre: String(r[4]), porcion: numero(r[5]) || 1,
    kcal: numero(r[6]), p: numero(r[7]), c: numero(r[8]), g: numero(r[9]), ico: String(r[10] || '') }));
  return { registro, guardadas, plan, metas: leerMetas(), hoja: libro().getName(), zona: zona(), version: VERSION };
}
function leerMetas() {
  const vals = {};
  filas(hoja(H.metas), 2).forEach(r => { vals[String(r[0])] = r[1]; });
  const m = {};
  METAS.forEach(([k, nombre]) => { m[k] = vals[nombre] === '' || vals[nombre] === undefined ? null : numero(vals[nombre]); });
  return m.kcal ? m : null;     // sin metas en la hoja: la app sube las suyas
}

/* ===================== Escritura ===================== */
function guardarRegistro(r) {
  if (!r) throw new Error('Registro vacío');
  const nombre = texto(r.nombre, 120);
  if (!nombre) throw new Error('La comida necesita nombre');
  return escribir(H.registro, id(r.id), [id(r.id), aFecha(r.fecha), comida(r.comida), nombre, Math.min(20, Math.max(0.1, numero(r.porcion) || 1)),
    cantidad(r.kcal, 10000, true), cantidad(r.p, 1000), cantidad(r.c, 2000), cantidad(r.g, 1000), texto(r.origen, 20), texto(r.ref, 80),
    r.registrado ? new Date(Number(r.registrado)) : new Date()]);
}
function guardarGuardada(g) {
  if (!g) throw new Error('Comida guardada vacía');
  const nombre = texto(g.nombre, 120);
  if (!nombre) throw new Error('La comida guardada necesita nombre');
  return escribir(H.guardadas, id(g.id), [id(g.id), nombre, comida(g.comida), cantidad(g.kcal, 10000, true), cantidad(g.p, 1000), cantidad(g.c, 2000),
    cantidad(g.g, 1000), g.fav ? 'Sí' : '', texto(g.ico, 8), texto(g.detalle, 300), texto(g.origen, 20),
    /^\d{4}-\d{2}-\d{2}$/.test(String(g.creada)) ? aFecha(g.creada) : new Date()]);
}
function guardarPlan(p) {
  if (!p) throw new Error('Plan vacío');
  return escribir(H.plan, id(p.id), [id(p.id), aFecha(p.fecha), comida(p.comida), texto(p.gid, 80), texto(p.nombre, 120) || 'Comida',
    Math.min(20, Math.max(0.1, numero(p.porcion) || 1)), cantidad(p.kcal, 10000, true), cantidad(p.p, 1000), cantidad(p.c, 2000), cantidad(p.g, 1000), texto(p.ico, 8)]);
}
function guardarMetas(m) {
  if (!m) throw new Error('Metas vacías');
  const h = hoja(H.metas);
  const valores = METAS.map(([k, nombre, min, max]) => {
    const v = Math.round(numero(m[k]));
    if (v < min || v > max) throw new Error(nombre + ' fuera de rango (' + min + '–' + max + ')');
    return [v];
  });
  h.getRange(2, 1, METAS.length + 1, 1).setValues(METAS.map(x => [x[1]]).concat([['Actualizado']]));
  h.getRange(2, 2, METAS.length, 1).setValues(valores);
  h.getRange(METAS.length + 2, 2).setValue(new Date());
  return true;
}
