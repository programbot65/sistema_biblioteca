'use strict';

/** Diagnóstico manual de la interfaz (uso: node scripts/revisar-interfaz.js) */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'bib-diag-'));
process.env.DB_PATH = path.join(CARPETA, 'diag.db');

const db = require('../src/db');
const { crearAplicacion } = require('../src/server');

(async () => {
  db.ejecutar("INSERT INTO categorias (nombre) VALUES ('Literatura')");
  db.ejecutar("INSERT INTO categorias (nombre) VALUES ('Matematicas')");
  db.ejecutar("INSERT INTO libros (codigo, titulo, autor, categoria_id, cantidad) VALUES ('LIT-001', 'El Principito', 'Saint-Exupery', 1, 2)");
  db.ejecutar("INSERT INTO libros (codigo, titulo, autor, categoria_id, cantidad) VALUES ('MAT-001', 'Algebra', 'Bennett', 2, 1)");
  db.ejecutar("INSERT INTO estudiantes (cedula, nombre, curso) VALUES ('1712345678', 'Ana Mero', '4to de Bachillerato')");
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado)
     VALUES (1, 1, date('now', '-2 days'), date('now', '+5 days'), 'activo')`
  );
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado)
     VALUES (2, 1, date('now', '-30 days'), date('now', '-23 days'), 'activo')`
  );

  const servidor = crearAplicacion().listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  console.log('servidor en', base);

  const errores = [];
  const consola = new VirtualConsole();
  consola.on('jsdomError', (e) => errores.push(['jsdomError', e.message, e.stack]));
  consola.on('error', (...a) => errores.push(['console.error', a.map(String).join(' ')]));
  consola.on('warn', (...a) => errores.push(['console.warn', a.map(String).join(' ')]));
  consola.on('log', (...a) => errores.push(['console.log', a.map(String).join(' ')]));

  const dom = await JSDOM.fromURL(`${base}/index.html#/panel`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: consola
  });

  // jsdom no implementa fetch: se conecta al servidor real de la prueba.
  dom.window.fetch = (entrada, opciones) => fetch(new URL(entrada, base), opciones);

  await new Promise((r) => setTimeout(r, 2000));
  console.log('PANEL fichas:', dom.window.document.querySelectorAll('.mesa .ficha').length,
    '| estaciones:', dom.window.document.querySelectorAll('.estacion').length,
    '| libro pila:', dom.window.document.querySelectorAll('.apilado__libro').length,
    '| lomos:', dom.window.document.querySelectorAll('.espina').length,
    '| compartimentos:', dom.window.document.querySelectorAll('.compartimento').length,
    '| hojas registro:', dom.window.document.querySelectorAll('.registro__hoja').length,
    '| carnes:', dom.window.document.querySelectorAll('.carne').length);
  console.log('estado sistema:', dom.window.document.getElementById('estado-texto')?.textContent,
    '| avisos visibles:', !dom.window.document.getElementById('boton-avisos').hidden);

  for (const ruta of ['#/inicio', '#/catalogo', '#/prestamos', '#/gestion']) {
    dom.window.location.hash = ruta;
    await new Promise((r) => setTimeout(r, 1200));
    const doc = dom.window.document;
    console.log(`\n=== ${ruta} ===`);
    console.log('titulo:', doc.querySelector('.vista__titulo')?.textContent
      || doc.querySelector('.nucleo__titulo')?.textContent);
    console.log('libros-catalogo:', doc.querySelectorAll('.rejilla-libros .libro').length);
    console.log('libros-anillo:', doc.querySelectorAll('.estanteria__anillo .libro').length);
    console.log('nucleo seccion:', doc.querySelector('.nucleo__seccion')?.textContent);
    console.log('paso activo:', doc.querySelectorAll('.nucleo__paso.activo').length);
    console.log('tablas:', doc.querySelectorAll('table').length);
    console.log('formularios:', doc.querySelectorAll('form').length);
    console.log('volver visible:', !doc.getElementById('volver-estanteria').hidden);
    if (doc.querySelector('.libro')) {
      const t = doc.querySelector('.libro').style.transform;
      console.log('transform libro 1:', t.slice(0, 90));
    }
    console.log('avisos:', doc.getElementById('avisos').textContent);
    console.log('cargando:', doc.querySelectorAll('.cargando').length,
      '| vacio:', doc.querySelectorAll('.vacio').length);
  }

  console.log('\n--- errores ---');
  for (const e of errores) console.log(e[0], '::', e[1], e[2] ? `\n${e[2].split('\n').slice(0, 5).join('\n')}` : '');

  dom.window.close();
  servidor.close();
  db.cerrar();
  fs.rmSync(CARPETA, { recursive: true, force: true });
  process.exit(0);
})();
