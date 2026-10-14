'use strict';

const path = require('node:path');

const raizProyecto = path.resolve(__dirname, '..');

module.exports = {
  raizProyecto,
  puerto: Number(process.env.PORT) || 3000,

  // Reglas institucionales de préstamo (se confirman con el encargado de biblioteca)
  diasPrestamo: 7,
  maximoPrestamosActivosPorEstudiante: 3,
  maximoRenovaciones: 1,

  rutas: {
    db: process.env.DB_PATH || path.join(raizProyecto, 'data', 'biblioteca.db'),
    publica: path.join(raizProyecto, 'public')
  },

  // Clave sencilla para el panel del encargado. Se puede definir por variable
  // de entorno; si no existe se usa el valor por defecto del proyecto.
  admin: {
    clavePorDefecto: 'ueea2026'
  }
};