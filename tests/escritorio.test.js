'use strict';

/**
 * Pruebas del "escritorio de la biblioteca" (la vista de panel rediseñada).
 *
 * Comprueban tres cosas:
 *   1. que ya no exista la estetica de dashboard (tarjetas de indicadores,
 *      grafico de barras, tabla de prestamos recientes);
 *   2. que la informacion siga presente y sea real: cada objeto del escritorio
 *      debe corresponde a un dato que entrega la API;
 *   3. que las piezas sean accesibles y navegables.
 *
 * No se inventa informacion: las cifras se comparan contra /api/panel.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-escritorio-'));
process.env.DB_PATH = path.join(CARPETA, 'escritorio.db');

const db = require('../src/db');
const { crearAplicacion } = require('../src/server');
const { CATEGORIAS } = require('../src/db/datos-iniciales');
const fechas = require('../src/utiles/fechas');

let servidor;
let base;
let dom;
let panel;

/** Datos de prueba: dos libros, prestamo vigente, uno atrasado y uno devuelto. */
function sembrar() {
  const idCategoria = db.ejecutar(
    'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
    'Literatura', 'Novelas, cuentos y poesias'
  );
  const categoriaId = Number(idCategoria.lastInsertRowid);

  const libros = [
    ['LIT-001', 'El Principito', 'Antoine de Saint-Exupery', 3],
    ['LIT-002', 'Pedro Paramo', 'Juan Rulfo', 2],
    ['LIT-003', 'Cien anos de soledad', 'Gabriel Garcia Marquez', 1],
    ['LIT-004', 'Veinte poemas de amor', 'Pablo Neruda', 1]
  ].map(([codigo, titulo, autor, cantidad]) => {
    const r = db.ejecutar(
      'INSERT INTO libros (codigo, titulo, autor, categoria_id, anio, cantidad) VALUES (?, ?, ?, ?, 2020, ?)',
      codigo, titulo, autor, categoriaId, cantidad
    );
    return { id: Number(r.lastInsertRowid), codigo, titulo };
  });

  const r = db.ejecutar(
    'INSERT INTO estudiantes (cedula, nombre, curso) VALUES (?, ?, ?)',
    '1712345678', 'Ana Lucia Mero', '2.º de Bachillerato'
  );
  const estudianteId = Number(r.lastInsertRowid);

  const hoy = fechas.hoy();

  // Prestamo vigente (devuelve pronto)
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado)
     VALUES (?, ?, ?, ?, 'activo')`,
    libros[0].id, estudianteId, fechas.sumarDias(hoy, -2), fechas.sumarDias(hoy, 5)
  );
  // Prestamo atrasado
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado)
     VALUES (?, ?, ?, ?, 'activo')`,
    libros[1].id, estudianteId, fechas.sumarDias(hoy, -30), fechas.sumarDias(hoy, -23)
  );
  // Prestamo ya devuelto
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, fecha_devolucion, estado)
     VALUES (?, ?, ?, ?, ?, 'devuelto')`,
    libros[2].id, estudianteId, fechas.sumarDias(hoy, -12), fechas.sumarDias(hoy, -5), fechas.sumarDias(hoy, -6)
  );

  // Segundo estudiante con prestamos, para los carnés
  const r2 = db.ejecutar(
    'INSERT INTO estudiantes (cedula, nombre, curso) VALUES (?, ?, ?)',
    '1311122233', 'Diego Zamora', '3.º de Bachillerato'
  );
  const estudiante2 = Number(r2.lastInsertRowid);
  db.ejecutar(
    `INSERT INTO prestamos (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado)
     VALUES (?, ?, ?, ?, 'activo')`,
    libros[3].id, estudiante2, hoy, fechas.sumarDias(hoy, 7)
  );

  return { categoriaId, libros };
}

async function esperar(condicion, descripcion, limite = 8000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (condicion(dom.window.document)) return;
    await new Promise((resolver) => setTimeout(resolver, 50));
  }
  throw new Error(`Tiempo agotado esperando: ${descripcion}`);
}

const doc = () => dom.window.document;
const texto = () => dom.window.document.body.textContent;

test.before(async () => {
  // Categorias adicionales para que la seccion de categorias tenga variedad.
  for (const categoria of CATEGORIAS.slice(1)) {
    db.ejecutar('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
      categoria.nombre, categoria.descripcion);
  }
  sembrar();

  servidor = crearAplicacion().listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}`;

  const errores = [];
  const consola = new VirtualConsole();
  const anotar = (mensaje) => {
    if (/scrollTo\(\) method/.test(mensaje)) return; // limitacion de jsdom
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

  dom.window.fetch = (entrada, opciones) => fetch(new URL(entrada, base), opciones);
  dom.errores = errores;

  await esperar((d) => d.querySelectorAll('.cifras .cifra').length > 0, 'el escritorio');

  panel = await (await fetch(`${base}/api/panel`)).json();
});

