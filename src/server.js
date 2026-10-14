'use strict';

/**
 * Servidor de la biblioteca UEEA.
 *
 * Arquitectura de tres partes (ver seccion 11 del plan):
 *   - Frontend: archivos estaticos en /public
 *   - Backend:  este servidor Express con la API en /api
 *   - Datos:    base de datos SQLite en /data
 */

const path = require('node:path');
const express = require('express');

const config = require('./config');
const db = require('./db');
const rutas = require('./rutas');
const { manejadorErrores } = require('./middleware/errores');
const { claveAdmin } = require('./middleware/autenticacion');

function crearAplicacion() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // Cabeceras basicas de seguridad. No se usan librerias externas para
  // mantener el proyecto dentro de herramientas gratuitas y simples.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.use('/api', rutas);

  // Frontend: archivos estaticos de /public
  app.use(express.static(config.rutas.publica, {
    maxAge: process.env.NODE_ENV === 'produccion' ? '1h' : 0,
    etag: true
  }));

  // Cualquier otra direccion devuelve la pagina principal (aplicacion de una
  // sola vista con navegacion interna).
  app.get('*', (req, res) => {
    res.sendFile(path.join(config.rutas.publica, 'index.html'));
  });

  app.use(manejadorErrores);

  return app;
}

function iniciar() {
  const app = crearAplicacion();

  const servidor = app.listen(config.puerto, () => {
    const total = db.obtener('SELECT COUNT(*) AS total FROM libros WHERE activo = 1');
    console.log('='.repeat(58));
    console.log('  Biblioteca UEEA - sistema de gestión bibliográfica');
    console.log('='.repeat(58));
    console.log(`  Servidor:    http://localhost:${config.puerto}`);
    console.log(`  Base datos:  ${db.ruta}`);
    console.log(`  Catálogo:    ${total ? total.total : 0} libros activos`);
    console.log(`  Préstamo:    ${config.diasPrestamo} días por defecto`);
    console.log(`  Clave admin: ${process.env.ADMIN_KEY ? '(definida por variable de entorno)' : '(valor por defecto del proyecto)'}`);
    console.log('='.repeat(58));
  });

  const cerrar = (senal) => {
    console.log(`\n${senal} recibido, cerrando el servidor...`);
    servidor.close(() => {
      db.cerrar();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => cerrar('SIGINT'));
  process.on('SIGTERM', () => cerrar('SIGTERM'));

  return servidor;
}

if (require.main === module) {
  iniciar();
}

module.exports = { crearAplicacion, iniciar };