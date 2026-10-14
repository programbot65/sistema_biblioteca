'use strict';

/**
 * Pruebas de la API del sistema de biblioteca.
 * Plan de pruebas (seccion 18 del proyecto).
 *
 * Se ejecuta con:  npm test
 * La base de datos se crea en un archivo temporal, aislada de la real.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CARPETA_TEMPORAL = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-test-'));
process.env.DB_PATH = path.join(CARPETA_TEMPORAL, 'prueba.db');
process.env.ADMIN_KEY = 'clave-de-prueba';

const db = require('../src/db');
const { crearAplicacion } = require('../src/server');
const { CATEGORIAS, LIBROS } = require('../src/db/datos-iniciales');

const CLAVE = 'clave-de-prueba';

let servidor;
let base;

// ---------------------------------------------------------------------
// Preparacion
// ---------------------------------------------------------------------
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
      `INSERT INTO libros (codigo, titulo, autor, categoria_id, anio, cantidad)
       VALUES (?, ?, ?, ?, ?, ?)`,
      libro.codigo, libro.titulo, libro.autor,
      idCategorias.get(libro.categoria) || null,
      libro.anio, libro.cantidad
    );
  }

  servidor = crearAplicacion().listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

test.after(() => {
  servidor.close();
  db.cerrar();
  fs.rmSync(CARPETA_TEMPORAL, { recursive: true, force: true });
});

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {})
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined
  });
  const datos = await respuesta.json();
  return { estado: respuesta.status, datos };
}

const comoEncargado = { 'x-admin-clave': CLAVE };

let secuencia = 0;

/** Crea un libro nuevo y aislado, para que cada prueba no dependa de otra. */
async function crearLibro(extra = {}) {
  secuencia += 1;
  const respuesta = await pedir('/api/admin/libros', {
    method: 'POST',
    headers: comoEncargado,
    body: {
      codigo: `PRUEBA-${String(secuencia).padStart(3, '0')}`,
      titulo: extra.titulo || `Libro de prueba ${secuencia}`,
      autor: extra.autor || 'Autor de prueba',
      cantidad: extra.cantidad ?? 1,
      categoria_id: extra.categoria_id ?? null
    }
  });

  if (respuesta.estado !== 201) {
    throw new Error(`No se pudo crear el libro de prueba: ${JSON.stringify(respuesta.datos)}`);
  }
  return respuesta.datos.libro;
}

async function prestar(libro, datos = {}) {
  return pedir('/api/prestamos', {
    method: 'POST',
    body: {
      libro_id: libro.id,
      nombre: 'Estudiante de Prueba',
      cedula: '0990000001',
      curso: '4to de Bachillerato',
      dias_prestamo: 7,
      ...datos
    }
  });
}

// ---------------------------------------------------------------------
// Catalogo (RF01, RF02, RF03)
// ---------------------------------------------------------------------
test('RF01 - el catalogo muestra los libros registrados', async () => {
  const { estado, datos } = await pedir('/api/catalogo?limite=200');
  assert.equal(estado, 200);
  assert.equal(datos.libros.length, LIBROS.length);
  assert.ok(datos.libros.every((libro) => libro.codigo && libro.titulo && libro.autor));
});

test('RF02 - se puede buscar por titulo, autor, categoria y codigo', async () => {
  const porTitulo = await pedir('/api/catalogo?q=principito');
  assert.equal(porTitulo.datos.libros[0].titulo, 'El Principito');

  const porAutor = await pedir('/api/catalogo?q=García');
  assert.ok(porAutor.datos.libros.length > 0);
  assert.ok(porAutor.datos.libros.every((l) => l.autor.includes('García')));

  const porCodigo = await pedir('/api/catalogo?q=MAT-001');
  assert.equal(porCodigo.datos.libros[0].codigo, 'MAT-001');

  const { datos: categorias } = await pedir('/api/categorias');
  const matematicas = categorias.categorias.find((c) => c.nombre === 'Matemáticas');
  const porCategoria = await pedir(`/api/catalogo?categoria=${matematicas.id}`);
  assert.ok(porCategoria.datos.libros.length > 0);
  assert.ok(porCategoria.datos.libros.every((l) => l.categoria === 'Matemáticas'));
});

