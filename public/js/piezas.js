'use strict';

/**
 * Piezas visuales reutilizables del sistema.
 *
 * Aqui viven los "objetos" que se pintan en pantalla: fichas, libros apilados,
 * lomos de una estantería, compartimentos y hojas del registro. Todas se
 * construyen con DOM y clases de CSS, nunca con texto incrustado, para que el
 * contenido que viene de la base de datos no pueda inyectar código.
 *
 * Cada pieza es accesible por teclado (botón real cuando tiene acción) y
 * responde al hover con una transición definida en `css/biblioteca.css`.
 */

window.Piezas = (() => {
  const { crear, crearSvg } = window.UI;

  /** Tonos de la identidad visual. Todos comparten la misma paleta. */
  const TONES = ['azul', 'violeta', 'verde', 'naranja', 'pizarra', 'teja'];

  /**
   * Ficha flotante con una cifra.
   * Se usa para los números del panel: no es una tarjeta, es una ficha de
   * papel con un_clip, una cifra grande y una etiqueta.
   */
  function ficha({ icono, valor, etiqueta, detalle = null, tono = 'pizarra', accion = null }) {
    const atributos = {
      clase: `ficha ficha--${tono}`,
      'aria-label': `${etiqueta}: ${valor}${detalle ? '. ' + detalle : ''}`
    };

    if (accion) {
      atributos.type = 'button';
      atributos.onclick = accion;
    }

    return crear('div', atributos, [
      crear('span', { clase: 'ficha__clip', 'aria-hidden': 'true' }),
      crear('span', { clase: 'ficha__icono' }, [crearSvg(icono, { clase: 'ficha__svg' })]),
      crear('span', { clase: 'ficha__valor', texto: valor }),
      crear('span', { clase: 'ficha__etiqueta', texto: etiqueta }),
      detalle ? crear('span', { clase: 'ficha__detalle', texto: detalle }) : null
    ]);
  }

  /**
   * Libro de la pila de préstamos recientes.
   * Aparece inclinado como un libro dejado sobre la mesa; al pasar el
   * puntero se levanta y muestra una etiqueta con los datos del préstamo.
   */
  function libroApilado({ prestamo, indice, total }) {
    // Cada libro se inclina un poco mas que el anterior, como una pila real.
    const inclinacion = ((indice % 5) - 2) * 1.6;
    const desplazamiento = indice * 4;

    const etiqueta = crear('span', { clase: 'apilado__etiqueta' }, [
      crear('span', { clase: 'apilado__titulo', texto: prestamo.titulo }),
      crear('span', { clase: 'apilado__dato', texto: prestamo.estudiante }),
      crear('span', { clase: 'apilado__dato', texto: `${prestamo.curso} · ${UI.fecha(prestamo.fecha_prestamo)}` })
    ]);

    return crear('button', {
      clase: 'apilado__libro',
      type: 'button',
      variables: {
        '--inclinacion': `${inclinacion}deg`,
        '--desplazamiento': `${desplazamiento}px`,
        '--capa': total - indice
      },
      'aria-label': `Préstamo de ${prestamo.titulo} a ${prestamo.estudiante}, ${UI.ETIQUETAS[prestamo.situacion] || prestamo.situacion}`,
      onclick: () => {
        window.location.hash = `#/prestamos?codigo=${encodeURIComponent(prestamo.codigo)}`;
      }
    }, [
      crear('span', { clase: 'apilado__lomo', 'aria-hidden': 'true' }),
      crear('span', { clase: 'apilado__paginas', 'aria-hidden': 'true' }),
      crear('span', { clase: 'apilado__portada' }, [
        crear('span', { clase: 'apilado__franja' }),
        crear('span', { clase: 'apilado__nombre', texto: prestamo.titulo })
      ]),
      etiqueta
    ]);
  }

  /**
   * Lomo de la estantería de libros más prestados.
   * La altura es proporcional a las veces prestado, como un lomo real: un
   * libro muy prestado sobresale por encima del estante.
   */
  function libroEspina({ libro, proporcion }) {
    const alto = 34 + Math.round(proporcion * 66);

    return crear('a', {
      clase: 'espina',
      href: `#/catalogo?q=${encodeURIComponent(libro.codigo)}`,
      variables: { '--alto': `${alto}%`, '--tono': TONES[libro.id % TONES.length] },
      'aria-label': `${libro.titulo}, de ${libro.autor}. Prestado ${libro.veces_prestado} veces. Ver en el catálogo.`,
      title: `${libro.titulo} — ${libro.veces_prestado} préstamo(s)`
    }, [
      crear('span', { clase: 'espina__tapa', 'aria-hidden': 'true' }),
      crear('span', { clase: 'espina__texto' }, [
        crear('span', { clase: 'espina__titulo', texto: libro.titulo }),
        crear('span', { clase: 'espina__conteo', texto: `${libro.veces_prestado}×` })
      ])
    ]);
  }

  /**
   * Compartimento de una sección de la biblioteca.
   * Muestra una categoría y cuántas copias quedan disponibles mediante un
   * relleno, en lugar de una barra de porcentaje. Lleva al catálogo filtrado
   * por el nombre de la categoría.
   */
  function compartimento({ categoria }) {
    const total = Number(categoria.ejemplares) || 0;
    const libres = Number(categoria.disponibles) || 0;
    const porcentaje = total ? Math.round((libres / total) * 100) : 0;

    return crear('a', {
      clase: 'compartimento',
      href: `#/catalogo?q=${encodeURIComponent(categoria.categoria)}`,
      'aria-label': `${categoria.categoria}: ${libres} disponibles de ${total} ejemplares. Ver en el catálogo.`,
      title: `${categoria.categoria} — ${libres} de ${total} disponibles`
    }, [
      crear('span', { clase: 'compartimento__etiqueta' }, [
        crear('span', { clase: 'compartimento__nombre', texto: categoria.categoria }),
        crear('span', { clase: 'compartimento__cifra', texto: `${libres}/${total}` })
      ]),
      crear('span', { clase: 'compartimento__vacio' }, [
        crear('span', {
          clase: 'compartimento__relleno',
          estilo: `width:${porcentaje}%`,
          'aria-hidden': 'true'
        })
      ])
    ]);
  }

  /**
   * Hoja del registro de préstamos por día.
   * Cada día es una hoja fina apoyada sobre una línea de base, con la altura
   * proporcional al número de préstamos.
   */
  function hoja({ punto, maximo }) {
    const proporcion = maximo > 0 ? punto.total / maximo : 0;
    const alto = punto.total ? Math.max(10, Math.round(proporcion * 100)) : 3;

    return crear('div', {
      clase: 'registro__hoja',
      variables: { '--alto': `${alto}%` },
      title: `${punto.total} préstamo(s) el ${UI.fecha(punto.fecha)}`,
      'aria-label': `${UI.fecha(punto.fecha)}: ${punto.total} préstamo(s)`,
      role: 'img'
    }, [
      crear('span', { clase: 'registro__cantidad', texto: punto.total || '' })
    ]);
  }

  /**
   * Ficha de estudiante con préstamos activos.
   * Se ve como un carné de biblioteca apoyado en el borde de la mesa.
   */
  function carné({ estudiante }) {
    return crear('button', {
      clase: 'carne',
      type: 'button',
      'aria-label': `${estudiante.nombre}, ${estudiante.curso}, ${estudiante.prestamos_activos} préstamo(s) activo(s)`,
      onclick: () => {
        window.location.hash = `#/prestamos?cedula=${encodeURIComponent(estudiante.cedula)}`;
      }
    }, [
      crear('span', { clase: 'carne__foto', 'aria-hidden': 'true' }),
      crear('span', { clase: 'carne__datos' }, [
        crear('span', { clase: 'carne__nombre', texto: estudiante.nombre }),
        crear('span', { clase: 'carne__curso', texto: estudiante.curso })
      ]),
      crear('span', { clase: 'carne__activo', texto: `${estudiante.prestamos_activos}` })
    ]);
  }

  /** Estado vacío con el tono de papel, sin inventar información. */
  function vacio({ mensaje, icono = 'etiqueta' }) {
    return crear('div', { clase: 'objeto-vacio' }, [
      crear('span', { clase: 'objeto-vacio__icono' }, [crearSvg(icono)]),
      crear('span', { texto: mensaje })
    ]);
  }

  /**
   * Encabezado de una "estación" del panel.
   * Usa una línea fina y el nombre del objeto, en lugar de una tarjeta.
   */
  function estacion({ titulo, detalle, children, extra = null }) {
    return crear('section', { clase: 'estacion' }, [
      crear('header', { clase: 'estacion__cabecera' }, [
        crear('h3', { clase: 'estacion__titulo', texto: titulo }),
        detalle ? crear('span', { clase: 'estacion__detalle', texto: detalle }) : null,
        extra
      ]),
      crear('div', { clase: 'estacion__cuerpo' }, [].concat(children))
    ]);
  }

  return { ficha, libroApilado, libroEspina, compartimento, hoja, carné, vacio, estacion, TONES };
})();
