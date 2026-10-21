'use strict';

/**
 * Vista de usuarios: busca estudiantes por nombre y muestra su curso y sus
 * préstamos en una ficha. Por privacidad, la cédula nunca se muestra en los
 * listados: solo se usa internamente para enlazar con sus préstamos.
 */

window.Vistas = window.Vistas || {};

Vistas.usuarios = {
  titulo: 'Usuarios',
  descripcion: 'Estudiantes registrados en los préstamos de la biblioteca.',

  async render(contenedor) {
    const { crear } = UI;

    const entrada = crear('input', {
      type: 'search',
      name: 'q',
      placeholder: 'Buscar por nombre del estudiante…',
      'aria-label': 'Buscar estudiantes por nombre',
      autocomplete: 'off'
    });

    const buscador = crear('form', {
      clase: 'buscador',
      onsubmit: (evento) => {
        evento.preventDefault();
        this.buscar(entrada.value.trim());
      }
    }, [
      crear('div', { clase: 'buscador__campo' }, [entrada]),
      crear('button', { clase: 'boton boton--primario', type: 'submit', texto: 'Buscar' })
    ]);

    this.contenedorLista = crear('div', { role: 'status', 'aria-live': 'polite' }, [
      crear('p', { clase: 'cargando', texto: 'Cargando usuarios…' })
    ]);

    contenedor.replaceChildren(
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      buscador,
      this.contenedorLista
    );

    let temporizador = null;
    entrada.addEventListener('input', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => this.buscar(entrada.value.trim()), 350);
    });

    await this.buscar('');
  },

  async buscar(nombre) {
    const contenedor = this.contenedorLista;
    if (!contenedor) return;
    const { crear } = UI;
    contenedor.replaceChildren(crear('p', { clase: 'cargando', texto: 'Buscando usuarios…' }));

    try {
      const datos = await Api.estudiantes({ q: nombre });
      const lista = (datos && datos.estudiantes) || [];
      if (!lista.length) {
        contenedor.replaceChildren(UI.vacio(
          nombre
            ? `No se encontraron usuarios para "${nombre}".`
            : 'Todavía no hay usuarios registrados.'
        ));
        return;
      }
      contenedor.replaceChildren(crear('div', { clase: 'usuarios' }, lista.map((e) =>
        crear('div', { clase: 'usuario' }, [
          crear('span', { clase: 'usuario__avatar', texto: (e.nombre || '?').trim().charAt(0).toUpperCase(), 'aria-hidden': 'true' }),
          crear('div', { clase: 'usuario__datos' }, [
            crear('span', { clase: 'usuario__nombre', texto: e.nombre }),
            crear('span', { clase: 'usuario__curso', texto: e.curso || 'Sin curso' })
          ]),
          crear('div', { clase: 'fila-botones' }, [
            crear('button', {
              clase: 'boton boton--secundario boton--pequeno', type: 'button',
              texto: 'Historial',
              onclick: () => this.verHistorial(e.id, e.nombre)
            }),
            crear('a', {
              clase: 'boton boton--secundario boton--pequeno',
              href: `#/prestamos?cedula=${encodeURIComponent(e.cedula)}`,
              texto: 'Préstamos'
            })
          ])
        ])
      )));
    } catch (error) {
      contenedor.replaceChildren(UI.vacio('No se pudo consultar la lista de usuarios.'));
      UI.errorApi(error);
    }
  },

  async verHistorial(id, nombre) {
    const { crear } = UI;
    UI.abrirModal(`Historial de ${nombre}`, crear('p', { clase: 'cargando', texto: 'Cargando historial…' }));
    try {
      const datos = await Api.historial(id);
      const prestamos = (datos && datos.prestamos) || [];
      if (!prestamos.length) {
        UI.abrirModal(`Historial de ${nombre}`, UI.vacio('Este usuario aún no tiene préstamos registrados.'));
        return;
      }
      const hoy = new Date().toISOString().slice(0, 10);
      const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const situacionDe = (p) => {
        if (p.estado === 'devuelto' || p.fecha_devolucion) return 'devuelto';
        if (p.fecha_limite < hoy) return 'atrasado';
        if (p.fecha_limite <= manana) return 'por_vencer';
        return 'vigente';
      };
      UI.abrirModal(`Historial de ${nombre}`, crear('div', { clase: 'atencion' }, prestamos.map((p) => {
        const situacion = situacionDe(p);
        return crear('div', { clase: 'atencion__item' }, [
          UI.insignia(situacion),
          crear('span', { clase: 'atencion__codigo', texto: p.codigo }),
          crear('span', { clase: 'atencion__titulo', texto: p.titulo }),
          crear('span', { clase: 'atencion__detalle', texto: `Prestado: ${UI.fecha(p.fecha_prestamo)} · Límite: ${UI.fecha(p.fecha_limite)}` })
        ]);
      })));
    } catch (error) {
      UI.cerrarModal();
      UI.errorApi(error);
    }
  }
};
