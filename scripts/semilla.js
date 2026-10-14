'use strict';

/**
 * Carga los datos iniciales de prueba (categorias, libros y prestamos).
 * Uso:  npm run db:seed          (no carga si ya hay libros)
 *       npm run db:seed -- --forzar  (vuelve a cargar aunque exista informacion)
 */

const db = require('../src/db');
const fechas = require('../src/utiles/fechas');
const { CATEGORIAS, LIBROS, PRESTAMOS_PRUEBA } = require('../src/db/datos-iniciales');

const forzar = process.argv.includes('--forzar');

const existentes = db.obtener('SELECT COUNT(*) AS total FROM libros').total;
if (existentes > 0 && !forzar) {
  console.log(`Ya existen ${existentes} libros en el catálogo.`);
  console.log('Use "npm run db:seed -- --forzar" para cargar los datos de prueba de nuevo.');
  console.log('O bien "npm run db:reset" para empezar de cero.');
  db.cerrar();
  process.exit(0);
}

db.transaccion(() => {
  // 1. Categorias
  const idCategorias = new Map();
  for (const categoria of CATEGORIAS) {
    const existente = db.obtener('SELECT id FROM categorias WHERE nombre = ?', categoria.nombre);
    if (existente) {
      idCategorias.set(categoria.nombre, existente.id);
      continue;
    }
    const resultado = db.ejecutar(
      'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
      categoria.nombre,
      categoria.descripcion
    );
    idCategorias.set(categoria.nombre, Number(resultado.lastInsertRowid));
  }
  console.log(`Categorias: ${idCategorias.size}`);

  // 2. Libros
  const idLibros = new Map();
  for (const libro of LIBROS) {
    const resultado = db.ejecutar(
      `INSERT INTO libros (codigo, titulo, autor, categoria_id, anio, editorial, descripcion, cantidad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      libro.codigo,
      libro.titulo,
      libro.autor,
      idCategorias.get(libro.categoria) || null,
      libro.anio ?? null,
      libro.editorial ?? null,
      libro.descripcion ?? null,
      libro.cantidad ?? 1
    );
    idLibros.set(libro.codigo, Number(resultado.lastInsertRowid));
  }
  console.log(`Libros: ${idLibros.size}`);

  // 3. Prestamos de prueba
  let activos = 0;
  let devueltos = 0;

  for (const dato of PRESTAMOS_PRUEBA) {
    const libroId = idLibros.get(dato.codigo);
    if (!libroId) continue;

    let estudiante = db.obtener('SELECT * FROM estudiantes WHERE cedula = ?', dato.cedula);
    if (!estudiante) {
      const resultado = db.ejecutar(
        'INSERT INTO estudiantes (cedula, nombre, curso) VALUES (?, ?, ?)',
        dato.cedula, dato.nombre, dato.curso
      );
      estudiante = db.obtener('SELECT * FROM estudiantes WHERE id = ?', Number(resultado.lastInsertRowid));
    }

    const fechaPrestamo = fechas.sumarDias(fechas.hoy(), -dato.diasAtraso);
    const fechaLimite = fechas.sumarDias(fechaPrestamo, dato.diasPrestamo);
    const esDevuelto = typeof dato.devueltoHace === 'number';

    db.ejecutar(
      `INSERT INTO prestamos
         (libro_id, estudiante_id, fecha_prestamo, fecha_limite, fecha_devolucion, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      libroId,
      estudiante.id,
      fechaPrestamo,
      fechaLimite,
      esDevuelto ? fechas.sumarDias(fechas.hoy(), -dato.devueltoHace) : null,
      esDevuelto ? 'devuelto' : 'activo'
    );

    if (esDevuelto) devueltos += 1;
    else activos += 1;
  }

  console.log(`Prestamos: ${activos} activos y ${devueltos} devueltos`);
});

const resumen = db.obtener(`
  SELECT
    (SELECT COUNT(*) FROM libros WHERE activo = 1) AS libros,
    (SELECT COUNT(*) FROM estudiantes)          AS estudiantes,
    (SELECT COUNT(*) FROM prestamos WHERE estado = 'activo' AND fecha_limite < date('now')) AS atrasados
`);

console.log('-'.repeat(50));
console.log(`Datos cargados. Libros: ${resumen.libros} | Estudiantes: ${resumen.estudiantes} | Atrasados: ${resumen.atrasados}`);
console.log('Ejecute "npm start" para levantar el sistema.');

db.cerrar();