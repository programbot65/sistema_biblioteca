'use strict';

/**
 * Utilidades de texto para la busqueda "inteligente".
 *
 * La idea es no depender solo de coincidencias exactas: se normaliza el
 * texto (sin tildes ni mayusculas), se separa en palabras y se comparan
 * las palabras usando similitud, de modo que "cienca" encuentre
 * "Ciencias" y "biologa" encuentre "Biologia".
 */

const PALABRAS_VACIAS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas',
  'y', 'e', 'o', 'u', 'en', 'con', 'por', 'para', 'para', 'a', 'al',
  'the', 'of', 'and'
]);

/**
 * Palabras relacionadas por tema. Si el usuario escribe una de estas,
 * el buscador tambien prueba con la otra. Permite busquedas mas
 * flexibles como "matematica" -> "Matematicas".
 */
const SINONIMOS = {
  ciencia: ['ciencias', 'cientifico'],
  ciencias: ['ciencia', 'cientifico'],
  matematica: ['matematicas', 'matematico'],
  matematicas: ['matematica', 'matematico'],
  fisica: ['fisicas', 'fisico'],
  quimica: ['quimicas', 'quimico'],
  biologia: ['biologicas', 'biologico'],
  literatura: ['literarias', 'literario', 'novela', 'cuento'],
  novela: ['literatura', 'cuento'],
  cuento: ['literatura', 'novela'],
  historia: ['historico', 'historica'],
  programacion: ['programar', 'codigo', 'software'],
  codigo: ['programacion', 'software'],
  informatico: ['informatica', 'computacion'],
  informatica: ['informatico', 'computacion'],
  robotica: ['robot', 'robots'],
  robot: ['robotica'],
  administrativa: ['administracion', 'gestion'],
  administracion: ['administrativa', 'gestion'],
  contabilidad: ['contable', 'contabilidad'],
  derecho: ['juridico', 'ley', 'leyes'],
  economia: ['economico', 'economica'],
  educacion: ['educativo', 'educativa', 'pedagogia'],
  english: ['ingles', 'idioma'],
  ingles: ['english', 'idioma']
};

/** Quita tildes, pasa a minusculas y deja solo letras, numeros y espacios. */
function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Divide el texto normalizado en palabras relevantes. */
function tokenizar(texto) {
  return normalizar(texto)
    .split(' ')
    .filter((palabra) => palabra.length > 1 && !PALABRAS_VACIAS.has(palabra));
}

/** Expande los terminos con sus palabras relacionadas (maximo una expansion). */
function expandirTerminos(terminos) {
  const expandidos = new Set(terminos);
  for (const termino of terminos) {
    const relacionados = SINONIMOS[termino];
    if (relacionados) relacionados.forEach((palabra) => expandidos.add(palabra));
    // Tambien considera la version en singular/plural mas cercana.
    if (termino.endsWith('as')) expandidos.add(termino.slice(0, -2) + 'a');
    if (termino.endsWith('es')) expandidos.add(termino.slice(0, -2) + 'a');
  }
  return [...expandidos];
}

/** Distancia de Levenshtein (ediciones necesarias para llegar de `a` a `b`). */
function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(actual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + costo);
    }
    anterior = actual;
  }

  return anterior[b.length];
}

/**
 * Similitud entre 0 y 1. Usa distancia de edicion relative al largo
 * de la palabra: 1 = identicas, 0 = sin relacion.
 */
function similitud(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const largo = Math.max(a.length, b.length);
  return Math.max(0, 1 - distanciaLevenshtein(a, b) / largo);
}

/** Indica si dos palabras son "casi" iguales (tolerancia a errores de escritura). */
function sonSimilares(a, b, tolerancia = 0.25) {
  if (a === b) return true;
  // Solo compara palabras de largo similar para evitar falsos positivos.
  const diferencia = Math.abs(a.length - b.length);
  if (diferencia > 2) return false;
  return similitud(a, b) >= 1 - tolerancia;
}

/**
 * Puntua que tanto un texto coincide con los terminos buscados.
 * Devuelve 0 si no hay ninguna coincidencia.
 *
 * Ponderacion:
 *   - la palabra completa esta en el texto .............. 10
 *   - el texto empieza con la palabra ................. 7
 *   - la palabra es parte del texto .................... 4
 *   - la palabra es parecida (error de escritura) ..... 2.5
 *   - la palabra es synonymous ...................... 1.5
 */
function puntuarTexto(texto, terminos, terminosExpandidos) {
  const objetivo = normalizar(texto);
  if (!objetivo) return 0;
  const palabrasObjetivo = objetivo.split(' ').filter(Boolean);
  const originales = new Set(terminos);

  let puntaje = 0;
  let coincidencias = 0;

  for (const termino of terminos) {
    let mejor = 0;

    if (objetivo === termino) {
      mejor = 10;
    } else if (objetivo.includes(termino)) {
      mejor = objetivo.startsWith(termino) ? 7 : 4;
    } else if (palabrasObjetivo.some((palabra) => sonSimilares(palabra, termino))) {
      mejor = 2.5;
    }

    if (mejor === 0 && terminosExpandidos.length) {
      const tieneRelacionado = terminosExpandidos.some(
        (expandido) => !originales.has(expandido) && objetivo.includes(expandido)
      );
      mejor = tieneRelacionado ? 1.5 : 0;
    }

    if (mejor > 0) {
      puntaje += mejor;
      coincidencias += 1;
    }
  }

  // Bonus cuando aparecen varias palabras distintas de la consulta.
  if (coincidencias > 1) puntaje += (coincidencias - 1) * 3;

  // Bonus si el texto es corto y coincide: un titulo exacto vale mas.
  if (coincidencias > 0) {
    const proporcion = terminos.length / Math.max(palabrasObjetivo.length, 1);
    puntaje *= 1 + proporcion * 0.5;
  }

  return puntaje;
}

/** Quita acentos y caracteres especiales para mostrar en pantalla. */
function limpiar(texto) {
  return normalizar(texto).replace(/\b\w/g, (letra) => letra.toUpperCase());
}

module.exports = {
  normalizar,
  tokenizar,
  expandirTerminos,
  distanciaLevenshtein,
  similitud,
  sonSimilares,
  puntuarTexto,
  limpiar,
  PALABRAS_VACIAS,
  SINONIMOS
};