'use strict';

/**
 * Resumen de la biblioteca (cifras, secciones, pendientes y destacados).
 *
 * Esta vista es el contenido que va DEBAJO de la estantería: el menu
 * principal es la estantería de libros y, al final de la pagina, el estado
 * real de la biblioteca.
 *
 * Los datos salen de `GET /api/panel`: no se calcula ni se inventa nada aqui.
 * Las piezas de detalle (pulse, registro, carnés, ...) siguen aqui porque las
 * reutiliza la vista de reportes.
 */

window.Vistas = window.Vistas || {};

Vistas.panel = {
  titulo: 'Resumen',
  descripcion: 'El estado de la biblioteca en un vistazo.',

  async render(contenedor) {
    const { crear } = UI;

    contenedor.replaceChildren(crear('p', { clase: 'cargando', texto: 'Leyendo la biblioteca…' }));

    try {
      const datos = await Api.panel();
      contenedor.replaceChildren(this.construir(datos));
      this.animarCifras(contenedor);
      await this.cargarDestacados(contenedor, datos.mas_prestados);
    } catch (error) {
      contenedor.replaceChildren(
        Piezas.vacio({ mensaje: 'No se pudo cargar la informacion de la biblioteca.' })
      );
      UI.errorApi(error);
    }
  },

  construir(datos) {
    const { crear } = UI;

    return crear('div', { clase: 'resumen' }, [
      this.cifras(datos.resumen),
      this.secciones(datos.por_categoria),
      this.pendientes(datos.ultimos_prestamos),
      this.destacados(datos.mas_prestados)
    ]);
  },

  // -------------------------------------------------------------------
  // Las cifras: una sola linea, sin tarjetas ni adornos.
  // -------------------------------------------------------------------
  cifras(resumen) {
    const { crear } = UI;

    const items = [
      {
        valor: resumen.disponibles,
        etiqueta: 'Disponibles',
        href: '#/catalogo?estado=disponible'
      },
      {
        valor: resumen.prestados,
        etiqueta: 'Prestados',
        href: '#/prestamos?situacion=activo'
      },
      {
        valor: resumen.atrasados,
        etiqueta: 'Atrasados',
        href: '#/prestamos?situacion=atrasado',
        alerta: Number(resumen.atrasados) > 0
      },
      {
        valor: resumen.titulos,
        etiqueta: 'Titulos',
        href: '#/catalogo'
      },
      {
        valor: resumen.estudiantes,
        etiqueta: 'Usuarios',
        href: '#/usuarios'
      }
    ];

    return crear('nav', { clase: 'cifras', 'aria-label': 'Cifras de la biblioteca' }, items.map((item) =>
      crear('a', {
        clase: `cifra${item.alerta ? ' cifra--alerta' : ''}`,
        href: item.href,
        'aria-label': `${item.etiqueta}: ${item.valor}`
      }, [
        crear('span', { clase: 'cifra__valor', texto: String(item.valor) }),
        crear('span', { clase: 'cifra__etiqueta', texto: item.etiqueta })
      ])
    ));
  },

  // -------------------------------------------------------------------
  // Las secciones de la biblioteca, como etiquetas sueltas.
  // -------------------------------------------------------------------
  secciones(categorias) {
    const { crear } = UI;

    if (!categorias || !categorias.length) return null;

    return crear('section', { clase: 'resumen__bloque' }, [
      crear('h3', { clase: 'resumen__titulo', texto: 'Secciones de la biblioteca' }),
      crear('div', { clase: 'secciones' }, categorias.map((categoria) =>
        Piezas.seccion({ categoria })
      ))
    ]);
  },

  // -------------------------------------------------------------------
  // Lo que de verdad necesita atencion: prestamos atrasados o por vencer.
  // -------------------------------------------------------------------
  pendientes(prestamos) {
    const { crear } = UI;

    const urgentes = (prestamos || [])
      .filter((p) => p.situacion === 'atrasado' || p.situacion === 'por_vencer')
      .slice(0, 5);

    if (!urgentes.length) return null;

    return crear('section', { clase: 'resumen__bloque' }, [
      crear('h3', { clase: 'resumen__titulo', texto: 'Necesita atencion' }),
      crear('ul', { clase: 'pendientes' }, urgentes.map((prestamo) =>
        crear('li', {}, [
          crear('a', {
            clase: `pendiente pendiente--${prestamo.situacion}`,
            href: `#/prestamos?codigo=${encodeURIComponent(prestamo.codigo)}`
          }, [
            crear('span', { clase: 'pendiente__estado', texto: UI.ETIQUETAS[prestamo.situacion] || prestamo.situacion }),
            crear('span', { clase: 'pendiente__titulo', texto: prestamo.titulo }),
            crear('span', { clase: 'pendiente__limite', texto: `limite ${UI.fecha(prestamo.fecha_limite)}` })
          ])
        ])
      ))
    ]);
  },

  // -------------------------------------------------------------------
  // Libros destacados: fila horizontal con portada, titulo, autor y estado.
  // -------------------------------------------------------------------
  destacados(mas) {
    const { crear } = UI;

    const fila = crear('div', { clase: 'destacados', tabindex: '0', 'aria-label': 'Libros destacados, deslice para ver mas' });

    const anterior = crear('button', {
      clase: 'destacados__flecha', type: 'button', 'aria-label': 'Ver libros anteriores',
      onclick: () => fila.scrollBy({ left: -fila.clientWidth * 0.8, behavior: 'smooth' })
    }, ['‹']);
    const siguiente = crear('button', {
      clase: 'destacados__flecha', type: 'button', 'aria-label': 'Ver libros siguientes',
      onclick: () => fila.scrollBy({ left: fila.clientWidth * 0.8, behavior: 'smooth' })
    }, ['›']);

    const extra = crear('div', { clase: 'destacados__extra' }, [
      anterior, siguiente,
      crear('a', { clase: 'destacados__todo', href: '#/catalogo', texto: 'Ver todo ›' })
    ]);

    return crear('section', { clase: 'resumen__bloque' }, [
      crear('h3', { clase: 'resumen__titulo', texto: 'Libros destacados' }),
      (mas && mas.length)
        ? fila
        : Piezas.vacio({ mensaje: 'Cuando haya prestamos, aqui apareceran los libros destacados.' }),
      (mas && mas.length) ? extra : null
    ]);
  },

  async cargarDestacados(contenedor, mas) {
    const fila = contenedor.querySelector && contenedor.querySelector('.destacados');
    if (!fila || !mas || !mas.length) return;
    const { crear } = UI;

    const detalles = await Promise.all(mas.slice(0, 8).map(async (resumenLibro) => {
      try {
        const respuesta = await Api.libro(resumenLibro.id);
        return respuesta && respuesta.libro ? respuesta.libro : null;
      } catch (error) {
        return null;
      }
    }));

    const libros = detalles.filter(Boolean);
    if (!libros.length) {
      fila.replaceChildren(UI.vacio('No se pudieron cargar los destacados.'));
      return;
    }

    fila.replaceChildren(...libros.map((libro) => {
      const disponible = Number(libro.disponibles) > 0;
      const tono = UI.tonoCategoria(libro.categoria);
      return crear('button', {
        clase: `destacado-item destacado-item--${tono}`,
        type: 'button',
        'aria-label': `${libro.titulo}, de ${libro.autor}. ${disponible ? 'Disponible' : 'Prestado'}. Abrir ficha.`,
        title: libro.titulo,
        onclick: () => Vistas.catalogo.verDetalle(libro.id)
      }, [
        UI.portada(libro, 'destacado-item__portada'),
        crear('span', { clase: 'destacado-item__titulo', texto: libro.titulo }),
        crear('span', { clase: 'destacado-item__autor', texto: libro.autor }),
        crear('span', {
          clase: `insignia ${disponible ? 'insignia--disponible' : 'insignia--prestado'}`,
          texto: disponible ? 'Disponible' : 'Prestado'
        })
      ]);
    }));
  },

  // -------------------------------------------------------------------
  // Piezas de detalle: las reutiliza la vista de reportes.
  // -------------------------------------------------------------------
  atencion(prestamos) {
    const { crear } = UI;
    const urgentes = (prestamos || []).filter((p) =>
      p.situacion === 'atrasado' || p.situacion === 'por_vencer').slice(0, 5);

    if (!urgentes.length) {
      return Piezas.estacion({
        titulo: 'Atención inmediata',
        detalle: 'préstamos que vencen hoy, mañana o ya vencieron',
        children: Piezas.vacio({ mensaje: 'Sin atrasos ni vencimientos cercanos. Todo en orden.' })
      });
    }

    return Piezas.estacion({
      titulo: 'Atención inmediata',
      detalle: `${urgentes.length} préstamo(s) que requieren seguimiento`,
      children: crear('div', { clase: 'atencion' }, urgentes.map((p) => {
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
    });
  },

  pilaDePrestamos(prestamos) {
    const { crear } = UI;

    if (!prestamos || !prestamos.length) {
      return Piezas.estacion({
        titulo: 'Mesa de prestamos',
        children: Piezas.vacio({ mensaje: 'Todavia no hay prestamos registrados.' })
      });
    }

    const pila = crear('div', { clase: 'apilado' }, prestamos.map((prestamo, indice) =>
      Piezas.libroApilado({ prestamo, indice, total: prestamos.length })
    ));

    return Piezas.estacion({
      titulo: 'Mesa de prestamos',
      detalle: `${prestamos.length} movimiento(s) reciente(s)`,
      children: pila,
      extra: UI.insignia(prestamos[0].situacion)
    });
  },

  estanteria(libros) {
    const { crear } = UI;

    if (!libros || !libros.length) {
      return Piezas.estacion({
        titulo: 'Estanteria de los mas prestados',
        children: Piezas.vacio({ mensaje: 'Aun no hay libros prestados.' })
      });
    }

    const maximo = Math.max(...libros.map((libro) => Number(libro.veces_prestado) || 0), 1);

    return Piezas.estacion({
      titulo: 'Estanteria de los mas prestados',
      detalle: 'la altura del lomo segun las veces prestado',
      children: crear('div', { clase: 'estante' }, [
        crear('div', { clase: 'estante__lomos' }, libros.map((libro) =>
          Piezas.libroEspina({ libro, proporcion: (Number(libro.veces_prestado) || 0) / maximo })
        )),
        crear('div', { clase: 'estante__tablero', 'aria-hidden': 'true' })
      ])
    });
  },

  compartimentos(categorias) {
    const { crear } = UI;
    const conLibros = (categorias || []).filter((categoria) => Number(categoria.ejemplares) > 0);

    if (!conLibros.length) {
      return Piezas.estacion({
        titulo: 'Secciones de la biblioteca',
        children: Piezas.vacio({ mensaje: 'Todavia no hay categorias con libros.' })
      });
    }

    return Piezas.estacion({
      titulo: 'Secciones de la biblioteca',
      detalle: `${conLibros.length} seccion(es) · disponibles / total`,
      children: crear('div', { clase: 'compartimentos' }, conLibros.map((categoria) =>
        Piezas.compartimento({ categoria })
      ))
    });
  },

  registro(serie) {
    const { crear } = UI;

    if (!serie || !serie.length) {
      return Piezas.estacion({
        titulo: 'Registro de prestamos',
        children: Piezas.vacio({ mensaje: 'Todavia no hay registro de prestamos.' })
      });
    }

    const maximo = Math.max(...serie.map((punto) => Number(punto.total) || 0), 1);
    const total = serie.reduce((suma, punto) => suma + (Number(punto.total) || 0), 0);

    return Piezas.estacion({
      titulo: 'Registro de prestamos',
      detalle: `${serie.length} dias · ${total} prestamo(s)`,
      children: crear('div', { clase: 'registro' }, [
        crear('div', { clase: 'registro__hojas' }, serie.map((punto) =>
          crear('div', { clase: 'registro__columna' }, [
            Piezas.hoja({ punto, maximo }),
            crear('span', { clase: 'registro__dia', texto: UI.fechaCorta(punto.fecha) })
          ])
        )),
        crear('div', { clase: 'registro__base', 'aria-hidden': 'true' })
      ])
    });
  },

  carnes(estudiantes) {
    const { crear } = UI;

    if (!estudiantes || !estudiantes.length) {
      return Piezas.estacion({
        titulo: 'Estudiantes con prestamos activos',
        children: Piezas.vacio({ mensaje: 'No hay prestamos activos en este momento.' })
      });
    }

    return Piezas.estacion({
      titulo: 'Estudiantes con prestamos activos',
      detalle: 'el numero es la cantidad de libros que tienen consigo',
      children: crear('div', { clase: 'carnes' }, estudiantes.map((estudiante) =>
        Piezas.carné({ estudiante })
      ))
    });
  },

  recientes(libros) {
    const { crear } = UI;
    if (!libros || !libros.length) {
      return Piezas.estacion({
        titulo: 'Agregados recientemente',
        detalle: 'últimos títulos registrados en el catálogo',
        children: Piezas.vacio({ mensaje: 'Todavía no hay libros registrados.' })
      });
    }
    return Piezas.estacion({
      titulo: 'Agregados recientemente',
      detalle: 'últimos títulos registrados en el catálogo',
      children: crear('div', { clase: 'recientes' }, libros.map((libro) =>
        crear('a', {
          clase: 'reciente',
          href: `#/catalogo?q=${encodeURIComponent(libro.codigo)}`,
          'aria-label': `${libro.titulo}, de ${libro.autor}. Ver en el catálogo.`
        }, [
          crear('span', { clase: 'reciente__titulo', texto: libro.titulo }),
          crear('span', { clase: 'reciente__autor', texto: libro.autor }),
          UI.insignia(libro.estado)
        ])
      ))
    });
  },

  pulso(resumen) {
    const { crear } = UI;
    const total = Number(resumen.ejemplares) || 0;
    const prestados = Number(resumen.prestados) || 0;
    const disponibles = Number(resumen.disponibles) || 0;
    const porcentaje = total ? Math.round((prestados / total) * 100) : 0;
    const radio = 54;
    const circunferencia = 2 * Math.PI * radio;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 132 132');
    svg.setAttribute('aria-hidden', 'true');
    const fondo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fondo.setAttribute('cx', '66'); fondo.setAttribute('cy', '66'); fondo.setAttribute('r', String(radio));
    fondo.setAttribute('fill', 'none'); fondo.setAttribute('stroke', 'rgba(154,168,199,.18)');
    fondo.setAttribute('stroke-width', '12');
    const arco = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arco.setAttribute('cx', '66'); arco.setAttribute('cy', '66'); arco.setAttribute('r', String(radio));
    arco.setAttribute('fill', 'none'); arco.setAttribute('stroke', 'url(#degradado-pulso)');
    arco.setAttribute('stroke-width', '12'); arco.setAttribute('stroke-linecap', 'round');
    arco.setAttribute('stroke-dasharray', `${(porcentaje / 100) * circunferencia} ${circunferencia}`);
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = '<linearGradient id="degradado-pulso" x1="0" y1="0" x2="1" y2="1">'
      + '<stop offset="0" stop-color="#48E5FF"/><stop offset="1" stop-color="#F472D0"/></linearGradient>';
    svg.append(defs, fondo, arco);

    const fila = (color, texto) => crear('div', { clase: 'pulso__fila' }, [
      crear('span', { clase: 'pulso__punto', estilo: `background:${color}` }),
      crear('span', { texto })
    ]);

    return Piezas.estacion({
      titulo: 'Pulso de la biblioteca',
      detalle: 'disponibles frente a prestados, ahora mismo',
      children: crear('div', { clase: 'pulso' }, [
        crear('div', { clase: 'pulso__dona', role: 'img', 'aria-label': `${porcentaje}% del catálogo en préstamo` }, [
          svg,
          crear('div', { clase: 'pulso__centro' }, [
            crear('span', { clase: 'pulso__porcentaje', texto: `${porcentaje}%` }),
            crear('span', { clase: 'pulso__leyenda', texto: 'en préstamo' })
          ])
        ]),
        crear('div', { clase: 'pulso__datos' }, [
          fila('#48E5FF', `${disponibles} disponibles`),
          fila('#9570FF', `${prestados} prestados`),
          fila('#F5C66B', `${resumen.por_vencer} por vencer`),
          fila('#FF7A90', `${resumen.atrasados} atrasados`)
        ])
      ])
    });
  },

  // -------------------------------------------------------------------
  // Cifras animadas al cargar (se omiten con movimiento reducido o en
  // entornos automatizados para no alterar los valores leidos)
  // -------------------------------------------------------------------
  animarCifras(contenedor) {
    let reducir = false;
    try {
      reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || (window.navigator && window.navigator.webdriver);
    } catch (error) { reducir = true; }
    if (reducir) return;

    contenedor.querySelectorAll('.cifra__valor').forEach((nodo) => {
      const final = Number(String(nodo.textContent).replace(/[^0-9]/g, '')) || 0;
      const inicio = performance.now();
      const duracion = 650;
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
