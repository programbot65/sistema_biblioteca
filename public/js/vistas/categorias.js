'use strict';

/**
 * Vista de categorías: cuadrícula real con cada sección de la biblioteca,
 * sus libros disponibles y el enlace al catálogo ya filtrado.
 */

window.Vistas = window.Vistas || {};

Vistas.categorias = {
  titulo: 'Categorías',
  descripcion: 'Explore la biblioteca por secciones.',

  async render(contenedor) {
    const { crear } = UI;
    contenedor.replaceChildren(
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      crear('p', { clase: 'cargando', texto: 'Cargando las secciones…' })
    );

    try {
      const datos = await Api.panel();
      contenedor.replaceChildren(
        crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
        crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
        Vistas.panel.compartimentos(datos.por_categoria)
      );
    } catch (error) {
      contenedor.replaceChildren(
        crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
        Piezas.vacio({ mensaje: 'No se pudieron cargar las categorías.' })
      );
      UI.errorApi(error);
    }
  }
};
