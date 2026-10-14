'use strict';

/** Rutas publicas del catalogo: no requieren ningun tipo de acceso. */

const express = require('express');
const catalogo = require('../servicios/catalogo.service');
const consulta = require('../middleware/consulta');
const { ErrorValidacion, envolver } = require('../middleware/errores');

const router = express.Router();

/** GET /api/categorias */
router.get('/categorias', envolver((req, res) => {
  res.json({ categorias: catalogo.categorias() });
}));

/** GET /api/catalogo */
router.get('/catalogo', envolver((req, res) => {
  const { limite, offset } = consulta.paginacion(req.query);
  const estado = consulta.texto(req.query.estado, 20).toLowerCase();

  if (estado && !catalogo.ESTADOS.includes(estado)) {
    throw new ErrorValidacion(
      `El estado "${estado}" no es válido. Use: ${catalogo.ESTADOS.join(', ')}.`
    );
  }

  const resultado = catalogo.listar({
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
 * GET /api/catalogo/:id
 * Ficha del libro con disponibilidad, prestamo actual y libros similares (RF03).
 */
router.get('/catalogo/:id', envolver((req, res) => {
  const libro = catalogo.detalle(Number(req.params.id));

  if (!libro) {
    throw new ErrorValidacion('El libro solicitado no existe.', 404);
  }

  res.json({ libro });
}));

/**
 * GET /api/recomendaciones
 * Sugiere libros por categoria, autor o palabras de la busqueda (RF09).
 */
router.get('/recomendaciones', envolver((req, res) => {
  const q = consulta.texto(req.query.q, 120);
  const resultado = catalogo.recomendar({
    libroId: consulta.entero(req.query.libro),
    categoriaId: consulta.entero(req.query.categoria),
    autor: consulta.texto(req.query.autor, 120) || null,
    titulo: consulta.texto(req.query.titulo, 120) || null,
    limite: consulta.entero(req.query.limite, 6)
  });

  res.json({ ...resultado, consulta: q });
}));

module.exports = router;