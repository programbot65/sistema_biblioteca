'use strict';

/**
 * Consultas sobre la tabla `libros`.
 *
 * Cada registro corresponde a un ejemplar fisico identified por su codigo.
 * La disponibilidad se calcula a partir de los prestamos activos, de modo
 * que nunca hay que actualizarla manualmente.
 */

const db = require('../db');

const SELECCION_BASE = `
  SELECT
    l.id,
    l.codigo,
    l.titulo,
    l.autor,
    l.categoria_id,
    c.nombre        AS categoria,
    l.anio,
    l.editorial,
    l.descripcion,
    l.portada,
    l.archivo_pdf,
    l.cantidad,
    l.activo,
    l.creado_en,
    (SELECT COUNT(*) FROM prestamos p
      WHERE p.libro_id = l.id AND p.estado = 'activo')          AS prestados,
    l.cantidad
      - (SELECT COUNT(*) FROM prestamos p
          WHERE p.libro_id = l.id AND p.estado = 'activo')      AS disponibles
  FROM libros l
  LEFT JOIN categorias c ON c.id = l.categoria_id
`;

const ORDENES = {
  titulo: 'l.titulo COLLATE NOCASE ASC',
  autor: 'l.autor COLLATE NOCASE ASC',
  categoria: 'c.nombre COLLATE NOCASE ASC, l.titulo COLLATE NOCASE ASC',
  anio: 'l.anio DESC, l.titulo COLLATE NOCASE ASC',
  recientes: 'l.creado_en DESC'
};

const CAMPOS_ESCRITURA = [
  'codigo',
  'titulo',
  'autor',
  'categoria_id',
  'anio',
  'editorial',
  'descripcion',
  'portada',
  'cantidad',
  'activo'
];

/** Listado con filtros basicos (RF01, RF02). */
function listar(filtros = {}) {
  const {
    categoriaId = null,
    soloDisponibles = false,
    soloActivos = true,
    orden = 'titulo',
    limite = 50,
    offset = 0
  } = filtros;

  const condiciones = [];
  const parametros = [];

  if (soloActivos) {
    condiciones.push('l.activo = 1');
  }
  if (categoriaId) {
    condiciones.push('l.categoria_id = ?');
    parametros.push(categoriaId);
  }
  if (soloDisponibles) {
    condiciones.push(`l.cantidad > (SELECT COUNT(*) FROM prestamos p
                        WHERE p.libro_id = l.id AND p.estado = 'activo')`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const ordenSql = ORDENES[orden] || ORDENES.titulo;

  const sql = `
    ${SELECCION_BASE}
    ${where}
    ORDER BY ${ordenSql}
    LIMIT ? OFFSET ?
  `;

  return db.todas(sql, ...parametros, limite, offset);
}

/** Lista simple de categorias con la cantidad de libros de cada una. */
function listarCategorias() {
  return db.todas(`
    SELECT
      c.id,
      c.nombre,
      c.descripcion,
      (SELECT COUNT(*) FROM libros l WHERE l.categoria_id = c.id AND l.activo = 1) AS total_libros
    FROM categorias c
    ORDER BY c.nombre COLLATE NOCASE ASC
  `);
}

/** Trae todos los libros que coincidan con un texto, para el buscador inteligente. */
function todosParaBuscar() {
  return db.todas(`${SELECCION_BASE} WHERE l.activo = 1`);
}

function obtenerPorId(id) {
  return db.obtener(`${SELECCION_BASE} WHERE l.id = ?`, id);
}

function obtenerPorCodigo(codigo) {
  return db.obtener(`${SELECCION_BASE} WHERE l.codigo = ?`, codigo);
}

/** Devuelve los libros que estan prestados actualmente a un estudiante. */
function prestadosPorEstudiante(estudianteId) {
  return db.todas(
    `${SELECCION_BASE}
     WHERE l.id IN (
       SELECT libro_id FROM prestamos WHERE estudiante_id = ? AND estado = 'activo'
     )
     ORDER BY l.titulo COLLATE NOCASE ASC`,
    estudianteId
  );
}

function crear(datos) {
  const registro = normalizarDatos(datos);
  const columnas = [];
  const valores = [];
  const marcadores = [];

  for (const campo of CAMPOS_ESCRITURA) {
    if (registro[campo] !== undefined) {
      columnas.push(campo);
      valores.push(registro[campo]);
      marcadores.push('?');
    }
  }

  const resultado = db.ejecutar(
    `INSERT INTO libros (${columnas.join(', ')}) VALUES (${marcadores.join(', ')})`,
    ...valores
  );

  return obtenerPorId(Number(resultado.lastInsertRowid));
}

function actualizar(id, datos) {
  const registro = normalizarDatos(datos);
  const asignaciones = [];
  const valores = [];

  for (const campo of CAMPOS_ESCRITURA) {
    if (registro[campo] !== undefined) {
      asignaciones.push(`${campo} = ?`);
      valores.push(registro[campo]);
    }
  }

  if (!asignaciones.length) return obtenerPorId(id);

  valores.push(id);
  db.ejecutar(`UPDATE libros SET ${asignaciones.join(', ')} WHERE id = ?`, ...valores);
  return obtenerPorId(id);
}

/** Baja logica: el libro no se borra para no perder el historial de prestamos. */
function desactivar(id) {
  return db.ejecutar('UPDATE libros SET activo = 0 WHERE id = ?', id);
}

function reactivar(id) {
  return db.ejecutar('UPDATE libros SET activo = 1 WHERE id = ?', id);
}

/** Guarda (o quita) la ruta del PDF que se puede leer desde la pagina. */
function guardarArchivo(id, ruta) {
  db.ejecutar('UPDATE libros SET archivo_pdf = ? WHERE id = ?', ruta || null, id);
  return obtenerPorId(id);
}

function existeCodigo(codigo, exceptoId = null) {
  const fila = db.obtener(
    'SELECT id FROM libros WHERE codigo = ? AND (? IS NULL OR id <> ?)',
    codigo, exceptoId, exceptoId
  );
  return Boolean(fila);
}

/** Convierte a los tipos que espera SQLite y aplica valores por defecto. */
function normalizarDatos(datos) {
  const registro = { ...datos };

  if (registro.codigo !== undefined) {
    registro.codigo = String(registro.codigo).trim().toUpperCase();
  }
  if (registro.titulo !== undefined) {
    registro.titulo = String(registro.titulo).trim();
  }
  if (registro.autor !== undefined) {
    registro.autor = String(registro.autor).trim();
  }
  if (registro.cantidad !== undefined && registro.cantidad !== null) {
    registro.cantidad = Math.max(1, Number(registro.cantidad) || 1);
  }
  if (registro.anio !== undefined) {
    registro.anio = registro.anio === null || registro.anio === ''
      ? null
      : Number(registro.anio);
  }
  if (registro.categoria_id !== undefined && registro.categoria_id !== '') {
    registro.categoria_id = registro.categoria_id === null ? null : Number(registro.categoria_id);
  }
  if (registro.activo !== undefined) {
    registro.activo = registro.activo ? 1 : 0;
  }

  return registro;
}

module.exports = {
  listar,
  listarCategorias,
  todosParaBuscar,
  obtenerPorId,
  obtenerPorCodigo,
  prestadosPorEstudiante,
  crear,
  actualizar,
  desactivar,
  reactivar,
  guardarArchivo,
  existeCodigo
};