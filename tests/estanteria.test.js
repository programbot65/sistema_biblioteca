'use strict';

/**
 * Pruebas de la estanteria circular de libros.
 *
 * Se cubre en tres niveles:
 *   1. El calculo de posiciones del anillo (matematica pura).
 *   2. El motor de navegacion: gestos, rueda, teclado, inercia y limpieza.
 *   3. La estanteria real dentro de la aplicacion: los libros se dibujan,
 *      el nucleo refleja la seccion del frente y al elegir un libro se abre
 *      la seccion correspondiente (sin romper las rutas existentes).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const RAIZ = path.join(__dirname, '..');

// =====================================================================
// 1. Calculo de posiciones
// =====================================================================

/*
   Los entornos de prueba se cierran despues de cada caso: si quedaran
   abiertos, sus bucles de `requestAnimationFrame` impedirian que el
   proceso terminara.
*/
const entornos = [];

test.afterEach(() => {
  while (entornos.length) entornos.pop().window.close();
});

function cargarMotor() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  dom.window.eval(fs.readFileSync(path.join(RAIZ, 'public', 'js', 'navegacion.js'), 'utf8'));
  entornos.push(dom);
  return dom;
}

test('El libro del frente es el mas grande y se ve por completo', () => {
  const { window } = cargarMotor();
  const medidas = { radioX: 300, escalaBase: 0.6, escalaMax: 1 };
  const frente = window.Navegacion.calcularPosicion(0, medidas);

  assert.equal(frente.frente, 1);
  assert.ok(Math.abs(frente.x) < 1e-9);
  assert.equal(frente.escala, 1);
  assert.equal(frente.opacidad, 1);
  assert.equal(frente.difuminado, 0);
  assert.ok(Math.abs(frente.giro) < 1e-9);
  assert.equal(frente.capa, 900);
});

test('El libro de atras es invisible, para no tapar el nucleo', () => {
  const { window } = cargarMotor();
  const medidas = { radioX: 300 };
  const atras = window.Navegacion.calcularPosicion(180, medidas);

  assert.equal(atras.frente, 0);
  assert.equal(atras.opacidad, 0);
  assert.ok(atras.escala < 0.7, 'debe verse mas pequeno');
  assert.ok(atras.difuminado > 1, 'debe verse difuminado');
});

test('Los libros laterales se separan, se inclinan y pierden tamaño', () => {
  const { window } = cargarMotor();
  const medidas = { radioX: 300, inclinacion: 15 };
  const derecha = window.Navegacion.calcularPosicion(90, medidas);
  const izquierda = window.Navegacion.calcularPosicion(-90, medidas);

  assert.ok(derecha.x > 0);
  assert.ok(izquierda.x < 0);
  assert.equal(Math.round(derecha.x), Math.round(-izquierda.x));

  // Se inclinan en sentidos opuestos, como un abanico de libros.
  assert.ok(derecha.giro < 0);
  assert.ok(izquierda.giro > 0);

  // A los lados ya no estan al frente: son mas pequenos y pasan a segundo plano.
  assert.ok(derecha.escala < 1);
  assert.ok(derecha.capa < 900);
  assert.equal(derecha.frente, 0.5);
});

test('El tamaño crece de forma continua al acercarse al frente', () => {
  const { window } = cargarMotor();
  const medidas = { radioX: 300 };

  let escalaAnterior = -1;

  for (const angulo of [170, 140, 110, 80, 50, 20]) {
    const p = window.Navegacion.calcularPosicion(angulo, medidas);
    assert.ok(p.escala > escalaAnterior, `la escala debe crecer en ${angulo} grados`);
    escalaAnterior = p.escala;
  }
});

test('Los libros del frente quedan bien iluminados y los de atras se apagan', () => {
  const { window } = cargarMotor();
  const medidas = { radioX: 300 };

  // A 90 grados el libro ya se ve por completo: solo pierde tamaño y enfoque.
  assert.equal(window.Navegacion.calcularPosicion(90, medidas).opacidad, 1);

  // Mas atras, se va difuminando hasta desaparecer.
  assert.ok(window.Navegacion.calcularPosicion(140, medidas).opacidad < 0.5);
  assert.equal(window.Navegacion.calcularPosicion(180, medidas).opacidad, 0);
});

test('El desplazamiento mantiene el libro del frente por debajo del nucleo', () => {
  const { window } = cargarMotor();
  const medidas = { radioX: 300, desplazamiento: 100 };
  const frente = window.Navegacion.calcularPosicion(0, medidas);

  assert.equal(frente.y, 100);
});

