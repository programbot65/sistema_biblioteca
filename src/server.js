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
    console.log('  Para detenerlo presione Ctrl + C');
  });

  // Si el puerto ya esta ocupado casi siempre es otra copia del servidor
  // que quedo abierta. Se avisa con un mensaje claro en vez de un error
  // técnico que asusta.
  servidor.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error('');
      console.error('  No se pudo iniciar el servidor.');
      console.error(`  El puerto ${config.puerto} ya está siendo usado por otra aplicación.`);
      console.error('');
      console.error('  Qué hacer:');
      console.error('    1. Cierra la otra ventana del sistema que sigue abierta');
      console.error('       (o ejecuta: taskkill /F /IM node.exe)');
      console.error('    2. O usa otro puerto, por ejemplo:');
      console.error(`       set PORT=3001 && npm run dev`);
      console.error('');
      process.exit(1);
    }

    console.error('  Error al iniciar el servidor:', error.message);
    process.exit(1);
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