// Guarda la app en el celular para que abra rápido y funcione sin señal.
// Cuando subas una versión nueva de la app, cambia el número de VERSION (y VERSION_APP en app.js).
const VERSION = 'panel-v1.6';
const ARCHIVOS = [
  './', './index.html', './seguridad.js', './tema.js', './config.js', './calculos.js', './ejemplo.js', './app.js', './comidas.js', './manifest.webmanifest',
  './fonts/bricolage.woff2', './fonts/inter.woff2', './favicon-32.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache: 'reload' obliga a bajar los archivos nuevos, no los que el navegador tenga guardados
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Archivos de la app: SIEMPRE los de la versión instalada, todos juntos (todo o nada).
// Antes se actualizaban uno por uno en segundo plano y, justo después de publicar, podían mezclarse archivos de dos
// versiones (un app.js nuevo con un comidas.js viejo). Ahora una versión nueva llega completa cuando cambia VERSION:
// el navegador la baja entera en 'install' (si falla un archivo, no se instala nada) y la app se recarga una vez.
// config.js es la excepción: va primero por la red (así, en cuanto pegues tus URL y subas el cambio, la app las usa);
// si la red tarda más de 3 s o no hay señal, se usa lo guardado.
// Lo que no está en la lista se pide a la red. Las llamadas a Google (tus datos) nunca se guardan aquí.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(VERSION).then(cache => {
    const guardado = () => cache.match(e.request, { ignoreSearch: true });
    if (!/\/config\.js$/.test(url.pathname)) return guardado().then(g => g || fetch(e.request));
    const red = fetch(e.request, { cache: 'no-cache' }).then(resp => {
      if (resp && resp.ok) cache.put(e.request, resp.clone());
      return resp;
    });
    red.catch(() => {});   // sin señal: se queda lo guardado
    return Promise.race([red, new Promise(r => setTimeout(r, 3000))]).catch(() => null)
      .then(resp => resp || guardado()).then(resp => resp || red);
  }));
});