test('RF02 - la busqueda inteligente acepta errores de escritura y falta de tildes', async () => {
  // "cienca" esta mal escrita: aun asi debe encontrar "Ciencias Naturales".
  const conError = await pedir('/api/catalogo?q=cienca');
  assert.ok(conError.datos.libros.length > 0);
  assert.ok(conError.datos.libros.some((l) => l.categoria === 'Ciencias Naturales'));

  // Sin tildes debe encontrar el mismo resultado.
  const sinTilde = await pedir('/api/catalogo?q=geografia');
  assert.ok(sinTilde.datos.libros.some((l) => l.titulo.includes('Geografía')));

  // Palabra relacionada por sinonimo (biologicas -> Biologia).
  const sinonimo = await pedir('/api/catalogo?q=biologicas');
  assert.ok(sinonimo.datos.libros.some((l) => l.categoria === 'Ciencias Naturales'));
});

test('RF02 - un filtro con un valor no valido devuelve un mensaje claro', async () => {
  const { estado, datos } = await pedir('/api/catalogo?estado=inventado');
  assert.equal(estado, 400);
  assert.match(datos.mensaje, /no es válido/i);
});

test('RF02 - se puede filtrar el catalogo por disponibilidad', async () => {
  const { datos } = await pedir('/api/catalogo?estado=disponible&limite=50');
  assert.ok(datos.libros.length > 0);
  assert.ok(datos.libros.every((l) => l.estado === 'disponible'));
});

// ---------------------------------------------------------------------
// Disponibilidad y consulta detallada (RF03)
// ---------------------------------------------------------------------
test('RF03 - cada libro informa si esta disponible o prestado', async () => {
  const { datos } = await pedir('/api/catalogo?limite=10');
  for (const libro of datos.libros) {
    assert.ok(['disponible', 'agotado'].includes(libro.estado));
    assert.equal(libro.disponibles, libro.cantidad - libro.prestados);
  }
});

test('RF03 - la ficha del libro muestra el prestamo actual', async () => {
  const libro = await crearLibro({ cantidad: 1 });
  await prestar(libro);

  const { estado, datos } = await pedir(`/api/catalogo/${libro.id}`);
  assert.equal(estado, 200);
  assert.equal(datos.libro.estado, 'agotado');
  assert.equal(datos.libro.prestamo_actual.cedula, '0990000001');
});

test('RF03 - un libro inexistente devuelve 404', async () => {
  const { estado, datos } = await pedir('/api/catalogo/999999');
  assert.equal(estado, 404);
  assert.match(datos.mensaje, /no existe/i);
});

// ---------------------------------------------------------------------
// Gestion de libros (RF04)
// ---------------------------------------------------------------------
test('RF04 - el encargado registra un libro y aparece en el catalogo', async () => {
  const { estado, datos } = await pedir('/api/admin/libros', {
    method: 'POST',
    headers: comoEncargado,
    body: {
      codigo: 'manual-001',
      titulo: 'Manual de uso del sistema',
      autor: 'Autor de prueba',
      anio: 2020,
      cantidad: 2
    }
  });

  assert.equal(estado, 201);
  assert.equal(datos.libro.codigo, 'MANUAL-001'); // se normaliza a mayusculas

  const catalogo = await pedir('/api/catalogo?q=Manual%20de%20uso');
  assert.equal(catalogo.datos.libros.length, 1);
  assert.equal(catalogo.datos.libros[0].id, datos.libro.id);
});

test('RF04 - no se puede registrar un libro sin los datos obligatorios', async () => {
  const { estado, datos } = await pedir('/api/admin/libros', {
    method: 'POST', body: { codigo: 'X' }, headers: comoEncargado
  });

  assert.equal(estado, 422);
  const campos = datos.detalles.map((d) => d.campo);
  assert.ok(campos.includes('codigo'));
  assert.ok(campos.includes('titulo'));
  assert.ok(campos.includes('autor'));
});

