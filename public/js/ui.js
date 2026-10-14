'use strict';

/**
 * Utilidades de la interfaz: creacion de elementos, avisos flotantes,
 * ventana modal, formato de fechas y portada de libros.
 *
 * Se evita usar innerHTML con datos del usuario: el texto siempre se
 * inserta con textContent para no permitir inyeccion de codigo.
 */

window.UI = (() => {
  const contenedorAvisos = () => document.getElementById('avisos');

  /** Crea un elemento con atributos e hijos de forma segura. */
  function crear(etiqueta, atributos = {}, hijos = []) {
    const elemento = document.createElement(etiqueta);

    for (const [clave, valor] of Object.entries(atributos)) {
      if (valor === undefined || valor === null || valor === false) continue;

      if (clave === 'clase') {
        elemento.className = valor;
      } else if (clave === 'texto') {
        elemento.textContent = valor;
      } else if (clave === 'estilo') {
        // Varias declaraciones: "ancho: 10px; color: red"
        elemento.style.cssText = valor;
      } else if (clave === 'variables') {
        // Variables CSS propias (--alto, --tono, ...) usadas por las piezas 3D.
        for (const [nombre, valorVariable] of Object.entries(valor)) {
          if (valorVariable === undefined || valorVariable === null) continue;
          elemento.style.setProperty(nombre, String(valorVariable));
        }
      } else if (clave.startsWith('on') && typeof valor === 'function') {
        elemento.addEventListener(clave.slice(2).toLowerCase(), valor);
      } else if (clave === 'dataset') {
        for (const [dato, datoValor] of Object.entries(valor)) {
          if (datoValor !== undefined && datoValor !== null) {
            elemento.dataset[dato] = datoValor;
          }
        }
      } else {
        elemento.setAttribute(clave, valor === true ? '' : valor);
      }
    }

    for (const hijo of [].concat(hijos)) {
      if (hijo === null || hijo === undefined || hijo === false) continue;
      elemento.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
    }

    return elemento;
  }

  /** Aviso flotante temporal. */
  function aviso(mensaje, tipo = 'info', duracion = 4000) {
    const elemento = crear('div', { clase: `aviso aviso--${tipo}`, texto: mensaje });
    contenedorAvisos().append(elemento);

    setTimeout(() => {
      elemento.style.opacity = '0';
      setTimeout(() => elemento.remove(), 250);
    }, duracion);
  }

  const exito = (mensaje) => aviso(mensaje, 'exito');
  const error = (mensaje) => aviso(mensaje, 'error', 6000);
  const alerta = (mensaje) => aviso(mensaje, 'alerta', 6000);

  /** Muestra un error de la API con su mensaje y, si hay, el detalle. */
  function errorApi(fallo) {
    const mensaje = fallo instanceof Api.ErrorApi
      ? fallo.mensaje
      : 'Ocurrio un error inesperado. Intente nuevamente.';
    error(mensaje);
    if (!(fallo instanceof Api.ErrorApi)) console.error(fallo);
  }

  // ---------- Ventana modal ----------
  const modal = () => document.getElementById('modal');
  const cuerpoModal = () => document.getElementById('modal-cuerpo');
  const tituloModal = () => document.getElementById('modal-titulo');

  function abrirModal(titulo, contenido) {
    tituloModal().textContent = titulo;
    cuerpoModal().replaceChildren(contenido);
    modal().hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function cerrarModal() {
    modal().hidden = true;
    cuerpoModal().replaceChildren();
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-cerrar-modal]')) cerrarModal();
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !modal().hidden) cerrarModal();
  });

  // ---------- Formato ----------
  const fecha = (texto) => {
    if (!texto) return '—';
    const partes = String(texto).slice(0, 10).split('-');
    if (partes.length !== 3) return texto;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const fechaCorta = (texto) => {
    if (!texto) return '—';
    const partes = String(texto).slice(0, 10).split('-');
    if (partes.length !== 3) return texto;
    return `${partes[2]}/${partes[1]}`;
  };

  const hoy = () => new Date().toISOString().slice(0, 10);

  function sumarDias(fechaIso, dias) {
    const [anio, mes, dia] = fechaIso.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia + dias);
    return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
  }

  const ETIQUETAS = {
    disponible: 'Disponible',
    prestado: 'Prestado',
    agotado: 'Todos prestados',
    vigente: 'En plazo',
    por_vencer: 'Por vencer',
    atrasado: 'Atrasado',
    devuelto: 'Devuelto'
  };

  const insignia = (estado) =>
    crear('span', { clase: `insignia insignia--${estado}`, texto: ETIQUETAS[estado] || estado });

  /**
   * Portada del libro. Si no hay imagen registrada se dibuja una portada
   * con el titulo, para no depender de archivos externos ni de Internet.
   */
  function portada(libro, clase = 'libro__portada') {
    if (libro.portada) {
      return crear('img', {
        clase,
        src: libro.portada,
        alt: `Portada de ${libro.titulo}`,
        loading: 'lazy'
      });
    }

    const texto = libro.titulo.length > 42
      ? `${libro.titulo.slice(0, 40)}…`
      : libro.titulo;

    return crear('div', {
      clase,
      texto,
      title: libro.titulo,
      'aria-label': `Portada de ${libro.titulo}`
    });
  }

  /**
   * Crea un elemento SVG a partir de una etiqueta.
   * Solo se usa con marcado escrito en el propio codigo del proyecto
   * (iconos), nunca con informacion que venga del usuario.
   */
  function crearSvg(markup, opciones = {}) {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = markup;
    const svg = contenedor.firstElementChild;

    if (!svg) return document.createTextNode('');

    if (opciones.clase) svg.setAttribute('class', opciones.clase);
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }

  /** Muestra un mensaje cuando una lista no tiene resultados. */
  const vacio = (mensaje) => crear('p', { clase: 'vacio', texto: mensaje });

  /** Desplaza la pagina hasta un elemento, si el entorno lo permite. */
  function desplazarA(elemento) {
    try {
      if (elemento && typeof elemento.scrollIntoView === 'function') {
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (error) {
      // Algunos entornos no implementan el desplazamiento: no es grave.
    }
  }

  /** Texto a partir de un valor: evita mostrar "undefined" en pantalla. */
  const oTexto = (valor, sustituto = '—') =>
    (valor === null || valor === undefined || valor === '' ? sustituto : valor);

  /** Marca los campos con error devueltos por la API. */
  function marcarErrores(formulario, detalles) {
    formulario.querySelectorAll('.campo').forEach((campo) => {
      campo.classList.remove('campo--error');
      const mensaje = campo.querySelector('.campo__error');
      if (mensaje) mensaje.textContent = '';
    });

    for (const detalle of detalles || []) {
      const entrada = formulario.querySelector(`[name="${detalle.campo}"]`);
      if (!entrada) continue;
      const campo = entrada.closest('.campo');
      if (!campo) continue;
      campo.classList.add('campo--error');
      const mensaje = campo.querySelector('.campo__error');
      if (mensaje) mensaje.textContent = detalle.mensaje;
    }
  }

  /** Crea un campo de formulario completo con su etiqueta y mensaje de error. */
  function campo({ etiqueta, nombre, tipo = 'text', valor = '', requerido = false, ayuda, opciones }) {
    const atributos = {
      type: tipo,
      name: nombre,
      id: nombre,
      required: requerido,
      inputmode: tipo === 'tel' ? 'numeric' : null
    };

    const entrada = opciones
      ? crear('select', atributos, opciones.map((opcion) => {
          const valorOpcion = typeof opcion === 'string' ? opcion : opcion.valor;
          const texto = typeof opcion === 'string' ? opcion : opcion.texto;
          return crear('option', { valor: valorOpcion, texto }, []);
        }))
      : crear('input', { ...atributos, value: valor });

    if (opciones && valor) entrada.value = valor;

    return crear('div', { clase: 'campo' }, [
      crear('label', { for: nombre, texto: `${etiqueta}${requerido ? ' *' : ''}` }),
      entrada,
      ayuda ? crear('span', { clase: 'campo__ayuda', texto: ayuda }) : null,
      crear('span', { clase: 'campo__error' })
    ]);
  }

  return {
    crear, aviso, exito, error, alerta, errorApi,
    abrirModal, cerrarModal,
    fecha, fechaCorta, hoy, sumarDias,
    insignia, portada, vacio, oTexto, campo, marcarErrores, desplazarA, crearSvg, ETIQUETAS
  };
})();