test.after(() => {
  if (dom) dom.window.close();
  servidor.close();
  db.cerrar();
  fs.rmSync(CARPETA, { recursive: true, force: true });
});

// =====================================================================
// 1. Desaparecio de la estetica de dashboard
// =====================================================================
test('Ya no hay tarjetas de indicadores, grafico de barras ni tabla de prestamos', () => {
  // Estas clases eran las del dashboard anterior.
  assert.equal(doc().querySelectorAll('.indicador').length, 0, 'no debe haber tarjetas de cifras');
  assert.equal(doc().querySelectorAll('.grafico').length, 0, 'no debe haber grafico de barras');
  assert.equal(doc().querySelectorAll('.grafico__barra').length, 0);
  assert.equal(doc().querySelectorAll('.barra-progreso').length, 0, 'no debe haber barras de porcentaje');
  assert.equal(doc().querySelectorAll('table').length, 0, 'no debe haber tablas');
  assert.equal(doc().querySelectorAll('.lista-datos').length, 0);
});

test('La pantalla de inicio es la estantería y el resumen vive aparte', async () => {
  dom.window.location.hash = '#/inicio';
  await esperar((d) => d.querySelector('.estanteria__anillo') !== null, 'la estanteria');

  // El inicio es solo la estantería.
  assert.ok(doc().querySelector('.estanteria__anillo'), 'la estantería abre el inicio');
  assert.equal(doc().querySelectorAll('.cifras .cifra').length, 0);

  // El resumen con las cifras reales está en su propia vista.
  dom.window.location.hash = '#/panel';
  await esperar((d) => d.querySelectorAll('.cifras .cifra').length > 0, 'el resumen');

  assert.equal(doc().querySelectorAll('.cifras .cifra').length, 5);
  assert.ok(doc().querySelector('.destacados'), 'la fila de destacados sigue en el resumen');
});

test('Los reportes reúnen las estaciones de detalle', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((d) => d.querySelector('.registro__columna') !== null, 'los reportes');

  const estaciones = doc().querySelectorAll('.estacion');
  assert.ok(estaciones.length >= 5, `se esperaban al menos 5 estaciones, hay ${estaciones.length}`);

  const titulos = Array.from(estaciones).map((e) => e.querySelector('.estacion__titulo').textContent);
  assert.ok(titulos.includes('Mesa de prestamos'));
  assert.ok(titulos.includes('Estanteria de los mas prestados'));
  assert.ok(titulos.includes('Registro de prestamos'));
});

