# Panel – notas para Claude

Tablero de Martin: PWA en GitHub Pages (`main` → https://martinrtx.github.io/Panel/), hermana de Gym y Finanzas.
Martin la usa como **APK** (Capacitor, carpeta `apk/`): un cascarón que carga esa misma página. El workflow "APK Android"
la compila y la publica en Releases (tag `apk`, `Panel.apk`) desde `main`; se firma con los secretos `KEYSTORE_B64` / `KEYSTORE_PASS`.
El plugin nativo `Panel.abrirApp` abre las APK de Gym (`com.martinrtx.gym`) y Finanzas (`com.martinrtx.finanzas`).
Dos pestañas: **Hoy** (gym y finanzas, solo lectura) y **Comidas** (lo que registras en Gym contra tus metas, plan semanal y resumen).

## Cómo se conecta

- Hoy lee los MISMOS Apps Script de Gym y Finanzas con la acción `data` (POST text/plain, clave en el cuerpo).
  No escribe nada en esas hojas. Si su respuesta cambia, ajustar `CALC.gymHoy` / `CALC.finanzasHoy` en `calculos.js`
  (se basan en `app.js` de Gym: `grupoDeHoy`, `datosWidgets`; y de Finanzas: `saldo`, `saldoPersona`, `resumenMes`).
- **Lo que come se registra SOLO en la app Gym** (Martin lo decidió: Gym tiene buscador, cámara, recetas y tupper).
  Panel lo lee con la acción `comidasPanel` del script de Gym (repo privado MartinRTX/Gym-script, `src/Panel.js`, 8.1+; ver GYM-PANEL.md).
  Ese script se publica con clasp desde su repo: NUNCA pedirle a Martin que pegue código en el Apps Script de Gym (se borraría).
  Sin esa acción usa `comidasDias` (hoy y ayer) de `data`. **Las metas las calcula Gym** (opción A, Martin lo eligió) y llegan en
  `comidasPanel().metas` con `deGym: true`; Panel solo las muestra (Ajustes no las edita mientras existan). Panel no escribe nada en Gym.
- Plan semanal, platillos para planear y metas: script propio `apps-script/Comidas.gs` (hoja "Comidas 2026").
  Lo registrado en Panel antes del cambio (pestaña Registro) se sigue sumando como "de Panel".
  La clave va en las Propiedades del script (`CLAVE`); en el código queda `PON_AQUI_TU_CLAVE` y así debe quedarse
  (el workflow no publica si cambia; el repo es público: nunca escribir la clave real). **Se publica solo desde GitHub** (desde el 03/11/2026):
  el workflow "Publicar Comidas (Panel)" de Gym-script (`.github/workflows/comidas.yml`) toma este archivo de `main`
  con clasp, crea versión y actualiza la misma implementación (la URL de `config.js` no cambia); corre cada 3 horas o a mano.
  NUNCA pegarlo a mano ni pedirle a Martin que lo pegue en el Apps Script (clasp lo pisaría). Basta con subir a `main`: sale en menos de 3 horas (revisa cada 3 horas, minuto 23) o al correrlo a mano.
- Las URL /exec van en `config.js` (o en Ajustes de la app). Las claves solo en el celular (`pan_conexion`).
- Comidas es "primero el celular": `pan_db` + cola `pan_cola` (operaciones por ID, idempotentes) que se sube en lotes.
- El patrimonio neto NO incluye deudas con personas (Martin lo pidió así): personas van aparte.

## Estructura

- `index.html` (estilos y esqueleto, sin JS adentro), `seguridad.js` (CSP estricta solo en Chrome) y `tema.js` (en el `<head>`), `config.js`, `calculos.js` (sin pantalla, con pruebas), `ejemplo.js` (datos de ejemplo),
  `app.js` (núcleo, Hoy, Ajustes, conexión), `comidas.js` (pestaña Comidas y la cola).
- `sw.js`: al publicar cambios de la app, subir `VERSION` (y `VERSION_APP` en `app.js`). `config.js` va primero por la red.
- `herramientas/revisar.js` y `node --test tests/*.test.js` corren en GitHub; `herramientas/probar.js` prueba en Chromium
  con las APIs simuladas (claro/oscuro, sin errores en consola, sin señal); `herramientas/iconos.js` genera los íconos.
- Botones y casillas: `clic('fn', args…)` / `alEscribir('fn', args…)` (data-click / data-input), nunca `onclick="…"`;
  la función tiene que ser `function` y estar en `ACCIONES` (app.js). `revisar.js` falla si hay JS dentro del HTML.
- Comentarios, textos y nombres en español, con el mismo estilo del código que ya existe.
