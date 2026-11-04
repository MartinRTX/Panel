/* Avisos en el celular: solo en la app Panel para Android (APK con el plugin de notificaciones).
 * No repiten los de Gym (pesarte, proteína, cintura, calorías): estos son de lo que vive en Panel.
 * Se reprograman solos cada vez que abres Panel o cambia algo (los textos llevan lo que sabe en ese momento).
 */
const AVISOS = [
  ['habitos', '✅ Hábitos de la noche', 'A las 9:30 pm, solo si ese día no los has marcado'],
  ['revision', '🗓️ Revisión del domingo', 'Domingo 7 pm: cómo te fue y tus objetivos para la que viene'],
  ['objetivos', '🎯 Objetivos a media semana', 'Jueves 7 pm: cómo vas con los de esta semana'],
  ['presupuesto', '💸 Presupuesto', '9 am, una vez al mes por categoría: si va más rápido que el mes']
];
// Identificadores de los avisos de Panel (no chocan con nada: es otra app)
const AV_HAB = 300, AV_REV = 310, AV_OBJ = 311, AV_PRES = 320;    // hábitos 300–306 (uno por día), presupuesto 320–329
const IDS_AVISOS = [0, 1, 2, 3, 4, 5, 6].map(d => AV_HAB + d).concat([AV_REV, AV_OBJ], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => AV_PRES + i));
const avisosPosibles = () => NATIVO && !!(window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('LocalNotifications'));
const avisosActivos = () => avisosPosibles() && LS.get('pan_avisos_on', false);
const avisoOn = k => LS.get('pan_avisos', {})[k] !== false;

function iniciarAvisos() {
  if (!avisosPosibles()) return;
  // Tocar un aviso abre lo suyo
  try {
    window.Capacitor.addListener('LocalNotifications', 'localNotificationActionPerformed', e => {
      const a = e && e.notification && e.notification.extra && e.notification.extra.accion;
      setTimeout(() => {
        if (a === 'revision') { if (HOJA_FN) cerrarHoja(); verTab('hoy'); abrirRevision(); }
        else if (a === 'habitos' || a === 'objetivos') { if (HOJA_FN) cerrarHoja(); HAB_AYER = false; verTab('hoy'); }
        else if (a === 'presupuesto') { if (HOJA_FN) cerrarHoja(); verTab('hoy'); }
      }, 300);
    });
  } catch (e) { /* sin avisos */ }
  programarAvisos();
}

