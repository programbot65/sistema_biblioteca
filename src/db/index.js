'use strict';

/**
 * Capa de acceso a datos.
 *
 * Usa el modulo nativo `node:sqlite` incluido en Node.js 22.5+.
 * Ventajas para este proyecto: no requiere compilar modulos nativos,
 * no necesita instalar un servidor de base de datos y no tiene costo.
 *
 * La API imitada es la de `better-sqlite3`, de modo que cambiar de
 * motor en el futuro solo requiere modificar este archivo.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

/** Convierte valores de JavaScript a tipos que SQLite puede almacenar. */
function sanearValor(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  if (valor instanceof Date) return valor.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof valor === 'object') return JSON.stringify(valor);
  return valor;
}

function sanearParametros(parametros) {
  if (parametros === undefined || parametros === null) return [];
  return (Array.isArray(parametros) ? parametros : [parametros]).map(sanearValor);
}

/** Los objetos que devuelve node:sqlite no tienen prototipo; los copiamos a objetos normales. */
function aObjetoNormal(fila) {
  return fila === undefined || fila === null ? undefined : Object.assign({}, fila);
}

function crearConexion(rutaArchivo) {
  fs.mkdirSync(path.dirname(rutaArchivo), { recursive: true });

  const db = new DatabaseSync(rutaArchivo);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  let nivelTransaccion = 0;

  const api = {
    ruta: rutaArchivo,

    exec(sql) {
      return db.exec(sql);
    },

    /** Ejecuta una consulta que no devuelve filas (INSERT, UPDATE, DELETE). */
    ejecutar(sql, ...parametros) {
      return db.prepare(sql).run(...sanearParametros(parametros));
    },

    /** Devuelve la primera fila o `undefined`. */
    obtener(sql, ...parametros) {
      return aObjetoNormal(db.prepare(sql).get(...sanearParametros(parametros)));
    },

    /** Devuelve todas las filas. */
    todas(sql, ...parametros) {
      return db.prepare(sql).all(...sanearParametros(parametros)).map(aObjetoNormal);
    },

    /** Ejecuta `funcion` dentro de una transaccion; revierte si lanza un error. */
    transaccion(funcion) {
      const anidada = nivelTransaccion > 0;
      if (!anidada) db.exec('BEGIN');
      nivelTransaccion += 1;
      try {
        const resultado = funcion();
        nivelTransaccion -= 1;
        if (!anidada) db.exec('COMMIT');
        return resultado;
      } catch (error) {
        nivelTransaccion -= 1;
        if (!anidada) db.exec('ROLLBACK');
        throw error;
      }
    },

    /** Aplica el esquema (idempotente: puede ejecutarse en cada arranque). */
    migrar() {
      const esquema = fs.readFileSync(path.join(__dirname, 'esquema.sql'), 'utf8');
      db.exec(esquema);
      return api;
    },

    cerrar() {
      if (db.isOpen) db.close();
    }
  };

  return api;
}

const conexion = crearConexion(config.rutas.db);
conexion.migrar();

module.exports = conexion;
module.exports.crearConexion = crearConexion;