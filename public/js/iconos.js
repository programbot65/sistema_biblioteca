'use strict';

/**
 * Catalogo de iconos del sistema.
 *
 * Todos son SVG dibujados con trazos, sin archivos externos ni fuentes de
 * iconos: el proyecto no necesita descargar nada y se ven igual en cualquier
 * navegador. Se usan tanto en la estantería como en el panel y el resto de
 * secciones.
 */

window.Iconos = {
  // --- Secciones del sistema ---
  panel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6"></rect>
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"></rect>
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"></rect>
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"></rect></svg>`,

  catalogo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 6.5C10.4 5 8.2 4.2 4.5 4.2v13C8.2 17.2 10.4 18 12 19.5"></path>
    <path d="M12 6.5c1.6-1.5 3.8-2.3 7.5-2.3v13c-3.7 0-5.9.8-7.5 2.3"></path>
    <path d="M12 6.5v13"></path></svg>`,

  prestamos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <polyline points="16.5 3.5 20 7 16.5 10.5"></polyline>
    <path d="M20 7H8a4 4 0 0 0-4 4v1"></path>
    <polyline points="7.5 20.5 4 17 7.5 13.5"></polyline>
    <path d="M4 17h12a4 4 0 0 0 4-4v-1"></path></svg>`,

  gestion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <line x1="5" y1="21" x2="5" y2="14"></line><line x1="5" y1="10" x2="5" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
    <line x1="19" y1="21" x2="19" y2="16"></line><line x1="19" y1="12" x2="19" y2="3"></line>
    <line x1="2.5" y1="14" x2="7.5" y2="14"></line>
    <line x1="9.5" y1="8" x2="14.5" y2="8"></line>
    <line x1="16.5" y1="16" x2="21.5" y2="16"></line></svg>`,

  biblioteca: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,

  // --- Cifras del panel ---
  disponibles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="16" height="4" rx="1"></rect>
    <rect x="5" y="10" width="15" height="4" rx="1"></rect>
    <rect x="3" y="16" width="14" height="4" rx="1"></rect></svg>`,

  prestados: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H17v14H6.5A1.5 1.5 0 0 0 5 18.5z"></path>
    <path d="M17 7h3.5v11.5a1.5 1.5 0 0 1-1.5 1.5H9"></path></svg>`,

  atrasado: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13.5"></line>
    <line x1="12" y1="17" x2="12" y2="17.01"></line></svg>`,

  por_vencer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"></circle>
    <polyline points="12 6.8 12 12 15.4 13.8"></polyline></svg>`,

  titulos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2.6 21.5 7.4 12 12.2 2.5 7.4"></polygon>
    <polyline points="2.5 12.4 12 17.2 21.5 12.4"></polyline>
    <polyline points="2.5 17 12 21.8 21.5 17"></polyline></svg>`,

  devoluciones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"></path>
    <polyline points="20.7 3.6 20.7 8.4 15.9 8.4"></polyline>
    <polyline points="8.6 12.2 11.4 15 15.6 9.6"></polyline></svg>`,

  // --- Interfaz ---
  izquierda: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 5 7.5 12 14.5 19"></polyline></svg>`,

  derecha: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><polyline points="9.5 5 16.5 12 9.5 19"></polyline></svg>`,

  rueda: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="2.5" width="8" height="14" rx="4"></rect>
    <line x1="12" y1="6.5" x2="12" y2="9.5"></line>
    <line x1="9.5" y1="20" x2="14.5" y2="20"></line></svg>`,

  mano: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"></path>
    <path d="M12 10.5V4.5a1.5 1.5 0 0 1 3 0V11"></path>
    <path d="M15 11V7a1.5 1.5 0 0 1 3 0v6.5a6 6 0 0 1-6 6h-.5a5.5 5.5 0 0 1-4.2-2L4 13.4a1.6 1.6 0 0 1 2.4-2.1L9 13.6"></path></svg>`,

  teclado: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.5" y="6" width="19" height="12" rx="2"></rect>
    <line x1="6.5" y1="10" x2="6.5" y2="10"></line><line x1="10" y1="10" x2="10" y2="10"></line>
    <line x1="13.5" y1="10" x2="13.5" y2="10"></line><line x1="17" y1="10" x2="17" y2="10"></line>
    <line x1="8" y1="14" x2="16" y2="14"></line></svg>`,

  lupa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10.5" cy="10.5" r="6.5"></circle>
    <line x1="15.4" y1="15.4" x2="20.5" y2="20.5"></line></svg>`,

  campana: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z"></path>
    <path d="M13.7 20a2 2 0 0 1-3.4 0"></path></svg>`,

  persona: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="4"></circle>
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"></path></svg>`,

  pulso: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">
    <polyline points="2.5 12.5 7 12.5 9.5 6.5 13.5 18 16 12.5 21.5 12.5"></polyline></svg>`,

  etiqueta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.6 12.9 12.9 20.6a2 2 0 0 1-2.8 0L3 13.6V3.5h10.1l7.5 7.5a2 2 0 0 1 0 2.9z"></path>
    <circle cx="7.6" cy="7.6" r="1.3"></circle></svg>`
};
