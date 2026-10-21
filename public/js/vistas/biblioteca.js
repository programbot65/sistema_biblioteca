'use strict';

/**
 * Vista de la Biblioteca digital.
 *
 * Muestra los libros registrados en el sistema con su informacion (portada,
 * titulo, autor, categoria y estado) y permite leerlos en la propia pagina
 * mediante el lector integrado (`js/lector.js`).
 *
 * El estado de cada libro no se guarda: se deduce de los prestamos
 * activos, asi que al registrar o devolver un prestamo esta seccion queda
 * al dia sin tocar nada mas.
 */

window.Vistas = window.Vistas || {};

Vistas.biblioteca = {
  titulo: 'Biblioteca digital',
  descripcion: 'Los libros que tienes prestados y los que puedes consultar desde aqui.',

  estado: {
    q: '',
    categoria: '',
    estado: '',
    orden: 'titulo',
    limite: 12,
    offset: 0,
    categorias: []
  },

  async render(contenedor, parametros = {}) {
    const { crear } = UI;

    if (parametros.q !== undefined) {
      this.estado.q = parametros.q;
      this.estado.offset = 0;
    }
    if (parametros.categoria !== undefined) this.estado.categoria = parametros.categoria || '';
    if (parametros.estado !== undefined) this.estado.estado = parametros.estado || '';

    if (!this.estado.categorias.length) {
      try {
        const datos = await Api.categorias();
        this.estado.categorias = datos.categorias;
      } catch (error) {
        this.estado.categorias = [];
      }
    }

    contenedor.replaceChildren(this.construir());
    await this.buscar();
  },

  construir() {
    const { crear } = UI;

    // --- Buscador ---
    const entradaBusqueda = crear('input', {
      type: 'search',
      name: 'q',
      placeholder: 'Buscar por titulo, autor o categoria...',
      'aria-label': 'Buscar en la biblioteca digital',
      value: this.estado.q
    });

    const temporizador = { id: null };
    entradaBusqueda.addEventListener('input', () => {
      clearTimeout(temporizador.id);
      temporizador.id = setTimeout(() => {
        this.estado.q = entradaBusqueda.value.trim();
        this.estado.offset = 0;
        this.buscar();
      }, 350);
    });

    const buscador = crear('form', {
      clase: 'buscador',
      onsubmit: (evento) => {
        evento.preventDefault();
        this.estado.q = entradaBusqueda.value.trim();
        this.estado.offset = 0;
        this.buscar();
      }
    }, [
      crear('div', { clase: 'buscador__campo' }, [entradaBusqueda]),
      crear('button', { clase: 'boton boton--primario', type: 'submit', texto: 'Buscar' })
    ]);

    // --- Filtros ---
    const selectorCategoria = crear('select', { 'aria-label': 'Filtrar por categoria' }, [
      crear('option', { value: '', texto: 'Todas las categorias' }),
      ...this.estado.categorias.map((categoria) =>
        crear('option', { value: categoria.id, texto: `${categoria.nombre} (${categoria.total_libros})` })
      )
    ]);
    selectorCategoria.value = this.estado.categoria;
    selectorCategoria.addEventListener('change', () => {
      this.estado.categoria = selectorCategoria.value;
      this.estado.offset = 0;
      this.buscar();
    });

    const selectorEstado = crear('select', { 'aria-label': 'Filtrar por disponibilidad' }, [
      crear('option', { value: '', texto: 'Toda disponibilidad' }),
      crear('option', { value: 'disponible', texto: 'Solo disponibles' }),
      crear('option', { value: 'agotado', texto: 'Solo prestados' })
    ]);
    selectorEstado.value = this.estado.estado;
    selectorEstado.addEventListener('change', () => {
      this.estado.estado = selectorEstado.value;
      this.estado.offset = 0;
      this.buscar();
    });

    const selectorOrden = crear('select', { 'aria-label': 'Ordenar resultados' }, [
      crear('option', { value: 'titulo', texto: 'Ordenar por titulo' }),
      crear('option', { value: 'autor', texto: 'Ordenar por autor' }),
      crear('option', { value: 'categoria', texto: 'Ordenar por categoria' }),
      crear('option', { value: 'recientes', texto: 'Ultimos registrados' })
    ]);
    selectorOrden.value = this.estado.orden;
    selectorOrden.addEventListener('change', () => {
      this.estado.orden = selectorOrden.value;
      this.buscar();
    });

    const filtros = crear('div', { clase: 'filtros' }, [
      selectorCategoria,
      selectorEstado,
      selectorOrden,
      crear('button', {
        clase: 'boton boton--secundario',
        type: 'button',
        texto: 'Limpiar filtros',
        onclick: () => {
          this.estado = { ...this.estado, q: '', categoria: '', estado: '', orden: 'titulo', offset: 0 };
          this.render(document.getElementById('contenido'));
        }
      })
    ]);

    this.contenedorResultados = crear('div', { id: 'resultados', role: 'status', 'aria-live': 'polite' }, [
      crear('p', { clase: 'cargando', texto: 'Abriendo la biblioteca digital...' })
    ]);

    this.conteoResultados = crear('p', { clase: 'vista-controles__conteo', texto: '' });

    const controles = crear('div', { clase: 'vista-controles' }, [
      this.conteoResultados
    ]);

    return crear('div', {}, [
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      buscador,
      filtros,
      controles,
      this.contenedorResultados
    ]);
  },

  /** Consulta la biblioteca digital y pinta los resultados. */
  async buscar() {
    const { crear } = UI;
    const contenedor = this.contenedorResultados;
    if (!contenedor) return;

    contenedor.replaceChildren(crear('p', { clase: 'cargando', texto: 'Consultando la biblioteca digital...' }));
    if (this.conteoResultados) this.conteoResultados.textContent = 'Consultando...';

    try {
      const datos = await Api.biblioteca({
        q: this.estado.q,
        categoria: this.estado.categoria,
        estado: this.estado.estado,
        orden: this.estado.orden,
        limite: this.estado.limite,
        offset: this.estado.offset
      });

      this.pintarResultados(datos);
    } catch (error) {
      contenedor.replaceChildren(UI.vacio('No se pudo consultar la biblioteca digital.'));
      UI.errorApi(error);
    }
  },

  pintarResultados(datos) {
    const { crear } = UI;
    const contenedor = this.contenedorResultados;

    if (!datos.libros.length) {
      contenedor.replaceChildren(UI.vacio(
        this.estado.q
          ? `No se encontraron libros para "${this.estado.q}". Pruebe con otras palabras o limpie los filtros.`
          : 'No hay libros que cumplan los filtros seleccionados.'
      ));
      if (this.conteoResultados) this.conteoResultados.textContent = '0 resultados';
      return;
    }

    if (this.conteoResultados) {
      const total = typeof datos.total !== 'undefined' ? datos.total : datos.libros.length;
      this.conteoResultados.textContent =
        `${datos.libros.length} libro(s) en esta página${total > datos.libros.length ? ` de ${total} en total` : ''}`;
    }

    const piezas = [];

    if (datos.consulta) {
      const nota = crear('p', { clase: 'nota-busqueda' });
      nota.append('Resultados para ');
      nota.append(crear('strong', { texto: `"${datos.consulta}"` }));
      nota.append(` · ${datos.libros.length} coincidencia(s).`);
      piezas.push(nota);
    }

    // Primero los libros que tiene prestados el estudiante: son los que
    // va a consultar en la biblioteca.
    if (datos.prestamos_activos && datos.prestamos_activos.length) {
      piezas.push(this.bloquePrestamos(datos.prestamos_activos));
    }

    const rejilla = crear('div', { clase: 'digital' }, datos.libros.map((libro) => this.tarjeta(libro)));
    piezas.push(rejilla);
    piezas.push(this.paginacion(datos));

    contenedor.replaceChildren(...piezas);
  },

  /**
   * Los prestamos activos: los libros que estan en poder del estudiante,
   * con la fecha limite y el estado de devolucion.
   */
  bloquePrestamos(prestamos) {
    const { crear } = UI;

    return crear('section', { clase: 'resumen__bloque' }, [
      crear('h3', { clase: 'resumen__titulo', texto: 'Tus préstamos' }),
      crear('ul', { clase: 'prestamos-activos' }, prestamos.map((prestamo) => {
        const boton = crear('button', {
          clase: 'boton boton--pequeno',
          type: 'button',
          texto: 'Leer libro',
          onclick: () => Lector.abrir({
            id: prestamo.libro_id,
            titulo: prestamo.titulo,
            categoria: prestamo.categoria,
            tiene_archivo: prestamo.tiene_archivo
          })
        });

        return crear('li', { clase: 'prestamo-activo' }, [
          crear('div', { clase: 'prestamo-activo__datos' }, [
            crear('span', { clase: 'prestamo-activo__titulo', texto: prestamo.titulo }),
            crear('span', {
              clase: 'prestamo-activo__detalle',
              texto: `${prestamo.estudiante_nombre} · ${prestamo.estudiante_curso} · ` +
                `préstamo ${UI.fecha(prestamo.fecha_prestamo)} · ` +
                `límite ${UI.fecha(prestamo.fecha_limite)}`
            })
          ]),
          crear('span', {
            clase: `insignia insignia--${prestamo.situacion === 'atrasado' ? 'atrasado' : 'vigente'}`,
            texto: prestamo.situacion_texto
          }),
          boton
        ]);
      }))
    ]);
  },

  /**
   * Tarjeta de un libro: portada, titulo, autor, categoria, estado y el
   * prestamo actual si lo tiene. El boton "Leer libro" abre el lector.
   */
  tarjeta(libro) {
    const { crear } = UI;
    const tono = UI.tonoCategoria(libro.categoria);
    const prestado = Boolean(libro.prestamo_actual);

    const pie = crear('div', { clase: 'digital__pie' }, [
      crear('span', {
        clase: `insignia ${prestado ? 'insignia--prestado' : 'insignia--disponible'}`,
        texto: prestado ? 'Prestado' : 'Disponible'
      }),
      crear('span', { clase: 'digital__codigo', texto: libro.codigo })
    ]);

    const prestamo = libro.prestamo_actual
      ? crear('div', { clase: 'digital__prestamo' }, [
        crear('span', { clase: 'digital__prestamo-linea', texto: libro.prestamo_actual.estudiante.nombre }),
        crear('span', {
          clase: 'digital__prestamo-linea digital__prestamo-linea--tenue',
          texto: `${libro.prestamo_actual.estudiante.curso} · límite ${UI.fecha(libro.prestamo_actual.fecha_limite)}`
        })
      ])
      : null;

    const botonLeer = crear('button', {
      clase: 'boton boton--primario digital__leer',
      type: 'button',
      texto: 'Leer libro',
      'aria-label': `Leer ${libro.titulo}`,
      onclick: () => Lector.abrir(libro)
    });

    return crear('article', { clase: `digital__item digital__item--${tono}` }, [
      crear('div', { clase: 'digital__portada' }, [UI.portada(libro, 'digital__portada-imagen')]),
      crear('div', { clase: 'digital__cuerpo' }, [
        crear('span', { clase: 'digital__categoria', texto: libro.categoria || 'Sin categoría' }),
        crear('h3', { clase: 'digital__titulo', texto: libro.titulo }),
        crear('p', { clase: 'digital__autor', texto: libro.autor }),
        prestamo,
        pie,
        botonLeer,
        !libro.tiene_archivo
          ? crear('p', { clase: 'digital__aviso', texto: 'Sin archivo digital disponible' })
          : null
      ])
    ]);
  },

  /** Botones de pagina anterior y siguiente. */
  paginacion(datos) {
    const { crear } = UI;
    const total = typeof datos.total !== 'undefined' ? datos.total : datos.libros.length;
    const limite = this.estado.limite;

    if (total <= limite) return crear('div');

    const anterior = crear('button', {
      clase: 'boton boton--secundario',
      type: 'button',
      texto: 'Anterior',
      disabled: this.estado.offset <= 0,
      onclick: () => {
        this.estado.offset = Math.max(0, this.estado.offset - limite);
        this.buscar();
      }
    });

    const siguiente = crear('button', {
      clase: 'boton boton--secundario',
      type: 'button',
      texto: 'Siguiente',
      disabled: this.estado.offset + limite >= total,
      onclick: () => {
        this.estado.offset += limite;
        this.buscar();
      }
    });

    return crear('div', { clase: 'paginacion' }, [anterior, siguiente]);
  }
};
