'use strict';

/** Agrupa todas las rutas de la API en un solo enrutador. */

const express = require('express');
const catalogos = require('./catalogo');
const prestamos = require('./prestamos');
const estudiantes = require('./estudiantes');
const panel = require('./panel');
const administracion = require('./administracion');
const { noEncontrado } = require('../middleware/errores');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    sistema: 'Biblioteca UEEA',
    version: require('../../package.json').version,
    descripcion: 'API del catálogo, préstamos y devoluciones',
    endpoints: {
      catalogo: 'GET /api/catalogo?q=&categoria=&estado=&orden=',
      libro: 'GET /api/catalogo/:id',
      categorias: 'GET /api/categorias',
      recomendaciones: 'GET /api/recomendaciones?libro=&categoria=&q=',
      registrar_prestamo: 'POST /api/prestamos',
      registrar_devolucion: 'POST /api/prestamos/:id/devolucion',
      renovar_prestamo: 'POST /api/prestamos/:id/renovar',
      prestamos: 'GET /api/prestamos?situacion=&codigo=&cedula=',
      atrasados: 'GET /api/prestamos/atrasados',
      estudiantes: 'GET /api/estudiantes?q=',
      historial: 'GET /api/estudiantes/:id/historial',
      panel: 'GET /api/panel',
      salud: 'GET /api/salud'
    }
  });
});

router.use('/', panel);
router.use('/', catalogos);
router.use('/prestamos', prestamos);
router.use('/estudiantes', estudiantes);
router.use('/admin', administracion);

router.use(noEncontrado);

module.exports = router;