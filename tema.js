// Tema elegido en Ajustes, antes de pintar para que no parpadee (va en el <head>)
(function () { try { var t = JSON.parse(localStorage.getItem('pan_tema')); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {} })();