test('RF04 - no se puede repetir el codigo de un ejemplar', async () => {
  const { estado, datos } = await pedir('/api/admin/libros', {
    method: 'POST',
    body: { codigo: 'LIT-002', titulo: 'Otro libro', autor: 'Otro autor' },
    headers: comoEncargado
  });
  assert.equal(estado, 409);
  assert.match(datos.mensaje, /código/i);
});

test('RF04 - sin clave valida no se puede modificar el catalogo', async () => {
  const sinClave = await pedir('/api/admin/libros', {
    method: 'POST', body: { codigo: 'XXX', titulo: 'No permitido', autor: 'Nadie' }
  });
  assert.equal(sinClave.estado, 401);

  const claveIncorrecta = await pedir('/api/admin/libros', {
    method: 'POST',
    headers: { 'x-admin-clave': 'incorrecta' },
    body: { codigo: 'XXX', titulo: 'No permitido', autor: 'Nadie' }
  });
  assert.equal(claveIncorrecta.estado, 401);
});

test('RF04 - el encargado actualiza la informacion de un libro', async () => {
  const libro = await crearLibro({ titulo: 'Titulo viejo' });

  const actualizado = await pedir(`/api/admin/libros/${libro.id}`, {
    method: 'PUT',
    body: { titulo: 'Titulo actualizado' },
    headers: comoEncargado
  });

  assert.equal(actualizado.estado, 200);
  assert.equal(actualizado.datos.libro.titulo, 'Titulo actualizado');
});

test('RF04 - un libro prestado no se puede dar de baja', async () => {
  const libro = await crearLibro();
  await prestar(libro);

  const baja = await pedir(`/api/admin/libros/${libro.id}`, {
    method: 'DELETE', headers: comoEncargado
  });
  assert.equal(baja.estado, 409);
});

// ---------------------------------------------------------------------
// Prestamos (RF05)
// ---------------------------------------------------------------------
test('RF05 - se registra un prestamo y el libro pasa a prestado', async () => {
  const libro = await crearLibro({ cantidad: 2 });
  const { estado, datos } = await prestar(libro, { cedula: '0991111111' });

  assert.equal(estado, 201);
  assert.equal(datos.prestamo.estado, 'activo');
  assert.equal(datos.prestamo.situacion, 'vigente');
  assert.ok(datos.libro.disponibles === 1);

  const despues = await pedir(`/api/catalogo/${libro.id}`);
  assert.equal(despues.datos.libro.prestados, 1);
  assert.equal(despues.datos.libro.disponibles, 1);
});

test('RF05 - la fecha limite se calcula a partir del plazo acordado', async () => {
  const libro = await crearLibro();
  const { datos } = await pedir('/api/prestamos', {
    method: 'POST',
    body: {
      libro_id: libro.id,
      nombre: 'Estudiante Plazo',
      cedula: '0992222222',
      curso: '5to de Bachillerato',
      dias_prestamo: 3
    }
  });

  const fechaPrestamo = new Date(`${datos.prestamo.fecha_prestamo}T00:00:00`);
  const fechaLimite = new Date(`${datos.prestamo.fecha_limite}T00:00:00`);
  const dias = Math.round((fechaLimite - fechaPrestamo) / 86400000);

  assert.equal(dias, 3);
});

test('RF05 - no se puede prestar un ejemplar que ya esta prestado', async () => {
  const libro = await crearLibro({ cantidad: 1 });

  const primero = await prestar(libro, { cedula: '0993333333' });
  assert.equal(primero.estado, 201);

  const segundo = await prestar(libro, { cedula: '0994444444' });
  assert.equal(segundo.estado, 409);
  assert.match(segundo.datos.mensaje, /ya está prestado/i);
});

test('RF05 - el formulario rechaza datos incompletos o invalidos', async () => {
  const { estado, datos } = await pedir('/api/prestamos', {
    method: 'POST',
    body: { libro_id: 1, nombre: 'A', cedula: 'abc', curso: '' }
  });

  assert.equal(estado, 422);
  const campos = datos.detalles.map((d) => d.campo);
  assert.ok(campos.includes('nombre'));
  assert.ok(campos.includes('cedula'));
  assert.ok(campos.includes('curso'));
});

