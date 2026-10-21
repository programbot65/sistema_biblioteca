'use strict';

/**
 * Vista de reportes: el detalle de la biblioteca en un solo lugar.
 * Reutiliza las piezas del panel con los mismos datos reales:
 * avisos, disponibilidad, movimientos, más prestados, actividad por día,
 * estudiantes activos y novedades. Todo es de solo lectura.
 */

window.Vistas = window.Vistas || {};

Vistas.reportes = {
  titulo: 'Reportes',
  descripcion: 'Detalle de préstamos, disponibilidad y actividad de la biblioteca.',

  async render(contenedor) {
    const { crear } = UI;
    contenedor.replaceChildren(
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      crear('p', { clase: 'cargando', texto: 'Generando los reportes…' })
    );

    try {
      const datos = await Api.panel();
      let recientes = [];
      try {
        const respuesta = await Api.catalogo({ orden: 'recientes', limite: 6 });
        recientes = respuesta.libros || [];
      } catch (errorRecientes) {
        recientes = [];
      }
      const P = Vistas.panel;
      contenedor.replaceChildren(
        crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
        crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
        crear('div', { clase: 'escritorio' }, [
          P.atencion(datos.ultimos_prestamos),
          crear('div', { clase: 'escritorio__doble' }, [
            P.pulso(datos.resumen),
            P.estanteria(datos.mas_prestados)
          ]),
          P.pilaDePrestamos(datos.ultimos_prestamos),
          crear('div', { clase: 'escritorio__doble escritorio__doble--invertido' }, [
            P.compartimentos(datos.por_categoria),
            P.registro(datos.prestamos_por_dia)
          ]),
          P.carnes(datos.estudiantes_mas_activos),
          P.recientes(recientes)
        ])
      );
    } catch (error) {
      contenedor.replaceChildren(
        crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
        Piezas.vacio({ mensaje: 'No se pudieron generar los reportes.' })
      );
      UI.errorApi(error);
    }
  }
};
