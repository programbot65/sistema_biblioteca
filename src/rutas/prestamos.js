'use strict';

/** Rutas de prestamos, devoluciones e historial (RF05, RF06, RF07, RF10). */

const express = require('express');
const prestamos = require('../servicios/prestamos.service');
const consulta = require('../middleware/consulta');
const { ErrorValidacion, envolver } = require('../middleware/errores');

const router = express.Router();

const SITUACIONES = ['activo', 'devuelto', 'atrasado', 'vigente', 'por_vencer'];

/** GET /api/prestamos */
router.get('/', envolver((req, res) => {
  const { limite, offset } = consulta.paginacion(req.query, 300);
  const situacion = consulta.texto(req.query.situacion, 20).toLowerCase();

  if (situacion && !SITUACIONES.includes(situacion)) {
    throw new ErrorValidacion(
      `La situación "${situacion}" no es válida. Use: ${SITUACIONES.join(', ')}.`
    );
  }

  const resultado = prestamos.listar({
    situacion: situacion || null,
    estudianteId: consulta.entero(req.query.estudiante),
    libroId: consulta.entero(req.query.libro),
    codigo: consulta.texto(req.query.codigo, 30),
    cedula: consulta.texto(req.query.cedula, 20),
    categoriaId: consulta.entero(req.query.categoria),
    desde: consulta.texto(req.query.desde, 10) || null,
    hasta: consulta.texto(req.query.hasta, 10) || null,
    orden: consulta.texto(req.query.orden, 20) || 'recientes',
    limite,
    offset
  });

  res.json({ ...resultado, limite, offset });
}));

/** GET /api/prestamos/atrasados  (lista de prestamos pendientes de devolucion) */
router.get('/atrasados', envolver((req, res) => {
  res.json(prestamos.listar({ situacion: 'atrasado', orden: 'limite', limite: 300 }));
}));

/**
 * POST /api/prestamos
 * Registra un préstamo con los datos básicos del estudiante (RF05).
 */
router.post('/', envolver((req, res) => {
  const cuerpo = req.body || {};
  const resultado = prestamos.registrar(cuerpo);
  res.status(201).json(resultado);
}));

/** GET /api/prestamos/:id */
router.get('/:id', envolver((req, res) => {
  const prestamo = prestamos.detalle(req.params.id);
  if (!prestamo) throw new ErrorValidacion('El préstamo no existe.', 404);
  res.json({ prestamo });
}));

/** POST /api/prestamos/:id/devolucion  (RF06) */
router.post('/:id/devolucion', envolver((req, res) => {
  const resultado = prestamos.devolver(req.params.id, (req.body || {}).fecha_devolucion);
  res.json(resultado);
}));

/** POST /api/prestamos/:id/renovar */
router.post('/:id/renovar', envolver((req, res) => {
  const resultado = prestamos.renovar(req.params.id, (req.body || {}).dias);
  res.json(resultado);
}));

module.exports = router;