'use strict';

/**
 * Vista de prestamos y devoluciones (RF05, RF06, RF07, RF10).
 * Incluye el formulario de registro, la lista de prestamos con filtros
 * y las acciones de devolucion y renovacion.
 */

Vistas.prestamos = {
  titulo: 'Prestamos y devoluciones',
  descripcion: 'Registre prestamos, controle las fechas y devuelva los libros.',

  filtros: { situacion: 'activo', codigo: '', cedula: '', orden: 'recientes' },
  libroPreseleccionado: null,

  async render(contenedor, parametros = {}) {
    this.libroPreseleccionado = parametros.libro ? Number(parametros.libro) : null;

    const { crear } = UI;

    contenedor.replaceChildren(
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      this.construirFormulario(),
      this.construirLista()
    );

    await this.cargarLista();
    if (this.libroPreseleccionado) this.seleccionarLibro(this.libroPreseleccionado);
  },

  // ---------------------------------------------------------------
  // Formulario de prestamo
  // ---------------------------------------------------------------
  construirFormulario() {
    const { crear } = UI;
    this.campos = {};

    const contenedorCampos = crear('div', { clase: 'rejilla-formulario' }, [
      this.campos.nombre = UI.campo({
        etiqueta: 'Nombre completo', nombre: 'nombre', requerido: true,
        ayuda: 'Solo se guardan los datos necesarios para el préstamo.'
      }),
      this.campos.cedula = UI.campo({
        etiqueta: 'Cédula', nombre: 'cedula', tipo: 'tel', requerido: true,
        ayuda: 'Entre 6 y 10 dígitos.'
      }),
      this.campos.curso = UI.campo({
        etiqueta: 'Curso', nombre: 'curso', requerido: true,
        opciones: ['', '1ro de Bachillerato', '2do de Bachillerato', '3ro de Bachillerato',
          '4to de Bachillerato', '5to de Bachillerato', '6to de Bachillerato',
          '1ro de Técnico', '2do de Técnico', '3ro de Técnico', '4to de Técnico', 'Otros']
      }),
      this.campos.dias = UI.campo({
        etiqueta: 'Días de préstamo', nombre: 'dias_prestamo', tipo: 'number', valor: 7, requerido: true
      }),
      this.campos.fecha = UI.campo({
        etiqueta: 'Fecha del préstamo', nombre: 'fecha_prestamo', tipo: 'date', valor: UI.hoy()
      })
    ]);

    this.campoLibro = UI.campo({
      etiqueta: 'Libro a prestar', nombre: 'libro_busqueda', requerido: true,
      ayuda: 'Escriba el título, el autor o el código y elija de la lista.'
    });

    const entradaLibro = this.campoLibro.querySelector('input');
    entradaLibro.setAttribute('autocomplete', 'off');

    this.libroSeleccionado = null;
    this.divSeleccion = crear('div');
    this.divSugerencias = crear('div', { clase: 'resultados-sugeridos' });
    this.divSugerencias.hidden = true;

    let temporizador = null;
    entradaLibro.addEventListener('input', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => this.buscarLibros(entradaLibro.value.trim()), 300);
    });

    entradaLibro.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') this.divSugerencias.hidden = true;
    });

    document.addEventListener('click', (evento) => {
      if (!this.divSugerencias.contains(evento.target) && evento.target !== entradaLibro) {
        this.divSugerencias.hidden = true;
      }
    });

    this.formulario = crear('form', {
      novalidate: true,
      onsubmit: (evento) => {
        evento.preventDefault();
        this.enviarPrestamo();
      }
    }, [
      crear('div', { clase: 'grupo-campos' }, [
        crear('div', { clase: 'bloque-busqueda-libro' }, [this.campoLibro, this.divSugerencias, this.divSeleccion]),
        contenedorCampos,
        crear('div', { clase: 'fila-botones' }, [
          crear('button', { clase: 'boton boton--primario', type: 'submit', texto: 'Registrar préstamo' }),
          crear('button', {
            clase: 'boton boton--secundario',
            type: 'button',
            texto: 'Limpiar formulario',
            onclick: () => this.limpiarFormulario()
          })
        ])
      ])
    ]);

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Registrar un préstamo' }),
      this.formulario
    ]);
  },

  async buscarLibros(texto) {
    const { crear } = UI;

    if (!texto || texto.length < 2) {
      this.divSugerencias.hidden = true;
      return;
    }

    try {
      const datos = await Api.catalogo({ q: texto, estado: 'disponible', limite: 8 });

      if (!datos.libros.length) {
        this.divSugerencias.hidden = false;
        this.divSugerencias.replaceChildren(crearTexto('texto-suave', 'No hay libros disponibles con ese texto.'));
        return;
      }

      this.divSugerencias.hidden = false;
      this.divSugerencias.replaceChildren(...datos.libros.map((libro) => crear('button', {
        type: 'button',
        onclick: () => this.elegirLibro(libro)
      }, [
        crear('strong', { texto: libro.titulo }),
        crear('br'),
        crear('small', { texto: `${libro.autor} · ${libro.codigo} · ${libro.categoria || 'Sin categoría'}` })
      ])));
    } catch (error) {
      UI.errorApi(error);
    }
  },

  elegirLibro(libro) {
    const entrada = this.campoLibro.querySelector('input');
    entrada.value = `${libro.codigo} - ${libro.titulo}`;
    this.divSugerencias.hidden = true;
    this.pintarLibroSeleccionado(libro);
  },

  pintarLibroSeleccionado(libro) {
    const { crear } = UI;
    this.libroSeleccionado = libro;

    this.divSeleccion.replaceChildren(crear('div', { clase: 'libro-seleccionado' }, [
      crear('div', {}, [
        crear('strong', { texto: libro.titulo }),
        crear('div', { clase: 'texto-suave', texto: `${libro.autor} · ${libro.codigo}` })
      ]),
      crear('span', { estilo: 'margin-left:auto' }, [UI.insignia(libro.estado)]),
      crear('button', {
        clase: 'boton boton--pequeno boton--peligro',
        type: 'button',
        texto: 'Cambiar',
        onclick: () => this.seleccionarLibro(null)
      })
    ]));
  },

  /** Permite elegir el libro desde el enlace que llega del catalogo. */
  async seleccionarLibro(id) {
    try {
      const { libro } = await Api.libro(id);
      const entrada = this.campoLibro.querySelector('input');
      entrada.value = `${libro.codigo} - ${libro.titulo}`;
      this.pintarLibroSeleccionado(libro);
      UI.desplazarA(this.campoLibro);
    } catch (error) {
      UI.errorApi(error);
    }
  },

  /** Lee el valor escrito en uno de los campos del formulario. */
  valor(campo) {
    const entrada = this.campos[campo] && this.campos[campo].querySelector('input, select, textarea');
    return entrada ? String(entrada.value).trim() : '';
  },

  limpiarFormulario() {
    this.formulario.reset();
    this.libroSeleccionado = null;
    this.divSeleccion.replaceChildren();
    this.divSugerencias.hidden = true;
    UI.marcarErrores(this.formulario, []);
    this.campos.fecha.querySelector('input').value = UI.hoy();
    this.campos.dias.querySelector('input').value = 7;
  },

  async enviarPrestamo() {
    const boton = this.formulario.querySelector('button[type="submit"]');

    if (!this.libroSeleccionado) {
      UI.alerta('Seleccione un libro de la lista de sugerencias.');
      return;
    }

    const cuerpo = {
      libro_id: this.libroSeleccionado.id,
      nombre: this.valor('nombre'),
      cedula: this.valor('cedula'),
      curso: this.valor('curso'),
      fecha_prestamo: this.valor('fecha_prestamo') || UI.hoy(),
      dias_prestamo: Number(this.valor('dias_prestamo')) || 7
    };

    boton.disabled = true;
    boton.textContent = 'Registrando...';

    try {
      const resultado = await Api.registrarPrestamo(cuerpo);
      UI.exito(resultado.aviso);
      this.limpiarFormulario();
      await this.cargarLista();
    } catch (error) {
      if (error instanceof Api.ErrorApi && error.detalles.length) {
        UI.marcarErrores(this.formulario, error.detalles);
      }
      UI.errorApi(error);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Registrar préstamo';
    }
  },

  // ---------------------------------------------------------------
  // Lista de prestamos
  // ---------------------------------------------------------------
  construirLista() {
    const { crear } = UI;

    const opciones = [
      ['activo', 'Préstamos activos'],
      ['atrasado', 'Atrasados'],
      ['por_vencer', 'Por vencer (hoy o mañana)'],
      ['devuelto', 'Devueltos'],
      ['', 'Todos']
    ];

    const selectorSituacion = crear('select', { 'aria-label': 'Filtrar por situacion' },
      opciones.map(([valor, texto]) => crear('option', { value: valor, texto })));
    selectorSituacion.value = this.filtros.situacion;
    selectorSituacion.addEventListener('change', () => {
      this.filtros.situacion = selectorSituacion.value;
      this.cargarLista();
    });

    const entradaCodigo = crear('input', {
      type: 'search',
      placeholder: 'Código del libro',
      'aria-label': 'Filtrar por codigo',
      value: this.filtros.codigo,
      style: 'max-width:180px'
    });
    entradaCodigo.addEventListener('input', () => {
      clearTimeout(this.temporizador);
      this.temporizador = setTimeout(() => {
        this.filtros.codigo = entradaCodigo.value.trim();
        this.cargarLista();
      }, 350);
    });

    const entradaCedula = crear('input', {
      type: 'search',
      placeholder: 'Cédula del estudiante',
      'aria-label': 'Filtrar por cedula',
      value: this.filtros.cedula,
      style: 'max-width:180px'
    });
    entradaCedula.addEventListener('input', () => {
      clearTimeout(this.temporizadorCedula);
      this.temporizadorCedula = setTimeout(() => {
        this.filtros.cedula = entradaCedula.value.trim();
        this.cargarLista();
      }, 350);
    });

    this.contenedorLista = crear('div', {}, [crearTexto('cargando', 'Cargando préstamos...')]);

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Listado de préstamos' }),
      crear('div', { clase: 'filtros' }, [selectorSituacion, entradaCodigo, entradaCedula]),
      this.contenedorLista
    ]);
  },

  async cargarLista() {
    if (!this.contenedorLista) return;
    this.contenedorLista.replaceChildren(crearTexto('cargando', 'Cargando préstamos...'));

    try {
      const datos = await Api.prestamos({
        situacion: this.filtros.situacion,
        codigo: this.filtros.codigo,
        cedula: this.filtros.cedula,
        limite: 100
      });

      this.pintarLista(datos.prestamos);
    } catch (error) {
      this.contenedorLista.replaceChildren(UI.vacio('No se pudo consultar la lista de préstamos.'));
      UI.errorApi(error);
    }
  },

  pintarLista(prestamos) {
    const { crear } = UI;

    if (!prestamos.length) {
      this.contenedorLista.replaceChildren(UI.vacio('No hay préstamos que coincidan con los filtros.'));
      return;
    }

    const filas = prestamos.map((prestamo) => {
      const acciones = [];

      if (prestamo.estado === 'activo') {
        acciones.push(crear('button', {
          clase: 'boton boton--exito boton--pequeno',
          type: 'button',
          texto: 'Devuelto',
          onclick: () => this.confirmarDevolucion(prestamo)
        }));
        acciones.push(crear('button', {
          clase: 'boton boton--secundario boton--pequeno',
          type: 'button',
          texto: 'Renovar',
          onclick: () => this.renovar(prestamo)
        }));
      }

      return crear('tr', {}, [
        crear('td', {}, [crear('div', { clase: 'celda-libro' }, [
          crear('div', {
            clase: 'celda-libro__miniatura',
            texto: prestamo.titulo.slice(0, 2).toUpperCase()
          }),
          crear('div', {}, [
            crear('div', { clase: 'celda-libro__titulo', texto: prestamo.titulo }),
            crear('div', { clase: 'celda-libro__codigo', texto: prestamo.codigo })
          ])
        ])]),
        crear('td', {}, [
          crear('div', { texto: prestamo.estudiante_nombre }),
          crear('div', { clase: 'texto-suave', texto: prestamo.estudiante_curso }),
          crear('div', { clase: 'celda-libro__codigo', texto: prestamo.cedula })
        ]),
        crear('td', { texto: UI.fecha(prestamo.fecha_prestamo) }),
        crear('td', {}, [
          crear('div', { texto: UI.fecha(prestamo.fecha_limite) }),
          prestamo.estado === 'activo'
            ? crear('div', { clase: 'texto-suave', texto: this.detallePlazo(prestamo) })
            : null
        ]),
        crear('td', {}, [UI.insignia(prestamo.situacion)]),
        crear('td', { clase: 'acciones' }, acciones)
      ]);
    });

    this.contenedorLista.replaceChildren(crear('div', { clase: 'tabla-envoltura' }, [
      crear('table', {}, [
        crear('thead', {}, [crear('tr', {}, [
          crear('th', { texto: 'Libro' }),
          crear('th', { texto: 'Estudiante' }),
          crear('th', { texto: 'Prestado' }),
          crear('th', { texto: 'Debe devolver' }),
          crear('th', { texto: 'Situación' }),
          crear('th', { texto: 'Acciones' })
        ])]),
        crear('tbody', {}, filas)
      ])
    ]));
  },

  detallePlazo(prestamo) {
    if (prestamo.situacion === 'atrasado') {
      return `${prestamo.dias_retraso} día(s) de atraso`;
    }
    if (prestamo.situacion === 'por_vencer') return 'Vence hoy o mañana';
    const dias = prestamo.dias_restantes;
    return dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`;
  },

  confirmarDevolucion(prestamo) {
    const { crear } = UI;

    const campoFecha = UI.campo({ etiqueta: 'Fecha de devolución', nombre: 'fecha_devolucion', tipo: 'date' });
    campoFecha.querySelector('input').value = UI.hoy();
    campoFecha.querySelector('input').max = UI.hoy();

    const contenido = crear('form', {
      onsubmit: (evento) => {
        evento.preventDefault();
        UI.cerrarModal();
        this.registrarDevolucion(prestamo.id, campoFecha.querySelector('input').value);
      }
    }, [
      crear('p', { texto: `¿Registrar la devolución de "${prestamo.titulo}"?` }),
      crear('p', { clase: 'texto-suave', texto: `Estudiante: ${prestamo.estudiante_nombre} (${prestamo.cedula})` }),
      campoFecha,
      crear('div', { clase: 'fila-botones' }, [
        crear('button', { clase: 'boton boton--exito', type: 'submit', texto: 'Confirmar devolución' }),
        crear('button', { clase: 'boton boton--secundario', type: 'button', texto: 'Cancelar', onclick: UI.cerrarModal })
      ])
    ]);

    UI.abrirModal('Registrar devolución', contenido);
  },

  async registrarDevolucion(prestamoId, fechaDevolucion) {
    try {
      const resultado = await Api.registrarDevolucion(prestamoId, { fecha_devolucion: fechaDevolucion });
      UI.exito(resultado.aviso);
      await this.cargarLista();
    } catch (error) {
      UI.errorApi(error);
    }
  },

  async renovar(prestamo) {
    try {
      const resultado = await Api.renovarPrestamo(prestamo.id, 7);
      UI.exito(resultado.aviso);
      await this.cargarLista();
    } catch (error) {
      UI.errorApi(error);
    }
  }
};

function crearTexto(clase, texto) {
  return UI.crear('p', { clase, texto });
}