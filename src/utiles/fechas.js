'use strict';

/**
 * Utilidades de fecha para el control de prestamos y devoluciones.
 *
 * Las fechas se manejan internamente con el formato 'AAAA-MM-DD' (sin hora),
 * que SQLite almacena y ordena correctamente como texto.
 */

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha de hoy en formato 'AAAA-MM-DD' segun la hora local. */
function hoy() {
  const ahora = new Date();
  return aIso(ahora);
}

/** Convierte un objeto Date (o 'AAAA-MM-DD') a 'AAAA-MM-DD'. */
function aIso(fecha) {
  if (typeof fecha === 'string') {
    if (REGEX_FECHA.test(fecha)) return fecha;
    const desdeTexto = new Date(fecha);
    return Number.isNaN(desdeTexto.getTime()) ? null : aIso(desdeTexto);
  }

  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return null;

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Verifica que el texto sea una fecha real (tambien rechaza 31/02). */
function esFechaValida(texto) {
  if (typeof texto !== 'string' || !REGEX_FECHA.test(texto)) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;

  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio &&
         fecha.getMonth() === mes - 1 &&
         fecha.getDate() === dia;
}

/** Suma (o resta) dias a una fecha 'AAAA-MM-DD'. */
function sumarDias(fechaIso, dias) {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia + dias);
  return aIso(fecha);
}

/** Dias entre dos fechas (positivo si `hasta` es posterior a `desde`). */
function diasEntre(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const utc1 = Date.UTC(a1, m1 - 1, d1);
  const utc2 = Date.UTC(a2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86400000);
}

/** Un prestamo esta atrasado si la fecha limite ya paso y sigue activo. */
function estaVencida(fechaLimite, referencia) {
  return fechaLimite < (referencia || hoy());
}

/**
 * Estado de un prestamo para mostrarlo en pantalla:
 *   'devuelto' -> ya fue devuelto
 *   'atrasado'  -> paso la fecha limite y sigue prestado
 *   'por_vencer'-> vence hoy o manana
 *   'vigente'   -> dentro del plazo
 */
function estadoPrestamo(fechaLimite, fechaDevolucion, referencia) {
  const hoyTexto = referencia || hoy();

  if (fechaDevolucion) return 'devuelto';
  if (fechaLimite < hoyTexto) return 'atrasado';

  const diasRestantes = diasEntre(hoyTexto, fechaLimite);
  return diasRestantes <= 1 ? 'por_vencer' : 'vigente';
}

/** Formato 'AAAA-MM-DD' -> 'DD/MM/AAAA' para mostrar al usuario. */
function formatear(fechaIso) {
  if (!fechaIso) return '';
  if (!REGEX_FECHA.test(fechaIso)) {
    const fecha = new Date(fechaIso);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleDateString('es-EC');
  }
  const [anio, mes, dia] = fechaIso.split('-');
  return `${dia}/${mes}/${anio}`;
}

const ETIQUETAS = {
  vigente: 'En plazo',
  por_vencer: 'Por vencer',
  atrasado: 'Atrasado',
  devuelto: 'Devuelto'
};

function etiquetaEstado(estado) {
  return ETIQUETAS[estado] || estado;
}

module.exports = {
  hoy,
  aIso,
  esFechaValida,
  sumarDias,
  diasEntre,
  estaVencida,
  estadoPrestamo,
  formatear,
  etiquetaEstado,
  REGEX_FECHA
};