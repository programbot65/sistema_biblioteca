'use strict';

/** Convierte un valor a entero positivo, o devuelve `porDefecto`. */
function entero(valor, porDefecto = null) {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) return porDefecto;
  return numero;
}

/** Interpreta 'true'/'1'/'si' como verdadero. */
function booleano(valor, porDefecto = false) {
  if (valor === undefined || valor === null || valor === '') return porDefecto;
  const texto = String(valor).toLowerCase();
  return texto === 'true' || texto === '1' || texto === 'si' || texto === 'sí';
}

/** Recorta un texto de entrada y limita su longitud. */
function texto(valor, largoMaximo = 200) {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim().slice(0, largoMaximo);
}

/** Lee un parametro de paginacion y limita el maximo de registros. */
function paginacion(query, maximo = 200) {
  const limite = Math.min(entero(query.limite, 24), maximo);
  const offset = entero(query.offset, 0);
  return { limite: Math.max(1, limite), offset };
}

module.exports = { entero, booleano, texto, paginacion };