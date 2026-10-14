'use strict';

/** Consulta de estudiantes y su historial de prestamos (RF10). */

const express = require('express');
const prestamos = require('../servicios/prestamos.service');
const consulta = require('../middleware/consulta');
const { ErrorValidacion, envolver } = require('../middleware/errores');

const router = express.Router();

/** GET /api/estudiantes?q=&cedula= */
router.get('/', envolver((req, res) => {
  const { limite, offset } = consulta.paginacion(req.query, 100);
  const estudiantes = prestamos.buscarEstudiantes({
    nombre: consulta.texto(req.query.q, 80) || null,
    cedula: consulta.texto(req.query.cedula, 20) || null,
    limite,
    offset
  });
  res.json({ estudiantes, limite, offset });
}));

/** GET /api/estudiantes/cursos  (lista usada por los formularios) */
router.get('/cursos', envolver((req, res) => {
  res.json({ cursos: prestamos.CURSOS_VALIDOS });
}));

/** GET /api/estudiantes/:id/historial */
router.get('/:id/historial', envolver((req, res) => {
  const historial = prestamos.historialEstudiante(req.params.id);
  if (!historial) throw new ErrorValidacion('El estudiante no existe.', 404);
  res.json(historial);
}));

module.exports = router;