// Guarda la app en el celular para que abra rápido y funcione sin señal.
// Cuando subas una versión nueva de la app, cambia el número de VERSION (y VERSION_APP en app.js).
const VERSION = 'panel-v1.0';
const ARCHIVOS = [
  './', './index.html', './config.js', './calculos.js', './ejemplo.js', './app.js', './comidas.js', './manifest.webmanifest',
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

// Archivos de la app: responde con lo guardado y actualiza en segundo plano.
// config.js va primero por la red: así, en cuanto pegues tus URL y subas el cambio, la app las usa.
// Las llamadas a Google (tus datos) nunca se guardan aquí.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const esConfig = /\/config\.js$/.test(url.pathname);
  e.respondWith(caches.open(VERSION).then(cache => {
    const guardado = () => cache.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request, esConfig ? { cache: 'no-cache' } : undefined).then(resp => {
      if (resp && resp.ok) cache.put(e.request, resp.clone());
      return resp;
    });
    red.catch(() => {});   // sin señal: se queda lo guardado
    // config.js: si la red tarda más de 3 s, se usa lo guardado para no frenar la app
    if (esConfig) return Promise.race([red, new Promise(r => setTimeout(r, 3000))]).catch(() => null)
      .then(resp => resp || guardado()).then(resp => resp || red);
    return guardado().then(g => g || red);
  }));
});
