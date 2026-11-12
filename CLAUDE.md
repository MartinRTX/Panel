# Panel – notas para Claude

Tablero de Martin: PWA en GitHub Pages (`main` → https://martinrtx.github.io/Panel/), hermana de Gym y Finanzas.
Martin la usa como **APK** (Capacitor, carpeta `apk/`): un cascarón que carga esa misma página. El workflow "APK Android"
la compila y la publica en Releases (tag `apk`, `Panel.apk`) desde `main`; se firma con los secretos `KEYSTORE_B64` / `KEYSTORE_PASS`.
El plugin nativo `Panel.abrirApp` abre las APK de Gym (`com.martinrtx.gym`) y Finanzas (`com.martinrtx.finanzas`).
Dos pestañas: **Hoy** (hábitos del día, objetivos de la semana, y gym y finanzas solo lectura) y **Comidas** (lo que registras
en Gym contra tus metas, plan semanal y resumen). La **revisión de la semana** es una hoja que sube desde abajo (`abrirRevision`).

## Lo que SÍ se hace en Panel (1.7, `semana.js` y `avisos.js`)

Martin lo pidió así: Panel no solo se ve, también se usa.
- **Hábitos del día** (tarjeta en Hoy): agua, horas de sueño, ánimo 1–5 y hasta 6 propios (Ajustes › Tus hábitos, guardados en
  `pan_hab_extra`). Un renglón por día en la pestaña "Hábitos" de la hoja Comidas 2026 (acción `guardarHabito`). Se puede marcar ayer.
- **Objetivos de la semana** (1 a 3; tipos en `CALC.OBJETIVOS`: gym, km, comida, gasto, agua, sueño, libre). Se miden solos con lo
  de Gym, Finanzas, comidas y hábitos (`CALC.progresoObjetivo`); el libre se palomea. Pestaña "Objetivos" (lunes de la semana).
  De viernes a domingo se eligen para la semana que viene; antes, para esa misma.
- **Revisión de la semana**: Gym (días por semana: `resumen.diasSemanas` del script de Gym; si aún no lo manda, lo que Panel anota en
  `pan_semgym`), km, peso y cintura de la semana, récords, comida, gasto (vs la anterior y vs el promedio de 4 semanas), hábitos,
  "lo que salió bien / para mejorar" y los objetivos. El domingo (y el lunes sin objetivos) Hoy la recuerda; `?accion=revision`.
- **Avisos** (solo APK con `@capacitor/local-notifications`): hábitos 9:30 pm, revisión domingo 7 pm, objetivos jueves 7 pm,
  presupuesto 9 am (una vez al mes por categoría). No repetir los de Gym (pesarte, proteína, cintura, kcal). Se reprograman al abrir.
- Hábitos y objetivos van por la cola de Comidas, pero solo se mandan si la hoja tiene el script 2+ (`pan_com_v`): así, si Panel se
  publica antes que el script, esperan en la cola en vez de rechazarse y perderse.

## Publicar (regla)

`main` se publica sola. Primero se sube la rama de trabajo, se espera a que "Pruebas" salga verde en GitHub en ESE commit y
solo entonces se adelanta `main` (el 08/11 en Gym se publicó con pruebas rojas por empujar las dos a la vez). El trabajo
`publicar` de `pruebas.yml` publica la página solo si las pruebas pasan, pero manda únicamente cuando Pages está en
Settings › Pages › Source: **GitHub Actions**; en "Deploy from a branch" GitHub publica `main` sin esperar y el trabajo solo avisa.

## Cómo se conecta

- **Gym (1.8)**: una sola llamada, acción `panel` del script de Gym 8.9+ (`Gym-script/src/Panel.js`): paquete chico y ya
  calculado por Gym (rutina de hoy en `d.hoy`, semana, 8 semanas, cuerpo, carrera, récords y las comidas con sus metas).
  `leerGym()` en `app.js`; con un script anterior cae a `data` + `comidasPanel` y reintenta `panel` al día siguiente
  (`pan_gym_sin_panel`). **Lo que Gym decide manda**: `CALC.gymHoy` usa `d.hoy` si los datos son de hoy; si son de otro día
  (sin señal) deduce con su regla de respaldo. `tests/contrato-gym.json` es una copia de `Gym-script/tests/contrato-panel.json`
  (lo generan las pruebas del script): si allá cambia una regla, se copia aquí y las pruebas dicen si Panel sigue de acuerdo.
  Nunca editarlo a mano.
- Finanzas: el MISMO Apps Script de la app con la acción `data` (POST text/plain, clave en el cuerpo); Panel recalcula con
  `CALC.finanzasHoy` (copia de `saldo`, `saldoPersona`, `resumenMes` de la app Finanzas: si cambian allá, ajustar aquí).
  Pendiente: darle a Finanzas el mismo trato que a Gym (acción propia + contrato).
- Panel no escribe nada en las hojas de Gym ni de Finanzas.
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
  `app.js` (núcleo, Hoy, Ajustes, conexión), `comidas.js` (pestaña Comidas y la cola), `semana.js` (hábitos, objetivos y revisión),
  `avisos.js` (notificaciones del APK).
- `sw.js`: al publicar cambios de la app, subir `VERSION` (y `VERSION_APP` en `app.js`). `config.js` va primero por la red.
- `herramientas/revisar.js` y `node --test tests/*.test.js` corren en GitHub; `herramientas/probar.js` prueba en Chromium
  con las APIs simuladas (claro/oscuro, sin errores en consola, sin señal); `herramientas/iconos.js` genera los íconos.
- Botones y casillas: `clic('fn', args…)` / `alEscribir('fn', args…)` (data-click / data-input), nunca `onclick="…"`;
  la función tiene que ser `function` y estar en `ACCIONES` (app.js). `revisar.js` falla si hay JS dentro del HTML.
- Comentarios, textos y nombres en español, con el mismo estilo del código que ya existe.
