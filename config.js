/* Panel – configuración. Es el ÚNICO archivo que tienes que tocar para conectar la app con tus hojas.
 *
 * 1. Pega abajo la URL /exec de cada Apps Script (Implementar > Gestionar implementaciones > "URL de la app web").
 *    - Gym y Finanzas: las MISMAS URL que ya usan tus apps (no hay que crear nada nuevo para esas dos).
 *    - Comidas: la del script nuevo de la hoja "Comidas 2026" (apps-script/Comidas.gs).
 * 2. Las CLAVES no van aquí: el repo es público. Se escriben una sola vez en la app (engrane > Conexión)
 *    y se quedan guardadas solo en tu celular.
 * 3. Sube el cambio a GitHub (main) y abre la app: en un minuto se actualiza sola.
 *
 * Mientras una URL tenga el texto PEGA_AQUI…, esa parte usa datos de ejemplo (Gym y Finanzas)
 * o guarda todo en el celular para subirlo después (Comidas).
 * También puedes pegar la URL directo en la app (engrane > Conexión) sin tocar este archivo.
 */
const CONFIG = {
  URL_GYM: 'https://script.google.com/macros/s/AKfycbw888x3m8LPrcFHoaNbO6MoewnKVZOvi0NBFwDnpmGozbo7kOYRGQ03wkUPyh9mYpRdmQ/exec',            // hoja "Entrenamiento 2026 – Martin"
  URL_FINANZAS: 'https://script.google.com/macros/s/AKfycbzto--9SZE1HU533-sxhHeffrdxBETbBXEN2PEw0YU4U-s918JUNpNHQ7hEYqTHZ16k_g/exec',  // hoja "Mis finanzas 2026"
  URL_COMIDAS: 'https://script.google.com/macros/s/AKfycbxgTpbmp0oPE8hp5iebQhmNCnCf_-jNvOQW9rvN-pQSRqIP6xLzopRaxnUPKeSSVbGWWQ/exec',    // hoja nueva "Comidas 2026"

  // Tu carrera (la cuenta regresiva de Hoy)
  CARRERA: { nombre: 'Carrera de 5 km', fecha: '2026-11-21' },

  // Botones rápidos de Hoy
  APPS: {
    gym: 'https://martinrtx.github.io/Gym/',
    finanzas: 'https://martinrtx.github.io/Finanzas/',
    gasto: 'https://martinrtx.github.io/Finanzas/?accion=gasto'
  },

  // Metas de comida iniciales (después se cambian en la app: engrane > Metas)
  METAS: { kcal: 2300, p: 140, c: 291, g: 64 },

  // Días de gym por semana que cuentas como meta (como en tu app Gym)
  META_DIAS_GYM: 4
};
