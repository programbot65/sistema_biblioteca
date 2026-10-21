'use strict';

/**
 * Pruebas de la interfaz (seccion 18 del plan).
 *
 * Se carga la pagina real en un entorno DOM, se navega entre las
 * secciones del sistema y se verifica que la informacion se muestre.
 * Esto detecta errores de JavaScript que no se ven en las pruebas de la API.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const CARPETA_TEMPORAL = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-ui-'));
process.env.DB_PATH = path.join(CARPETA_TEMPORAL, 'interfaz.db');
process.env.ADMIN_KEY = 'clave-de-prueba';

const db = require('../src/db');
const { crearAplicacion } = require('../src/server');
const { CATEGORIAS, LIBROS } = require('../src/db/datos-iniciales');

let servidor;
let base;
let dom;

/** Espera a que una condicion dentro del documento se cumpla. */
async function esperar(condicion, descripcion, limite = 8000) {
  const inicio = Date.now();

  while (Date.now() - inicio < limite) {
    if (condicion(dom.window.document)) return;
    await new Promise((resolver) => setTimeout(resolver, 50));
  }

  throw new Error(`Tiempo agotado esperando: ${descripcion}`);
}

const texto = () => dom.window.document.body.textContent;

test.before(async () => {
  const idCategorias = new Map();
  for (const categoria of CATEGORIAS) {
    const resultado = db.ejecutar(
      'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
      categoria.nombre, categoria.descripcion
    );
    idCategorias.set(categoria.nombre, Number(resultado.lastInsertRowid));
  }
  for (const libro of LIBROS) {
    db.ejecutar(
      'INSERT INTO libros (codigo, titulo, autor, categoria_id, anio, cantidad) VALUES (?, ?, ?, ?, ?, ?)',
      libro.codigo, libro.titulo, libro.autor,
      idCategorias.get(libro.categoria) || null, libro.anio, libro.cantidad
    );
  }

  // Prestamos de prueba: uno vigente, uno atrasado y uno devuelto.
  const librosPorCodigo = db.todas('SELECT id, codigo FROM libros');
  const porCodigo = (codigo) => librosPorCodigo.find((libro) => libro.codigo === codigo).id;

  const estudiantes = [
    ['1712345678', 'Ana Lucía Mero', '2.º de Bachillerato'],
    ['1311122233', 'Diego Zamora', '3.º de Bachillerato'],
    ['2009876543', 'María Fernanda Ríos', '10.º de EGB']
  ].map(([cedula, nombre, curso]) => {
    const resultado = db.ejecutar(
      'INSERT INTO estudiantes (cedula, nombre, curso) VALUES (?, ?, ?)',
      cedula, nombre, curso
    );
    return Number(resultado.lastInsertRowid);
  });

  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado)
     VALUES (?, ?, date('now', '-2 days'), date('now', '+5 days'), 'activo')`,
    porCodigo('LIT-002'), estudiantes[0]
  );
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado)
     VALUES (?, ?, date('now', '-30 days'), date('now', '-23 days'), 'activo')`,
    porCodigo('MAT-001'), estudiantes[1]
  );
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, fecha_devolucion, estado)
     VALUES (?, ?, date('now', '-10 days'), date('now', '-3 days'), date('now', '-5 days'), 'devuelto')`,
    porCodigo('CS-001'), estudiantes[2]
  );

  servidor = crearAplicacion().listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const errores = [];
  const consola = new VirtualConsole();
  const anotar = (mensaje) => {
    // Limitacion conocida de jsdom, no es un error del sistema.
    if (/scrollTo\(\) method/.test(mensaje)) return;
    errores.push(mensaje);
  };
  consola.on('jsdomError', (error) => anotar(error.message));
  consola.on('error', (mensaje) => anotar(String(mensaje)));

  dom = await JSDOM.fromURL(`${base}/index.html#/panel`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: consola
  });

  // jsdom no implementa fetch ni el desplazamiento de la pagina: se conecta
  // al servidor real de la prueba y se ignoran esos avisos del entorno.
  dom.window.fetch = (entrada, opciones) => fetch(new URL(entrada, base), opciones);
  dom.errores = errores;

  // Se espera a que termine de cargar el inicio.
  await esperar((doc) => doc.querySelectorAll('.cifras .cifra').length > 0, 'el inicio');
});

test.after(() => {
  if (dom) dom.window.close();
  servidor.close();
  db.cerrar();
  fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });
});