test('RF05 - no se puede prestar mas de 3 libros al mismo estudiante', async () => {
  const cedula = '0912345678';
  const datos = { nombre: 'Estudiante Limite', cedula, curso: '6to de Bachillerato' };

  for (let i = 0; i < 3; i += 1) {
    const libro = await crearLibro();
    const respuesta = await prestar(libro, datos);
    assert.equal(respuesta.estado, 201, `el prestamo ${i + 1} debio aceptarse`);
  }

  const otro = await crearLibro();
  const rechazado = await prestar(otro, datos);
  assert.equal(rechazado.estado, 409);
  assert.match(rechazado.datos.mensaje, /máximo/i);
});

// ---------------------------------------------------------------------
// Devoluciones (RF06)
// ---------------------------------------------------------------------
test('RF06 - al registrar la devolucion el libro vuelve a estar disponible', async () => {
  const libro = await crearLibro({ cantidad: 2 });
  const { datos: creado } = await prestar(libro, { cedula: '0995555555' });
  const idPrestamo = creado.prestamo.id;

  assert.equal((await pedir(`/api/catalogo/${libro.id}`)).datos.libro.prestados, 1);

  const devolucion = await pedir(`/api/prestamos/${idPrestamo}/devolucion`, {
    method: 'POST', body: {}
  });

  assert.equal(devolucion.estado, 200);
  assert.equal(devolucion.datos.prestamo.estado, 'devuelto');
  assert.equal(devolucion.datos.prestamo.situacion, 'devuelto');
  assert.ok(devolucion.datos.libro.disponibles === 2);

  const despues = await pedir(`/api/catalogo/${libro.id}`);
  assert.equal(despues.datos.libro.prestados, 0);
  assert.equal(despues.datos.libro.disponibles, 2);
  assert.equal(despues.datos.libro.estado, 'disponible');
});

test('RF06 - no se puede devolver dos veces el mismo prestamo', async () => {
  const libro = await crearLibro();
  const { datos: creado } = await prestar(libro, { cedula: '0996666666' });

  await pedir(`/api/prestamos/${creado.prestamo.id}/devolucion`, { method: 'POST', body: {} });
  const segunda = await pedir(`/api/prestamos/${creado.prestamo.id}/devolucion`, {
    method: 'POST', body: {}
  });

  assert.equal(segunda.estado, 409);
  assert.match(segunda.datos.mensaje, /ya había sido devuelto/i);
});

test('RF06 - la devolucion no puede ser anterior al prestamo ni futura', async () => {
  const libro = await crearLibro();
  const { datos: creado } = await prestar(libro, { cedula: '0997777777' });

  const anterior = await pedir(`/api/prestamos/${creado.prestamo.id}/devolucion`, {
    method: 'POST', body: { fecha_devolucion: '2000-01-01' }
  });
  assert.equal(anterior.estado, 400);
  assert.match(anterior.datos.mensaje, /anterior/i);

  const futura = await pedir(`/api/prestamos/${creado.prestamo.id}/devolucion`, {
    method: 'POST', body: { fecha_devolucion: '2099-01-01' }
  });
  assert.equal(futura.estado, 400);
  assert.match(futura.datos.mensaje, /futura/i);
});

test('RF05 - se puede renovar el plazo de un prestamo activo una sola vez', async () => {
  const libro = await crearLibro();
  const { datos: creado } = await prestar(libro, { cedula: '0998888888' });

  const renovacion = await pedir(`/api/prestamos/${creado.prestamo.id}/renovar`, {
    method: 'POST', body: { dias: 5 }
  });

  assert.equal(renovacion.estado, 200);
  assert.ok(renovacion.datos.prestamo.fecha_limite > creado.prestamo.fecha_limite);
  assert.equal(renovacion.datos.prestamo.renovaciones, 1);

  const segunda = await pedir(`/api/prestamos/${creado.prestamo.id}/renovar`, {
    method: 'POST', body: { dias: 5 }
  });
  assert.equal(segunda.estado, 409);
});

