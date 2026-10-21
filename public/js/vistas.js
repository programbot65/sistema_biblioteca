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

/**
 * Interruptor del registro de libros.
 *
 * Mientras el inventario real no esté listo, el registro, la edición y la
 * eliminación de libros quedan OCULTOS en la interfaz (Administración
 * muestra un aviso de preparación y el catálogo no ofrece el botón de
 * registro). Todo el código de administración se conserva intacto.
 *
 * Para habilitar nuevamente el registro, cambie este valor a `true`.
 */
window.BibliotecaConfig = {
  registroDeLibros: false
};
