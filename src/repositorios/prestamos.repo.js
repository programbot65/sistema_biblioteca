'use strict';

/**
 * Consultas y operaciones sobre `prestamos`.
 *
 * Un prestamo activo tiene `estado = 'activo'`. La condicion de atraso no se
 * guarda: se deduce comparando `fecha_limite` con la fecha actual, de modo
 * que el sistema nunca muestra informacion desactualizada.
 */

const db = require('../db');
const fechas = require('../utiles/fechas');

const SELECCION_BASE = `
  SELECT
    p.id,
    p.libro_id,
    p.estudiante_id,
    p.fecha_prestamo,
    p.fecha_limite,
    p.fecha_devolucion,
    p.estado,
    p.renovaciones,
    p.observaciones,
    l.codigo,
    l.titulo,
    l.autor,
    l.portada,
    c.nombre AS categoria,
    e.cedula,
    e.nombre  AS estudiante_nombre,
    e.curso   AS estudiante_curso
  FROM prestamos p
  JOIN libros l       ON l.id = p.libro_id
  JOIN estudiantes e  ON e.id = p.estudiante_id
  LEFT JOIN categorias c ON c.id = l.categoria_id
`;

function obtenerPorId(id) {
  return db.obtener(`${SELECCION_BASE} WHERE p.id = ?`, id);
}

/** Prestamo activo de un ejemplar, si existe. */
function activoDelLibro(libroId) {
  return db.obtener(`${SELECCION_BASE} WHERE p.libro_id = ? AND p.estado = 'activo'`, libroId);
}

function contarActivosDelEstudiante(estudianteId) {
  const fila = db.obtener(
    "SELECT COUNT(*) AS total FROM prestamos WHERE estudiante_id = ? AND estado = 'activo'",
    estudianteId
  );
  return fila ? fila.total : 0;
}

/** Listado con filtros usados en el panel y en el historial (RF10). */
function listar(filtros = {}) {
  const {
    situacion = null,          // 'activo' | 'devuelto' | 'atrasado' | 'vigente' | 'por_vencer'
    estudianteId = null,
    libroId = null,
    codigo = null,
    cedula = null,
    categoriaId = null,
    desde = null,
    hasta = null,
    limite = 50,
    offset = 0,
    orden = 'recientes'
  } = filtros;

  const condiciones = [];
  const parametros = [];
  const hoy = fechas.hoy();

  if (situacion === 'activo') {
    condiciones.push("p.estado = 'activo'");
  } else if (situacion === 'devuelto') {
    condiciones.push("p.estado = 'devuelto'");
  } else if (situacion === 'atrasado') {
    condiciones.push("p.estado = 'activo' AND p.fecha_limite < ?");
    parametros.push(hoy);
  } else if (situacion === 'por_vencer') {
    condiciones.push("p.estado = 'activo' AND p.fecha_limite >= ? AND p.fecha_limite <= ?");
    parametros.push(hoy, fechas.sumarDias(hoy, 1));
  } else if (situacion === 'vigente') {
    condiciones.push("p.estado = 'activo' AND p.fecha_limite > ?");
    parametros.push(fechas.sumarDias(hoy, 1));
  }

  if (estudianteId) {
    condiciones.push('p.estudiante_id = ?');
    parametros.push(estudianteId);
  }
  if (libroId) {
    condiciones.push('p.libro_id = ?');
    parametros.push(libroId);
  }
  if (codigo) {
    condiciones.push('l.codigo = ?');
    parametros.push(String(codigo).trim().toUpperCase());
  }
  if (cedula) {
    condiciones.push('e.cedula LIKE ?');
    parametros.push(`%${cedula}%`);
  }
  if (categoriaId) {
    condiciones.push('l.categoria_id = ?');
    parametros.push(categoriaId);
  }
  if (desde) {
    condiciones.push('p.fecha_prestamo >= ?');
    parametros.push(desde);
  }
  if (hasta) {
    condiciones.push('p.fecha_prestamo <= ?');
    parametros.push(hasta);
  }

  const ordenes = {
    recientes: 'p.fecha_prestamo DESC, p.id DESC',
    limite: 'p.fecha_limite ASC, p.id ASC',
    titulo: 'l.titulo COLLATE NOCASE ASC',
    estudiante: 'e.nombre COLLATE NOCASE ASC, p.fecha_prestamo DESC'
  };
  const ordenSql = ordenes[orden] || ordenes.recientes;
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  return db.todas(
    `${SELECCION_BASE} ${where} ORDER BY ${ordenSql} LIMIT ? OFFSET ?`,
    ...parametros,
    limite,
    offset
  );
}

function contar(filtros = {}) {
  return listar({ ...filtros, limite: -1, offset: 0 }).length;
}

/**
 * Registra un prestamo dentro de una transaccion para evitar que dos
 * estudiantes obtengan el mismo ejemplar al mismo tiempo.
 */
function registrar({ libroId, estudianteId, fechaPrestamo, diasPrestamo, observaciones }) {
  return db.transaccion(() => {
    const resultado = db.ejecutar(
      `INSERT INTO prestamos
         (libro_id, estudiante_id, fecha_prestamo, fecha_limite, estado, observaciones)
       VALUES (?, ?, ?, ?, 'activo', ?)`,
      libroId,
      estudianteId,
      fechaPrestamo,
      fechas.sumarDias(fechaPrestamo, diasPrestamo),
      observaciones || null
    );
    return obtenerPorId(Number(resultado.lastInsertRowid));
  });
}

/** Registra la devolucion y deja el ejemplar disponible nuevamente (RF06). */
function registrarDevolucion(prestamoId, fechaDevolucion) {
  return db.transaccion(() => {
    db.ejecutar(
      "UPDATE prestamos SET fecha_devolucion = ?, estado = 'devuelto' WHERE id = ? AND estado = 'activo'",
      fechaDevolucion,
      prestamoId
    );
    return obtenerPorId(prestamoId);
  });
}

/** Extiende el plazo del prestamo (RF05, opcion del encargado). */
function renovar(prestamoId, diasExtra, nuevaFechaLimite) {
  return db.transaccion(() => {
    db.ejecutar(
      'UPDATE prestamos SET fecha_limite = ?, renovaciones = renovaciones + 1 WHERE id = ?',
      nuevaFechaLimite,
      prestamoId
    );
    return obtenerPorId(prestamoId);
  });
}

/** Prestamos activos cuya fecha limite ya paso (RF07). */
function atrasados(limite = 100) {
  return listar({ situacion: 'atrasado', limite, orden: 'limite' });
}

function ultimos(limite = 8) {
  return listar({ limite, orden: 'recientes' });
}

module.exports = {
  obtenerPorId,
  activoDelLibro,
  contarActivosDelEstudiante,
  listar,
  contar,
  registrar,
  registrarDevolucion,
  renovar,
  atrasados,
  ultimos
};