// ---------------------------------------------------------------------
// Atrasos (RF07)
// ---------------------------------------------------------------------
test('RF07 - los prestamos atrasados se identifican por la fecha limite', async () => {
  const libro = await crearLibro({ titulo: 'Libro para atrasar' });
  const { datos: creado } = await prestar(libro, { cedula: '0922223333' });

  // Se simula el paso del tiempo adelantando la fecha limite.
  db.ejecutar(
    "UPDATE prestamos SET fecha_limite = '2000-01-01' WHERE id = ?",
    creado.prestamo.id
  );

  const atrasados = await pedir('/api/prestamos/atrasados');
  const encontrado = atrasados.datos.prestamos.find((p) => p.id === creado.prestamo.id);

  assert.ok(encontrado, 'el prestamo atrasado debe aparecer en la lista');
  assert.equal(encontrado.situacion, 'atrasado');
  assert.ok(encontrado.dias_retraso > 0);
  assert.equal(encontrado.situacion_texto, 'Atrasado');

  const filtrado = await pedir('/api/prestamos?situacion=atrasado');
  assert.ok(filtrado.datos.prestamos.every((p) => p.situacion === 'atrasado'));
});

test('RF07 - un prestamo devuelto ya no aparece como atrasado', async () => {
  const libro = await crearLibro();
  const { datos: creado } = await prestar(libro, { cedula: '0933334444' });

  db.ejecutar(
    "UPDATE prestamos SET fecha_limite = '2000-01-01' WHERE id = ?",
    creado.prestamo.id
  );
  await pedir(`/api/prestamos/${creado.prestamo.id}/devolucion`, { method: 'POST', body: {} });

  const atrasados = await pedir('/api/prestamos/atrasados');
  assert.ok(!atrasados.datos.prestamos.some((p) => p.id === creado.prestamo.id));
});

// ---------------------------------------------------------------------
// Historial (RF10)
// ---------------------------------------------------------------------
test('RF10 - el historial del estudiante muestra sus prestamos', async () => {
  const cedula = '0999990001';
  const nombre = 'Estudiante Con Historial';

  for (let i = 0; i < 2; i += 1) {
    const libro = await crearLibro();
    await prestar(libro, { nombre, cedula });
  }
  // El segundo libro se devuelve para que el historial tenga ambos estados.
  const activos = await pedir(`/api/prestamos?cedula=${cedula}&situacion=activo&limite=1`);
  await pedir(`/api/prestamos/${activos.datos.prestamos[0].id}/devolucion`, {
    method: 'POST', body: {}
  });

  const { datos: respuestaEstudiantes } = await pedir(`/api/estudiantes?cedula=${cedula}`);
  const estudiantes = respuestaEstudiantes.estudiantes;
  assert.equal(estudiantes.length, 1);

  const { estado, datos } = await pedir(`/api/estudiantes/${estudiantes[0].id}/historial`);
  assert.equal(estado, 200);
  assert.equal(datos.estudiante.nombre, nombre);
  assert.equal(datos.prestamos.length, 2);
  assert.ok(datos.prestamos.every((p) => p.codigo && p.situacion));
  assert.ok(datos.prestamos.some((p) => p.situacion === 'devuelto'));
});

test('RF10 - se puede filtrar la lista de prestamos por codigo y cedula', async () => {
  const libro = await crearLibro();
  await prestar(libro, { cedula: '0988776655' });

  const porCodigo = await pedir(`/api/prestamos?codigo=${libro.codigo}`);
  assert.equal(porCodigo.datos.prestamos.length, 1);

  const porCedula = await pedir('/api/prestamos?cedula=0988776655');
  assert.ok(porCedula.datos.prestamos.length >= 1);
});

// ---------------------------------------------------------------------
// Estadisticas (RF08)
// ---------------------------------------------------------------------
test('RF08 - el panel muestra las estadisticas basicas', async () => {
  const { estado, datos } = await pedir('/api/panel');

  assert.equal(estado, 200);
  for (const clave of ['ejemplares', 'disponibles', 'prestados', 'atrasados', 'por_vencer']) {
    assert.equal(typeof datos.resumen[clave], 'number', `falta la cifra ${clave}`);
  }

  // Invariante: lo prestado mas lo disponible no puede pasar el total.
  assert.equal(
    datos.resumen.prestados + datos.resumen.disponibles,
    datos.resumen.ejemplares
  );

  assert.ok(datos.resumen.ejemplares > LIBROS.length);
  assert.equal(datos.prestamos_por_dia.length, 14);
  assert.ok(Array.isArray(datos.ultimos_prestamos));
  assert.ok(Array.isArray(datos.por_categoria));
  assert.ok(datos.por_categoria.length > 0);
});

