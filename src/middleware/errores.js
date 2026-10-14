'use strict';

/** Error de negocio: mensaje claro para el usuario y codigo HTTP. */
class ErrorValidacion extends Error {
  constructor(mensaje, estadoHttp = 400, detalles = null) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

/** Ruta no encontrada dentro de la API. */
function noEncontrado(req, res) {
  res.status(404).json({
    error: 'Recurso no encontrado',
    mensaje: `No existe el recurso ${req.method} ${req.originalUrl}`
  });
}

/**
 * Manejador central de errores. Evita que se expongan detalles internos
 * (consultas SQL, rutas del servidor) al usuario.
 */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(error, req, res, next) {
  const esValidacion = error instanceof ErrorValidacion ||
    error.name === 'ErrorNegocio';

  const estado = esValidacion ? error.estadoHttp : 500;

  if (!esValidacion) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, error);
  }

  res.status(estado).json({
    error: esValidacion ? error.name : 'Error interno del servidor',
    mensaje: esValidacion ? error.message : 'Ocurrió un error inesperado. Intente nuevamente.',
    detalles: esValidacion ? error.detalles : undefined
  });
}

/** Envoltura para que los errores de funciones `async` lleguen al manejador. */
function envolver(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { ErrorValidacion, noEncontrado, manejadorErrores, envolver };