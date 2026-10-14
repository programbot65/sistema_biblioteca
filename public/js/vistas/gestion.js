'use strict';

/**
 * Vista de gestion del encargado de biblioteca (RF04).
 * Permite registrar, actualizar y dar de baja libros, ademas de crear
 * categorias. Se protege con una clave sencilladefined en el proyecto.
 */

Vistas.gestion = {
  titulo: 'Administración del catálogo',
  descripcion: 'Registre y actualice los libros. Acceso exclusivo del encargado.',

  categorias: [],

  async render(contenedor) {
    if (!Api.claveAdmin.valor) {
      contenedor.replaceChildren(crearTextoVista(), this.construirAcceso());
      return;
    }
    await this.mostrarFormulario();
  },

  construirAviso() {
    const { crear } = UI;
    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Acceso del encargado' }),
      crear('p', {
        clase: 'texto-suave',
        texto: 'La clave protege las operaciones que modifican el catálogo. Si se ha olvidado, modifique la variable ADMIN_KEY al iniciar el servidor.'
      }),
      crear('div', { clase: 'fila-botones' }, [
        crear('button', {
          clase: 'boton boton--peligro',
          type: 'button',
          texto: 'Salir del modo gestión',
          onclick: () => {
            Api.claveAdmin.limpiar();
            UI.exito('Se cerró la sesión de gestión.');
            this.render(document.getElementById('contenido'));
          }
        })
      ])
    ]);
  },

  construirAcceso() {
    const { crear } = UI;

    const entrada = crear('input', {
      type: 'password',
      name: 'clave',
      placeholder: 'Clave del encargado',
      'aria-label': 'Clave del encargado',
      autocomplete: 'current-password'
    });

    const formulario = crear('form', {
      class: 'acceso',
      onsubmit: (evento) => {
        evento.preventDefault();
        if (!entrada.value.trim()) {
          UI.alerta('Escriba la clave para continuar.');
          return;
        }
        Api.claveAdmin.guardar(entrada.value.trim());
        this.mostrarFormulario();
      }
    }, [
      crear('div', { clase: 'campo' }, [
        crear('label', { for: 'clave-admin', texto: 'Clave de administración' }),
        entrada,
        crear('span', { clase: 'campo__ayuda', texto: 'Clave por defecto del proyecto: ueea2026' })
      ]),
      crear('button', { clase: 'boton boton--primario', type: 'submit', texto: 'Entrar' })
    ]);

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Ingrese la clave para gestionar el catálogo' }),
      formulario
    ]);
  },

  async mostrarFormulario() {
    const { crear } = UI;
    const contenedor = document.getElementById('contenido');

    if (!this.categorias.length) {
      try {
        const datos = await Api.categorias();
        this.categorias = datos.categorias;
      } catch (error) {
        this.categorias = [];
      }
    }

    contenedor.replaceChildren(
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      this.construirFormularioLibro(),
      this.construirFormularioCategoria(),
      this.construirAviso()
    );

    await this.cargarLista();
  },

  construirFormularioLibro() {
    const { crear } = UI;

    this.libroEditando = null;

    const entradaCodigo = crear('input', {
      type: 'text', name: 'codigo', required: true, placeholder: 'Ejemplo: LIT-001',
      autocomplete: 'off'
    });
    const entradaTitulo = crear('input', { type: 'text', name: 'titulo', required: true });
    const entradaAutor = crear('input', { type: 'text', name: 'autor', required: true });
    const entradaAnio = crear('input', { type: 'number', name: 'anio', min: '1000', max: '2100', placeholder: '2020' });
    const entradaEditorial = crear('input', { type: 'text', name: 'editorial' });
    const entradaCantidad = crear('input', { type: 'number', name: 'cantidad', min: '1', max: '99', value: '1' });
    const entradaPortada = crear('input', { type: 'text', name: 'portada', placeholder: 'Opcional: ruta o dirección de la imagen' });
    const entradaDescripcion = crear('textarea', { name: 'descripcion', rows: '3' });
    const selectorCategoria = crear('select', { name: 'categoria_id' }, [
      crear('option', { value: '', texto: 'Sin categoría' }),
      ...this.categorias.map((categoria) =>
        crear('option', { value: categoria.id, texto: categoria.nombre })
      )
    ]);

    this.mensajeFormulario = crear('p', { clase: 'texto-suave' });
    this.botonGuardar = crear('button', { clase: 'boton boton--primario', type: 'submit', texto: 'Registrar libro' });

    this.formularioLibro = crear('form', {
      novalidate: true,
      onsubmit: (evento) => {
        evento.preventDefault();
        this.guardarLibro({
          codigo: entradaCodigo.value.trim(),
          titulo: entradaTitulo.value.trim(),
          autor: entradaAutor.value.trim(),
          anio: entradaAnio.value.trim(),
          editorial: entradaEditorial.value.trim(),
          cantidad: entradaCantidad.value.trim(),
          portada: entradaPortada.value.trim(),
          descripcion: entradaDescripcion.value.trim(),
          categoria_id: selectorCategoria.value
        });
      }
    }, [
      crear('div', { clase: 'rejilla-formulario' }, [
        campoConEntrada('Código del ejemplar', entradaCodigo, 'Debe ser único, sin espacios.'),
        campoConEntrada('Título', entradaTitulo, null, true),
        campoConEntrada('Autor', entradaAutor, null, true),
        campoConEntrada('Categoría', selectorCategoria, null, false),
        campoConEntrada('Número de ejemplares', entradaCantidad, 'Ejemplares que comparten este código.')
      ]),
      // Datos secundarios agrupados: no estorban el registro habitual,
      // pero siguen en el mismo formulario y se guardan igual.
      crear('details', { clase: 'datos-opcionales' }, [
        crear('summary', { clase: 'datos-opcionales__resumen' }, [
          crear('span', { texto: 'Datos opcionales del libro' }),
          crear('span', { clase: 'texto-suave', texto: 'Año, editorial, portada y sinopsis' })
        ]),
        crear('div', { clase: 'rejilla-formulario' }, [
          campoConEntrada('Año de publicación', entradaAnio),
          campoConEntrada('Editorial', entradaEditorial),
          campoConEntrada('Portada (opcional)', entradaPortada)
        ]),
        campoConEntrada('Descripción / sinopsis', entradaDescripcion)
      ]),
      this.mensajeFormulario,
      crear('div', { clase: 'fila-botones' }, [
        this.botonGuardar,
        crear('button', {
          clase: 'boton boton--secundario',
          type: 'button',
          texto: 'Limpiar',
          onclick: () => this.limpiarFormulario()
        })
      ])
    ]);

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Registrar un libro nuevo' }),
      this.formularioLibro
    ]);
  },

  limpiarFormulario() {
    this.formularioLibro.reset();
    this.formularioLibro.querySelector('[name="cantidad"]').value = '1';
    this.libroEditando = null;
    this.botonGuardar.textContent = 'Registrar libro';
    UI.marcarErrores(this.formularioLibro, []);
    this.mensajeFormulario.textContent = '';
  },

  async guardarLibro(datos) {
    const cuerpo = {
      codigo: datos.codigo,
      titulo: datos.titulo,
      autor: datos.autor,
      categoria_id: datos.categoria_id || '',
      anio: datos.anio || '',
      editorial: datos.editorial,
      cantidad: datos.cantidad || 1,
      portada: datos.portada,
      descripcion: datos.descripcion
    };

    this.botonGuardar.disabled = true;

    try {
      if (this.libroEditando) {
        const resultado = await Api.actualizarLibro(this.libroEditando, cuerpo);
        UI.exito(resultado.mensaje);
      } else {
        const resultado = await Api.crearLibro(cuerpo);
        UI.exito(resultado.mensaje);
      }
      this.limpiarFormulario();
      await this.cargarLista();
    } catch (error) {
      if (error instanceof Api.ErrorApi && error.detalles.length) {
        UI.marcarErrores(this.formularioLibro, error.detalles);
      }
      UI.errorApi(error);
    } finally {
      this.botonGuardar.disabled = false;
    }
  },

  /** Carga los datos de un libro en el formulario para editarlo. */
  async editarLibro(id) {
    try {
      const { libro } = await Api.libro(id);
      const formulario = this.formularioLibro;
      formulario.querySelector('[name="codigo"]').value = libro.codigo;
      formulario.querySelector('[name="titulo"]').value = libro.titulo;
      formulario.querySelector('[name="autor"]').value = libro.autor;
      formulario.querySelector('[name="anio"]').value = libro.anio || '';
      formulario.querySelector('[name="editorial"]').value = libro.editorial || '';
      formulario.querySelector('[name="cantidad"]').value = libro.cantidad;
      formulario.querySelector('[name="portada"]').value = libro.portada || '';
      formulario.querySelector('[name="descripcion"]').value = libro.descripcion || '';
      formulario.querySelector('[name="categoria_id"]').value = libro.categoria_id || '';

      this.libroEditando = id;
      this.botonGuardar.textContent = 'Guardar cambios';
      this.mensajeFormulario.textContent = `Editando el libro ${libro.codigo}.`;
      UI.desplazarA(formulario);
    } catch (error) {
      UI.errorApi(error);
    }
  },

  async desactivar(libro) {
    const confirmado = window.confirm(
      `¿Dar de baja "${libro.titulo}" (${libro.codigo}) del catálogo?\n\n` +
      'El registro se conserva para no perder el historial de préstamos.'
    );
    if (!confirmado) return;

    try {
      const resultado = await Api.desactivarLibro(libro.id);
      UI.exito(resultado.mensaje);
      await this.cargarLista();
    } catch (error) {
      UI.errorApi(error);
    }
  },

  async reactivar(libro) {
    try {
      const resultado = await Api.reactivarLibro(libro.id);
      UI.exito(resultado.mensaje);
      await this.cargarLista();
    } catch (error) {
      UI.errorApi(error);
    }
  },

  construirFormularioCategoria() {
    const { crear } = UI;

    const entrada = crear('input', {
      type: 'text',
      name: 'nueva_categoria',
      placeholder: 'Ejemplo: Deportes',
      'aria-label': 'Nombre de la nueva categoría'
    });

    const formulario = crear('form', {
      class: 'acceso',
      style: 'max-width:none',
      onsubmit: (evento) => {
        evento.preventDefault();
        const nombre = entrada.value.trim();
        if (!nombre) {
          UI.alerta('Escriba el nombre de la categoría.');
          return;
        }
        this.crearCategoria(nombre, entrada);
      }
    }, [
      crear('div', { clase: 'grupo-campos' }, [
        crear('div', { clase: 'campo' }, [
          crear('label', { texto: 'Nombre de la categoría' }),
          entrada
        ]),
        crear('button', { clase: 'boton boton--secundario', type: 'submit', texto: 'Crear categoría' })
      ])
    ]);

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Categorías' }),
      crear('p', { clase: 'texto-suave', texto: 'Categorías registradas actualmente:' }),
      crear('div', { clase: 'estrellas' }, this.categorias.map((categoria) =>
        crear('span', { clase: 'insignia insignia--categoria', texto: `${categoria.nombre} (${categoria.total_libros})` })
      )),
      crear('hr', { clase: 'separador' }),
      crear('p', { clase: 'texto-suave', texto: 'Crear una categoría nueva:' }),
      formulario
    ]);
  },

  async crearCategoria(nombre, entrada) {
    try {
      const resultado = await Api.crearCategoria({ nombre });
      UI.exito(resultado.mensaje);
      this.categorias = resultado.categorias;
      entrada.value = '';
      await this.mostrarFormulario();
    } catch (error) {
      UI.errorApi(error);
    }
  },

  construirLista() {
    this.contenedorLibros = UI.crear('div', {}, [
      UI.crear('p', { clase: 'cargando', texto: 'Cargando libros...' })
    ]);

    return UI.crear('section', { clase: 'tarjeta' }, [
      UI.crear('h3', { clase: 'tarjeta__titulo', texto: 'Libros registrados' }),
      this.contenedorLibros
    ]);
  },

  async cargarLista() {
    if (!document.getElementById('contenido')) return;
    if (!this.contenedorLibros) {
      const seccion = this.construirLista();
      document.getElementById('contenido').append(seccion);
    }

    this.contenedorLibros.replaceChildren(UI.crear('p', { clase: 'cargando', texto: 'Cargando libros...' }));

    try {
      const datos = await Api.catalogo({ limite: 200, orden: 'titulo' });
      this.pintarLista(datos.libros);
    } catch (error) {
      this.contenedorLibros.replaceChildren(UI.vacio('No se pudo cargar la lista de libros.'));
      UI.errorApi(error);
    }
  },

  pintarLista(libros) {
    const { crear } = UI;

    if (!libros.length) {
      this.contenedorLibros.replaceChildren(UI.vacio('Todavía no hay libros registrados.'));
      return;
    }

    const filas = libros.map((libro) => crear('tr', {}, [
      crear('td', {}, [crear('div', { clase: 'celda-libro__titulo', texto: libro.titulo })]),
      crear('td', { texto: libro.autor }),
      crear('td', { clase: 'celda-libro__codigo', texto: libro.codigo }),
      crear('td', { texto: UI.oTexto(libro.categoria) }),
      crear('td', { texto: `${libro.disponibles} / ${libro.cantidad}` }),
      crear('td', {}, [UI.insignia(libro.estado)]),
      crear('td', { clase: 'acciones' }, [
        crear('button', {
          clase: 'boton boton--secundario boton--pequeno',
          type: 'button',
          texto: 'Editar',
          onclick: () => this.editarLibro(libro.id)
        }),
        crear('button', {
          clase: 'boton boton--peligro boton--pequeno',
          type: 'button',
          texto: 'Dar de baja',
          onclick: () => this.desactivar(libro)
        })
      ])
    ]));

    this.contenedorLibros.replaceChildren(crear('div', { clase: 'tabla-envoltura' }, [
      crear('table', {}, [
        crear('thead', {}, [crear('tr', {}, [
          crear('th', { texto: 'Título' }),
          crear('th', { texto: 'Autor' }),
          crear('th', { texto: 'Código' }),
          crear('th', { texto: 'Categoría' }),
          crear('th', { texto: 'Disp./Total' }),
          crear('th', { texto: 'Estado' }),
          crear('th', { texto: 'Acciones' })
        ])]),
        crear('tbody', {}, filas)
      ])
    ]));
  }
};

function campoConEntrada(etiqueta, entrada, ayuda, requerido) {
  return UI.crear('div', { clase: 'campo' }, [
    UI.crear('label', { texto: etiqueta }),
    entrada,
    ayuda ? UI.crear('span', { clase: 'campo__ayuda', texto: ayuda }) : null,
    UI.crear('span', { clase: 'campo__error' })
  ]);
}

function crearTextoVista() {
  return UI.crear('div', {}, [
    UI.crear('h2', { clase: 'vista__titulo', texto: 'Administración del catálogo' }),
    UI.crear('p', {
      clase: 'vista__descripcion',
      texto: 'Registre y actualice los libros. Acceso exclusivo del encargado.'
    })
  ]);
}