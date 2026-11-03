// Revisión rápida que corre GitHub en cada push (y la puedes correr tú: node herramientas/revisar.js):
//  1. Sintaxis de cada archivo de la app y del Apps Script.
//  2. Los scripts de index.html juntos, en el orden en que los carga el navegador: así se detecta una variable
//     declarada dos veces (const/let repetido), que en el celular deja la app en blanco; y funciones repetidas entre archivos.
//  3. Que sw.js guarde todos los archivos que carga la app (si falta uno, la app no abre sin señal).
//  4. Ningún on…="…" ni <script> con código en el HTML: los botones usan clic('fn', …) (data-click) y en Chrome la
//     política de seguridad (seguridad.js) bloquea el JS en línea.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
let errores = 0;
const compilar = (codigo, nombre) => {
  try { new vm.Script(codigo, { filename: nombre }); console.log('✓', nombre); }
  catch (e) { errores++; console.error('✗', nombre + ':', e.message); }
};

const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1].replace(/^\.\//, '').split('?')[0]).filter(f => !/^https?:/.test(f));
const archivos = [...new Set(scripts.concat(['sw.js', 'apps-script/Comidas.gs']))];
archivos.forEach(f => compilar(fs.readFileSync(path.join(RAIZ, f), 'utf8'), f));
compilar(scripts.map(f => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n;\n'), scripts.join(' + ') + ' (juntos, como en index.html)');

// Una función con el mismo nombre en dos archivos no da error: gana la del último y la otra deja de funcionar sin avisar
const vistas = {};
scripts.forEach(f => {
  for (const m of fs.readFileSync(path.join(RAIZ, f), 'utf8').matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm)) {
    if (vistas[m[1]] && vistas[m[1]] !== f) { errores++; console.error('✗ función ' + m[1] + ' repetida en ' + vistas[m[1]] + ' y ' + f); }
    vistas[m[1]] = vistas[m[1]] || f;
  }
});
if (!errores) console.log('✓ sin funciones repetidas entre archivos');

// sw.js: cada script, fuente e ícono que usa index.html tiene que estar en ARCHIVOS
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');
const usados = scripts.concat([...html.matchAll(/(?:href|src)="([^"]+\.(?:png|woff2|webmanifest))"/g)].map(m => m[1]));
const faltan = [...new Set(usados)].filter(f => !sw.includes("'./" + f + "'"));
if (faltan.length) { errores++; console.error('✗ sw.js no guarda: ' + faltan.join(', ')); }
else console.log('✓ sw.js guarda todo lo que carga index.html');
[...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(f => f && !fs.existsSync(path.join(RAIZ, f)))
  .forEach(f => { errores++; console.error('✗ sw.js pide un archivo que no existe: ' + f); });

// Sin JS dentro del HTML: ni on…="…" (en index.html ni en lo que pintan los .js) ni <script> con código
const conCodigo = scripts.concat(['index.html']).filter(f => /\son[a-z]+=\\?["']/.test(fs.readFileSync(path.join(RAIZ, f), 'utf8')));
if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(html)) conCodigo.push('index.html (<script> con código)');
if (conCodigo.length) { errores++; console.error('✗ JS dentro del HTML en ' + conCodigo.join(', ') + ': usa clic(\'fn\', …) o alEscribir(\'fn\', …)'); }
else console.log('✓ sin JS dentro del HTML');

if (errores) process.exit(1);