// =====================================================================
// 2. La informacion sigue siendo real
// =====================================================================
test('Las cifras muestran exactamente los datos del servidor', async () => {
  dom.window.location.hash = '#/panel';
  await esperar((d) => d.querySelectorAll('.cifras .cifra').length > 0, 'el escritorio');

  const resumen = panel.resumen;
  const cifras = Array.from(doc().querySelectorAll('.cifras .cifra'));

  const valores = cifras.map((cifra) => cifra.querySelector('.cifra__valor').textContent);
  const etiquetas = cifras.map((cifra) => cifra.querySelector('.cifra__etiqueta').textContent);

  assert.ok(valores.includes(String(resumen.disponibles)), 'debe estar los disponibles');
  assert.ok(valores.includes(String(resumen.prestados)), 'debe estar los prestados');
  assert.ok(valores.includes(String(resumen.atrasados)), 'debe estar los atrasados');
  assert.ok(valores.includes(String(resumen.titulos)), 'debe estar los titulos');

  assert.ok(etiquetas.includes('Disponibles'));
  assert.ok(etiquetas.includes('Atrasados'));
});

test('Las cifras se leen sin depender del color', () => {
  for (const cifra of doc().querySelectorAll('.cifras .cifra')) {
    assert.ok(cifra.querySelector('.cifra__etiqueta').textContent.trim().length > 2,
      'cada cifra tiene su etiqueta escrita');
    assert.match(cifra.getAttribute('aria-label'), /: \d+/);
  }
});

test('La cifra de atrasados avisa con el color de alerta cuando hay atraso', () => {
  const resumen = panel.resumen;
  assert.ok(resumen.atrasados > 0, 'la prueba necesita al menos un prestamo atrasado');

  const cifra = Array.from(doc().querySelectorAll('.cifras .cifra')).find((c) =>
    c.querySelector('.cifra__etiqueta').textContent === 'Atrasados');

  assert.ok(cifra.classList.contains('cifra--alerta'), 'la cifra de atrasados usa el tono de alerta');
});

test('Los prestamos recientes aparecen como una pila de libros', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((d) => d.querySelector('.apilado__libro') !== null, 'la pila de prestamos');

  const pila = doc().querySelectorAll('.apilado__libro');

  assert.equal(pila.length, panel.ultimos_prestamos.length);
  assert.ok(pila.length > 0);

  // Cada libro de la pila corresponde a un prestamo real de la API.
  const codigosApi = panel.ultimos_prestamos.map((p) => p.codigo).sort();
  const codigosPila = Array.from(pila).map((libro) => {
    const etiqueta = libro.getAttribute('aria-label');
    return codigosApi.find((codigo) => etiqueta.includes(codigo)) ||
      (panel.ultimos_prestamos.find((p) => etiqueta.includes(p.titulo)) || {}).codigo;
  }).sort();

  assert.deepEqual(codigosPila, codigosApi);

  // Cada libro tiene lomo y canto de paginas: se ve un libro, no un boton.
  for (const libro of pila) {
    assert.ok(libro.querySelector('.apilado__lomo'));
    assert.ok(libro.querySelector('.apilado__paginas'));
    assert.equal(libro.tagName, 'BUTTON');
  }
});

test('Los libros mas prestados se muestran como lomos sobre un estante', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((d) => d.querySelector('.espina') !== null, 'los lomos');

  const lomos = doc().querySelectorAll('.espina');
  assert.ok(lomos.length > 0);
  assert.equal(lomos.length, panel.mas_prestados.length);

  assert.ok(doc().querySelector('.estante__tablero'), 'debe existir el tablero del estante');

  // La altura del lomo crece con las veces prestado.
  const alturas = Array.from(lomos).map((lomo) => parseFloat(lomo.style.getPropertyValue('--alto')));
  const conteos = panel.mas_prestados.map((libro) => libro.veces_prestado);

  const mayorConteo = Math.max(...conteos);
  const indiceTop = conteos.indexOf(mayorConteo);
  const mayorAltura = Math.max(...alturas);
  assert.ok(alturas[indiceTop] === mayorAltura, 'el libro mas prestado debe ser el lomo mas alto');

  // Cada lomo lleva al catalogo usando su codigo.
  for (const lomo of lomos) {
    assert.match(lomo.getAttribute('href'), /^#\/catalogo\?q=/);
  }
});

