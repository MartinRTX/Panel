// Política de seguridad estricta (solo en el navegador): ningún JS dentro del HTML, solo los archivos de la app.
// Se suma a la de index.html (las dos se cumplen). La de index.html permite JS en línea porque en el APK Capacitor
// mete su puente con el teléfono como script en línea; aquí, en Chrome, ya no hace falta.
(function () {
  var nativo = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) || /; wv\)/.test(navigator.userAgent);
  if (nativo) return;
  var m = document.createElement('meta');
  m.httpEquiv = 'Content-Security-Policy';
  m.content = "script-src 'self'; object-src 'none'; base-uri 'none'";
  document.head.appendChild(m);
})();