test('Las utilidades del motor se comportan como se espera', () => {
  const { window } = cargarMotor();
  const { limitar, suavizar, diferenciaAngular } = window.Navegacion;

  assert.equal(limitar(5, 0, 10), 5);
  assert.equal(limitar(-5, 0, 10), 0);
  assert.equal(limitar(50, 0, 10), 10);

  assert.equal(suavizar(0, 1, -1), 0);
  assert.equal(suavizar(0, 1, 2), 1);
  assert.ok(Math.abs(suavizar(0, 1, 0.5) - 0.5) < 0.001);

  // 350 y 10 grados estan separados por 20 grados, no por 340.
  assert.equal(diferenciaAngular(350, 10), -20);
  assert.equal(diferenciaAngular(10, 350), 20);
});

// =====================================================================
// 2. Motor de navegacion
// =====================================================================
/** Crea un escenario minimo con elementos falso en el anillo. */
function crearEscenario({ total = 4, reducedMotion = false } = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  // Se declara siempre para poder simular la preferencia de menos movimiento.
  Object.defineProperty(dom.window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (consulta) => ({
      media: consulta,
      matches: reducedMotion && /prefers-reduced-motion/.test(consulta),
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {}
    })
  });

  dom.window.eval(fs.readFileSync(path.join(RAIZ, 'public', 'js', 'navegacion.js'), 'utf8'));
  entornos.push(dom);

  const { document } = dom.window;
  const contenedor = document.createElement('div');
  document.body.append(contenedor);

  const elementos = Array.from({ length: total }, () => {
    const elemento = document.createElement('button');
    elemento.setAttribute('aria-current', 'false');
    contenedor.append(elemento);
    return elemento;
  });

  const creado = { indice: -1, elegidos: [] };

  const carrusel = dom.window.Navegacion.crear({
    contenedor,
    elementos,
    alCentrar: (indice) => { creado.indice = indice; },
    alElegir: (indice, confirmado) => { if (confirmado) creado.elegidos.push(indice); }
  });

  return { dom, window: dom.window, document, contenedor, elementos, carrusel, creado };
}

/** El evento `wheel` necesita `deltaY`, que el constructor Event no admite. */
function rueda(window, contenedor, deltaY) {
  const evento = new window.Event('wheel', { bubbles: true, cancelable: true });
  Object.defineProperty(evento, 'deltaY', { value: deltaY });
  contenedor.dispatchEvent(evento);
  return evento;
}

test('El motor coloca los elementos y marca el primero como frente', () => {
  const { elementos, carrusel, creado } = crearEscenario();

  assert.equal(carrusel.obtenerEstado().total, 4);
  assert.equal(carrusel.obtenerEstado().paso, 90);
  assert.equal(carrusel.obtenerIndice(), 0);
  assert.equal(creado.indice, 0);
  assert.equal(elementos[0].getAttribute('aria-current'), 'true');
  assert.ok(elementos[0].style.transform.includes('translate3d'));
  assert.ok(elementos[0].style.zIndex !== '');

  carrusel.destruir();
});

test('El elemento de atras queda con opacidad cero', () => {
  const { elementos, carrusel } = crearEscenario({ total: 4 });

  // El segundo elemento esta a 90 grados; el tercero a 180 (detras).
  assert.ok(Number(elementos[2].style.opacity) < 0.2);

  carrusel.destruir();
});

test('La rueda del raton lleva al siguiente libro', () => {
  const { window, contenedor, carrusel } = crearEscenario({ total: 4 });
  const antes = carrusel.obtenerEstado().objetivo;

  rueda(window, contenedor, 120);

  const despues = carrusel.obtenerEstado().objetivo;
  assert.equal(despues - antes, -90, 'el anillo debe girar para traer el libro siguiente');

  carrusel.destruir();
});

test('La rueda acumula el desplazamiento y no se salta pasos', () => {
  const { window, contenedor, carrusel } = crearEscenario({ total: 4 });
  const inicial = carrusel.obtenerEstado().objetivo;

  // Tres clics de rueda pequenos: menos de un paso en total.
  for (let i = 0; i < 3; i += 1) rueda(window, contenedor, 20);
  assert.equal(carrusel.obtenerEstado().objetivo, inicial, 'no debe avanzar con una rueda parcial');

  // Un evento largo debe avanzar mas de un paso.
  rueda(window, contenedor, 300);
  assert.ok(carrusel.obtenerEstado().objetivo < inicial - 90);

  carrusel.destruir();
});