test('Las categorias son compartimentos con su nombre y su disponibilidad', async () => {
  dom.window.location.hash = '#/categorias';
  await esperar(
    (d) => {
      const titulo = d.querySelector('.vista__titulo');
      return titulo && titulo.textContent === 'Categorías' && d.querySelector('.compartimento') !== null;
    },
    'las secciones'
  );

  const compartimentos = doc().querySelectorAll('.compartimento');
  assert.ok(compartimentos.length > 0);

  const conLibros = panel.por_categoria.filter((c) => c.ejemplares > 0);
  assert.equal(compartimentos.length, conLibros.length);

  for (const celda of compartimentos) {
    const nombre = celda.querySelector('.compartimento__nombre').textContent;
    const origen = conLibros.find((c) => c.categoria === nombre);
    assert.ok(origen, `el compartimento "${nombre}" debe existir en la API`);
    assert.equal(celda.querySelector('.compartimento__cifra').textContent,
      `${origen.disponibles}/${origen.ejemplares}`);
    assert.match(celda.getAttribute('href'), /^#\/catalogo\?q=/);
  }
});

test('El registro de prestamos son las hojas de un cuaderno, con su rotulo de dia', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((d) => d.querySelector('.registro__columna') !== null, 'el registro');

  const columnas = doc().querySelectorAll('.registro__columna');
  assert.equal(columnas.length, panel.prestamos_por_dia.length);
  assert.equal(columnas.length, 14);

  // Cada columna tiene su hoja y la fecha escrita debajo.
  for (const columna of columnas) {
    assert.ok(columna.querySelector('.registro__hoja'));
    assert.match(columna.querySelector('.registro__dia').textContent, /\d{2}\/\d{2}/);
  }

  // La altura de la hoja es proporcional al numero de prestamos.
  const alturas = Array.from(doc().querySelectorAll('.registro__hoja'))
    .map((hoja) => parseFloat(hoja.style.getPropertyValue('--alto')));
  const maximo = Math.max(...panel.prestamos_por_dia.map((p) => p.total), 1);

  const indiceTop = panel.prestamos_por_dia.reduce((mejor, punto, i) =>
    punto.total > panel.prestamos_por_dia[mejor].total ? i : mejor, 0);

  assert.equal(alturas[indiceTop], Math.max(...alturas));
  assert.equal(Math.max(...alturas), 100);
  void maximo;
});

test('Los estudiantes con prestamos activos aparecen como carnes', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((d) => d.querySelector('.carne') !== null, 'los carnes');

  const carnes = doc().querySelectorAll('.carne');
  assert.equal(carnes.length, panel.estudiantes_mas_activos.length);

  for (const carne of carnes) {
    assert.equal(carne.tagName, 'BUTTON');
    assert.ok(carne.querySelector('.carne__nombre').textContent.trim());
    assert.ok(carne.querySelector('.carne__activo').textContent.trim());
  }
});

test('Cada estacion explica de donde sale su informacion', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((d) => d.querySelector('.registro__dia') !== null, 'el registro');

  const detalles = Array.from(doc().querySelectorAll('.estacion__detalle')).map((d) => d.textContent);
  const textoCompleto = detalles.join(' | ');

  assert.match(textoCompleto, /dia/, 'el registro debe decir cuantos dias cubre');
  assert.match(textoCompleto, /altura del lomo/, 'la estanteria debe explicar el criterio');

  dom.window.location.hash = '#/categorias';
  await esperar(
    (d) => {
      const titulo = d.querySelector('.vista__titulo');
      return titulo && titulo.textContent === 'Categorías' && d.querySelector('.compartimento') !== null;
    },
    'las secciones'
  );
  const detalleSecciones = doc().querySelector('.estacion__detalle').textContent;
  assert.match(detalleSecciones, /disponibles \/ total/, 'las secciones deben explicar la cifra');
});

