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
    ['1712345678', 'Ana Lucía Mero', '4to de Bachillerato'],
    ['1311122233', 'Diego Zamora', '5to de Bachillerato'],
    ['2009876543', 'María Fernanda Ríos', '3ro de Técnico']
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

  // Se espera a que termine de cargar el panel principal.
  await esperar((doc) => doc.querySelectorAll('.mesa .ficha').length > 0, 'el panel principal');
});

test.after(() => {
  if (dom) dom.window.close();
  servidor.close();
  db.cerrar();
  fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });
});

// ---------------------------------------------------------------------
test('La pagina carga el escritorio con las cifras de la biblioteca', () => {
  const documento = dom.window.document;

  // Las cifras ya no son tarjetas con bordes: son fichas de papel.
  assert.equal(documento.querySelectorAll('.ficha').length, 6);
  assert.ok(texto().includes('Mesa de entrada'));
  assert.ok(texto().includes('disponibles'));
  assert.ok(texto().includes('atrasados'));
});

test('El panel dibuja el registro de prestamos de los ultimos dias', () => {
  const documento = dom.window.document;
  assert.equal(documento.querySelectorAll('.registro__hoja').length, 14);
});

test('La navegacion marca la seccion activa', async () => {
  const activo = dom.window.document.querySelector('.navegacion__enlace.activo');
  assert.ok(activo);
  assert.equal(activo.dataset.vista, 'panel');
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
  const avisos = [];
  dom.window.UI.alerta = (mensaje) => avisos.push(mensaje);

  dom.window.document
    .querySelector('form button[type="submit"]')
    .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  assert.ok(avisos.length === 1);
  assert.match(avisos[0], /libro/i);

  dom.window.UI.alerta = (mensaje) => UI.aviso(mensaje, 'alerta');
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
  documento.querySelector('[name="curso"]').value = '2do de Bachillerato';
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

test('La vista de gestion pide la clave del encargado', async () => {
  dom.window.location.hash = '#/gestion';

  await esperar((doc) => doc.querySelector('.acceso') !== null, 'el formulario de acceso');

  assert.ok(texto().includes('Ingrese la clave'));
  assert.ok(dom.window.document.querySelector('[name="clave"]'));
});

test('Con la clave correcta se muestra el formulario de registro de libros', async () => {
  dom.window.Api.claveAdmin.guardar('clave-de-prueba');
  await dom.window.App.navegar();

  await esperar((doc) => doc.querySelector('[name="titulo"]') !== null, 'el formulario de libro');

  assert.ok(texto().includes('Registrar un libro nuevo'));
  assert.ok(texto().includes('Categorías'));
  assert.ok(dom.window.document.querySelector('[name="codigo"]'));
  assert.ok(dom.window.document.querySelector('[name="cantidad"]'));
});

test('El listado de libros de gestion muestra la tabla con acciones', async () => {
  await esperar((doc) => doc.querySelector('.tabla-envoltura table') !== null, 'la tabla de libros');

  const botones = dom.window.document.querySelectorAll('button');
  const textos = Array.from(botones).map((boton) => boton.textContent);
  assert.ok(textos.includes('Editar'));
  assert.ok(textos.includes('Dar de baja'));
});

test('Una ruta desconocida muestra un mensaje de pagina no encontrada', async () => {
  dom.window.location.hash = '#/no-existe';
  await esperar((doc) => doc.body.textContent.includes('Página no encontrada'), 'el mensaje de error');

  assert.ok(texto().includes('Volver a la estanteria'));
});

test('No se produjo ningun error de JavaScript durante la navegacion', () => {
  assert.deepEqual(dom.errores, []);
});