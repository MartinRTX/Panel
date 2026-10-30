/**
 * Panel.gs (v1) — lo que la app Panel le pide a tu hoja de Gym. No cambia nada de lo que ya tienes.
 *
 * Cómo instalarlo (2 pasos, igual que Maquina.gs):
 *  1) En el Apps Script de tu hoja de Gym: Archivos → ＋ → Secuencia de comandos → nómbralo "Panel" y pega TODO este archivo.
 *  2) En AppGym.gs, en la línea de `const fns = { data: getData, ...`, agrega dentro de las llaves:
 *        comidasPanel: comidasPanel_, metasPanel: metasPanel_,
 *  Luego: Implementar → Administrar implementaciones → editar (✏️) → Versión: Nueva versión → Implementar (la URL no cambia).
 *
 * Qué hace:
 *  - comidasPanel(dias): lo que comiste los últimos días (la pestaña "Comidas" que llena la app Gym), día por día y con
 *    sus macros, para que Panel te muestre el día, el plan y el resumen semanal. Solo lee.
 *  - metasPanel(metas): tus metas de comida viven en Panel. Al guardarlas ahí, la proteína se vuelve tu meta de
 *    proteína de Gym (el anillo y el aviso de las 6 pm) y las calorías, carbohidratos y grasa quedan guardadas para
 *    que la app Gym las use. Sin metas (metasPanel()) solo te dice cuáles tiene guardadas.
 *    No toca tus recetas, productos ni tuppers.
 * Usa lo que ya está en AppGym.gs: ss_, key_, num_, props_, U y COMIDAS_COLS.
 */

function comidasPanel_(dias) {
  dias = Math.max(1, Math.min(120, Math.round(Number(dias) || 42)));
  const ss = ss_(), tz = ss.getSpreadsheetTimeZone(), hoy = key_(new Date(), tz);
  const desde = key_(new Date(new Date(hoy + 'T12:00:00').getTime() - (dias - 1) * 864e5), tz);
  const sh = ss.getSheetByName('Comidas'), porDia = {};
  if (sh && sh.getLastRow() > 1) {
    // Solo las filas del final: ahí están los días recientes (la app escribe cada día completo al final)
    const n = sh.getLastRow(), ini = Math.max(2, n - 4000);
    const TIEMPO = { 'Desayuno': 'd', 'Comida': 'c', 'Cena': 'n', 'Colación': 's' };
    sh.getRange(ini, 1, n - ini + 1, COMIDAS_COLS.length).getValues().forEach(r => {
      if (!(r[0] instanceof Date)) return;
      const k = key_(r[0], tz);
      if (k < desde || k > hoy) return;
      (porDia[k] = porDia[k] || []).push({ h: String(r[1] || ''), m: TIEMPO[r[2]] || '', n: String(r[3] || ''), q: num_(r[4]), u: String(r[5] || ''),
        p: num_(r[6]) || 0, c: num_(r[7]), f: num_(r[8]), k: num_(r[9]), fib: num_(r[10]), src: String(r[11] || ''), ref: String(r[12] || ''), id: String(r[13] || '') });
    });
  }
  return { dias: porDia, desde: desde, hoy: hoy, metas: metasGuardadasPanel_(), version: 1 };
}

function metasGuardadasPanel_() {
  let cfg = {};
  try { cfg = JSON.parse(props_().getProperty('CFG_' + U.key) || '{}'); } catch (e) {}
  const m = cfg.metasPanel || null;
  return { p: Number(cfg.metaProteina || U.metaProteina) || 130, kcal: m ? m.kcal : null, c: m ? m.c : null, g: m ? m.g : null, ts: m ? m.ts : null };
}

function metasPanel_(m) {
  if (!m) return metasGuardadasPanel_();
  const v = (x, a, b, nombre) => {
    const n = Math.round(Number(x));
    if (isNaN(n) || n < a || n > b) throw new Error(nombre + ' fuera de rango (' + a + '–' + b + ')');
    return n;
  };
  const kcal = v(m.kcal, 800, 6000, 'Calorías'), p = v(m.p, 40, 300, 'Proteína'), c = v(m.c, 0, 1000, 'Carbohidratos'), g = v(m.g, 0, 400, 'Grasa');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const clave = 'CFG_' + U.key;
    let cfg = {};
    try { cfg = JSON.parse(props_().getProperty(clave) || '{}'); } catch (e) {}
    cfg.metaProteina = p;
    cfg.metasPanel = { kcal: kcal, c: c, g: g, ts: Date.now() };
    props_().setProperty(clave, JSON.stringify(cfg));
    Object.assign(U, cfg);
  } finally { lock.releaseLock(); }
  return metasGuardadasPanel_();
}
