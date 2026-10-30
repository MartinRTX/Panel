# Comidas: registras en Gym, Panel lee y manda las metas

Desde la versión 1.3, **lo que comes se registra solo en tu app Gym** (buscador, cámara, recetas, el tupper de mamá).
Panel lo lee y te muestra el día, el plan semanal y el resumen contra **tus metas, que viven en Panel**.

| Qué | Dónde vive |
|---|---|
| Lo que comes (registro) | App Gym → pestaña "Comidas" de la hoja *Entrenamiento 2026 – Martin* |
| Metas (kcal, proteína, carbs, grasa) | Panel (engrane › Metas). Se guardan en "Comidas 2026" y **se le mandan a Gym** |
| Plan semanal y platillos para planear | Panel → hoja "Comidas 2026" |
| Lo que registraste en Panel antes de este cambio | Se queda en "Comidas 2026" y se sigue sumando ("de Panel") |

## Lo que tienes que hacer (5 min, en la compu)

1. Abre tu hoja **Entrenamiento 2026 – Martin › Extensiones › Apps Script**.
2. **Archivos → ＋ → Secuencia de comandos**, ponle de nombre **Panel** y pega TODO el archivo
   https://github.com/MartinRTX/Panel/blob/main/apps-script/Panel-Gym.gs (botón de copiar, "Copy raw file").
3. En **AppGym.gs**, busca la línea que empieza con `const fns = { data: getData,` y agrega dentro de las llaves
   (por ejemplo después de `data: getData,`):
   ```js
   comidasPanel: comidasPanel_, metasPanel: metasPanel_,
   ```
4. Guarda (💾) y **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**.
   La URL no cambia: no hay que tocar Panel.
5. Abre Panel. En **Comidas** ya debes ver tus últimas 6 semanas de Gym, y en Gym tu meta de proteína pasa a ser la de Panel.

Mientras no hagas esto, Panel solo ve **hoy y ayer** (lo que ya manda la app Gym) y te lo avisa en Comidas.

## Qué hace Panel.gs (no cambia nada de lo que ya tienes)

- `comidasPanel`: lee la pestaña "Comidas" de los últimos 42 días. Solo lectura.
- `metasPanel`: cuando guardas metas en Panel, la **proteína** se vuelve tu meta de Gym (el anillo y el aviso de las 6 pm)
  y las calorías, carbohidratos y grasa quedan guardadas en tu configuración de Gym (`metasPanel`).
  No toca tus recetas, productos, tuppers ni la configuración de nada más.

## Ajustes sugeridos para la app Gym (cuando quieras)

Para que Gym use **también** las calorías, carbs y grasa de Panel (hoy solo toma la proteína):

1. En **AppGym.gs**, en `getData()`, junto a `metaProteina: U.metaProteina || 130,` agrega:
   ```js
   metasPanel: U.metasPanel || null,
   ```
2. En la app Gym (`comida.js`, función `metasHoy()`): si `DATA.metasPanel` existe, usar
   `{ k: DATA.metasPanel.kcal, c: DATA.metasPanel.c, f: DATA.metasPanel.g }` en lugar de las calculadas, y en
   "Tus metas de hoy" decir que vienen de Panel (y quitar el editor de metas para no tener dos lugares).
3. Opcional: agregar **Colación** como cuarta comida en Gym (el script ya la acepta: `s` → "Colación"); Panel la muestra como Snacks.

Si me das acceso para editar el repo Gym, hago estos cambios yo.
