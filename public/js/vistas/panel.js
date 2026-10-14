'use strict';

/**
 * Vista del panel: el escritorio de la biblioteca (RF08).
 *
 * No se usan tarjetas, tablas ni gráficos de barras. La información se
 * presenta como los objetos de una biblioteca real:
 *
 *   - las cifras cuelgan como fichas de papel con clip;
 *   - los préstamos recientes forman una pila de libros sobre la mesa;
 *   - los libros más prestados se ven como lomos en una estantería;
 *   - las categorías son compartimentos con su rótulo;
 *   - el registro de préstamos son las hojas de un cuaderno;
 *   - los estudiantes activos son carnés apoyados en el borde.
 *
 * Los datos son exactamente los que entrega `GET /api/panel`: no se calcula
 * ni se inventa nada nuevo.
 */

window.Vistas = window.Vistas || {};

Vistas.panel = {
  titulo: 'Panel principal',
  descripcion: 'Resumen de la biblioteca: cifras, avisos y accesos directos.',

  async render(contenedor) {
    const { crear } = UI;

    contenedor.replaceChildren(
      crear('h2', { clase: 'vista__titulo oculto', texto: 'Panel de la biblioteca' }),
      crear('p', { clase: 'cargando', texto: 'Abriendo el escritorio...' })
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
      contenedor.replaceChildren(this.construir(datos, recientes));
      this.animarCifras(contenedor);
    } catch (error) {
      contenedor.replaceChildren(
        crear('h2', { clase: 'vista__titulo oculto', texto: 'Panel de la biblioteca' }),
        Piezas.vacio({ mensaje: 'No se pudo cargar la informacion del panel.' })
      );
      UI.errorApi(error);
    }
  },

  construir(datos, recientes = []) {
    const { crear } = UI;
    const resumen = datos.resumen;

    return crear('div', { clase: 'centro' }, [
      this.heroe(resumen),
      crear('div', { clase: 'escritorio' }, [
        this.mesaDeEntrada(resumen),
        this.atencion(datos.ultimos_prestamos),
        this.pilaDePrestamos(datos.ultimos_prestamos),
        this.detalleAgrupado(datos, resumen, recientes),
        this.accesos()
      ])
    ]);
  },

  // -------------------------------------------------------------------
  // Estadísticas detalladas: un solo grupo plegable para no saturar.
  // Todo sigue en el DOM y accesible; solo se oculta visualmente.
  // -------------------------------------------------------------------
  detalleAgrupado(datos, resumen, recientes) {
    const { crear } = UI;

    const resumenBtn = crear('summary', { clase: 'grupo-detalle__resumen' }, [
      crear('span', { clase: 'grupo-detalle__titulo', texto: 'Estadísticas detalladas' }),
      crear('span', { clase: 'grupo-detalle__pista', texto: 'Pulso, categorías, actividad por día y más. Pulse para mostrar.' })
    ]);

    return crear('details', { clase: 'grupo-detalle' }, [
      resumenBtn,
      crear('div', { clase: 'grupo-detalle__cuerpo escritorio' }, [
        crear('div', { clase: 'escritorio__doble' }, [
          this.pulso(resumen),
          this.estanteria(datos.mas_prestados)
        ]),
        crear('div', { clase: 'escritorio__doble escritorio__doble--invertido' }, [
          this.compartimentos(datos.por_categoria),
          this.registro(datos.prestamos_por_dia)
        ]),
        this.carnes(datos.estudiantes_mas_activos),
        this.recientes(recientes)
      ])
    ]);
  },

  // -------------------------------------------------------------------
  // Héroe: bienvenida, fecha dinámica y búsqueda destacada.
  // (Los atajos viven en "Accesos directos", sin duplicarlos aquí.)
  // -------------------------------------------------------------------
  heroe(resumen) {
    const { crear } = UI;
    const fecha = new Date().toLocaleDateString('es-EC', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const entrada = crear('input', {
      type: 'search',
      name: 'q',
      placeholder: 'Buscar por título, autor, categoría o código…',
      'aria-label': 'Búsqueda destacada en el catálogo',
      autocomplete: 'off'
    });

    const formulario = crear('form', {
      clase: 'hero__buscador',
      role: 'search',
      onsubmit: (evento) => {
        evento.preventDefault();
        const texto = entrada.value.trim();
        window.location.hash = texto
          ? `#/catalogo?q=${encodeURIComponent(texto)}`
          : '#/catalogo';
      }
    }, [
      entrada,
      crear('button', { clase: 'boton boton--primario', type: 'submit', texto: 'Explorar catálogo' })
    ]);

    return crear('section', { clase: 'hero', 'aria-label': 'Centro de control de la biblioteca' }, [
      crear('span', { clase: 'hero__etiqueta', texto: 'Centro de control' }),
      crear('h2', { clase: 'hero__titulo' }, [
        'Bienvenido a la ',
        crear('span', { texto: 'Biblioteca UEEA' })
      ]),
      crear('p', { clase: 'hero__fecha', texto: `${fecha} · ${resumen.prestados} préstamo(s) activo(s), ${resumen.atrasados} atrasado(s)` }),
      formulario
    ]);
  },

  // -------------------------------------------------------------------
  // Pulso: dona de disponibilidad con datos reales (sin librerías)
  // -------------------------------------------------------------------
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
      + '<stop offset="0" stop-color="#48E5FF"/><stop offset="1" stop-color="#9570FF"/></linearGradient>';
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
  // Atención: atrasados y por vencer que requieren seguimiento
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

  // -------------------------------------------------------------------
  // Agregados recientemente (datos reales del catálogo)
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // Accesos directos a las acciones más utilizadas
  // -------------------------------------------------------------------
  accesos() {
    const { crear } = UI;
    const tarjeta = (icono, titulo, detalle, destino) => crear('a', {
      clase: 'acceso-rapido', href: destino
    }, [
      crear('span', { clase: 'acceso-rapido__icono' }, [UI.crearSvg(Iconos[icono])]),
      crear('span', {}, [
        crear('span', { texto: titulo }),
        crear('small', { texto: detalle })
      ])
    ]);

    return Piezas.estacion({
      titulo: 'Accesos directos',
      detalle: 'las acciones más utilizadas, a un clic',
      children: crear('div', { clase: 'accesos' }, [
        tarjeta('prestamos', 'Registrar préstamo', 'nuevo préstamo a un estudiante', '#/prestamos'),
        tarjeta('devoluciones', 'Registrar devolución', 'préstamos activos pendientes', '#/prestamos?situacion=activo'),
        tarjeta('catalogo', 'Explorar catálogo', 'buscar por título, autor o código', '#/catalogo'),
        tarjeta('gestion', 'Registrar libro', 'alta de un título en el catálogo', '#/gestion')
      ])
    });
  },

  // -------------------------------------------------------------------
  // Cifras animadas al cargar (se omiten con movimiento reducido o en
  // entornos automatizados para no alterar los valores leídos)
  // -------------------------------------------------------------------
  animarCifras(contenedor) {
    let reducir = false;
    try {
      reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || (window.navigator && window.navigator.webdriver);
    } catch (error) { reducir = true; }
    if (reducir) return;

    contenedor.querySelectorAll('.ficha__valor').forEach((nodo) => {
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
  },

  // -------------------------------------------------------------------
  // Mesa de entrada: las cifras como fichas de papel
  // -------------------------------------------------------------------
  mesaDeEntrada(resumen) {
    const { crear } = UI;

    const fichas = [
      Piezas.ficha({
        icono: Iconos.disponibles,
        valor: resumen.disponibles,
        etiqueta: 'disponibles',
        detalle: 'listos para prestar',
        tono: 'verde',
        accion: () => { window.location.hash = '#/catalogo?estado=disponible'; }
      }),
      Piezas.ficha({
        icono: Iconos.prestados,
        valor: resumen.prestados,
        etiqueta: 'prestados',
        detalle: `${resumen.porcentaje_prestados}% del catalogo`,
        tono: 'azul',
        accion: () => { window.location.hash = '#/prestamos?situacion=activo'; }
      }),
      Piezas.ficha({
        icono: Iconos.atrasado,
        valor: resumen.atrasados,
        etiqueta: 'atrasados',
        detalle: resumen.atrasados ? 'requieren seguimiento' : 'todo en orden',
        tono: resumen.atrasados ? 'teja' : 'verde',
        accion: () => { window.location.hash = '#/prestamos?situacion=atrasado'; }
      }),
      Piezas.ficha({
        icono: Iconos.por_vencer,
        valor: resumen.por_vencer,
        etiqueta: 'por vencer',
        detalle: 'hoy o manana',
        tono: resumen.por_vencer ? 'naranja' : 'pizarra'
      }),
      Piezas.ficha({
        icono: Iconos.titulos,
        valor: resumen.titulos,
        etiqueta: 'titulos',
        detalle: `${resumen.ejemplares} ejemplares`,
        tono: 'violeta',
        accion: () => { window.location.hash = '#/catalogo'; }
      }),
      Piezas.ficha({
        icono: Iconos.devoluciones,
        valor: resumen.devueltos_mes,
        etiqueta: 'devoluciones',
        detalle: 'en lo que va del mes',
        tono: 'pizarra',
        accion: () => { window.location.hash = '#/prestamos?situacion=devuelto'; }
      })
    ];

    return Piezas.estacion({
      titulo: 'Mesa de entrada',
      detalle: resumen.fecha ? `Hoy es ${UI.fecha(resumen.fecha)}` : null,
      children: crear('div', { clase: 'mesa' }, fichas)
    });
  },

  // -------------------------------------------------------------------
  // Pila de prestamos recientes
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // Estanteria de los libros mas prestados
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // Compartimentos por categoria
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // Registro de prestamos por dia
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // Carnes de los estudiantes con mas prestamos activos
  // -------------------------------------------------------------------
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
  }
};
