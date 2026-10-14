'use strict';

/**
 * Consultas sobre `estudiantes`.
 * Se guardan unicamente los datos minimos: nombre, cedula y curso.
 */

const db = require('../db');

function obtenerPorCedula(cedula) {
  return db.obtener('SELECT * FROM estudiantes WHERE cedula = ?', cedula);
}

function obtenerPorId(id) {
  return db.obtener('SELECT * FROM estudiantes WHERE id = ?', id);
}

function buscar({ cedula = null, nombre = null, limite = 50, offset = 0 } = {}) {
  const condiciones = [];
  const parametros = [];

  if (cedula) {
    condiciones.push('cedula LIKE ?');
    parametros.push(`%${cedula}%`);
  }
  if (nombre) {
    condiciones.push('nombre LIKE ?');
    parametros.push(`%${nombre}%`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return db.todas(
    `SELECT * FROM estudiantes ${where} ORDER BY nombre COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
    ...parametros,
    limite,
    offset
  );
}

/**
 * Busca un estudiante por cedula o lo crea. Permite reutilizar el registro
 * si el mismo estudiante vuelve a pedir un prestamo.
 */
function obtenerOCrear({ cedula, nombre, curso }) {
  const existente = obtenerPorCedula(cedula);
  if (existente) {
    // Se actualizan los datos por si el estudiante cambio de curso o corrigio su nombre.
    db.ejecutar(
      'UPDATE estudiantes SET nombre = ?, curso = ? WHERE id = ?',
      String(nombre).trim(), String(curso).trim(), existente.id
    );
    return obtenerPorId(existente.id);
  }

  const resultado = db.ejecutar(
    'INSERT INTO estudiantes (cedula, nombre, curso) VALUES (?, ?, ?)',
    cedula, String(nombre).trim(), String(curso).trim()
  );
  return obtenerPorId(Number(resultado.lastInsertRowid));
}

/** Datos del estudiante junto con sus prestamos activos y su historial. */
function historial(id) {
  const estudiante = obtenerPorId(id);
  if (!estudiante) return null;

  const prestamos = db.todas(
    `SELECT
       p.id, p.fecha_prestamo, p.fecha_limite, p.fecha_devolucion,
       p.estado, p.renovaciones, p.observaciones,
       l.id AS libro_id, l.codigo, l.titulo, l.autor, l.portada,
       c.nombre AS categoria
     FROM prestamos p
     JOIN libros l ON l.id = p.libro_id
     LEFT JOIN categorias c ON c.id = l.categoria_id
     WHERE p.estudiante_id = ?
     ORDER BY p.fecha_prestamo DESC, p.id DESC`,
    id
  );

  return { estudiante, prestamos };
}

/** Estudiante que mas libros ha tomado (util para el panel). */
function masActivos(limite = 5) {
  return db.todas(
    `SELECT e.id, e.cedula, e.nombre, e.curso,
            COUNT(p.id) AS prestamos_activos
     FROM estudiantes e
     JOIN prestamos p ON p.estudiante_id = e.id AND p.estado = 'activo'
     GROUP BY e.id
     ORDER BY prestamos_activos DESC, e.nombre COLLATE NOCASE ASC
     LIMIT ?`,
    limite
  );
}

module.exports = {
  obtenerPorCedula,
  obtenerPorId,
  buscar,
  obtenerOCrear,
  historial,
  masActivos
};