# Mañana: lo que te falta para tener Panel conectado

La app ya está construida y probada. **Funciona desde hoy sin conectar nada**: Hoy muestra datos de ejemplo y
Comidas guarda todo en tu Pixel; cuando conectes la hoja "Comidas 2026" se sube solo lo que hayas registrado.

Te toma unos 20 minutos. Los pasos 1 a 4 conviene hacerlos en la compu; el 5 y el 6 en el Pixel.

---

## 1. Activar GitHub Pages (2 min)

Yo no tengo permiso para activarlo; el código ya está en la rama `main`.

1. Abre https://github.com/MartinRTX/Panel/settings/pages
2. En **Build and deployment** › **Source** elige **Deploy from a branch**.
3. En **Branch** elige **main** y la carpeta **/ (root)**. Toca **Save**.
4. Espera 1–2 minutos (en la pestaña **Actions** aparece "pages build and deployment" en verde).
5. Abre https://martinrtx.github.io/Panel/ — ya debe verse la app con datos de ejemplo.

## 2. Crear la hoja "Comidas 2026" y su Apps Script (8 min)

1. Abre https://sheets.new (con tu cuenta de siempre) y ponle de nombre **Comidas 2026**. No hace falta crear pestañas: el script las crea.
2. En la hoja: **Extensiones › Apps Script**. Arriba a la izquierda cámbiale el nombre al proyecto a **Comidas API**.
3. Abre https://github.com/MartinRTX/Panel/blob/main/apps-script/Comidas.gs, toca el botón de **copiar** (los dos cuadritos, "Copy raw file").
4. En Apps Script, en `Código.gs`, **borra todo** y **pega** el archivo.
5. Busca la línea `const CLAVE = 'PON_AQUI_TU_CLAVE';` y cambia `PON_AQUI_TU_CLAVE` por tu clave
   (puede ser la misma que usas en Gym y Finanzas). Guarda con 💾 (o Ctrl+S).
6. Arriba, junto a "Ejecutar", elige la función **instalar** y toca **Ejecutar**.
   - Te pide permisos: **Revisar permisos** › tu cuenta › si sale "Google no ha verificado esta app":
     **Avanzado** (o "Configuración avanzada") **› Ir a Comidas API (no seguro)** › **Permitir**. (Es tu propio script; solo toca esta hoja.)
   - Al terminar, en la hoja aparecen las pestañas **Registro, Guardadas, Plan, Metas y Resumen**.
7. **Implementar › Nueva implementación**. En el engrane ⚙️ de "Seleccionar tipo" elige **Aplicación web**.
   - Descripción: `Panel`
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Toca **Implementar** y copia la **URL de la app web** (termina en `/exec`).
8. Prueba rápida: abre esa URL en el navegador. Debe decir `{"ok":false,"error":"Clave incorrecta"}`.
   **Eso está bien**: el script está vivo y no deja entrar sin tu clave.

## 3. Copiar las URL de Gym y Finanzas (3 min)

Para Gym y Finanzas **no hay que desplegar nada nuevo**: Panel lee los mismos Apps Script que ya usan tus apps
(solo lee; nunca escribe en esas hojas).

1. Abre la hoja **Entrenamiento 2026 – Martin › Extensiones › Apps Script › Implementar › Gestionar implementaciones**.
   Copia la **URL de la app web** de la implementación activa.
2. Lo mismo en **Mis finanzas 2026**.

## 4. Pegar las tres URL en `config.js` (2 min)

1. Abre https://github.com/MartinRTX/Panel/edit/main/config.js
2. Reemplaza los tres textos `PEGA_AQUI_…` (deja las comillas):
   ```js
   URL_GYM: 'https://script.google.com/macros/s/……/exec',
   URL_FINANZAS: 'https://script.google.com/macros/s/……/exec',
   URL_COMIDAS: 'https://script.google.com/macros/s/……/exec',
   ```
3. **Commit changes** (directo a `main`). En 1–2 minutos la página se actualiza sola.

> Si prefieres que las URL no queden en el repo (es público), sáltate este paso y pégalas en la app, en el paso 6.
> Sin la clave las URL no sirven para nada, por eso es seguro dejarlas en `config.js`. **La clave nunca va en el repo.**

## 5. Instalar Panel en tu Pixel 10 Pro como APK (5 min)

Es una app de verdad (APK), como tus apps Gym y Finanzas: GitHub la compila sola y la deja en **Releases**.

