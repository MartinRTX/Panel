// Genera los íconos de la app a partir de brand/icon.svg (con el Chromium de Playwright):
//   node herramientas/iconos.js
// icon-192/512 y apple-touch-icon: con esquinas redondeadas · icon-maskable-512: fondo completo (Android lo recorta en círculo)
// favicon-32: la pestaña del navegador.
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
  await navegador.close();
})();
