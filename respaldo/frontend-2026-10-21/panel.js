'use strict';

/**
 * Vista del panel principal (RF08).
 *
 * Resumen de la biblioteca con un diseño simple y corriente: tarjetas de
 * cifras, listas y tablas. Todos los datos salen de `GET /api/panel`; no se
 * calcula ni se inventa nada aquí.
 */

window.Vistas = window.Vistas || {};

Vistas.panel = {
  titulo: 'Panel principal',
  descripcion: 'Resumen de la biblioteca: cifras, atención inmediata y movimientos recientes.',

  async render(contenedor) {
    const { crear } = UI;

    contenedor.replaceChildren(
      crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
      crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
      crear('p', { clase: 'cargando', texto: 'Cargando el panel…' })
    );

    try {
      const datos = await Api.panel();
      contenedor.replaceChildren(
        crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
        crear('p', { clase: 'vista__descripcion', texto: this.descripcion }),
        this.construir(datos)
      );
      this.animarCifras(contenedor);
    } catch (error) {
      contenedor.replaceChildren(
        crear('h2', { clase: 'vista__titulo', texto: this.titulo }),
        UI.vacio('No se pudo cargar la información del panel.')
      );
      UI.errorApi(error);
    }
  },

  construir(datos) {
    const { crear } = UI;

    return crear('div', { clase: 'panel' }, [
      this.indicadores(datos.resumen),
      this.atencion(datos.ultimos_prestamos),
      crear('div', { clase: 'panel__doble' }, [
        this.prestamosRecientes(datos.ultimos_prestamos),
        this.masPrestados(datos.mas_prestados)
      ]),
      this.secciones(datos.por_categoria),
      this.estudiantes(datos.estudiantes_mas_activos)
    ]);
  },

  // -------------------------------------------------------------------
  // Tarjetas de cifras
  // -------------------------------------------------------------------
  indicadores(resumen) {
    const { crear } = UI;

    const tarjeta = ({ icono, valor, etiqueta, detalle, tono, enlace }) => {
      const contenido = [
        crear('span', { clase: 'indicador__fila' }, [
          crear('span', { clase: 'indicador__icono' }, [UI.crearSvg(icono)]),
          crear('span', { clase: 'indicador__valor', texto: String(valor) })
        ]),
        crear('span', { clase: 'indicador__etiqueta', texto: etiqueta }),
        crear('span', { clase: 'indicador__detalle', texto: detalle })
      ];

      return enlace
        ? crear('a', {
            clase: `indicador indicador--${tono}`,
            href: enlace,
            'aria-label': `${etiqueta}: ${valor}. ${detalle}`
          }, contenido)
        : crear('div', {
            clase: `indicador indicador--${tono}`,
            'aria-label': `${etiqueta}: ${valor}. ${detalle}`,
            'aria-disabled': 'true'
          }, contenido);
    };

    return crear('div', { clase: 'rejilla-indicadores' }, [
      tarjeta({
        icono: Iconos.disponibles, valor: resumen.disponibles, etiqueta: 'Disponibles',
        detalle: 'listos para prestar', tono: 'verde', enlace: '#/catalogo?estado=disponible'
      }),
      tarjeta({
        icono: Iconos.prestados, valor: resumen.prestados, etiqueta: 'Prestados',
        detalle: `${resumen.porcentaje_prestados}% del catálogo`, tono: 'azul', enlace: '#/prestamos?situacion=activo'
      }),
      tarjeta({
        icono: Iconos.atrasado, valor: resumen.atrasados, etiqueta: 'Atrasados',
        detalle: resumen.atrasados ? 'requieren seguimiento' : 'todo en orden', tono: 'teja', enlace: '#/prestamos?situacion=atrasado'
      }),
      tarjeta({
        icono: Iconos.por_vencer, valor: resumen.por_vencer, etiqueta: 'Por vencer',
        detalle: 'hoy o mañana', tono: 'naranja', enlace: '#/prestamos?situacion=por_vencer'
      }),
      tarjeta({
        icono: Iconos.titulos, valor: resumen.titulos, etiqueta: 'Títulos',
        detalle: `${resumen.ejemplares} ejemplares`, tono: 'violeta', enlace: '#/catalogo'
      }),
      tarjeta({
        icono: Iconos.persona, valor: resumen.estudiantes, etiqueta: 'Usuarios',
        detalle: 'registrados', tono: 'pizarra', enlace: '#/usuarios'
      })
    ]);
  },

  // -------------------------------------------------------------------
  // Atención inmediata: atrasados y por vencer
  // -------------------------------------------------------------------
  atencion(prestamos) {
    const { crear } = UI;
    const urgentes = (prestamos || [])
      .filter((p) => p.situacion === 'atrasado' || p.situacion === 'por_vencer')
      .slice(0, 5);

    const cuerpo = urgentes.length
      ? crear('div', { clase: 'lista-atencion' }, urgentes.map((p) => {
          const critico = p.situacion === 'atrasado';
          return crear('a', {
            clase: `atencion__item${critico ? ' atencion__item--critico' : ''}`,
            href: `#/prestamos?codigo=${encodeURIComponent(p.codigo)}`,
            'aria-label': `${p.titulo}, ${UI.ETIQUETAS[p.situacion] || p.situacion}, límite ${UI.fecha(p.fecha_limite)}. Ver préstamo.`
          }, [
            UI.insignia(p.situacion),
            crear('span', { clase: 'atencion__codigo', texto: p.codigo }),
            crear('span', { clase: 'atencion__titulo', texto: p.titulo }),
            crear('span', { clase: 'atencion__detalle', texto: `Límite: ${UI.fecha(p.fecha_limite)}` })
          ]);
        }))
      : crear('p', { clase: 'texto-suave', texto: 'Sin atrasos ni vencimientos cercanos. Todo en orden.' });

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Atención inmediata' }),
      cuerpo
    ]);
  },

  // -------------------------------------------------------------------
  // Préstamos recientes (tabla)
  // -------------------------------------------------------------------
  prestamosRecientes(prestamos) {
    const { crear } = UI;

    if (!prestamos || !prestamos.length) {
      return crear('section', { clase: 'tarjeta' }, [
        crear('h3', { clase: 'tarjeta__titulo', texto: 'Préstamos recientes' }),
        crear('p', { clase: 'texto-suave', texto: 'Todavía no hay préstamos registrados.' })
      ]);
    }

    const filas = prestamos.map((prestamo) =>
      crear('tr', {}, [
        crear('td', {}, [
          crear('div', { clase: 'celda-libro' }, [
            crear('div', { clase: 'celda-libro__miniatura', texto: prestamo.titulo.slice(0, 2).toUpperCase(), 'aria-hidden': 'true' }),
            crear('div', {}, [
              crear('div', { clase: 'celda-libro__titulo', texto: prestamo.titulo }),
              crear('div', { clase: 'celda-libro__codigo', texto: prestamo.codigo })
            ])
          ])
        ]),
        crear('td', {}, [
          crear('div', { texto: prestamo.estudiante }),
          crear('div', { clase: 'celda-libro__codigo', texto: prestamo.curso })
        ]),
        crear('td', { texto: UI.fecha(prestamo.fecha_prestamo) }),
        crear('td', { texto: UI.fecha(prestamo.fecha_limite) }),
        crear('td', {}, [UI.insignia(prestamo.situacion)])
      ])
    );

    return crear('section', { clase: 'tarjeta tabla-recientes' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Préstamos recientes' }),
      crear('div', { clase: 'tabla-envoltura' }, [
        crear('table', {}, [
          crear('thead', {}, [crear('tr', {}, [
            crear('th', { texto: 'Libro' }),
            crear('th', { texto: 'Estudiante' }),
            crear('th', { texto: 'Prestado' }),
            crear('th', { texto: 'Debe devolver' }),
            crear('th', { texto: 'Situación' })
          ])]),
          crear('tbody', {}, filas)
        ])
      ])
    ]);
  },

  // -------------------------------------------------------------------
  // Libros más prestados
  // -------------------------------------------------------------------
  masPrestados(libros) {
    const { crear } = UI;

    if (!libros || !libros.length) {
      return crear('section', { clase: 'tarjeta' }, [
        crear('h3', { clase: 'tarjeta__titulo', texto: 'Libros más prestados' }),
        crear('p', { clase: 'texto-suave', texto: 'Aún no hay libros prestados.' })
      ]);
    }

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Libros más prestados' }),
      crear('div', { clase: 'lista-simple' }, libros.map((libro, indice) =>
        crear('a', {
          clase: 'lista-simple__item',
          href: `#/catalogo?q=${encodeURIComponent(libro.codigo)}`,
          'aria-label': `${libro.titulo}, de ${libro.autor}. Prestado ${libro.veces_prestado} veces. Ver en el catálogo.`
        }, [
          crear('span', { clase: 'lista-simple__indice', texto: String(indice + 1), 'aria-hidden': 'true' }),
          crear('span', { clase: 'lista-simple__titulo', texto: libro.titulo }),
          crear('span', { clase: 'lista-simple__detalle', texto: `${libro.veces_prestado} préstamo(s)` })
        ])
      ))
    ]);
  },

  // -------------------------------------------------------------------
  // Secciones (categorías) con su disponibilidad
  // -------------------------------------------------------------------
  secciones(categorias) {
    const { crear } = UI;
    const conLibros = (categorias || []).filter((c) => Number(c.ejemplares) > 0);

    if (!conLibros.length) {
      return crear('section', { clase: 'tarjeta' }, [
        crear('h3', { clase: 'tarjeta__titulo', texto: 'Secciones de la biblioteca' }),
        crear('p', { clase: 'texto-suave', texto: 'Todavía no hay categorías con libros.' })
      ]);
    }

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Secciones de la biblioteca' }),
      crear('div', { clase: 'lista-simple' }, conLibros.map((categoria) => {
        const total = Number(categoria.ejemplares) || 0;
        const libres = Number(categoria.disponibles) || 0;
        const porcentaje = total ? Math.round((libres / total) * 100) : 0;

        return crear('a', {
          clase: 'lista-simple__item',
          href: `#/catalogo?q=${encodeURIComponent(categoria.categoria)}`,
          'aria-label': `${categoria.categoria}: ${libres} disponibles de ${total} ejemplares. Ver en el catálogo.`
        }, [
          crear('span', { clase: 'lista-simple__titulo', texto: categoria.categoria }),
          crear('span', { clase: 'barra', 'aria-hidden': 'true' }, [
            crear('span', { clase: 'barra__relleno', estilo: `width:${porcentaje}%` })
          ]),
          crear('span', { clase: 'lista-simple__detalle', texto: `${libres}/${total}` })
        ]);
      }))
    ]);
  },

  // -------------------------------------------------------------------
  // Estudiantes con préstamos activos
  // -------------------------------------------------------------------
  estudiantes(lista) {
    const { crear } = UI;

    if (!lista || !lista.length) {
      return crear('section', { clase: 'tarjeta' }, [
        crear('h3', { clase: 'tarjeta__titulo', texto: 'Estudiantes con préstamos activos' }),
        crear('p', { clase: 'texto-suave', texto: 'No hay préstamos activos en este momento.' })
      ]);
    }

    return crear('section', { clase: 'tarjeta' }, [
      crear('h3', { clase: 'tarjeta__titulo', texto: 'Estudiantes con préstamos activos' }),
      crear('div', { clase: 'lista-simple' }, lista.map((estudiante) =>
        crear('a', {
          clase: 'lista-simple__item',
          href: `#/prestamos?cedula=${encodeURIComponent(estudiante.cedula)}`,
          'aria-label': `${estudiante.nombre}, ${estudiante.curso}, ${estudiante.prestamos_activos} préstamo(s) activo(s). Ver préstamos.`
        }, [
          crear('span', { clase: 'lista-simple__titulo', texto: estudiante.nombre }),
          crear('span', { clase: 'texto-suave', texto: estudiante.curso }),
          crear('span', { clase: 'lista-simple__detalle', texto: `${estudiante.prestamos_activos} préstamo(s)` })
        ])
      ))
    ]);
  },

  // -------------------------------------------------------------------
  // Animación de entrada de las cifras (opcional; se omite con movimiento
  // reducido o en entornos automatizados)
  // -------------------------------------------------------------------
  animarCifras(contenedor) {
    let reducir = false;
    try {
      reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || (window.navigator && window.navigator.webdriver);
    } catch (error) { reducir = true; }
    if (reducir) return;

    contenedor.querySelectorAll('.indicador__valor').forEach((nodo) => {
      const final = Number(String(nodo.textContent).replace(/[^0-9]/g, '')) || 0;
      const inicio = performance.now();
      const duracion = 500;
      const paso = (ahora) => {
        const avance = Math.min(1, (ahora - inicio) / duracion);
        const suave = 1 - Math.pow(1 - avance, 3);
        nodo.textContent = String(Math.round(final * suave));
        if (avance < 1) requestAnimationFrame(paso);
        else nodo.textContent = String(final);
      };
      requestAnimationFrame(paso);
    });
  }
};
