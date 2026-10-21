'use strict';

/**
 * Motor de navegacion circular (inspirado en la corona de un reloj inteligente).
 *
 * Este archivo NO contiene estilos ni crea elementos: solo calcula posiciones,
 * profundidad y gestos. La parte visual vive en `css/estanteria.css` y la
 * construccion de los libros en `js/vistas/portada.js`.
 *
 * El motor coloca cada elemento sobre un anillo en el espacio 3D y expone:
 *   - rueda del raton -> avanza de un libro al siguiente (con acumulacion
 *                        fraccionaria, para no saltarse pasos con poca rueda)
 *   - arrastre        -> giro libre con inercia al soltar
 *   - teclado         -> flechas izquierda/derecha, Inicio y Fin
 *   - foco y clic     -> centra el libro y avisa cuando queda al frente
 *
 * Todo el movimiento ocurre dentro de un unico `requestAnimationFrame`, que
 * escribe unicamente `transform`, `opacity`, `filter` y `--frente` en cada
 * elemento. No se tocan propiedades que provoquen recalculo de la pagina.
 */

window.Navegacion = (() => {
  const GRADO = Math.PI / 180;
  const EPSILON = 0.05;

  const limitar = (valor, min, max) => Math.min(max, Math.max(min, valor));

  /** Interpolacion suave (smoothstep) entre dos bordes. */
  function suavizar(borde0, borde1, valor) {
    const t = limitar((valor - borde0) / (borde1 - borde0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /** Diferencia angular minima entre dos angulos, en el rango (-180, 180]. */
  function diferenciaAngular(a, b) {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  }

  /**
   * Posicion de un elemento sobre el anillo.
   *
   * @param {number} angulo  angulo en grados (0 = justo delante).
   * @param {object} medidas parametros del anillo.
   * @returns {{x,y,z,escala,opacidad,difuminado,giro,capa,frente}}
   *
   * `frente` vale 1 cuando el elemento esta frente a la persona y 0 cuando
   * queda en el lado opuesto del anillo, detras del nucleo central.
   */
  function calcularPosicion(angulo, medidas) {
    const {
      radioX,
      radioZ = radioX * 0.5,
      arco = radioX * 0.2,
      escalaBase = 0.62,
      escalaMax = 1,
      difuminadoMax = 3.6,
      inclinacion = 15,
      desplazamiento = 0
    } = medidas;

    const rad = angulo * GRADO;
    const seno = Math.sin(rad);
    const coseno = Math.cos(rad);

    const x = seno * radioX;
    const z = coseno * radioZ;

    // El anillo se curva hacia arriba por detras y el libro del frente queda
    // por debajo del nucleo central, de modo que nunca lo tapan por completo.
    const y = desplazamiento + (1 - coseno) * arco;

    // 1 = frente, 0 = parte posterior del anillo.
    const frente = (z / radioZ + 1) / 2;

    // Los elementos de la parte posterior se desvanecen por completo para
    // que nunca se solapen con el nucleo central.
    let opacidad = suavizar(0.04, 0.42, frente);
    opacidad *= opacidad;

    return {
      x,
      y,
      z,
      escala: escalaBase + (escalaMax - escalaBase) * frente,
      opacidad,
      difuminado: Math.max(0, (1 - frente) * difuminadoMax),
      // Inclinacion suave: los libros de los lados se inclinan como un abanico.
      giro: -seno * inclinacion,
      capa: Math.round(frente * 900),
      frente
    };
  }

  /**
   * Crea y controla un carrusel circular.
   *
   * @param {object} opciones
   * @param {HTMLElement} opciones.contenedor zona donde viven los elementos.
   * @param {HTMLElement[]} opciones.elementos los elementos a colocar.
   * @param {(indice:number)=>void} [opciones.alCentrar] libro que llega al frente.
   * @param {(indice:number, confirmado:boolean)=>void} [opciones.alElegir]
   *        `confirmado` indica que el usuario ya hizo clic (no solo el foco).
   * @param {number} [opciones.radioRelativo] radio como parte del ancho (0.5 = mitad).
   * @param {(medidas:object)=>void} [opciones.alRedimensionar]
   * @returns {object} API del carrusel.
   */
  function crear(opciones) {
    const {
      contenedor,
      elementos,
      alCentrar = null,
      alElegir = null,
      radioRelativo = 0.36,
      alRedimensionar = null
    } = opciones;

    const total = elementos.length;
    const paso = total > 0 ? 360 / total : 360;
    const ciclo = paso * total;

    const estado = {
      angulo: 0,
      anguloNormalizado: 0,
      objetivo: 0,
      velocidad: 0,
      arrastrando: false,
      conInercia: false,
      punteroX: 0,
      punteroT: 0,
      acumuladoRueda: 0,
      indice: -1,
      hover: -1,
      idBucle: null,
      ultimoTiempo: 0,
      destruido: false,
      medidas: null,
      temporizadorRueda: null,
      temporizadorApertura: null
    };

    // Ajustes del movimiento: se pueden cambiar segun se prefiera la sensacion.
    const parametros = {
      rigidez: 15,           // rapidez con la que el anillo busca su posicion
      rozamiento: 4.6,       // freno de la inercia al soltar el arrastre
      umbralInercia: 8,      // velocidad minima para seguir girando (grados/s)
      sensibilidadRueda: 90, // grados de rueda que equivalen a un paso
      sensibilidadTiro: 0.28 // grados por pixel de arrastre
    };

    const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    /** Indica si la persona pidio menos animacion en el sistema. */
    const conMovimientoReducido = () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------- Medidas del anillo ----------
    function calcularMedidas() {
      const ancho = Math.max(contenedor.clientWidth || 0, 320);
      const alto = Math.max(contenedor.clientHeight || 0, 320);
      const anchoLibro = elementos[0] ? elementos[0].offsetWidth || 170 : 170;
      const compacto = ancho < 640;

      const escalaBase = compacto ? 0.56 : 0.62;
      const escalaMax = compacto ? 0.92 : 1;

      /*
        Los libros de los lados ya se ven mas pequenos, asi que el radio
        maximo se calcula con la mitad de su ancho real (y no con el ancho
        completo). Asi ningun libro toca el borde ni se monta sobre el
        libro del frente en pantallas pequenas.
      */
      const escalaLateral = escalaBase + (escalaMax - escalaBase) * 0.5;
      const margen = 8;
      const radioMaximo = Math.max(ancho / 2 - (anchoLibro * escalaLateral) / 2 - margen, 30);
      const radioX = Math.min(ancho * radioRelativo, radioMaximo);

      estado.medidas = {
        ancho,
        alto,
        radioX,
        radioZ: radioX * (compacto ? 0.42 : 0.5),
        arco: radioX * 0.16,
        escalaBase,
        escalaMax,
        difuminadoMax: compacto ? 2.5 : 3.6,
        inclinacion: compacto ? 9 : 15,
        // Empuja el anillo hacia abajo para que el libro del frente quede
        // por debajo del nucleo central en lugar de taparlo.
        desplazamiento: alto * 0.16
      };

      return estado.medidas;
    }

    // ---------- Pintado ----------
    /**
     * En el tema claro el fondo es mas claro: los libros del fondo se
     * desvanecen demasiado y parecerian papel mojado. Ahi se les da mas
     * presencia y menos desenfoque.
     */
    function ajustesDelTema() {
      let claro = false;
      try {
        claro = document.documentElement.dataset.tema === 'claro';
      } catch (error) { claro = false; }
      return claro
        ? { opacidad: 2.1, difuminado: 0.5 }
        : { opacidad: 1, difuminado: 1 };
    }

    function colocar() {
      const { medidas } = estado;
      if (!medidas) return;

      const limiteSalida = medidas.ancho / 2 + medidas.radioX;
      const tema = ajustesDelTema();

      elementos.forEach((elemento, indice) => {
        const p = calcularPosicion(estado.anguloNormalizado + indice * paso, medidas);

        // Un elemento muy lejos del centro se oculta por completo: asi nunca
        // se sale de la pantalla ni se superpone de forma incorrecta.
        const dentro = Math.abs(p.x) < limiteSalida;

        elemento.style.transform =
          `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, ${p.z.toFixed(2)}px) ` +
          `scale(${p.escala.toFixed(3)}) rotateZ(${p.giro.toFixed(2)}deg)`;

        const opacidad = dentro ? Math.min(1, p.opacidad * tema.opacidad) : 0;
        elemento.style.opacity = opacidad.toFixed(3);
        elemento.style.zIndex = String(dentro ? p.capa : 0);

        const difuminado = p.difuminado * tema.difuminado;
        elemento.style.filter = difuminado > 0.15 ? `blur(${difuminado.toFixed(2)}px)` : '';
        elemento.style.setProperty('--frente', p.frente.toFixed(3));
      });

      const nuevoIndice = indiceDelFrente();
      if (nuevoIndice !== estado.indice) {
        const anterior = estado.indice;
        estado.indice = nuevoIndice;

        if (anterior >= 0 && elementos[anterior]) {
          elementos[anterior].classList.remove('es-frente');
          elementos[anterior].setAttribute('aria-current', 'false');
        }
        if (elementos[nuevoIndice]) {
          elementos[nuevoIndice].classList.add('es-frente');
          elementos[nuevoIndice].setAttribute('aria-current', 'true');
        }
        if (alCentrar) alCentrar(nuevoIndice);
      }
    }

    /**
     * Reduce el angulo a un rango pequeno y lo refleja en `anguloNormalizado`.
     * Asi los numeros no crecen sin limite aunque el usuario gire mucho, y
     * `indiceDelFrente` siempre trabaja sobre un valor comparable.
     */
    function normalizarAngulo() {
      estado.anguloNormalizado = ((estado.angulo % ciclo) + ciclo) % ciclo;
      if (estado.anguloNormalizado > ciclo / 2) estado.anguloNormalizado -= ciclo;
      return estado.anguloNormalizado;
    }

    /** Indice del elemento mas cercano al frente. */
    function indiceDelFrente() {
      if (!total) return -1;
      const cerca = Math.round(-estado.anguloNormalizado / paso);
      return ((cerca % total) + total) % total;
    }

    // ---------- Bucle de animacion ----------
    function fotograma(tiempo) {
      if (estado.destruido) return;

      const dt = estado.ultimoTiempo ? limitar((tiempo - estado.ultimoTiempo) / 1000, 0, 0.05) : 0.016;
      estado.ultimoTiempo = tiempo;

      if (!estado.arrastrando) {
        if (estado.conInercia) {
          estado.angulo += estado.velocidad * dt;
          estado.velocidad *= Math.exp(-parametros.rozamiento * dt);

          if (Math.abs(estado.velocidad) < parametros.umbralInercia) {
            estado.conInercia = false;
            estado.velocidad = 0;
            ajustarAlMasCercano();
          }
        } else {
          const diferencia = estado.objetivo - estado.angulo;
          estado.angulo += diferencia * (1 - Math.exp(-parametros.rigidez * dt));
          if (Math.abs(diferencia) < EPSILON) estado.angulo = estado.objetivo;
        }
      }

      // El angulo se mantiene en un rango pequeno: asi los numeros no crecen
      // sin limite aunque el usuario gire el anillo muchas veces.
      normalizarAngulo();

      colocar();

      estado.idBucle = window.requestAnimationFrame(fotograma);
    }

    function arrancar() {
      if (estado.idBucle === null && !estado.destruido) {
        estado.ultimoTiempo = 0;
        estado.idBucle = window.requestAnimationFrame(fotograma);
      }
    }

    function parar() {
      if (estado.idBucle !== null) {
        window.cancelAnimationFrame(estado.idBucle);
        estado.idBucle = null;
      }
    }

    // ---------- Objetivos ----------
    function ajustarAlMasCercano() {
      estado.objetivo = Math.round(estado.angulo / paso) * paso;
    }

    /** Centra el libro de un indice, por el giro mas corto. */
    function centrar(indice, inmediato = false) {
      if (!total || indice < 0 || indice >= total) return;

      // El angulo de un libro es `rotacion + indice * paso`. Para que el
      // libro `indice` quede justo delante, la rotacion debe ser su negativa.
      const base = -indice * paso;
      const actual = estado.angulo;
      let mejor = base;
      let mejorDistancia = Infinity;

      for (const vueltas of [0, 1, -1]) {
        const candidato = base + vueltas * ciclo;
        const distancia = Math.abs(diferenciaAngular(candidato, actual));
        if (distancia < mejorDistancia) {
          mejorDistancia = distancia;
          mejor = candidato;
        }
      }

      estado.objetivo = mejor;
      estado.velocidad = 0;
      estado.conInercia = false;

      if (inmediato || conMovimientoReducido()) {
        estado.angulo = mejor;
        normalizarAngulo();
        colocar();
      } else {
        arrancar();
      }
    }

    /** Avanza `cantidad` libros (positivo = hacia el siguiente). */
    function avanzar(cantidad = 1) {
      estado.objetivo -= paso * cantidad;
      arrancar();
    }

    // ---------- Gestos ----------
    function alGirarRueda(evento) {
      if (!total) return;
      evento.preventDefault();

      // Acumula el desplazamiento para no saltarse pasos con el raton.
      estado.acumuladoRueda += evento.deltaY / parametros.sensibilidadRueda;

      while (Math.abs(estado.acumuladoRueda) >= 1) {
        const direccion = estado.acumuladoRueda > 0 ? 1 : -1;
        estado.objetivo -= paso * direccion;
        estado.acumuladoRueda -= direccion;
      }

      clearTimeout(estado.temporizadorRueda);
      estado.temporizadorRueda = setTimeout(() => {
        estado.acumuladoRueda = 0;
        ajustarAlMasCercano();
      }, 140);

      arrancar();
    }

    function alPresionarPuntero(evento) {
      if (evento.button) return;

      estado.arrastrando = true;
      estado.conInercia = false;
      estado.velocidad = 0;
      estado.punteroX = evento.clientX;
      estado.punteroT = ahora();
      contenedor.classList.add('esta-arrastrando');
    }

    function alMoverPuntero(evento) {
      if (!estado.arrastrando) return;

      const momento = ahora();
      const deltaX = evento.clientX - estado.punteroX;
      const segundos = Math.max((momento - estado.punteroT) / 1000, 0.008);

      estado.angulo += deltaX * parametros.sensibilidadTiro;
      estado.objetivo = estado.angulo;
      estado.velocidad = (deltaX * parametros.sensibilidadTiro) / segundos;

      estado.punteroX = evento.clientX;
      estado.punteroT = momento;
    }

    function alSoltarPuntero() {
      if (!estado.arrastrando) return;

      estado.arrastrando = false;
      contenedor.classList.remove('esta-arrastrando');

      if (conMovimientoReducido()) {
        estado.velocidad = 0;
        estado.conInercia = false;
        ajustarAlMasCercano();
      } else if (Math.abs(estado.velocidad) > parametros.umbralInercia) {
        estado.conInercia = true;
      } else {
        ajustarAlMasCercano();
      }

      arrancar();
    }

    function alTecla(evento) {
      if (!total) return;

      const acciones = {
        ArrowRight: () => avanzar(1),
        ArrowDown: () => avanzar(1),
        ArrowLeft: () => avanzar(-1),
        ArrowUp: () => avanzar(-1),
        Home: () => centrar(0),
        End: () => centrar(total - 1)
      };

      const accion = acciones[evento.key];
      if (!accion) return;
      evento.preventDefault();
      accion();
    }

    function alEntrar(indice) {
      estado.hover = indice;
      contenedor.classList.add('tiene-hover');
    }

    function alSalir(indice) {
      if (estado.hover === indice) estado.hover = -1;
      if (estado.hover === -1) contenedor.classList.remove('tiene-hover');
    }

    // ---------- Enlaces con los elementos ----------
    elementos.forEach((elemento, indice) => {
      elemento.addEventListener('pointerenter', () => alEntrar(indice));
      elemento.addEventListener('pointerleave', () => alSalir(indice));

      // Al recibir el foco (teclado o tabulador) el libro se centra.
      elemento.addEventListener('focus', () => centrar(indice));

      elemento.addEventListener('click', (evento) => {
        evento.preventDefault();
        if (!alElegir) return;

        // El libro se centra primero y despues se abre la seccion: el
        // movimiento es breve y da la sensacion de abrir una aplicacion.
        centrar(indice);

        clearTimeout(estado.temporizadorApertura);
        const espera = conMovimientoReducido() ? 0 : 260;
        estado.temporizadorApertura = setTimeout(() => alElegir(indice, true), espera);
      });
    });

    contenedor.addEventListener('wheel', alGirarRueda, { passive: false });
    contenedor.addEventListener('pointerdown', alPresionarPuntero);
    contenedor.addEventListener('keydown', alTecla);
    window.addEventListener('pointermove', alMoverPuntero);
    window.addEventListener('pointerup', alSoltarPuntero);
    window.addEventListener('pointercancel', alSoltarPuntero);

    // La rueda solo desplaza el anillo cuando el puntero esta encima.
    contenedor.addEventListener('pointerenter', () => contenedor.classList.add('sobre-anillo'));
    contenedor.addEventListener('pointerleave', () => contenedor.classList.remove('sobre-anillo'));

    // ---------- Tamano ----------
    function alCambiarTamano() {
      calcularMedidas();
      colocar();
      if (alRedimensionar) alRedimensionar(estado.medidas);
    }

    /** Al cambiar el tema, los libros se vuelven a colocar con el nuevo ajuste. */
    function alCambiarTema() {
      colocar();
    }

    const observador = typeof ResizeObserver === 'function'
      ? new ResizeObserver(alCambiarTamano)
      : null;
    if (observador) observador.observe(contenedor);
    window.addEventListener('resize', alCambiarTamano);
    document.addEventListener('tema-cambiado', alCambiarTema);

    // ---------- Arranque ----------
    calcularMedidas();
    colocar();
    arrancar();

    return {
      centrar,
      avanzar,
      obtenerIndice: () => estado.indice,
      obtenerHover: () => estado.hover,
      obtenerEstado: () => ({
        angulo: estado.angulo,
        anguloNormalizado: estado.anguloNormalizado,
        objetivo: estado.objetivo,
        velocidad: estado.velocidad,
        inercia: estado.conInercia,
        arrastrando: estado.arrastrando,
        paso,
        total,
        indice: estado.indice,
        medidas: estado.medidas
      }),
      /** Coloca un indice sin animacion (util para pruebas). */
      fijarIndice(indice) {
        estado.angulo = -indice * paso;
        estado.objetivo = estado.angulo;
        estado.velocidad = 0;
        estado.conInercia = false;
        normalizarAngulo();
        colocar();
      },
      redimensionar: calcularMedidas,
      destruir() {
        estado.destruido = true;
        parar();
        clearTimeout(estado.temporizadorRueda);
        clearTimeout(estado.temporizadorApertura);
        if (observador) observador.disconnect();
        contenedor.removeEventListener('wheel', alGirarRueda);
        contenedor.removeEventListener('pointerdown', alPresionarPuntero);
        contenedor.removeEventListener('keydown', alTecla);
        window.removeEventListener('pointermove', alMoverPuntero);
        window.removeEventListener('pointerup', alSoltarPuntero);
        window.removeEventListener('pointercancel', alSoltarPuntero);
        window.removeEventListener('resize', alCambiarTamano);
        document.removeEventListener('tema-cambiado', alCambiarTema);
      }
    };
  }

  return { crear, calcularPosicion, limitar, suavizar, diferenciaAngular, GRADO };
})();
