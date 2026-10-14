'use strict';

/**
 * Borra la base de datos y la vuelve a crear con los datos de prueba.
 * Uso:  npm run db:reset
 *
 * IMPORTANTE: elimina toda la informacion registrada.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const config = require('../src/config');

const ruta = config.rutas.db;

if (!fs.existsSync(ruta)) {
  console.log('No existe una base de datos previa: se creara una nueva.');
} else {
  for (const archivo of [ruta, `${ruta}-wal`, `${ruta}-shm`, `${ruta}-journal`]) {
    if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
  }
  console.log(`Base de datos anterior eliminada: ${ruta}`);
}

const ejecutar = (script) => execFileSync(process.execPath, [path.join(__dirname, script)], {
  stdio: 'inherit'
});

ejecutar('migrar.js');
console.log('');
ejecutar('semilla.js');