// =====================================================================
// 3. Navegacion desde el escritorio
// =====================================================================
test('La cifra de atrasados lleva a la lista de prestamos atrasados', async () => {
  dom.window.location.hash = '#/panel';
  await esperar((d) => d.querySelectorAll('.cifras .cifra').length > 0, 'el escritorio');

  const cifra = Array.from(doc().querySelectorAll('.cifras .cifra')).find((f) =>
    f.querySelector('.cifra__etiqueta').textContent === 'Atrasados');

  cifra.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  await esperar((d) => d.querySelector('.tabla-envoltura') !== null, 'la lista de prestamos');
  assert.equal(dom.window.location.hash, '#/prestamos?situacion=atrasado');
});

test('Un libro de la pila lleva a los prestamos filtrados por su codigo', async () => {
  dom.window.location.hash = '#/reportes';
  await esperar((d) => d.querySelector('.apilado__libro') !== null, 'la pila de prestamos');

  const codigo = panel.ultimos_prestamos[0].codigo;
  const libro = doc().querySelector('.apilado__libro');

  libro.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  await esperar((d) => d.querySelector('.tabla-envoltura') !== null, 'la lista filtrada');
  assert.equal(dom.window.location.hash, `#/prestamos?codigo=${encodeURIComponent(codigo)}`);
});

test('Un compartimento lleva al catalogo con el nombre de la seccion', async () => {
  dom.window.location.hash = '#/categorias';
  await esperar(
    (d) => {
      const titulo = d.querySelector('.vista__titulo');
      return titulo && titulo.textContent === 'Categorías' && d.querySelector('.compartimento') !== null;
    },
    'los compartimentos'
  );

  const nombre = doc().querySelector('.compartimento__nombre').textContent;
  doc().querySelector('.compartimento')
    .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  await esperar((d) => d.querySelector('.buscador') !== null, 'el catalogo');
  assert.ok(dom.window.location.hash.includes('q='));
  assert.ok(dom.window.location.hash.includes(encodeURIComponent(nombre.slice(0, 4))));
});

test('El encabezado muestra el estado del sistema y el aviso de atrasos', async () => {
  dom.window.location.hash = '#/panel';
  await esperar((d) => d.querySelector('.cifras .cifra') !== null, 'el escritorio');

  const estado = doc().getElementById('estado-sistema');
  const avisos = doc().getElementById('boton-avisos');
  const globo = doc().getElementById('contador-avisos');

  await esperar((d) => d.getElementById('estado-texto').textContent.length > 0, 'el estado');

  assert.equal(estado.hidden, false);
  assert.equal(avisos.hidden, false);
  assert.ok(estado.classList.contains('estado--alerta'));
  assert.equal(globo.textContent, String(panel.resumen.atrasados));
  assert.equal(avisos.getAttribute('href'), '#/prestamos?situacion=atrasado');
});

test('Sin atrasos, el encabezado no muestra aviso y lo dice en linea', async () => {
  // Se devuelven todos los prestamos: el estado debe quedar limpio.
  db.ejecutar("UPDATE prestamos SET estado = 'devuelto', fecha_devolucion = ? WHERE estado = 'activo'",
    fechas.hoy());

  dom.window.location.hash = '#/catalogo';
  await esperar((d) => d.querySelector('.buscador') !== null, 'el catalogo');
  await dom.window.App.actualizarEstado();

  const estado = doc().getElementById('estado-sistema');
  const avisos = doc().getElementById('boton-avisos');

  assert.equal(estado.hidden, false);
  assert.equal(avisos.hidden, true, 'sin atrasos no hace falta mostrar el aviso');
  assert.equal(doc().getElementById('estado-texto').textContent, 'Todo en linea');
});

test('No se produjo ningún error de JavaScript en el escritorio', () => {
  assert.deepEqual(dom.errores, []);
});
