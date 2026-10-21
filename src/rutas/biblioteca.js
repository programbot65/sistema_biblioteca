'use strict';

/**
 * Rutas de la Biblioteca digital.
 *
 * Permiten consultar los libros del catalogo con su estado de prestamo y
 * leer el PDF adjunto, todo desde la pagina web.
 */

const express = require('express');

const biblioteca = require('../servicios/biblioteca.service');
const consulta = require('../middleware/consulta');
const { ErrorValidacion, envolver } = require('../middleware/errores');

const router = express.Router();

/**
 * GET /api/biblioteca
 * Libros del catalogo con su prestamo actual y si tienen PDF disponible.
 */
router.get('/biblioteca', envolver((req, res) => {
  const { limite, offset } = consulta.paginacion(req.query, 60);
  const estado = consulta.texto(req.query.estado, 20).toLowerCase();

  const resultado = biblioteca.listar({
    q: consulta.texto(req.query.q, 120),
    categoriaId: consulta.entero(req.query.categoria),
    estado: estado || null,
    orden: consulta.texto(req.query.orden, 20) || 'titulo',
    limite,
    offset
  });

  res.json({ ...resultado, limite, offset });
}));

/**
 * GET /api/libros/:id/archivo
 * Envia el PDF del libro para poder leerlo en el lector de la pagina.
 */
router.get('/libros/:id/archivo', envolver((req, res) => {
  const resultado = biblioteca.leerArchivo(Number(req.params.id));

  if (resultado.error) {
    throw new ErrorValidacion(resultado.error, resultado.estado || 404);
  }

  const descargar = consulta.texto(req.query.descarga, 10) === '1';
  const nombre = resultado.nombre.replace(/["\r\n]/g, '');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('X-Paginas', String(resultado.paginas || 0));
  res.setHeader(
    'Content-Disposition',
    `${descargar ? 'attachment' : 'inline'}; filename="${nombre}"`
  );
  res.setHeader('Cache-Control', 'private, max-age=60');

  // En una consulta HEAD solo se piden los datos: no se envia el archivo.
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.setHeader('Content-Length', String(resultado.buffer.length));
  res.send(resultado.buffer);
}));

module.exports = router;
