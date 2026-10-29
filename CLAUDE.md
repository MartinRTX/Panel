# Panel – notas para Claude

Tablero de Martin: PWA en GitHub Pages (`main` → https://martinrtx.github.io/Panel/), hermana de Gym y Finanzas.
Martin la usa como **APK** (Capacitor, carpeta `apk/`): un cascarón que carga esa misma página. El workflow "APK Android"
la compila y la publica en Releases (tag `apk`, `Panel.apk`) desde `main`; se firma con los secretos `KEYSTORE_B64` / `KEYSTORE_PASS`.
El plugin nativo `Panel.abrirApp` abre las APK de Gym (`com.martinrtx.gym`) y Finanzas (`com.martinrtx.finanzas`).
Dos pestañas: **Hoy** (gym y finanzas, solo lectura) y **Comidas** (registro, metas, guardadas, plan semanal y resumen).

## Cómo se conecta

- Hoy lee los MISMOS Apps Script de Gym y Finanzas con la acción `data` (POST text/plain, clave en el cuerpo).
  No escribe nada en esas hojas. Si su respuesta cambia, ajustar `CALC.gymHoy` / `CALC.finanzasHoy` en `calculos.js`
  (se basan en `app.js` de Gym: `grupoDeHoy`, `datosWidgets`; y de Finanzas: `saldo`, `saldoPersona`, `resumenMes`).
- Comidas usa su propio script: `apps-script/Comidas.gs` (hoja "Comidas 2026"). Martin lo pega a mano en su Apps Script.
  **En el repo la clave siempre es `PON_AQUI_TU_CLAVE`** (el repo es público). Si cambia, decirle qué pasos repetir.
- Las URL /exec van en `config.js` (o en Ajustes de la app). Las claves solo en el celular (`pan_conexion`).
- Comidas es "primero el celular": `pan_db` + cola `pan_cola` (operaciones por ID, idempotentes) que se sube en lotes.
- El patrimonio neto NO incluye deudas con personas (Martin lo pidió así): personas van aparte.

## Estructura

- `index.html` (estilos y esqueleto), `config.js`, `calculos.js` (sin pantalla, con pruebas), `ejemplo.js` (datos de ejemplo),
  `app.js` (núcleo, Hoy, Ajustes, conexión), `comidas.js` (pestaña Comidas y la cola).
- `sw.js`: al publicar cambios de la app, subir `VERSION` (y `VERSION_APP` en `app.js`). `config.js` va primero por la red.
- `herramientas/revisar.js` y `node --test tests/*.test.js` corren en GitHub; `herramientas/probar.js` prueba en Chromium
  con las APIs simuladas (claro/oscuro, sin errores en consola, sin señal); `herramientas/iconos.js` genera los íconos.
- Comentarios, textos y nombres en español, con el mismo estilo del código que ya existe.