test('Las flechas del teclado mueven el carrusel', () => {
  const { window, contenedor, carrusel } = crearEscenario({ total: 4 });
  const inicial = carrusel.obtenerEstado().objetivo;

  const enviar = (tecla) => {
    const evento = new window.KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true });
    contenedor.dispatchEvent(evento);
    return evento.defaultPrevented;
  };

  assert.ok(enviar('ArrowRight'), 'la flecha derecha debe quedar manejada');
  assert.equal(carrusel.obtenerEstado().objetivo, inicial - 90);

  enviar('ArrowLeft');
  enviar('ArrowLeft');
  assert.equal(carrusel.obtenerEstado().objetivo, inicial + 90);

  carrusel.destruir();
});

test('Inicio y Fin llevan a los extremos del carrusel', () => {
  const { window, contenedor, carrusel } = crearEscenario({ total: 4 });

  contenedor.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  assert.equal(carrusel.obtenerEstado().objetivo, -270);

  contenedor.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  assert.equal(carrusel.obtenerEstado().objetivo, 0);

  carrusel.destruir();
});

test('Centrar un indice no da vueltas de mas', () => {
  const { carrusel } = crearEscenario({ total: 4 });

  carrusel.fijarIndice(1);
  assert.equal(carrusel.obtenerIndice(), 1, 'fijarIndice debe dejar ese libro al frente');

  // Volver al primero: no debe dar una vuelta completa, basta con el giro corto.
  carrusel.centrar(0, true);
  assert.equal(carrusel.obtenerEstado().objetivo, 0);
  assert.equal(carrusel.obtenerIndice(), 0);

  // Y al ultimo, por el camino mas corto.
  carrusel.centrar(3, true);
  assert.equal(carrusel.obtenerIndice(), 3);

  carrusel.destruir();
});

test('El arrastre gira el anillo y al soltar queda alineado', async () => {
  const { window, contenedor, carrusel } = crearEscenario({ total: 4 });

  contenedor.dispatchEvent(new window.MouseEvent('pointerdown', { clientX: 200, bubbles: true }));
  assert.ok(contenedor.classList.contains('esta-arrastrando'));

  window.dispatchEvent(new window.MouseEvent('pointermove', { clientX: 100, bubbles: true }));
  assert.ok(carrusel.obtenerEstado().angulo < 0, 'arrastrar a la izquierda debe girar al reves');

  window.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true }));
  assert.equal(contenedor.classList.contains('esta-arrastrando'), false);

  // Al soltar con fuerza, el anillo sigue girando por inercia...
  assert.equal(carrusel.obtenerEstado().inercia, true);

  // ...y cuando se frena queda alineado con un libro, nunca a medias.
  await esperarEstado(
    (estado) => Math.abs(estado.objetivo % 90) < 1e-9,
    'que la inercia termine en un libro alineado'
  );

  carrusel.destruir();
});