1. **Una sola vez, para que se pueda actualizar encima sin desinstalar:** en
   https://github.com/MartinRTX/Panel/settings/secrets/actions toca **New repository secret** y crea los mismos dos
   que tienes en Gym y Finanzas:
   - `KEYSTORE_B64` (el texto en base64 de tu llave)
   - `KEYSTORE_PASS` (su contraseña)

   Después ve a **Actions › APK Android › Run workflow** (rama `main`) para que se vuelva a compilar con tu llave.
   Si no tienes esos valores a la mano, sáltate esto: el APK se firma con una llave temporal y funciona igual;
   solo que si algún día cambia la carpeta `apk/`, tendrás que desinstalar Panel antes de instalar la nueva.
2. Espera a que **Actions › APK Android** termine en verde (unos 5 minutos).
3. En el Pixel abre https://github.com/MartinRTX/Panel/releases/tag/apk y descarga **Panel.apk**.
4. Ábrelo desde la notificación de descarga › **Instalar**. Si Android pide permiso para "instalar apps desconocidas"
   desde Chrome, actívalo (es lo mismo que hiciste con Gym y Finanzas).
5. Queda el ícono **Panel** (cuatro cuadritos: morado, verde, naranja y blanco). Ábrelo; la primera vez necesita internet.
6. Si antes instalaste Panel desde Chrome como página, bórrala: mantén presionado su ícono › **Desinstalar**.

En el APK, los botones **Abrir Gym**, **Abrir Finanzas** y **Registrar gasto** abren tus APK de Gym y Finanzas
(Registrar gasto entra directo al registro). El gesto atrás cierra lo abierto, en Comidas regresa a Hoy y en Hoy manda Panel al fondo.
Las mejoras de la app llegan solas (por GitHub Pages); solo reinstalas si cambia la carpeta `apk/`.

## 6. Poner las claves en la app (2 min)

1. En Panel toca el **engrane ⚙️ › Conexión con tus hojas**.
2. En **Gym**, **Finanzas** y **Comidas**: escribe la clave (la URL ya sale de `config.js`; si no la pusiste ahí, pégala aquí)
   y toca **Guardar y probar**.
   - Si usas las apps Gym o Finanzas en este mismo Chrome, aparece el botón **"Usar la conexión de tu app …"**: un toque y listo.
3. Cómo saber que quedó:
   - En **Hoy**, junto a Gym y Finanzas ya no dice "Ejemplo" sino "hace X min" en verde.
   - Arriba la pastilla dice **✓ Al día** y en la hoja "Comidas 2026" aparecen tus comidas, tus dos comidas guardadas y tus metas.

### Si algo falla

| Lo que ves | Qué hacer |
|---|---|
| "La clave no coincide con la de Apps Script" | La clave de la app y la de `CLAVE` en el script deben ser idénticas. Si cambiaste el script, vuelve a implementar (abajo). |
| "Apps Script no dejó entrar…" | En la implementación, "Quién tiene acceso" debe ser **Cualquier usuario**. |
| "Clave: falta poner tu clave en el código" | No cambiaste `PON_AQUI_TU_CLAVE` en el script, o no implementaste la versión nueva. |
| Cambiaste el script de Comidas | **Implementar › Gestionar implementaciones › ✏️ › Versión: Nueva versión › Implementar** (la URL no cambia). |
| Algo de Gym o Finanzas sale raro | Mándame captura. Lo probé con datos con la misma forma que mandan sus scripts, pero no con tus datos reales. |

---

## Decisiones que tomé sin preguntarte

**Conexión y seguridad**
1. **Gym y Finanzas usan sus Apps Script actuales** (la acción `data` que ya usan esas apps), en modo solo lectura.
   Así no hay nada nuevo que desplegar para ellas y no se toca su código. Comidas tiene su propio script nuevo.
2. **Las claves no van en el repo** (es público, igual que en Finanzas): se escriben una vez en el celular.
   Las URL sí pueden ir en `config.js` porque sin clave no sirven. Las tres pueden usar la misma clave.
3. Todo va por POST con la clave en el cuerpo (nunca en el link), igual que Gym y Finanzas.

**Hoy – Gym**
4. **Rutina de hoy**: manda la hoja (`sugGrupo`, que solo avanza cuando entrenas). Si la app no ha podido leer la hoja hoy,
   usa la misma regla que tu app Gym: el siguiente después del último que entrenaste (nunca por fecha).
   Si ya entrenaste hoy lo dice; en tus días de descanso dice "Hoy descansas · cuando vuelvas toca …".
5. **Días entrenados**: semana de lunes a domingo, meta de **4 días** (como en Gym; se cambia en `config.js`).
6. **Km de trote**: los de la semana actual (lunes a domingo) que manda tu hoja.
7. **Peso**: último peso + cambio del promedio de 7 días contra la semana pasada. **Cintura**: última medición contra la anterior.
   Bajar se pinta en verde (tu meta es bajar grasa).
8. **Carrera**: la fecha fija es la de `config.js` (**sábado 21 de noviembre de 2026**, 5 km); manda sobre la que tenga la hoja de Gym.
9. Si los datos guardados son de la semana pasada (sin señal), los números de la semana se ponen en ceros en vez de mostrar datos viejos.

