'use strict';

/**
 * Crea la base de datos y aplica el esquema.
 * Uso:  npm run db:migrate
 *
 * El script es idempotente: puede ejecutarse varias veces sin duplicar tablas.
 */

const db = require('../src/db');

const tablas = db.todas(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
);

console.log(`Base de datos lista en: ${db.ruta}`);
console.log(`Tablas creadas: ${tablas.map((t) => t.name).join(', ')}`);
db.cerrar();