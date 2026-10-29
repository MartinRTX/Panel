// Una hoja de Google de mentira (lo mínimo de SpreadsheetApp que usa apps-script/Comidas.gs) para probar el script sin Google.
// cargarScript() devuelve las funciones del script (doPost, doGet, instalar…) y el libro para revisar qué quedó escrito.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pad = n => String(n).padStart(2, '0');
const aClave = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

function rango(h, fila, col, nf, nc) {
  return {
    getValues() { const out = []; for (let i = 0; i < nf; i++) { const r = []; for (let j = 0; j < nc; j++) r.push(h.celda(fila + i, col + j)); out.push(r); } return out; },
    setValues(v) {
      if (v.length !== nf || v.some(r => r.length !== nc)) throw new Error('setValues: el tamaño no coincide con el rango');
      v.forEach((r, i) => r.forEach((x, j) => h.poner(fila + i, col + j, x))); return this;
    },
    getValue() { return h.celda(fila, col); },
    setValue(x) { h.poner(fila, col, x); return this; },
    setFormula(f) { h.formulas[fila + ',' + col] = f; return this; },
    setFontWeight() { return this; }, setNumberFormat() { return this; }
  };
}
function hojaNueva(nombre) {
  const h = {
    nombre, datos: [], formulas: {}, maxFilas: 1000,
    celda(f, c) { const r = h.datos[f - 1]; return r && r[c - 1] !== undefined ? r[c - 1] : ''; },
    poner(f, c, x) {
      if (f > h.maxFilas) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      while (h.datos.length < f) h.datos.push([]);
      // Como en Sheets: un texto que empieza con apóstrofo se guarda sin él (el apóstrofo solo dice "esto es texto");
      // uno que empieza con = sin apóstrofo, Sheets lo toma como fórmula
      if (typeof x === 'string' && x[0] === '=') h.formulas[f + ',' + c] = x;
      h.datos[f - 1][c - 1] = typeof x === 'string' && x[0] === "'" ? x.slice(1) : x;
    },
    getName: () => h.nombre, setName(n) { h.nombre = n; return h; },
    getLastRow() { for (let i = h.datos.length; i > 0; i--) if ((h.datos[i - 1] || []).some(x => x !== '' && x !== undefined)) return i; return 0; },
    getMaxRows: () => h.maxFilas,
    insertRowsAfter(_, n) { h.maxFilas += n; },
    deleteRow(f) { h.datos.splice(f - 1, 1); },
    setFrozenRows() {},
    getRange(a, b, c, d) {
      if (typeof a === 'string') {
        const m = /^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/.exec(a), col = s => s.split('').reduce((t, ch) => t * 26 + ch.charCodeAt(0) - 64, 0);
        return rango(h, Number(m[2] || 1), col(m[1]), 1, 1);
      }
      return rango(h, a, b, c || 1, d || 1);
    }
  };
  return h;
}
function libroNuevo(nombre) {
  const lb = {
    nombre: nombre || 'Comidas 2026', hojas: [hojaNueva('Hoja 1')],
    getName: () => lb.nombre, getSpreadsheetTimeZone: () => 'America/Hermosillo',
    getSheets: () => lb.hojas.slice(),
    getSheetByName: n => lb.hojas.find(h => h.nombre === n) || null,
    insertSheet(n) { const h = hojaNueva(n); lb.hojas.push(h); return h; }
  };
  return lb;
}

function cargarScript(clave) {
  const lb = libroNuevo();
  let codigo = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Comidas.gs'), 'utf8');
  if (clave) codigo = codigo.replace("const CLAVE = 'PON_AQUI_TU_CLAVE';", "const CLAVE = '" + clave + "';");
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => lb },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ contenido: s, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Logger: { log() {} },
    Utilities: {
      formatDate: (d, tz, fmt) => { if (fmt !== 'yyyy-MM-dd') throw new Error('formato no simulado: ' + fmt); return aClave(d); },
      parseDate: (t, tz, fmt) => { const [y, m, d] = t.split('-').map(Number); return new Date(y, m - 1, d); }
    },
    Date, JSON, Math, String, Number, Object, Array, Error, isFinite, parseFloat
  };
  vm.createContext(ctx);
  vm.runInContext(codigo + '\n;this.__ = { doGet, doPost, instalar, INDICE_reset: () => { INDICE = {}; } };', ctx, { filename: 'Comidas.gs' });
  const api = ctx.__;
  // Igual que Apps Script: cada llamada empieza con las variables globales en blanco
  const post = cuerpo => { api.INDICE_reset(); return JSON.parse(api.doPost({ postData: { contents: JSON.stringify(cuerpo) } }).contenido); };
  const get = params => { api.INDICE_reset(); return JSON.parse(api.doGet({ parameter: params || {} }).contenido); };
  return { lb, post, get, instalar: api.instalar };
}

module.exports = { cargarScript, aClave };
