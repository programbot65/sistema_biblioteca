'use strict';

/**
 * Comprobacion de la geometria del carrusel con medidas reales de pantalla.
 *
 * No dibuja nada: calcula donde quedaria cada libro en un escritorio, una
 * tableta y un telefono, y avisa si algun libro se sale de la zona visible o
 * se solapa con el nucleo central de forma incorrecta.
 *
 * Uso: npm run revisar:geometria
 */

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const RAIZ = path.join(__dirname, '..');

const PANTALLAS = [
  { nombre: 'escritorio 1920x1080', ancho: 1920, alto: 1080, libro: 172, zonaAncho: 1168, zonaAlto: 660 },
  { nombre: 'laptop 1366x768     ', ancho: 1366, alto: 768, libro: 172, zonaAncho: 1168, zonaAlto: 538 },
  { nombre: 'tablet 820x1180     ', ancho: 820, alto: 1180, libro: 158, zonaAncho: 782, zonaAlto: 540 },
  { nombre: 'telefono 390x844    ', ancho: 390, alto: 844, libro: 124, zonaAncho: 338, zonaAlto: 540 },
  { nombre: 'telefono 360x640    ', ancho: 360, alto: 640, libro: 108, zonaAncho: 338, zonaAlto: 400 }
];

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { runScripts: 'outside-only' });
dom.window.eval(fs.readFileSync(path.join(RAIZ, 'public', 'js', 'navegacion.js'), 'utf8'));
const { calcularPosicion } = dom.window.Navegacion;

const GRADO = Math.PI / 180;

/** Escala que tendrian los libros de los lados (a 90 grados). */
function compactoEscala(pantalla) {
  const compacto = pantalla.zonaAncho < 640;
  const base = compacto ? 0.56 : 0.62;
  const maximo = compacto ? 0.92 : 1;
  return base + (maximo - base) * 0.5;
}

/** Reproduce `calcularMedidas` con medidas de pantalla reales. */
function medidasDe(pantalla) {
  const compacto = pantalla.zonaAncho < 640;
  const escalaLateral = compactoEscala(pantalla);
  const radioMaximo = Math.max(pantalla.zonaAncho / 2 - (pantalla.libro * escalaLateral) / 2 - 8, 30);
  const radioX = Math.min(pantalla.zonaAncho * 0.36, radioMaximo);

  return {
    ancho: pantalla.zonaAncho,
    alto: pantalla.zonaAlto,
    radioX,
    radioZ: radioX * (compacto ? 0.42 : 0.5),
    arco: radioX * 0.16,
    escalaBase: compacto ? 0.56 : 0.62,
    escalaMax: compacto ? 0.92 : 1,
    difuminadoMax: compacto ? 2.5 : 3.6,
    inclinacion: compacto ? 9 : 15,
    desplazamiento: pantalla.zonaAlto * 0.16
  };
}

/** Caja que ocupa un libro, ya escalado e inclinado. */
function caja(libro, medidas, angulo, escalaLibro) {
  const p = calcularPosicion(angulo, medidas);
  const ancho = libro * p.escala;
  const alto = (medidas.alto === 0 ? 232 : libro * 1.35) * p.escala;
  const giro = Math.abs(p.giro) * GRADO;

  // Altura extra que aporta la inclinacion.
  const altoTotal = ancho * Math.sin(giro) + alto * Math.cos(giro);

  return {
    angulo,
    frente: p.frente,
    escala: p.escala,
    opacidad: p.opacidad,
    centroX: medidas.ancho / 2 + p.x,
    centroY: medidas.alto / 2 + p.y,
    medioAncho: ancho / 2,
    medioAlto: altoTotal / 2,
    escalaLibro
  };
}

let problemas = 0;

console.log('');
for (const pantalla of PANTALLAS) {
  const medidas = medidasDe(pantalla);
  const total = 4;
  const paso = 360 / total;
  console.log(`── ${pantalla.nombre} ──`);
  console.log(`   zona ${medidas.ancho}x${medidas.alto} · radio ${medidas.radioX.toFixed(0)}px · paso ${paso}°`);

  const cajas = [];
  for (let i = 0; i < total; i += 1) {
    const c = caja(pantalla.libro, medidas, i * paso, pantalla.libro);
    cajas.push(c);

    if (c.opacidad < 0.05) {
      console.log(`   libro ${i}: oculto (detras del nucleo) - correcto`);
      continue;
    }

    const izquierda = c.centroX - c.medioAncho;
    const derecha = c.centroX + c.medioAncho;
    const arriba = c.centroY - c.medioAlto;
    const abajo = c.centroY + c.medioAlto;

    const sale = izquierda < 0 || derecha > medidas.ancho || arriba < 0 || abajo > medidas.alto;
    const estado = sale ? 'SE SALE' : 'ok';

    console.log(
      `   libro ${i}: x ${izquierda.toFixed(0)}–${derecha.toFixed(0)}  ` +
      `y ${arriba.toFixed(0)}–${abajo.toFixed(0)}  ` +
      `escala ${c.escala.toFixed(2)}  opacidad ${c.opacidad.toFixed(2)}  ${estado}`
    );

    if (sale) problemas += 1;
  }

  // Solapamiento entre libros visibles.
  for (let a = 0; a < cajas.length; a += 1) {
    for (let b = a + 1; b < cajas.length; b += 1) {
      const A = cajas[a];
      const B = cajas[b];
      if (A.opacidad < 0.05 || B.opacidad < 0.05) continue;

      const solapaX = Math.abs(A.centroX - B.centroX) < A.medioAncho + B.medioAncho;
      const solapaY = Math.abs(A.centroY - B.centroY) < A.medioAlto + B.medioAlto;

      if (solapaX && solapaY) {
        console.log(`   AVISO: los libros ${a} y ${b} se solapan`);
        problemas += 1;
      }
    }
  }

  // El libro del frente debe quedar por debajo del nucleo, no tapado.
  const frente = cajas[0];
  const arribaFrente = frente.centroY - frente.medioAlto;
  const nucleoCentroY = medidas.alto * 0.4;
  const nucleoAbajo = nucleoCentroY + medidas.ancho * 0.1;
  const solapaNucleo = arribaFrente < nucleoAbajo;

  console.log(`   nucleo ${(nucleoCentroY - medidas.ancho * 0.1).toFixed(0)}–${nucleoAbajo.toFixed(0)} · ` +
    `libro del frente desde ${arribaFrente.toFixed(0)} · ` +
    `${solapaNucleo ? 'el frente se superpone (deseado)' : 'sin solape'}`);
  console.log('');
}

console.log(problemas === 0
  ? 'Resultado: ningun libro se sale ni se solapa de forma incorrecta.'
  : `Resultado: ${problemas} problema(s) de colocacion.`);

dom.window.close();
process.exit(problemas === 0 ? 0 : 1);
