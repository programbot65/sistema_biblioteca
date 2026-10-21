'use strict';

const crypto = require('node:crypto');
const config = require('../config');

/**
 * Proteccion sencilla del panel administrativo.
 *
 * El plan del proyecto indica evitar servicios de autenticacion externos y
 * mantener el acceso dentro de la institucion. Por eso se usa una clave
 * compartida que el encargado ingresa en la pantalla de gestion.
 *
 * Solo protege las operaciones que modifican informacion; consultar el
 * catalogo es publico, tal como pide el alcance del proyecto.
 */
function claveAdmin() {
  return process.env.ADMIN_KEY || config.admin.clavePorDefecto;
}

function comparar(textoIngresado, textoEsperado) {
  const a = Buffer.from(String(textoIngresado || ''));
  const b = Buffer.from(String(textoEsperado || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function requiereClaveAdmin(req, res, next) {
  const enviada = req.get('x-admin-clave') || req.query.clave || '';
  if (!comparar(enviada, claveAdmin())) {
    return res.status(401).json({
      error: 'No autorizado',
      mensaje: 'La clave del encargado no es correcta o no fue enviada.'
    });
  }
  return next();
}

module.exports = { requiereClaveAdmin, claveAdmin };
