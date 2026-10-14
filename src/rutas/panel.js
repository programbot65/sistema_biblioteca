'use strict';

/** Rutas de consulta general y estadisticas del panel (RF08). */

const express = require('express');
const estadisticas = require('../servicios/estadisticas.service');
const consulta = require('../middleware/consulta');
const { envolver } = require('../middleware/errores');

const router = express.Router();

/** GET /api/panel  -> toda la informacion del panel en una sola peticion */
router.get('/panel', envolver((req, res) => {
  res.json(estadisticas.panel());
}));

/** GET /api/estadisticas/resumen */
router.get('/estadisticas/resumen', envolver((req, res) => {
  res.json(estadisticas.resumen());
}));

/** GET /api/estadisticas/prestamos-por-dia?dias=14 */
router.get('/estadisticas/prestamos-por-dia', envolver((req, res) => {
  const dias = Math.min(Math.max(consulta.entero(req.query.dias, 14), 7), 90);
  res.json({ dias, serie: estadisticas.prestamosPorDia(dias) });
}));

/** GET /api/estadisticas/mas-prestados */
router.get('/estadisticas/mas-prestados', envolver((req, res) => {
  res.json({ libros: estadisticas.masPrestados(consulta.entero(req.query.limite, 8)) });
}));

/** GET /api/estadisticas/por-categoria */
router.get('/estadisticas/por-categoria', envolver((req, res) => {
  res.json({ categorias: estadisticas.porCategoria() });
}));

/** GET /api/salud  -> comprueba que el servidor y la base de datos responden */
router.get('/salud', envolver((req, res) => {
  const resumen = estadisticas.resumen();
  res.json({ estado: 'ok', base_datos: 'conectada', fecha: resumen.fecha });
}));

module.exports = router;