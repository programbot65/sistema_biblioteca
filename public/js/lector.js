'use strict';

/**
 * Lector integrado de la Biblioteca digital.
 *
 * Abre el PDF de un libro dentro de la propia pagina y permite recorrerlo:
 * pagina anterior, pagina siguiente, zoom y descarga. Si el libro no tiene
 * un archivo digital, lo dice con claridad en vez de mostrar un hueco.
 *
 * El PDF se muestra con el visor del navegador dentro de un `iframe`. Para
 * poder controlling la pagina y el zoom se cambian los parametros `#page` y
 * `#zoom` de la direccion, que son los que respeta el visor de Chrome, Edge
 * y Firefox.
 */

window.Lector = (() => {
  const { crear } = window.UI;

  const ZOOMS = [50, 75, 100, 125, 150, 200];

  /** Estado del lector mientras esta abierto. */
  const estado = {
    libro: null,
    pagina: 1,
    paginas: 0,
    zoom: 100,
    marco: null
  };

  /** Texto de ayuda para cada accion del lector. */
  const ayuda = {
    anterior: 'Página anterior',
    siguiente: 'Página siguiente',
    menos: 'Alejar el texto',
    mas: 'Ampliar el texto',
    descargar: 'Descargar el PDF',
    cerrar: 'Cerrar el lector'
  };

  /** Iconos del lector (SVG propio, no dependen de la biblioteca). */
  const ICONOS = {
    anterior: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>',
    siguiente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"></path></svg>',
    menos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"></path></svg>',
    mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
    descargar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"></path><path d="M7.5 10.5 12 15l4.5-4.5"></path><path d="M5 19h14"></path></svg>',
    vacio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h9l4 4V20.5H6z"></path><path d="M15 3.5v4h4"></path><path d="M9.5 12.5h5M9.5 16h3.5"></path></svg>'
  };

  /** Construye la direccion del PDF con la pagina y el zoom actuales. */
  function direccion() {
    const base = window.Api.archivoLibro(estado.libro.id);
    const partes = [`page=${estado.pagina}`, `zoom=${estado.zoom}`];
    return `${base}#${partes.join('&')}`;
  }

  /** Refresca el marco del PDF con la pagina y el zoom actuales. */
  function refrescarMarco() {
    if (!estado.marco) return;
    estado.marco.setAttribute('src', direccion());
    pintarIndicador();
  }

  /** Escribe el "Pagina X de Y" y activa o desactiva los botones. */
  function pintarIndicador() {
    const { crear: crearElemento } = window.UI;

    const indicador = estado.marco && estado.marco.closest('.lector');
    if (!indicador) return;

    const texto = indicador.querySelector('.lector__pagina');
    if (texto) {
      texto.textContent = estado.paginas
        ? `Página ${estado.pagina} de ${estado.paginas}`
        : `Página ${estado.pagina}`;
    }

    const zoom = indicador.querySelector('.lector__zoom');
    if (zoom) zoom.textContent = `${estado.zoom} %`;

    const anterior = indicador.querySelector('[data-accion="anterior"]');
    const siguiente = indicador.querySelector('[data-accion="siguiente"]');
    if (anterior) anterior.disabled = estado.pagina <= 1;
    if (siguiente) {
      siguiente.disabled = Boolean(estado.paginas) && estado.pagina >= estado.paginas;
    }
  }

  /** Cambia de pagina y recarga el marco. */
  function irAPagina(pagina) {
    const destino = Math.max(1, Math.floor(pagina) || 1);
    if (estado.paginas && destino > estado.paginas) return;
    estado.pagina = destino;
    refrescarMarco();
  }

  /** Cambia el zoom del visor. */
  function cambiarZoom(delta) {
    const indice = ZOOMS.indexOf(estado.zoom);
    const siguiente = Math.max(0, Math.min(ZOOMS.length - 1, (indice < 0 ? 2 : indice) + delta));
    estado.zoom = ZOOMS[siguiente];
    refrescarMarco();
  }

  /** Boton del lector. */
  function boton({ accion, etiqueta, contenido, clase = 'lector__boton' }) {
    const elemento = crear('button', {
      clase,
      type: 'button',
      'aria-label': etiqueta,
      title: etiqueta,
      dataset: { accion }
    }, [contenido]);

    elemento.addEventListener('click', () => {
      if (accion === 'anterior') irAPagina(estado.pagina - 1);
      if (accion === 'siguiente') irAPagina(estado.pagina + 1);
      if (accion === 'menos') cambiarZoom(-1);
      if (accion === 'mas') cambiarZoom(1);
      if (accion === 'descargar') {
        window.open(window.Api.archivoLibro(estado.libro.id, { descarga: true }), '_blank');
      }
    });

    return elemento;
  }

  /** Barra de control del lector. */
  function crearControles() {
    const barra = crear('div', { clase: 'lector__controles' }, [
      boton({
        accion: 'anterior',
        etiqueta: ayuda.anterior,
        contenido: crear('span', { clase: 'lector__glifo' }, [UI.crearSvg(ICONOS.anterior)])
      }),
      crear('span', { clase: 'lector__pagina', texto: 'Página 1' }),
      boton({
        accion: 'siguiente',
        etiqueta: ayuda.siguiente,
        contenido: crear('span', { clase: 'lector__glifo' }, [UI.crearSvg(ICONOS.siguiente)])
      }),
      crear('span', { clase: 'lector__separador', 'aria-hidden': 'true' }),
      boton({
        accion: 'menos',
        etiqueta: ayuda.menos,
        contenido: crear('span', { clase: 'lector__glifo' }, [UI.crearSvg(ICONOS.menos)])
      }),
      crear('span', { clase: 'lector__zoom', texto: '100 %' }),
      boton({
        accion: 'mas',
        etiqueta: ayuda.mas,
        contenido: crear('span', { clase: 'lector__glifo' }, [UI.crearSvg(ICONOS.mas)])
      })
    ]);

    return barra;
  }

  /** Mensaje para los libros que todavia no tienen archivo digital. */
  function construirSinArchivo() {
    return crear('div', { clase: 'lector__vacio' }, [
      crear('span', { clase: 'lector__vacio-icono' }, [UI.crearSvg(ICONOS.vacio)]),
      crear('h3', { clase: 'lector__vacio-titulo', texto: 'Contenido no disponible' }),
      crear('p', {
        clase: 'lector__vacio-texto',
        texto: `El libro "${estado.libro.titulo}" todavía no tiene un archivo digital en la biblioteca.`
      }),
      crear('p', {
        clase: 'lector__vacio-nota',
        texto: 'El encargado de la biblioteca puede adjuntar el PDF desde la sección de administración.'
      })
    ]);
  }

  /**
   * Abre el lector con un libro.
   * @param {object} libro  Libro con `id`, `titulo` y `tiene_archivo`.
   */
  function abrir(libro) {
    if (!libro || !libro.id) return;

    estado.libro = libro;
    estado.pagina = 1;
    estado.zoom = 100;
    estado.paginas = Number(libro.paginas) || 0;

    const modal = document.getElementById('modal');
    const caja = modal.querySelector('.modal__caja');
    if (caja) caja.classList.add('modal__caja--lector');

    document.getElementById('modal-titulo').textContent = libro.titulo || 'Lector';

    const cuerpo = document.getElementById('modal-cuerpo');
    cuerpo.classList.add('modal__cuerpo--lector');

    if (libro.tiene_archivo) {
      const marco = crear('iframe', {
        clase: 'lector__marco',
        src: direccion(),
        title: `Contenido de ${libro.titulo}`,
        allowfullscreen: true
      });
      estado.marco = marco;

      const contenedor = crear('div', { clase: 'lector' }, [
        marco,
        crearControles()
      ]);


      cuerpo.replaceChildren(contenedor);
    } else {
      estado.marco = null;
      cuerpo.replaceChildren(construirSinArchivo());
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    // Se recupera el numero de paginas con una peticion ligera.
    if (libro.tiene_archivo) recuperarPaginas();
  }

  /** Pregunta al servidor cuantas paginas tiene el PDF. */
  async function recuperarPaginas() {
    if (!estado.libro || !estado.libro.tiene_archivo) return;
    if (estado.paginas) return;

    try {
      const respuesta = await fetch(window.Api.archivoLibro(estado.libro.id), {
        method: 'HEAD'
      });
      const paginas = Number(respuesta.headers.get('X-Paginas'));
      if (paginas > 0) {
        estado.paginas = paginas;
        pintarIndicador();
      }
    } catch (error) {
      // Si no se puede saber, el lector funciona igual con la pagina actual.
    }
  }

  /** Cierra el lector. */
  function cerrar() {
    const modal = document.getElementById('modal');
    const caja = modal.querySelector('.modal__caja');
    if (caja) caja.classList.remove('modal__caja--lector');

    const cuerpo = document.getElementById('modal-cuerpo');
    if (cuerpo) cuerpo.classList.remove('modal__cuerpo--lector');

    estado.marco = null;
    estado.libro = null;
  }

  return { abrir, cerrar, estado };
})();