let AV_T = null;
function programarAvisos() {
  if (!avisosActivos()) return;
  clearTimeout(AV_T);
  AV_T = setTimeout(armarAvisos, 1500);   // varios cambios seguidos: se programa una sola vez
}
function enFecha(dias, h, m) { const f = new Date(); f.setDate(f.getDate() + dias); f.setHours(h, m || 0, 0, 0); return f; }
function armarAvisos() {
  const ahora = new Date(), k = hoy(), lista = [], base = { channelId: 'panel', schedule: null };
  const pon = (id, at, title, body, accion) => { if (at > ahora) lista.push(Object.assign({}, base, { id, schedule: { at, allowWhileIdle: true }, title, body, extra: { accion } })); };
  // Hábitos 9:30 pm: hoy solo si aún no marcas nada; los próximos 6 días siempre (al marcarlos se vuelve a programar)
  if (avisoOn('habitos')) for (let d = 0; d < 7; d++) {
    const f = enFecha(d, 21, 30), h = habitoDe(claveDia(f));
    if (d === 0 && (h.agua !== null || h.sueno !== null || h.animo !== null)) continue;
    pon(AV_HAB + f.getDay(), f, '✅ ¿Cómo te fue hoy?', 'Agua, sueño y ánimo: un toque cada uno en Panel.', 'habitos');
  }
  // Domingo 7 pm: la revisión (si ese domingo ya elegiste objetivos para la que viene, el siguiente)
  if (avisoOn('revision')) {
    let dom = enFecha((7 - ahora.getDay()) % 7, 19);
    if (dom <= ahora || objetivosDe(sumarDias(lunesDe(claveDia(dom)), 7)).length) dom = enFecha((7 - ahora.getDay()) % 7 + 7, 19);
    const l = lunesDe(claveDia(dom)), objs = objetivosDe(l);
    pon(AV_REV, dom, '🗓️ Tu revisión de la semana', objs.length ? 'Mira cuántos de tus ' + objs.length + ' objetivos cumpliste y elige los de la que viene.'
      : 'Gym, comida, dinero y hábitos juntos, y tus objetivos para la que viene. 2 minutos.', 'revision');
  }
  // Jueves 7 pm: tus objetivos de esa semana (si tienes)
  if (avisoOn('objetivos')) {
    let jue = enFecha((4 - ahora.getDay() + 7) % 7, 19);
    if (jue <= ahora) jue = enFecha((4 - ahora.getDay() + 7) % 7 + 7, 19);
    const l = lunesDe(claveDia(jue)), objs = objetivosDe(l);
    if (objs.length) {
      // Si es de esta semana, con cómo vas hoy
      const ctx = l === lunesDe(k) ? ctxSemana(l) : null;
      pon(AV_OBJ, jue, '🎯 ¿Cómo vas con tus objetivos?', objs.map(o => textoObjetivo(o) + (ctx ? ' (' + valorTexto(o, CALC.progresoObjetivo(o, ctx, false)) + ')' : '')).join(' · '), 'objetivos');
    }
  }
  // Presupuesto 9 am de mañana: categorías que van más rápido que el mes (una vez al mes por categoría y nivel)
  if (avisoOn('presupuesto') && DATOS.fin && DATOS.fin.d && !DATOS.fin.ejemplo) {
    const F = CALC.finanzasHoy(DATOS.fin.d, k), ya = LS.get('pan_pres_avisos', {}), manana = enFecha(1, 9), mk = F.mes;
    Object.keys(ya).forEach(x => { if (x.slice(0, 7) !== mk || typeof ya[x] !== 'number') delete ya[x]; });
    F.categorias.filter(c => c.presupuesto && (c.gastado > c.presupuesto || (c.gastado / c.presupuesto >= 0.6 && c.gastado / c.presupuesto > F.avanceMes + 0.2)))
      .slice(0, 10).forEach((c, i) => {
        const nivel = c.gastado > c.presupuesto ? 'pasado' : 'rapido', clave = mk + ':' + c.nombre + ':' + nivel;
        if (ya[clave] && ya[clave] <= Date.now()) return;       // ese aviso ya salió este mes
        const at = ya[clave] ? new Date(ya[clave]) : manana;
        ya[clave] = at.getTime();
        pon(AV_PRES + i, at, nivel === 'pasado' ? '💸 Te pasaste en ' + c.nombre : '💸 Vas al ' + Math.round(c.gastado / c.presupuesto * 100) + '% de ' + c.nombre,
          nivel === 'pasado' ? 'Llevas ' + money(c.gastado, true) + ' de ' + money(c.presupuesto, true) + ' este mes.'
            : 'Y va el ' + Math.round(F.avanceMes * 100) + '% del mes. Te quedan ' + money(c.presupuesto - c.gastado, true) + '.', 'presupuesto');
      });
    LS.set('pan_pres_avisos', ya);
  }
  nativo('LocalNotifications', 'cancel', { notifications: IDS_AVISOS.map(id => ({ id })) })
    .then(() => nativo('LocalNotifications', 'createChannel', { id: 'panel', name: 'Panel', description: 'Hábitos, revisión de la semana, objetivos y presupuesto', importance: 3, visibility: 1 }))
    .then(() => lista.length ? nativo('LocalNotifications', 'schedule', { notifications: lista }) : null);
}

// Ajustes › Avisos
function bloqueAvisosAjustes() {
  let h = '<div class="fl" id="aj-avisos">Avisos en el celular</div>';
  if (!NATIVO) return h + '<div class="hint" style="margin:-4px 2px 0">Los avisos llegan en la app Panel para Android (APK). Aquí en el navegador no.</div>';
  if (!avisosPosibles()) return h + '<div class="note">Tu app Panel es de antes de los avisos. Baja la nueva: <b>github.com/MartinRTX/Panel › Releases › Panel.apk</b> e instálala encima (no se borra nada).</div>';
  if (!LS.get('pan_avisos_on', false)) return h + '<div class="hint" style="margin:-4px 2px 8px">Hábitos en la noche, la revisión del domingo, tus objetivos el jueves y el presupuesto. No repite los de Gym.</div>' +
    '<button class="btn block"' + clic('activarAvisos') + '>Activar avisos</button>';
  return h + AVISOS.map(([k, t, sub]) => interruptor(avisoOn(k), 'cambiarAviso', t, sub, k)).join('');
}
async function activarAvisos() {
  const r = await nativo('LocalNotifications', 'requestPermissions');
  if (!r || r.display !== 'granted') return toast('Sin permiso: actívalo en Ajustes del teléfono › Apps › Panel › Notificaciones');
  LS.set('pan_avisos_on', true); vibrar(); toast('Avisos activados ✓'); refrescarHoja(); programarAvisos();
}
function cambiarAviso(k) {
  const a = LS.get('pan_avisos', {}); a[k] = !avisoOn(k); LS.set('pan_avisos', a);
  vibrar(); refrescarHoja(); programarAvisos();
}
