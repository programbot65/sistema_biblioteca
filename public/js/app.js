'use strict';

/**
 * Punto de entrada de la aplicacion.
 *
 * Se usa una aplicacion de una sola pagina con navegacion por hash (#/ruta),
 * lo que permite recargar la pagina y compartir enlaces sin necesidad de un
 * servidor que reescriba las direcciones.
 *
 * La pantalla de inicio es la estanteria circular de libros (#/inicio). Las
 * demas rutas (#/panel, #/catalogo, #/prestamos, #/gestion) siguen siendo las
 * mismas secciones de siempre.
 */

window.App = (() => {
  const VISTAS_POR_DEFECTO = 'panel';
  const contenido = () => document.getElementById('contenido');

  /** Convierte "#/catalogo?q=texto&limite=5" en {vista, parametros}. */
  function leerRuta() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const [ruta, consulta = ''] = hash.split('?');
    const parametros = {};

    for (const par of consulta.split('&')) {
      if (!par) continue;
      const [clave, valor = ''] = par.split('=');
      parametros[decodeURIComponent(clave)] = decodeURIComponent(valor);
    }

    const partes = ruta.split('/').filter(Boolean);

    return {
      vista: partes[0] || VISTAS_POR_DEFECTO,
      parametros,
      id: partes[1] || null
    };
  }

  function marcarNavegacion(vista) {
    document.querySelectorAll('.navegacion__enlace').forEach((enlace) => {
      const activo = enlace.dataset.vista === vista;
      enlace.classList.toggle('activo', activo);
      if (activo) enlace.setAttribute('aria-current', 'page');
      else enlace.removeAttribute('aria-current');
    });
  }

  /**
   * El encabezado no muestra una fila de botones: solo indica en que seccion
   * se esta y ofrece el camino de vuelta a la estanteria.
   */
  function actualizarEncabezado(vista, pantalla) {
    const volver = document.getElementById('volver-estanteria');
    const subtitulo = document.getElementById('subtitulo-seccion');
    const enPortada = vista === 'inicio';

    if (volver) {
      volver.hidden = enPortada;
      volver.classList.toggle('activo', !enPortada);
    }
    if (subtitulo) {
      subtitulo.textContent = enPortada
        ? 'Catalogo digital y control de prestamos'
        : (pantalla && pantalla.titulo) || '';
    }
    document.body.dataset.vista = vista;

    dibujarIconos();
    actualizarEstado();
  }

  /** Inserta los SVG del encabezado a partir del catalogo de iconos. */
  function dibujarIconos() {
    const aviso = document.querySelector('#boton-avisos .icono-boton__glifo');
    if (aviso && !aviso.firstChild) aviso.append(UI.crearSvg(Iconos.campana));

    const rol = document.querySelector('#rol-usuario .rol__icono');
    if (rol && !rol.firstChild) rol.append(UI.crearSvg(Iconos.persona));
  }

  /** Fecha actual del encabezado, generada dinámicamente en español. */
  function pintarFecha() {
    const nodo = document.getElementById('fecha-actual');
    if (!nodo) return;
    try {
      const fecha = new Date().toLocaleDateString('es-EC', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
      nodo.textContent = fecha;
      nodo.setAttribute('datetime', new Date().toISOString().slice(0, 10));
    } catch (error) {
      nodo.textContent = '';
    }
  }

  /** Búsqueda global del encabezado: lleva al catálogo con el texto escrito. */
  function conectarBusquedaGlobal() {
    const formulario = document.getElementById('busqueda-global');
    const entrada = document.getElementById('busqueda-global-entrada');
    if (!formulario || !entrada || formulario.dataset.lista) return;
    formulario.dataset.lista = 'si';
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault();
      const texto = entrada.value.trim();
      window.location.hash = texto
        ? `#/catalogo?q=${encodeURIComponent(texto)}`
        : '#/catalogo';
      entrada.blur();
    });
    // Atajo de teclado: "/" enfoca la búsqueda desde cualquier sección.
    document.addEventListener('keydown', (evento) => {
      if (evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      const etiqueta = (document.activeElement && document.activeElement.tagName) || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(etiqueta)) return;
      evento.preventDefault();
      entrada.focus();
    });
  }

  /**
   * Estado del sistema y avisos del encabezado.
   * Se leen del resumen que el servidor ya expone; si algo falla, el
   * encabezado simplemente se queda sin esos indicadores.
   */
  async function actualizarEstado() {
    const caja = document.getElementById('estado-sistema');
    const texto = document.getElementById('estado-texto');
    const botonAvisos = document.getElementById('boton-avisos');
    const globo = document.getElementById('contador-avisos');

    try {
      const resumen = await Api.resumen();
      const atrasados = Number(resumen.atrasados) || 0;

      if (caja) {
        caja.hidden = false;
        caja.classList.toggle('estado--alerta', atrasados > 0);
      }
      if (texto) {
        texto.textContent = atrasados > 0
          ? `${atrasados} atrasado(s)`
          : 'Todo en linea';
      }
      if (botonAvisos) {
        botonAvisos.hidden = atrasados === 0;
        botonAvisos.setAttribute(
          'aria-label',
          atrasados === 1
            ? 'Hay 1 prestamo atrasado. Verlo.'
            : `Hay ${atrasados} prestamos atrasados. Verlos.`
        );
      }
      if (globo) {
        globo.textContent = atrasados > 9 ? '9+' : String(atrasados);
        globo.classList.toggle('con-carga', atrasados > 0);
      }
    } catch (error) {
      // El encabezado es informativo: si no se puede leer, se oculta.
      if (caja) caja.hidden = true;
      if (botonAvisos) botonAvisos.hidden = true;
    }
  }

  /** Anima la entrada de la seccion recien dibujada. */
  function animarEntrada() {
    const caja = contenido();
    caja.classList.remove('entrando');
    // Forzar el reinicio de la animacion en navegaciones seguidas.
    void caja.offsetWidth;
    caja.classList.add('entrando');
  }

  function mostrarError(mensaje) {
    contenido().replaceChildren(
      UI.crear('h2', { clase: 'vista__titulo', texto: 'Página no encontrada' }),
      UI.vacio(mensaje),
      UI.crear('div', { clase: 'fila-botones', estilo: 'justify-content:center' }, [
        UI.crear('a', { clase: 'boton boton--primario', href: '#/inicio', texto: 'Volver a la estanteria' })
      ])
    );
  }

  async function navegar() {
    const { vista, parametros, id } = leerRuta();
    UI.cerrarModal();

    // Enlace directo a la ficha de un libro: #/catalogo/12
    if (vista === 'catalogo' && id) {
      const { crear } = UI;
      contenido().replaceChildren(
        crear('h2', { clase: 'vista__titulo', texto: 'Catalogo de libros' }),
        crearTexto('cargando', 'Abriendo el libro...')
      );
      actualizarEncabezado(vista, Vistas.catalogo);
      Vistas.catalogo.verDetalle(Number(id));
      window.location.hash = '#/catalogo';
      return;
    }

    const pantalla = Vistas[vista];
    if (!pantalla || typeof pantalla.render !== 'function') {
      marcarNavegacion(vista);
      actualizarEncabezado(vista, null);
      mostrarError(`La sección "${vista}" no existe en el sistema.`);
      return;
    }

    marcarNavegacion(vista);
    actualizarEncabezado(vista, pantalla);

    try {
      await pantalla.render(contenido(), parametros);
      animarEntrada();
    } catch (error) {
      mostrarError('No se pudo cargar la sección solicitada.');
      UI.errorApi(error);
    }

    contenido().focus({ preventScroll: true });

    // Al navegar entre secciones se vuelve al inicio de la pagina.
    try {
      if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (error) {
      // Algunos entornos de prueba no implementan scrollTo: no es grave.
    }
  }

  function iniciar() {
    if (!window.location.hash) {
      window.location.hash = `#/${VISTAS_POR_DEFECTO}`;
    }
    pintarFecha();
    conectarBusquedaGlobal();
    window.addEventListener('hashchange', navegar);
    navegar();
  }

  return { iniciar, navegar, leerRuta, actualizarEncabezado, actualizarEstado };
})();

function crearTexto(clase, texto) {
  return UI.crear('p', { clase, texto });
}

document.addEventListener('DOMContentLoaded', () => {
  App.iniciar();
});