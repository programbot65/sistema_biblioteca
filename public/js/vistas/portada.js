'use strict';

/**
 * Portada: la estanteria circular de libros.
 *
 * Esta vista es la pantalla de inicio del sistema: un menu de libros
 * giratorio donde cada seccion del sistema es un libro. Al elegir un libro
 * se abre la seccion correspondiente, sin cambiar ninguna de las rutas ni del
 * funcionamiento ya implementados.
 *
 * Reparto de responsabilidades:
 *   - este archivo: que libros existen, como se ve cada uno y a donde llevan.
 *   - `js/navegacion.js`: posiciones, profundidad, inercia y gestos.
 *   - `css/estanteria.css`: la parte visual.
 */

window.Vistas = window.Vistas || {};

Vistas.inicio = {
  titulo: 'Estanteria',
  descripcion: 'Elija un libro para abrir la seccion del sistema.',

  /** Se recuerda que libro quedo al frente para recuperarlo al volver. */
  indiceRecordado: 0,

    /** Los iconos viven en `js/iconos.js`, compartidos con el panel. */
  iconoDe(clave) { return Iconos[clave]; },

  /**
   * Las secciones a las que se puede abrir desde la estanteria.
   * El propio inicio no aparece: la estanteria ya es la portada, asi que
   * sus libros son las demas secciones del sistema.
   */
  secciones: [
    {
      ruta: 'catalogo',
      etiqueta: 'Catalogo',
      titulo: 'CATALOGO',
      descripcion: 'Buscar y consultar los libros del catalogo',
      icono: 'catalogo',
      tono: 'violeta'
    },
    {
      ruta: 'usuarios',
      etiqueta: 'Usuarios',
      titulo: 'USUARIOS',
      descripcion: 'Estudiantes de la biblioteca y su historial',
      icono: 'persona',
      tono: 'verde'
    },
    {
      ruta: 'prestamos',
      etiqueta: 'Prestamos',
      titulo: 'PRESTAMOS',
      descripcion: 'Registrar prestamos, devoluciones y renovaciones',
      icono: 'prestamos',
      tono: 'naranja'
    }
  ],

  // -------------------------------------------------------------------
  // Ciclo de vida de la vista
  // -------------------------------------------------------------------
  async render(contenedor) {
    const { crear } = UI;

    // Si se vuelve desde una seccion, el motor anterior ya no debe seguir
    // girando: se destruye antes de construir uno nuevo.
    if (this.estanteria) {
      this.estanteria.destruir();
      this.estanteria = null;
    }

    this.elementosNucleo = {};

    this.libros = this.secciones.map((seccion, indice) => this.crearLibro(seccion, indice));
    this.anillo = crear('div', { clase: 'estanteria__anillo' }, this.libros);

    this.nucleo = this.crearNucleo();

    this.escena = crear('div', { clase: 'estanteria' }, [
      crear('span', { clase: 'estanteria__corona', 'aria-hidden': 'true' }),
      this.anillo,
      this.nucleo
    ]);

    const zona = crear('div', { clase: 'estanteria-zona' }, [this.escena]);

    const bloque = crear('section', { clase: 'portada' }, [
      crear('header', { clase: 'portada__presentacion' }, [
        crear('p', { clase: 'portada__antetitulo', texto: 'Biblioteca UEEA' }),
        crear('h2', { clase: 'portada__titulo' }, [
          'Elija una ',
          crear('span', { texto: 'seccion' })
        ])
      ]),
      crear('h2', { clase: 'oculto', texto: 'Estanteria de secciones del sistema' }),
      zona,
      this.crearControles()
    ]);

    contenedor.replaceChildren(bloque);

    this.arrancar();
  },

  /** Crea el motor de navegacion y conecta sus avisos. */
  arrancar() {
    this.estanteria = Navegacion.crear({
      contenedor: this.escena,
      elementos: this.libros,
      alCentrar: (indice) => this.pintarNucleo(indice),
      alElegir: (indice, confirmado) => {
        if (!confirmado) return;
        const seccion = this.secciones[indice];
        if (!seccion) return;
        this.indiceRecordado = indice;
        window.location.hash = `#/${seccion.ruta}`;
      }
    });

    // Se recupera el libro que estaba al frente la ultima vez.
    if (this.indiceRecordado) {
      this.estanteria.fijarIndice(this.indiceRecordado);
    }
  },

  // -------------------------------------------------------------------
  // Piezas visuales
  // -------------------------------------------------------------------
  crearLibro(seccion, indice) {
    const { crear } = UI;
    const numero = String(indice + 1).padStart(2, '0');

    const tapa = crear('span', { clase: 'libro__tapa libro__tapa--delante' }, [
      crear('span', { clase: 'libro__marca', texto: 'UEEA' }),
      crear('span', { clase: 'libro__icono' }, [UI.crearSvg(this.iconoDe(seccion.icono))]),
      crear('span', { clase: 'libro__titulo', texto: seccion.titulo }),
      crear('span', { clase: 'libro__regla' }),
      crear('span', { clase: 'libro__codigo', texto: numero })
    ]);

    const interior = crear('span', { clase: 'libro__interior' }, [
      crear('span', { clase: 'libro__interior-icono' }, [UI.crearSvg(this.iconoDe(seccion.icono))]),
      crear('span', { clase: 'libro__interior-titulo', texto: seccion.etiqueta }),
      crear('span', { clase: 'libro__interior-lineas' }),
      crear('span', { clase: 'libro__interior-pie', texto: seccion.descripcion })
    ]);

    const volumen = crear('span', { clase: 'libro__volumen' }, [
      crear('span', { clase: 'libro__tapa libro__tapa--atras' }),
      crear('span', { clase: 'libro__lomo' }),
      crear('span', { clase: 'libro__paginas' }),
      interior,
      tapa
    ]);

    const escena = crear('span', { clase: 'libro__escena' }, [
      crear('span', { clase: 'libro__sombra', 'aria-hidden': 'true' }),
      volumen
    ]);

    return crear('button', {
      clase: `libro libro--${seccion.tono}`,
      type: 'button',
      dataset: { vista: seccion.ruta, indice: String(indice) },
      'aria-label': `${seccion.etiqueta}. ${seccion.descripcion}`,
      'aria-current': 'false'
    }, [escena]);
  },

  /** Nucleo minimo: solo el nombre de la seccion y los pasos. */
  crearNucleo() {
    const { crear } = UI;

    this.elementosNucleo.seccion = crear('span', { clase: 'nucleo__seccion' });
    this.elementosNucleo.pasos = crear('span', { clase: 'nucleo__pasos' }, this.secciones.map(() =>
      crear('span', { clase: 'nucleo__paso' })
    ));

    return crear('div', { clase: 'estanteria__nucleo' }, [
      crear('span', { clase: 'nucleo__icono' }, [UI.crearSvg(this.iconoDe('biblioteca'))]),
      this.elementosNucleo.seccion,
      this.elementosNucleo.pasos
    ]);
  },

  /** Solo dos flechas: el resto de la ayuda estorba. */
  crearControles() {
    const { crear } = UI;

    this.controlAnterior = crear('button', {
      clase: 'estanteria__control',
      type: 'button',
      'aria-label': 'Ver el libro anterior',
      onclick: () => this.estanteria && this.estanteria.avanzar(-1)
    }, [UI.crearSvg(this.iconoDe("izquierda"))]);

    this.controlSiguiente = crear('button', {
      clase: 'estanteria__control',
      type: 'button',
      'aria-label': 'Ver el libro siguiente',
      onclick: () => this.estanteria && this.estanteria.avanzar(1)
    }, [UI.crearSvg(this.iconoDe("derecha"))]);

    return crear('div', { clase: 'estanteria__barra' }, [this.controlAnterior, this.controlSiguiente]);
  },

  /** Muestra en el nucleo el titulo del libro que esta al frente. */
  pintarNucleo(indice) {
    const seccion = this.secciones[indice];
    if (!seccion || !this.elementosNucleo.seccion) return;

    this.elementosNucleo.seccion.textContent = seccion.etiqueta;

    Array.from(this.elementosNucleo.pasos.children).forEach((paso, i) => {
      paso.classList.toggle('activo', i === indice);
    });
  }
};
