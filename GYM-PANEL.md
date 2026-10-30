# Comidas: registras en Gym, Gym calcula las metas y Panel las muestra

Desde la versión 1.4 (opción A, la que eligió Martin):

| Qué | Dónde vive |
|---|---|
| Lo que comes (registro) | App Gym → pestaña "Comidas" de la hoja *Entrenamiento 2026 – Martin* (una receta = un renglón por ingrediente, columna "Parte de") |
| Metas (kcal, proteína, carbs, grasa) | **App Gym**: las calcula con tu peso, tus días de gym, tus km y cómo vas bajando, y se ajustan solas cada semana. Gym se las manda a su script (`metasGym`) y Panel las lee |
| Plan semanal y platillos para planear | Panel → hoja "Comidas 2026" |
| Lo que registraste en Panel antes de la 1.3 | Se queda en "Comidas 2026" y se sigue sumando ("de Panel") |

## No hay nada que pegar a mano

La acción `comidasPanel` vive en el script de Gym (repo privado **MartinRTX/Gym-script**, `src/Panel.js`, versión 8.1 o más nueva).
Ese script se publica solo desde GitHub con clasp: **cualquier archivo pegado a mano en el editor de Apps Script se borra en la
siguiente publicación**. Si Panel necesita algo nuevo del script de Gym, el cambio se hace en ese repo.

## Qué hace `comidasPanel` (solo lee)

- Lo que comiste los últimos 42 días, día por día, con las recetas juntas (como en la app Gym) y sus `partes`.
- `metas`: las que calculó Gym, con los nombres de Panel (`kcal`, `p`, `c`, `g`, más `fib`, `auto`, `mant`, `porque` y `deGym: true`).
  Mientras Gym no las haya mandado, `kcal` viene vacío y Panel usa las suyas.

Panel ya no escribe metas en Gym (la acción `metasPanel` de la 1.3 se quitó).