**Hoy – Finanzas**
10. **Patrimonio neto = cuentas − deudas con bancos** (tarjetas y préstamos). Las deudas con personas van en su propia
    tarjeta "Personas · aparte" y **no se suman ni restan** (en tu app Finanzas el neto sí resta lo que debes a personas).
11. **Saldos**: calculados igual que la app Finanzas (saldo al corte + movimientos desde el corte). Las cuentas archivadas no salen.
12. **Gasto del mes** = gastos − reembolsos por categoría, igual que "Este mes" en Finanzas. La rayita marca qué tanto del mes va;
    la barra se pone amarilla si gastas más rápido que el mes y roja si te pasas.
13. **Solo pestañas nuevas**: Panel nunca usa "Historial" ni "Respuestas de formulario 2" (los manda el script de Finanzas, pero se ignoran).
14. **Botones rápidos**: Abrir Gym, Abrir Finanzas, Registrar gasto (abre Finanzas en "gasto") y Registrar comida (en Panel).
    En el APK abren tus APK de Gym y Finanzas; si alguna no está instalada, abren su página en el navegador.

**Comidas**
15. **Metas iniciales**: 2,300 kcal y 140 g de proteína; la grasa al 25 % de las calorías (**64 g**) y los carbohidratos con
    el resto (**291 g**). En Ajustes las cambias; el botón "Repartir el resto" recalcula carbs y grasa.
16. **Licuado** (desayuno): 250 ml de leche semidescremada, 1 plátano, 100 g de fresas, 1 scoop de proteína (30 g) y 5 g de creatina
    = **371 kcal, 33 g proteína, 50 g carbs, 6 g grasa**. Valores del catálogo de tu app Gym. No le puse la avena ni la linaza
    que trae la receta de Gym porque no las mencionaste. Si tu scoop es de otra marca, edítalo (Ajustes › Mis comidas guardadas).
17. **Cena**: 2 tortillas de harina, 60 g de queso Oaxaca y 60 g de frijoles refritos = **491 kcal, 23 g proteína**.
    Le puse queso porque son quesadillas.
18. **Comida de mamá**: 3 toques (qué carne, con qué viene, qué tan lleno el plato + tortillas), con las porciones del "tupper"
    de tu app Gym. Se puede guardar como favorita con nombre (p. ej. "Picadillo de mamá").
19. **Comidas**: desayuno, comida, cena y snacks. Cada cosa se puede editar (porción ×½ a ×2, macros) o quitar, con "Deshacer".
20. **Plan semanal**: una comida por tiempo y día. "Llenar con lo de siempre" pone licuado, comida de mamá (un plato normal
    estimado) y quesadillas en los huecos vacíos; los snacks quedan libres. "Copiar la anterior" repite la semana pasada.
    En la vista Día, lo planeado aparece como botón de un toque.
21. **"Cumplí la meta"** = proteína al 95 % o más **y** calorías entre 85 % y 110 %. El resumen también separa cuántos días
    cumpliste solo proteína y solo calorías. Los promedios solo cuentan días completos registrados (hoy cuenta hasta mañana).
22. **Comidas no tiene datos de ejemplo**: todo lo que registres es real y se sube a la hoja. Solo Hoy usa ejemplos.
23. La primera vez que conectes, se suben tus comidas guardadas y tus metas a la hoja; después, lo que diga la hoja manda
    (si registras desde otro celular, aparece al abrir Panel). La app baja los últimos 120 días; la hoja guarda todo.
24. La hoja "Comidas 2026" trae una pestaña **Resumen** con fórmulas (totales por día y ✓ si cumpliste) para verla directo en Sheets.
25. En Ajustes hay **Exportar respaldo** (un archivo con tus comidas) por si algún día borras los datos de Chrome antes de conectar.

**Diseño y publicación**
26. Mismo estilo que tus apps: fuentes de Finanzas (Bricolage + Inter), barra inferior flotante con el botón **+** al centro
    para registrar comida, hojas que suben desde abajo, y el color de cada app (Gym morado, Finanzas verde, Comidas naranja).
27. Tema **automático** (sigue al Pixel) con opción Claro u Oscuro en Ajustes. Funciona sin señal (service worker).
28. Ícono nuevo de Panel (cuatro cuadritos: pesa, gráfica, plato y anillo de avance).
29. Publiqué el código en la rama de trabajo y también en **`main`** (era solo el commit inicial), para que Pages lo publique en cuanto lo actives.
30. Dejé pruebas automáticas (GitHub Actions "Pruebas"): cálculos, el Apps Script de Comidas sobre una hoja simulada,
    y `herramientas/probar.js` para probar la app completa en Chromium.
