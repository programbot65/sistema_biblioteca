'use strict';

/**
 * Crea la base de datos y aplica el esquema.
 * Uso:  npm run db:migrate
 *
 * El script es idempotente: puede ejecutarse varias veces sin duplicar tablas.
 * Ademas, anade las columnas nuevas que se hayan incorporado despues, para
 * que una base de datos ya existente no se quede atras.
 */

const db = require('../src/db');

/**
 * Anade una columna a una tabla si todavia no existe.
 * SQLite no admite "ADD COLUMN IF NOT EXISTS", asi que se comprueba antes.
 */
function anadirColumna(tabla, columna, definicion) {
  const existentes = db.todas(`PRAGMA table_info(${tabla})`);
  if (!existentes.length) return false;
  if (existentes.some((campo) => campo.name === columna)) return false;

  db.ejecutar(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  return true;
}

const tablas = db.todas(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
);

console.log(`Base de datos lista en: ${db.ruta}`);
console.log(`Tablas creadas: ${tablas.map((t) => t.name).join(', ')}`);

// Biblioteca digital: el PDF que se puede leer desde la pagina.
if (anadirColumna('libros', 'archivo_pdf', 'TEXT')) {
  console.log('Columna anadida: libros.archivo_pdf');
}

db.cerrar();