test('RF08 - los prestamos recientes se clasifican con una situacion conocida', async () => {
  const { datos } = await pedir('/api/panel');
  for (const prestamo of datos.ultimos_prestamos) {
    assert.ok(
      ['vigente', 'por_vencer', 'atrasado', 'devuelto'].includes(prestamo.situacion),
      `situacion desconocida: ${prestamo.situacion}`
    );
  }
});

// ---------------------------------------------------------------------
// Recomendaciones (RF09)
// ---------------------------------------------------------------------
test('RF09 - el sistema recomienda libros de la misma categoria', async () => {
  const { datos: categorias } = await pedir('/api/categorias');
  const literatura = categorias.categorias.find((c) => c.nombre === 'Literatura');

  const { estado, datos } = await pedir(
    `/api/recomendaciones?categoria=${literatura.id}&limite=4`
  );

  assert.equal(estado, 200);
  assert.ok(datos.libros.length > 0);
  assert.ok(datos.libros.every((l) => l.categoria === 'Literatura'));
  assert.ok(datos.libros.every((l) => l.motivo_recomendacion));
});

test('RF09 - las recomendaciones se pueden pedir por autor y por palabras', async () => {
  const porAutor = await pedir('/api/recomendaciones?autor=Antoine de Saint-Exupery&limite=3');
  assert.ok(porAutor.datos.libros.length > 0);

  const porPalabras = await pedir('/api/recomendaciones?titulo=programacion&limite=3');
  assert.ok(porPalabras.datos.libros.length > 0);
});

test('RF09 - la ficha del libro incluye libros relacionados', async () => {
  const { datos: catalogo } = await pedir('/api/catalogo?q=El Principito');
  const { datos } = await pedir(`/api/catalogo/${catalogo.libros[0].id}`);

  assert.ok(Array.isArray(datos.libro.relacionados));
  assert.ok(datos.libro.relacionados.length > 0);
  assert.ok(datos.libro.relacionados.every((l) => l.id !== datos.libro.id));
});

test('RF09 - la busqueda informa si fue inteligente y muestra sugerencias', async () => {
  const { datos } = await pedir('/api/catalogo?q=matematica');
  assert.equal(datos.inteligente, true);
  assert.ok(Array.isArray(datos.sugerencias));
});

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
test('Las utilidades de fecha calculan correctamente el estado', () => {
  const fechas = require('../src/utiles/fechas');
  const hoy = fechas.hoy();

  assert.equal(fechas.estadoPrestamo(fechas.sumarDias(hoy, -1), null), 'atrasado');
  assert.equal(fechas.estadoPrestamo(fechas.sumarDias(hoy, 10), null), 'vigente');
  assert.equal(fechas.estadoPrestamo(fechas.sumarDias(hoy, 1), null), 'por_vencer');
  assert.equal(fechas.estadoPrestamo(fechas.sumarDias(hoy, -5), hoy), 'devuelto');

  assert.equal(fechas.esFechaValida('2026-02-31'), false);
  assert.equal(fechas.esFechaValida('2026-13-01'), false);
  assert.equal(fechas.esFechaValida('2026-02-28'), true);
  assert.equal(fechas.formatear('2026-03-09'), '09/03/2026');
});

test('Las utilidades de texto normalizan y comparan palabras', () => {
  const texto = require('../src/utiles/texto');

  assert.equal(texto.normalizar('Química'), 'quimica');
  assert.deepEqual(texto.tokenizar('El gran Principito'), ['gran', 'principito']);
  assert.ok(texto.sonSimilares('cienca', 'ciencia'));
  assert.equal(texto.sonSimilares('cienca', 'geografia'), false);
  assert.ok(texto.expandirTerminos(['matematica']).includes('matematicas'));
});