test('Un clic en un libro lo centra y despues confirma la eleccion', async () => {
  const { window, elementos, carrusel, creado } = crearEscenario({ total: 4 });

  elementos[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

  // El clic centra el libro de inmediato...
  assert.equal(carrusel.obtenerEstado().objetivo, -180);
  // ...y la eleccion se confirma poco despues.
  assert.deepEqual(creado.elegidos, []);

  await new Promise((resolver) => setTimeout(resolver, 400));
  assert.deepEqual(creado.elegidos, [2]);

  carrusel.destruir();
});

test('Con movimiento reducido la eleccion es inmediata', async () => {
  const { window, elementos, carrusel, creado } = crearEscenario({ total: 4, reducedMotion: true });

  elementos[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

  // Sin animacion, el libro queda colocado en el acto.
  assert.equal(carrusel.obtenerEstado().angulo, -90);

  await new Promise((resolver) => setTimeout(resolver, 400));
  assert.deepEqual(creado.elegidos, [1]);

  carrusel.destruir();
});

test('Al enfocar un libro con el teclado el carrusel lo centra', () => {
  const { window, elementos, carrusel } = crearEscenario({ total: 4 });

  elementos[3].dispatchEvent(new window.Event('focus'));

  assert.equal(carrusel.obtenerEstado().objetivo, -270);

  carrusel.destruir();
});

test('Destruir el motor detiene el bucle de animacion y los escuchantes', () => {
  const { window, contenedor, carrusel } = crearEscenario({ total: 4 });
  const objetivo = carrusel.obtenerEstado().objetivo;

  carrusel.destruir();

  // Tras destruir, ni la rueda ni el teclado deben modificar el estado.
  rueda(window, contenedor, 300);
  contenedor.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  window.dispatchEvent(new window.MouseEvent('pointermove', { clientX: 500, bubbles: true }));

  assert.equal(carrusel.obtenerEstado().objetivo, objetivo);
});

// =====================================================================
// 3. La estanteria dentro de la aplicacion real
// =====================================================================
const CARPETA = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-estanteria-'));
process.env.DB_PATH = path.join(CARPETA, 'estanteria.db');
process.env.ADMIN_KEY = 'clave-de-prueba';

const db = require('../src/db');
const { crearAplicacion } = require('../src/server');
const { CATEGORIAS, LIBROS } = require('../src/db/datos-iniciales');

let servidor;
let base;
let dom;

const doc = () => dom.window.document;

/** Espera a que el estado del carrusel cumpla una condicion. */
async function esperarEstado(condicion, descripcion, limite = 5000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (condicion(dom.window.Vistas.inicio.estanteria.obtenerEstado())) return;
    await new Promise((resolver) => setTimeout(resolver, 40));
  }
  throw new Error(`Tiempo agotado esperando: ${descripcion}`);
}

/**
 * Espera una condicion sobre el documento. Si se agota el tiempo, informa de
 * lo que hay en pantalla para poder entender el fallo.
 */
async function esperar(condicion, descripcion, limite = 8000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (condicion(dom.window.document)) return;
    await new Promise((resolver) => setTimeout(resolver, 50));
  }

  const pantalla = dom.window.document.body.textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
  throw new Error(
    `Tiempo agotado esperando: ${descripcion}\n` +
    `  hash: ${dom.window.location.hash}\n` +
    `  pantalla: ${pantalla}`
  );
}

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

  dom = await JSDOM.fromURL(`${base}/index.html#/inicio`, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: consola
  });

  dom.window.fetch = (entrada, opciones) => fetch(new URL(entrada, base), opciones);
  dom.errores = errores;

  await esperar((d) => d.querySelectorAll('.estanteria__anillo .libro').length > 0, 'los libros del anillo');
});

test.after(() => {
  if (dom) dom.window.close();
  servidor.close();
  db.cerrar();
  fs.rmSync(CARPETA, { recursive: true, force: true });
});

test('La portada dibuja un libro por cada sección existente', () => {
  const libros = doc().querySelectorAll('.estanteria__anillo .libro');
  assert.equal(libros.length, 4);

  const rutas = Array.from(libros).map((libro) => libro.dataset.vista);
  assert.deepEqual(rutas, ['panel', 'catalogo', 'prestamos', 'gestion']);
});

test('Cada libro tiene nombre accesible, lomo, paginas y tapa', () => {
  const libros = doc().querySelectorAll('.estanteria__anillo .libro');

  for (const libro of libros) {
    assert.match(libro.getAttribute('aria-label'), /\w/);
    assert.equal(libro.tagName, 'BUTTON');
    assert.ok(libro.querySelector('.libro__lomo'));
    assert.ok(libro.querySelector('.libro__paginas'));
    assert.ok(libro.querySelector('.libro__tapa--delante'));
    assert.ok(libro.querySelector('.libro__tapa--atras'));
    assert.ok(libro.querySelector('.libro__interior'));
    assert.ok(libro.querySelector('.libro__titulo').textContent.trim().length > 2);
  }
});

