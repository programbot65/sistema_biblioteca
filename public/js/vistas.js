'use strict';

/**
 * Registro de vistas de la aplicacion.
 * Cada archivo de /js/vistas se agrega aqui con la forma:
 *
 *   Vistas.nombre = {
 *     titulo: '...',
 *     descripcion: '...',
 *     async render(contenedor, parametros) { ... }
 *   };
 *
 * Debe cargarse antes que los archivos de vistas y antes de app.js.
 */

window.Vistas = Object.create(null);
