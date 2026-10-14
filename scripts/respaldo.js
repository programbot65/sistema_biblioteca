'use strict';

/**
 * Genera una copia de seguridad de la base de datos.
 * Uso:  npm run db:respaldo
 *
 * Los respaldos se guardan en data/respaldo con la fecha y hora, para no
 * sobrescribir versiones anteriores.
 */

const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/db');
const config = require('../src/config');

const carpeta = path.join(config.raizProyecto, 'data', 'respaldo');
fs.mkdirSync(carpeta, { recursive: true });

// Es necesario cerrar la base antes de copiarla para que la copia sea
// consistente (se evita copiar con informacion a medio escribir).
db.cerrar();

const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const destino = path.join(carpeta, `biblioteca-${marca}.db`);

fs.copyFileSync(config.rutas.db, destino);
const tamanoKb = (fs.statSync(destino).size / 1024).toFixed(1);

console.log(`Respaldo creado: ${destino} (${tamanoKb} KB)`);