test('El motor aplica una posición 3D distinta a cada libro', () => {
  const libros = Array.from(doc().querySelectorAll('.estanteria__anillo .libro'));
  const transformaciones = libros.map((libro) => libro.style.transform);

  assert.equal(new Set(transformaciones).size, 4, 'los cuatro libros deben estar en sitios distintos');
  for (const transformacion of transformaciones) {
    assert.match(transformacion, /translate3d\(/);
    assert.match(transformacion, /scale\(/);
  }

  // Solo uno puede estar al frente.
  assert.equal(doc().querySelectorAll('.libro.es-frente').length, 1);
});

test('El núcleo central muestra la sección del libro que está al frente', async () => {
  assert.equal(doc().querySelector('.nucleo__seccion').textContent, 'Panel');
  assert.equal(doc().querySelectorAll('.nucleo__paso.activo').length, 1);

  dom.window.Navegacion; // el motor sigue montado
  dom.window.Vistas.inicio.estanteria.avanzar(1);

  await esperar((d) => d.querySelector('.nucleo__seccion').textContent === 'Catalogo',
    'que el nucleo muestre la seccion siguiente');

  assert.equal(doc().querySelectorAll('.nucleo__paso.activo').length, 1);
});

test('El botón de la derecha gira el carrusel hacia el siguiente libro', async () => {
  const antes = dom.window.Vistas.inicio.estanteria.obtenerIndice();

  const controles = doc().querySelectorAll('.estanteria__control');
  controles[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

  await esperar(
    () => dom.window.Vistas.inicio.estanteria.obtenerIndice() !== antes,
    'que el control cambie el libro del frente'
  );

  const indice = dom.window.Vistas.inicio.estanteria.obtenerIndice();
  assert.equal(doc().querySelectorAll('.estanteria__anillo .libro')[indice].dataset.vista,
    dom.window.Vistas.inicio.secciones[indice].ruta);
});

test('Al elegir el libro de Catálogo se abre la sección de catálogo', async () => {
  const libro = doc().querySelector('.estanteria__anillo .libro[data-vista="catalogo"]');
  libro.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  // Se espera al buscador, no al titulo: el titulo tambien aparece en el
  // encabezado antes de que la seccion termine de dibujarse.
  await esperar((d) => d.querySelector('.buscador') !== null, 'que se abra el catalogo');

  assert.equal(dom.window.location.hash, '#/catalogo');

  // La seccion sigue siendo la misma de siempre: con sus libros.
  await esperar((d) => d.querySelectorAll('.rejilla-libros .libro').length > 0, 'los libros del catalogo');
});

test('El botón del encabezado permite volver a la estantería', async () => {
  const volver = doc().getElementById('volver-estanteria');
  assert.equal(volver.hidden, false, 'el camino de vuelta debe verse dentro de una sección');
  assert.equal(volver.getAttribute('href'), '#/inicio');

  volver.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));

  await esperar((d) => d.querySelectorAll('.estanteria__anillo .libro').length === 4,
    'que vuelva la estanteria');

  assert.equal(doc().querySelectorAll('.estanteria__anillo .libro').length, 4);
  assert.equal(doc().getElementById('volver-estanteria').hidden, true,
    'en la estanteria no hace falta el botón de volver');
});

test('Al volver a la estantería se recuerda el último libro abierto', async () => {
  const recordado = dom.window.Vistas.inicio.indiceRecordado;
  assert.equal(dom.window.Vistas.inicio.secciones[recordado].ruta, 'catalogo');

  await esperar(
    (d) => d.querySelector('.nucleo__seccion').textContent === 'Catalogo',
    'que la estanteria se abra en el libro del catalogo'
  );
});

test('La navegación accesible sigue disponible aunque el carrusel no se use', () => {
  const enlaces = doc().querySelectorAll('.navegacion__enlace');
  const rutas = Array.from(enlaces).map((enlace) => enlace.getAttribute('href'));

  assert.deepEqual(rutas, ['#/inicio', '#/panel', '#/catalogo', '#/prestamos', '#/gestion']);
});

test('Las secciones existentes siguen funcionando tras el rediseño', async () => {
  for (const [ruta, comprobacion] of [
    ['#/panel', '.mesa .ficha'],
    ['#/prestamos', 'form'],
    ['#/gestion', '.acceso']
  ]) {
    dom.window.location.hash = ruta;
    await esperar((d) => d.querySelector(comprobacion) !== null, `la seccion ${ruta}`);
    assert.ok(doc().querySelector(comprobacion), `la seccion ${ruta} debe seguir mostrando su contenido`);
  }
});

test('Salir de la estantería detiene el motor, sin dejar el bucle corriendo', async () => {
  dom.window.location.hash = '#/inicio';
  await esperar((d) => d.querySelector('.estanteria') !== null, 'la estanteria');

  const estanteria = dom.window.Vistas.inicio.estanteria;

  dom.window.location.hash = '#/panel';
  await esperar((d) => d.querySelector('.mesa .ficha') !== null, 'el panel');

  assert.ok(estanteria, 'se conserva la referencia para poder inspeccionarla');
  // Tras navegar, el motor anterior ya no escribe sobre libros que no existen.
  await new Promise((resolver) => setTimeout(resolver, 200));
  assert.equal(doc().querySelectorAll('.estanteria__anillo .libro').length, 0);
});

test('No se produjo ningún error de JavaScript con la nueva navegación', () => {
  assert.deepEqual(dom.errores, []);
});