// ---------------------------------------------------------------------
test('La pagina carga el inicio con las cifras de la biblioteca', () => {
  const documento = dom.window.document;

  // Las cifras son una sola linea, sin tarjetas ni adornos.
  const cifras = Array.from(documento.querySelectorAll('.cifras .cifra'));
  assert.equal(cifras.length, 5);
  assert.ok(texto().toLowerCase().includes('disponibles'));
  assert.ok(texto().toLowerCase().includes('atrasados'));

  for (const cifra of cifras) {
    assert.ok(cifra.querySelector('.cifra__valor').textContent.trim());
    assert.ok(cifra.querySelector('.cifra__etiqueta').textContent.trim().length > 2);
  }
});

test('La estantería es la pantalla de inicio', async () => {
  dom.window.location.hash = '#/inicio';

  await esperar((doc) => doc.querySelector('.estanteria__anillo') !== null, 'la estantería');

  const documento = dom.window.document;
  assert.ok(texto().includes('Biblioteca UEEA'));

  // La estantería es el menu: un libro por sección.
  const libros = Array.from(documento.querySelectorAll('.estanteria__anillo .libro'));
  assert.ok(libros.length >= 3, 'debe haber un libro por sección');

  // Y en el inicio no hay nada más: ni resumen, ni panel lateral.
  assert.equal(documento.querySelectorAll('.portada__resumen').length, 0);
  assert.equal(documento.querySelectorAll('.cifras .cifra').length, 0);
  assert.equal(documento.querySelectorAll('.sidebar').length, 0);
});

test('Los libros de la estantería son las secciones del sistema', async () => {
  dom.window.location.hash = '#/inicio';

  await esperar((doc) => doc.querySelectorAll('.estanteria__anillo .libro').length > 0, 'la estantería');

  const documento = dom.window.document;
  const libros = Array.from(documento.querySelectorAll('.estanteria__anillo .libro'));
  assert.deepEqual(
    libros.map((l) => l.dataset.vista),
    ['catalogo', 'usuarios', 'prestamos']
  );

  // Al elegir un libro se abre su sección.
  const libro = documento.querySelector('.estanteria__anillo .libro[data-vista="catalogo"]');
  libro.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  await esperar((doc) => doc.querySelector('.rejilla-libros') !== null, 'el catalogo');
  assert.equal(dom.window.location.hash, '#/catalogo');
});

test('El inicio integra las categorías de la biblioteca', async () => {
  dom.window.location.hash = '#/panel';

  await esperar((doc) => doc.querySelector('.seccion') !== null, 'las categorías del inicio');

  const secciones = dom.window.document.querySelectorAll('.seccion');
  assert.ok(secciones.length > 0);

  const panel = await (await fetch(`${base}/api/panel`)).json();
  const conLibros = panel.por_categoria.filter((categoria) => categoria.ejemplares > 0);
  assert.equal(secciones.length, conLibros.length);

  for (const celda of secciones) {
    assert.ok(celda.querySelector('.seccion__nombre').textContent.trim());
    assert.match(celda.getAttribute('href'), /^#\/catalogo\?q=/);
  }
});

test('El panel dibuja el registro de prestamos de los ultimos dias', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((doc) => doc.querySelector('.registro__hoja') !== null, 'el registro');

  const documento = dom.window.document;
  assert.equal(documento.querySelectorAll('.registro__hoja').length, 14);
});

test('El encabezado indica la sección y ofrece volver a la estantería', async () => {
  dom.window.location.hash = '#/catalogo';
  await esperar((doc) => doc.querySelectorAll('.rejilla-libros .libro').length > 0, 'el catalogo');

  const documento = dom.window.document;

  // No hay menu lateral: la estantería es el menú.
  assert.equal(documento.querySelectorAll('.sidebar').length, 0);

  // El encabezado dice en que sección estamos y ofrece el camino de vuelta.
  const subtitulo = documento.getElementById('subtitulo-seccion');
  assert.ok(subtitulo.textContent.trim().length > 0);

  const volver = documento.getElementById('volver-estanteria');
  assert.equal(volver.hidden, false);
  assert.equal(volver.getAttribute('href'), '#/inicio');
});

test('La vista del catalogo muestra los libros', async () => {
  dom.window.location.hash = '#/catalogo';

  await esperar(
    (doc) => doc.querySelectorAll('.rejilla-libros .libro').length > 0,
    'las tarjetas de libros del catalogo'
  );

  const documento = dom.window.document;
  assert.ok(texto().includes('Catalogo de libros'));
  assert.equal(documento.querySelectorAll('.rejilla-libros .libro').length, 12);
  assert.ok(texto().includes('El Principito'));
});

