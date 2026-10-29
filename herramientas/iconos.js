// Genera los íconos de la app a partir de brand/icon.svg (con el Chromium de Playwright):
//   node herramientas/iconos.js
// icon-192/512 y apple-touch-icon: con esquinas redondeadas · icon-maskable-512: fondo completo (Android lo recorta en círculo)
// favicon-32: la pestaña del navegador.
// apk/icono/: ícono del APK. icon-only (completo) y las dos capas del ícono adaptable de Android 8+ (fondo y figura);
// la figura va al 78 % para que el círculo del Pixel no recorte las esquinas de los cuadritos.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(RAIZ, 'brand', 'icon.svg'), 'utf8');
// Maskable: sin esquinas redondeadas (el dibujo ya cabe en la zona segura del 80 %)
const maskable = svg.replace(/(<rect id="fondo"[^>]*?) rx="228"/, '$1').replace(/(<rect[^>]*?) rx="228"([^>]*id="brillo")/, '$1$2');

(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  const sacar = async (codigo, lado, archivo, fondo) => {
    await pagina.setViewportSize({ width: lado, height: lado });
    await pagina.setContent('<html><body style="margin:0;background:' + (fondo || 'transparent') + '">' +
      codigo.replace('width="1024" height="1024"', 'width="' + lado + '" height="' + lado + '"') + '</body></html>');
    await pagina.screenshot({ path: path.join(RAIZ, archivo), omitBackground: !fondo, clip: { x: 0, y: 0, width: lado, height: lado } });
    console.log('✓', archivo);
  };
  await sacar(svg, 192, 'icon-192.png');
  await sacar(svg, 512, 'icon-512.png');
  await sacar(svg, 32, 'favicon-32.png');
  await sacar(maskable, 512, 'icon-maskable-512.png');
  await sacar(maskable, 180, 'apple-touch-icon.png', '#0E1330');
  // APK: sin el fondo queda la figura; sin la figura queda el fondo
  const [ini, fin] = [maskable.indexOf('<g filter='), maskable.lastIndexOf('</svg>')];
  const fondo = maskable.slice(0, ini) + maskable.slice(fin);
  const figura = maskable.replace(/<rect id="fondo"[^>]*\/>/, '').replace(/<rect[^>]*id="brillo"\/>/, '')
    .replace('<g filter=', '<g transform="translate(512 512) scale(.78) translate(-512 -512)"><g filter=').replace('</svg>', '</g></svg>');
  fs.mkdirSync(path.join(RAIZ, 'apk', 'icono'), { recursive: true });
  await sacar(maskable, 1024, 'apk/icono/icon-only.png', '#0E1330');
  await sacar(fondo, 1024, 'apk/icono/icon-background.png', '#0E1330');
  await sacar(figura, 1024, 'apk/icono/icon-foreground.png');
  await navegador.close();
})();
