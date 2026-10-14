'use strict';

/**
 * Vista del catalogo (RF01, RF02, RF03, RF09).
 * Permite consultar, filtrar y ver el detalle de cada libro, con la
 * recomendacion de libros similares.
 */

Vistas.catalogo = {
  titulo: 'Catalogo de libros',
  descripcion: 'Consulte los libros de la biblioteca por titulo, autor, categoria o codigo.',

  estado: {
    q: '',
    categoria: '',
    estado: '',
    orden: 'titulo',
    limite: 12,
    offset: 0,
    categorias: []
  },

  get modoVista() {
    try {
      return localStorage.getItem('biblio_vista') || 'cuadricula';
    } catch (error) {
      return 'cuadricula';
    }
  },

  set modoVista(modo) {
    try {
      localStorage.setItem('biblio_vista', modo);
    } catch (error) {
      // El almacenamiento puede no estar disponible: no es grave.
    }
    this._modoVista = modo;
    this.aplicarModoVista();
  },

  async render(contenedor, parametros = {}) {
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

    contenedor.replaceChildren(this.construir(contenedor));
    await this.buscar();
  },

  construir() {
    const { crear } = UI;

    const entradaBusqueda = crear('input', {
      type: 'search',
      name: 'q',
      placeholder: 'Buscar por titulo, autor, categoria o codigo...',
      'aria-label': 'Buscar en el catalogo',
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
      crear('option', { value: 'anio', texto: 'Ordenar por anio' }),
      crear('option', { value: 'recientes', texto: 'Ultimos registrados' })
    ]);
    selectorOrden.value = this.estado.orden;
    selectorOrden.addEventListener('change', () => {
      this.estado.orden = selectorOrden.value;
      this.buscar();
    });

    const filtros = crear('div', { clase: 'filtros' }, [
      selectorCategoria,
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

    // Filtros secundarios agrupados: disponibilidad y orden.
    // Siguen en la misma sección y funcionan igual, sin saturar la vista.
    const filtrosAvanzados = crear('details', { clase: 'filtros-avanzados' }, [
      crear('summary', { clase: 'filtros-avanzados__resumen' }, [
        crear('span', { texto: 'Opciones avanzadas' }),
        crear('span', { clase: 'texto-suave', texto: 'Disponibilidad y orden' })
      ]),
      crear('div', { clase: 'filtros filtros-avanzados__cuerpo' }, [
        selectorEstado, selectorOrden
      ])
    ]);

    this.contenedorResultados = crear('div', { id: 'resultados', role: 'status', 'aria-live': 'polite' }, [
      crear('p', { clase: 'cargando', texto: 'Buscando libros...' })
    ]);

    this.conteoResultados = crear('p', { clase: 'vista-controles__conteo', texto: '' });

    const botonCuadricula = crear('button', {
      clase: 'vista-controles__boton',
      type: 'button',
      'aria-pressed': 'true',
      'aria-label': 'Ver como cuadrícula',
      title: 'Vista de cuadrícula'
    }, ['Cuadrícula']);
    botonCuadricula.prepend(UI.crearSvg(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"></rect></svg>'
    ));

    const botonLista = crear('button', {
      clase: 'vista-controles__boton',
      type: 'button',
      'aria-pressed': 'false',
      'aria-label': 'Ver como lista',
      title: 'Vista de lista'
    }, ['Lista']);
    botonLista.prepend(UI.crearSvg(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8.5" y1="6" x2="20.5" y2="6"></line><line x1="8.5" y1="12" x2="20.5" y2="12"></line><line x1="8.5" y1="18" x2="20.5" y2="18"></line><circle cx="4.8" cy="6" r="1.3"></circle><circle cx="4.8" cy="12" r="1.3"></circle><circle cx="4.8" cy="18" r="1.3"></circle></svg>'
    ));

    botonCuadricula.addEventListener('click', () => { this.modoVista = 'cuadricula'; });
    botonLista.addEventListener('click', () => { this.modoVista = 'lista'; });
    this.botonCuadricula = botonCuadricula;
    this.botonLista = botonLista;

    try {
      this._modoVista = localStorage.getItem('biblio_vista') || 'cuadricula';
    } catch (error) {
      this._modoVista = 'cuadricula';
    }

    const controlesVista = crear('div', { clase: 'vista-controles' }, [
      this.conteoResultados,
      crear('div', { clase: 'vista-controles__grupo', role: 'group', 'aria-label': 'Cambiar vista de resultados' }, [
        botonCuadricula, botonLista
      ])
    ]);

    return crear('div', {}, [
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      buscador,
      filtros,
      filtrosAvanzados,
      controlesVista,
      this.contenedorResultados
    ]);
  },

  /** Aplica el modo de vista (cuadrícula o lista) a la rejilla actual. */
  aplicarModoVista() {
    const modo = this._modoVista || 'cuadricula';
    const rejilla = this.contenedorResultados && this.contenedorResultados.querySelector('.rejilla-libros');
    if (rejilla) rejilla.classList.toggle('rejilla-libros--lista', modo === 'lista');
    if (this.botonCuadricula) this.botonCuadricula.setAttribute('aria-pressed', String(modo === 'cuadricula'));
    if (this.botonLista) this.botonLista.setAttribute('aria-pressed', String(modo === 'lista'));
  },

  /** Consulta la API y dibuja los resultados. */
  async buscar() {
    const contenedor = this.contenedorResultados;
    if (!contenedor) return;

    contenedor.replaceChildren(crearTexto('cargando', 'Buscando libros…'));
    if (this.conteoResultados) this.conteoResultados.textContent = 'Consultando el catálogo…';

    try {
      const datos = await Api.catalogo({
        q: this.estado.q,
        categoria: this.estado.categoria,
        estado: this.estado.estado,
        orden: this.estado.orden,
        limite: this.estado.limite,
        offset: this.estado.offset
      });

      this.pintarResultados(datos);
    } catch (error) {
      contenedor.replaceChildren(UI.vacio('No se pudo consultar el catalogo.'));
      UI.errorApi(error);
    }
  },

  pintarResultados(datos) {
    const { crear } = UI;
    const contenedor = this.contenedorResultados;

    if (!datos.libros.length) {
      contenedor.replaceChildren(
        UI.vacio(this.estado.q
          ? `No se encontraron libros para "${this.estado.q}". Pruebe con otras palabras o limpie los filtros.`
          : 'No hay libros que cumplan los filtros seleccionados. Pruebe limpiar los filtros.')
      );
      if (this.conteoResultados) this.conteoResultados.textContent = '0 resultados';
      return;
    }

    if (this.conteoResultados) {
      const total = typeof datos.total !== 'undefined' ? datos.total : datos.libros.length;
      this.conteoResultados.textContent = `${datos.libros.length} resultado(s) en esta página${total > datos.libros.length ? ` de ${total} en total` : ''}`;
    }

    const piezas = [];

    if (datos.consulta) {
      const nota = crear('p', { clase: 'nota-busqueda' });
      nota.append('Resultados para ');
      nota.append(crear('strong', { texto: `"${datos.consulta}"` }));
      nota.append(` · ${datos.libros.length} coincidencia(s).`);
      if (datos.inteligente) {
        nota.append(' La búsqueda también considera palabras relacionadas, singular/plural y errores de escritura.');
      }
      piezas.push(nota);
    }

    const rejilla = crear('div', { clase: 'rejilla-libros' }, datos.libros.map((libro) => this.tarjetaLibro(libro)));
    if ((this._modoVista || 'cuadricula') === 'lista') rejilla.classList.add('rejilla-libros--lista');

    // Navegación por teclado entre tarjetas: flechas mueven el enfoque.
    rejilla.addEventListener('keydown', (evento) => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(evento.key)) return;
      const tarjetas = Array.from(rejilla.querySelectorAll('.libro'));
      const indice = tarjetas.indexOf(document.activeElement);
      if (indice === -1) return;
      evento.preventDefault();
      const columnas = (this._modoVista === 'lista') ? 1 : Math.max(1, Math.floor(rejilla.offsetWidth / 200));
      let siguiente = indice;
      if (evento.key === 'ArrowRight') siguiente = indice + 1;
      if (evento.key === 'ArrowLeft') siguiente = indice - 1;
      if (evento.key === 'ArrowDown') siguiente = indice + columnas;
      if (evento.key === 'ArrowUp') siguiente = indice - columnas;
      if (tarjetas[siguiente]) tarjetas[siguiente].focus();
    });
    piezas.push(rejilla);
    this.aplicarModoVista();

    // Paginacion simple
    const desde = datos.offset + 1;
    const hasta = datos.offset + datos.libros.length;

    if (this.estado.limite < 24 || datos.offset > 0) {
      piezas.push(crear('div', { clase: 'paginacion' }, [
        crear('button', {
          clase: 'boton boton--secundario boton--pequeno',
          type: 'button',
          texto: 'Anterior',
          disabled: datos.offset === 0,
          onclick: () => {
            this.estado.offset = Math.max(0, datos.offset - this.estado.limite);
            this.buscar();
          }
        }),
        crear('span', { texto: `${desde}-${hasta}` }),
        crear('button', {
          clase: 'boton boton--secundario boton--pequeno',
          type: 'button',
          texto: 'Siguiente',
          disabled: hasta >= datos.libros.length && datos.libros.length < this.estado.limite,
          onclick: () => {
            this.estado.offset = datos.offset + this.estado.limite;
            this.buscar();
          }
        })
      ]));
    }

    contenedor.replaceChildren(...piezas);
  },

  tarjetaLibro(libro) {
    const { crear } = UI;
    const estadoTexto = (UI.ETIQUETAS && UI.ETIQUETAS[libro.estado]) || libro.estado;

    return crear('button', {
      clase: 'libro',
      type: 'button',
      'aria-label': `${libro.titulo}, de ${libro.autor}. Código ${libro.codigo}. ${estadoTexto}. Abrir ficha.`,
      onclick: () => this.verDetalle(libro.id)
    }, [
      UI.portada(libro),
      crear('div', { clase: 'libro__cuerpo' }, [
        crear('span', { clase: 'libro__titulo', texto: libro.titulo }),
        crear('span', { clase: 'libro__autor', texto: libro.autor }),
        crear('div', { clase: 'libro__pie' }, [
          crear('span', { clase: 'libro__codigo', texto: libro.codigo }),
          UI.insignia(libro.estado)
        ]),
        crear('span', {
          clase: 'texto-suave',
          texto: `${libro.disponibles} de ${libro.cantidad} ejemplar(es) disponible(s)`
        })
      ])
    ]);
  },

  /** Ficha completa del libro dentro de una ventana modal. */
  async verDetalle(id) {
    const { crear } = UI;
    const cuerpo = crear('p', { clase: 'cargando', texto: 'Cargando informacion del libro...' });
    UI.abrirModal('Ficha del libro', cuerpo);

    try {
      const { libro } = await Api.libro(id);
      UI.abrirModal(libro.titulo, this.construirDetalle(libro));
    } catch (error) {
      UI.cerrarModal();
      UI.errorApi(error);
    }
  },

  construirDetalle(libro) {
    const { crear } = UI;

    const datos = crear('dl', { clase: 'ficha__datos' }, [
      dato('Codigo', libro.codigo),
      dato('Autor', libro.autor),
      dato('Categoria', libro.categoria),
      dato('Anio', UI.oTexto(libro.anio)),
      dato('Editorial', UI.oTexto(libro.editorial)),
      dato('Ejemplares', `${libro.cantidad} registrado(s)`),
      dato('Disponibles', `${libro.disponibles} disponible(s), ${libro.prestados} prestado(s)`)
    ]);

    const descripcion = libro.descripcion
      ? crear('p', { clase: 'texto-suave', texto: libro.descripcion })
      : null;

    const prestamoActual = libro.prestamo_actual
      ? crear('div', { clase: 'tarjeta' }, [
          crear('p', {}, [
            crear('strong', { texto: 'Ejemplar prestado actualmente' })
          ]),
          crear('p', { clase: 'texto-suave', texto: `Estudiante: ${libro.prestamo_actual.estudiante_nombre}` }),
          crear('p', { clase: 'texto-suave', texto: `Curso: ${libro.prestamo_actual.estudiante_curso}` }),
          crear('p', { clase: 'texto-suave', texto: `Debe devolverse: ${UI.fecha(libro.prestamo_actual.fecha_limite)}` })
        ])
      : null;

    const acciones = crear('div', { clase: 'fila-botones' }, [
      crear('button', {
        clase: `boton ${libro.disponibles > 0 ? 'boton--primario' : 'boton--secundario'}`,
        type: 'button',
        texto: 'Registrar prestamo',
        disabled: libro.disponibles === 0,
        onclick: () => {
          UI.cerrarModal();
          window.location.hash = `#/prestamos?libro=${libro.id}`;
        }
      }),
      crear('button', {
        clase: 'boton boton--secundario',
        type: 'button',
        texto: 'Ver en el catalogo',
        onclick: () => {
          UI.cerrarModal();
          window.location.hash = `#/catalogo?q=${encodeURIComponent(libro.codigo)}`;
        }
      })
    ]);

    const piezas = [
      crear('div', { clase: 'ficha' }, [UI.portada(libro, 'ficha__portada'), datos]),
      descripcion,
      prestamoActual,
      acciones
    ];

    if (libro.relacionados && libro.relacionados.length) {
      piezas.push(crear('hr', { clase: 'separador' }));
      piezas.push(crear('h3', { texto: 'Libros que tambien le pueden interesar' }));
      piezas.push(crear('p', {
        clase: 'texto-suave',
        texto: 'Sugerencias por categoria, autor y palabras del titulo.'
      }));
      piezas.push(crear('div', { clase: 'estrellas' }, libro.relacionados.map((sugerido) => {
        const tarjeta = crear('button', {
          clase: 'libro',
          type: 'button',
          onclick: () => this.verDetalle(sugerido.id)
        }, [
          UI.portada(sugerido, 'celda-libro__miniatura'),
          crear('div', { clase: 'libro__cuerpo' }, [
            crear('span', { clase: 'libro__titulo', texto: sugerido.titulo }),
            crear('span', { clase: 'texto-suave', texto: sugerido.motivo_recomendacion })
          ])
        ]);
        tarjeta.style.width = '100%';
        return tarjeta;
      })));
    }

    return crear('div', {}, piezas);
  }
};

// ---------- Ayudantes locales ----------
function dato(etiqueta, valor) {
  return UI.crear('div', { clase: 'dato' }, [
    UI.crear('dt', { texto: etiqueta }),
    UI.crear('dd', { texto: valor })
  ]);
}

function crearTexto(clase, texto) {
  return UI.crear('p', { clase, texto });
}