test('El buscador del catalogo filtra y avisa cuando usa busqueda inteligente', async () => {
  dom.window.location.hash = '#/catalogo?q=cienca';
  await esperar((doc) => doc.querySelector('.nota-busqueda'), 'la nota de busqueda');

  const nota = dom.window.document.querySelector('.nota-busqueda').textContent;
  assert.ok(nota.includes('coincidencia'));
  assert.ok(nota.includes('palabras relacionadas'));

  // Deben aparecer los libros de Ciencias Naturales pese al error de escritura.
  assert.ok(texto().includes('Biología') || texto().includes('Química'));
});

test('Al elegir una tarjeta se abre la ficha del libro con recomendaciones', async () => {
  const tarjetas = dom.window.document.querySelectorAll('.rejilla-libros .libro');
  tarjetas[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  await esperar(
    (doc) => doc.querySelector('#modal .ficha') !== null,
    'la ficha del libro dentro de la ventana modal'
  );

  const ficha = dom.window.document.querySelector('#modal .ficha');
  assert.ok(ficha.querySelector('.dato'));
  assert.ok(texto().includes('Ejemplares'));
  assert.ok(texto().includes('Registrar prestamo') || texto().includes('Registrar préstamo'));
});

test('La lista de prestamos muestra los prestamos activos con su situacion', async () => {
  dom.window.UI.cerrarModal();
  dom.window.location.hash = '#/prestamos';

  await esperar((doc) => doc.querySelector('form') !== null, 'el formulario de prestamos');
  await esperar(
    (doc) => doc.querySelector('.tabla-envoltura table') !== null,
    'la tabla de prestamos'
  );

  assert.ok(texto().includes('Registrar un préstamo'));
  assert.ok(texto().includes('Listado de préstamos'));
  assert.ok(dom.window.document.querySelector('[name="cedula"]'));
  assert.ok(dom.window.document.querySelector('[name="curso"]'));

  const documento = dom.window.document;
  assert.equal(documento.querySelectorAll('tbody tr').length, 2); // solo los activos
  assert.ok(texto().includes('El Principito'));
  assert.ok(texto().includes('En plazo'));
  assert.ok(texto().includes('Atrasado'));
});

test('El filtro de situacion muestra los prestamos atrasados', async () => {
  const select = dom.window.document.querySelectorAll('.filtros select')[0];
  select.value = 'atrasado';
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  await esperar(
    (doc) => doc.querySelectorAll('tbody tr').length === 1,
    'un solo prestamo atrasado'
  );

  assert.ok(texto().includes('Atrasado'));
});

test('El formulario de prestamos avisa si no se elige libro', () => {
  const documento = dom.window.document;

  documento
    .querySelector('form button[type="submit"]')
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  // El error se marca en el propio buscador de libros.
  const campo = documento.querySelector('.campo--error');
  assert.ok(campo, 'debe marcarse el campo con error');
  assert.match(campo.querySelector('.campo__error').textContent, /libro/i);
  assert.equal(campo.querySelector('input').name, 'libro_busqueda');
});

test('Los datos de un estudiante conocido se completan solos', async () => {
  const documento = dom.window.document;

  // Se escribe la cedula de una estudiante que ya tiene prestamos.
  const cedula = documento.querySelector('[name="cedula"]');
  cedula.value = '1712345678';
  cedula.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

  await esperar(
    (doc) => doc.querySelector('[name="nombre"]').value.trim().length > 0,
    'que se completen los datos del estudiante'
  );

  assert.equal(documento.querySelector('[name="nombre"]').value, 'Ana Lucía Mero');
  assert.equal(documento.querySelector('[name="curso"]').value, '2.º de Bachillerato');
});

test('El formulario de prestamos registra un prestamo completo', async () => {
  const documento = dom.window.document;

  // Se vuelve al filtro de prestamos activos.
  const filtro = documento.querySelectorAll('.filtros select')[0];
  filtro.value = 'activo';
  filtro.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  await esperar((doc) => doc.querySelectorAll('tbody tr').length === 2, 'los dos prestamos activos');

  // Se llenan los datos del estudiante.
  documento.querySelector('[name="nombre"]').value = 'Estudiante Interfaz';
  documento.querySelector('[name="cedula"]').value = '0911122233';
  documento.querySelector('[name="curso"]').value = '8.º de EGB';
  documento.querySelector('[name="dias_prestamo"]').value = '7';

  // Se busca un libro y se elige de las sugerencias.
  const entradaLibro = documento.querySelector('[name="libro_busqueda"]');
  entradaLibro.value = 'LIT-003';
  await dom.window.Vistas.prestamos.buscarLibros('LIT-003');

  await esperar(
    (doc) => doc.querySelectorAll('.resultados-sugeridos button').length > 0,
    'las sugerencias de libros'
  );

  documento
    .querySelector('.resultados-sugeridos button')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  assert.ok(documento.querySelector('.libro-seleccionado'));

  // Se envia el formulario.
  documento
    .querySelector('form button[type="submit"]')
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  await esperar(
    (doc) => doc.body.textContent.includes('La metamorfosis') && doc.querySelectorAll('tbody tr').length === 3,
    'el nuevo prestamo en la lista'
  );

  // El prestamo quedo registrado en la base de datos.
  const respuesta = await fetch(`${base}/api/prestamos?cedula=0911122233`);
  const { prestamos } = await respuesta.json();

  assert.equal(prestamos.length, 1);
  assert.equal(prestamos[0].codigo, 'LIT-003');
  assert.equal(prestamos[0].estado, 'activo');
  assert.equal(prestamos[0].situacion, 'vigente');
  assert.equal(prestamos[0].estudiante_nombre, 'Estudiante Interfaz');
});

test('El formulario muestra el error cuando el prestamo no es valido', async () => {
  const documento = dom.window.document;

  documento.querySelector('[name="nombre"]').value = 'A';
  documento.querySelector('[name="cedula"]').value = '12';
  documento.querySelector('[name="curso"]').value = '';

  const entradaLibro = documento.querySelector('[name="libro_busqueda"]');
  entradaLibro.value = 'INF-002';
  await dom.window.Vistas.prestamos.buscarLibros('INF-002');
  await esperar(
    (doc) => doc.querySelectorAll('.resultados-sugeridos button').length > 0,
    'las sugerencias de libros'
  );
  documento
    .querySelector('.resultados-sugeridos button')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  documento
    .querySelector('form button[type="submit"]')
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  await esperar(
    (doc) => doc.querySelectorAll('.campo--error').length > 0,
    'los campos marcados con error'
  );

  assert.ok(documento.querySelectorAll('.campo--error').length >= 2);
});

test('Desde la lista se registra la devolucion de un libro', async () => {
  const documento = dom.window.document;

  await esperar((doc) => doc.querySelectorAll('tbody tr').length === 3, 'los tres préstamos activos');

  const botonDevolver = Array.from(documento.querySelectorAll('button'))
    .find((boton) => boton.textContent === 'Devuelto');

  assert.ok(botonDevolver, 'debe existir el botón Devuelto en los préstamos activos');

  botonDevolver.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  await esperar(
    (doc) => doc.querySelector('#modal form') !== null,
    'la ventana de confirmación de devolución'
  );

  assert.ok(texto().includes('Registrar devolución'));
  assert.ok(dom.window.document.querySelector('#modal [name="fecha_devolucion"]'));

  dom.window.document
    .querySelector('#modal button[type="submit"]')
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  await esperar(
    (doc) => doc.querySelectorAll('tbody tr').length === 2,
    'la lista de préstamos activos tras la devolución'
  );

  const respuesta = await fetch(`${base}/api/prestamos?situacion=devuelto`);
  const { prestamos } = await respuesta.json();

  assert.ok(prestamos.some((prestamo) => prestamo.estado === 'devuelto'));
  assert.equal(prestamos.length, 2); // el de prueba y el devuelto ahora
});

test('La vista de gestion muestra el aviso de registro en preparación', async () => {
  dom.window.location.hash = '#/gestion';

  await esperar((doc) => doc.body.textContent.includes('Registro en preparación'), 'el aviso de pausa');

  assert.ok(texto().includes('Registro en preparación'));
  // Sin formularios de registro, edición ni eliminación a la vista.
  assert.equal(dom.window.document.querySelector('[name="titulo"]'), null);
  assert.equal(dom.window.document.querySelector('[name="clave"]'), null);
});

test('El catálogo vacío no ofrece registrar libros mientras dura la pausa', async () => {
  dom.window.location.hash = '#/catalogo';
  await esperar(
    (doc) => doc.querySelectorAll('.rejilla-libros .libro').length > 0,
    'las tarjetas de libros del catalogo'
  );

  // Se simula el catálogo vacío para comprobar el mensaje de espera.
  const vista = dom.window.Vistas.catalogo;
  vista.estado.q = '';
  vista.estado.categoria = '';
  vista.estado.estado = '';
  vista.estado.offset = 0;
  vista.pintarResultados({ libros: [], total: 0, offset: 0 });

  await esperar((doc) => doc.querySelector('.vacio--catalogo') !== null, 'el aviso de catálogo vacío');

  assert.ok(texto().includes('Todavía no hay libros registrados'));
  assert.ok(texto().includes('aparecerán aquí'));
  assert.equal(dom.window.document.querySelector('.vacio--catalogo .boton'), null);
});

test('El botón de tema alterna entre claro y oscuro', () => {
  const documento = dom.window.document;
  const boton = documento.querySelector('#tema-boton');
  assert.ok(boton);
  const inicial = documento.documentElement.dataset.tema;
  boton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.notEqual(documento.documentElement.dataset.tema, inicial);
  boton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(documento.documentElement.dataset.tema, inicial);
});

test('El tema claro está definido y se recuerda entre visitas', () => {
  const documento = dom.window.document;

  // La hoja de estilos del tema claro tiene que estar cargada.
  const hojas = Array.from(documento.querySelectorAll('link[rel="stylesheet"]'))
    .map((hoja) => hoja.getAttribute('href'));
  assert.ok(hojas.includes('/css/tema-claro.css'), 'falta la hoja del tema claro');

  // Al cambiar el tema, la preferencia queda guardada en el navegador.
  const boton = documento.querySelector('#tema-boton');
  const inicial = documento.documentElement.dataset.tema;

  boton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  const cambiado = documento.documentElement.dataset.tema;
  assert.notEqual(cambiado, inicial);
  assert.equal(dom.window.localStorage.getItem('biblio_tema'), cambiado);

  // Y al volver a pulsarlo se recupera el tema anterior.
  boton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(documento.documentElement.dataset.tema, inicial);
});

test('No hay menú lateral: la estantería es el menú', () => {
  const documento = dom.window.document;
  assert.equal(documento.querySelectorAll('.sidebar').length, 0);
  assert.equal(documento.querySelectorAll('#navegacion').length, 0);
});

test('Las categorías muestran secciones reales con su disponibilidad', async () => {
  dom.window.location.hash = '#/categorias';

  await esperar((doc) => doc.querySelector('.compartimento') !== null, 'las secciones');

  const primero = dom.window.document.querySelector('.compartimento');
  assert.ok(primero.querySelector('.compartimento__nombre').textContent.trim());
  assert.match(primero.querySelector('.compartimento__cifra').textContent, /\d+\/\d+/);
  assert.match(primero.getAttribute('href'), /^#\/catalogo\?q=/);
});

test('Los usuarios se buscan sin exponer la cédula y tienen historial real', async () => {
  dom.window.location.hash = '#/usuarios';

  await esperar((doc) => doc.querySelector('.usuario') !== null, 'la lista de usuarios');

  const documento = dom.window.document;
  const tarjetas = documento.querySelectorAll('.usuario');
  assert.ok(tarjetas.length > 0);
  assert.ok(documento.querySelector('.usuario__nombre').textContent.trim());
  assert.ok(!texto().includes('1712345678'), 'la cédula no se muestra en el listado');

  documento.querySelector('[name="q"]').value = 'Ana';
  documento.querySelector('.buscador')
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  await esperar(
    (doc) => Array.from(doc.querySelectorAll('.usuario__nombre')).some((n) => n.textContent.includes('Ana')),
    'el filtro por nombre'
  );

  documento.querySelector('.usuario .boton')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  await esperar((doc) => doc.querySelector('#modal .atencion__item') !== null, 'el historial real');
  assert.ok(texto().includes('Historial de'));
});

test('Los reportes reúnen el detalle real de la biblioteca', async () => {
  dom.window.location.hash = '#/reportes';

  await esperar((doc) => doc.querySelector('.registro__columna') !== null, 'los reportes');

  const documento = dom.window.document;
  assert.ok(documento.querySelector('.apilado__libro'));
  assert.ok(documento.querySelector('.espina'));
  assert.ok(documento.querySelector('.carne'));
});

test('Una ruta desconocida muestra un mensaje de pagina no encontrada', async () => {
  dom.window.location.hash = '#/no-existe';
  await esperar((doc) => doc.body.textContent.includes('Página no encontrada'), 'el mensaje de error');

  assert.ok(texto().includes('Volver a la estanteria'));
});

test('No se produjo ningun error de JavaScript durante la navegacion', () => {
  assert.deepEqual(dom.errores, []);
});