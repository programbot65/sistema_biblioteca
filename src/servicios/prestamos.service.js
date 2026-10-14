'use strict';

/**
 * Servicio de prestamos y devoluciones.
 *
 * Aqui viven las reglas de negocio y las validaciones (RF05, RF06, RF07):
 * no se puede prestar un ejemplar ya prestado, se respetan los limites de
 * prestamos por estudiante y las fechas se calculan automaticamente.
 */

const config = require('../config');
const fechas = require('../utiles/fechas');
const librosRepo = require('../repositorios/libros.repo');
const estudiantesRepo = require('../repositorios/estudiantes.repo');
const prestamosRepo = require('../repositorios/prestamos.repo');

class ErrorNegocio extends Error {
  constructor(mensaje, estadoHttp = 400, detalles = null) {
    super(mensaje);
    this.name = 'ErrorNegocio';
    this.estadoHttp = estadoHttp;
    this.detalles = detalles;
  }
}

const CURSOS_VALIDOS = [
  '1ro de Bachillerato',
  '2do de Bachillerato',
  '3ro de Bachillerato',
  '4to de Bachillerato',
  '5to de Bachillerato',
  '6to de Bachillerato',
  '1ro de Técnico',
  '2do de Técnico',
  '3ro de Técnico',
  '4to de Técnico',
  'Otros'
];

/** Anade el estado calculado (vigente, atrasado, etc.) que usa la interfaz. */
function decorar(prestamo) {
  if (!prestamo) return null;
  const situacion = fechas.estadoPrestamo(
    prestamo.fecha_limite,
    prestamo.fecha_devolucion
  );

  const hoy = fechas.hoy();
  return {
    ...prestamo,
    situacion,
    situacion_texto: fechas.etiquetaEstado(situacion),
    dias_restantes: prestamo.estado === 'activo'
      ? fechas.diasEntre(hoy, prestamo.fecha_limite)
      : null,
    dias_retraso: situacion === 'atrasado'
      ? Math.abs(fechas.diasEntre(prestamo.fecha_limite, hoy))
      : 0
  };
}

function decorarLista(lista) {
  return lista.map(decorar);
}

/** Normaliza y valida los datos que llegan del formulario de prestamo. */
function validarDatosPrestamo(datos) {
  const errores = [];

  const nombre = String(datos.nombre || '').trim();
  const cedula = String(datos.cedula || '').trim();
  const curso = String(datos.curso || '').trim();
  const libroId = Number(datos.libro_id);
  const fechaPrestamo = datos.fecha_prestamo ? fechas.aIso(datos.fecha_prestamo) : fechas.hoy();
  const diasPrestamo = Number(datos.dias_prestamo) || config.diasPrestamo;

  if (!nombre) {
    errores.push({ campo: 'nombre', mensaje: 'El nombre completo es obligatorio.' });
  } else if (nombre.length < 5) {
    errores.push({ campo: 'nombre', mensaje: 'El nombre debe tener al menos 5 caracteres.' });
  } else if (!/[a-zA-ZáéíóúñÑ]{3,}/.test(nombre)) {
    errores.push({ campo: 'nombre', mensaje: 'El nombre no parece válido.' });
  }

  if (!cedula) {
    errores.push({ campo: 'cedula', mensaje: 'La cédula es obligatoria.' });
  } else if (!/^\d{6,10}$/.test(cedula)) {
    errores.push({
      campo: 'cedula',
      mensaje: 'La cédula debe tener entre 6 y 10 dígitos, sin letras ni guiones.'
    });
  }

  if (!curso) {
    errores.push({ campo: 'curso', mensaje: 'El curso es obligatorio.' });
  } else if (!CURSOS_VALIDOS.includes(curso)) {
    errores.push({ campo: 'curso', mensaje: 'El curso seleccionado no es válido.' });
  }

  if (!Number.isInteger(libroId) || libroId <= 0) {
    errores.push({ campo: 'libro_id', mensaje: 'Debe seleccionar un libro del catálogo.' });
  }

  if (!fechas.esFechaValida(fechaPrestamo)) {
    errores.push({ campo: 'fecha_prestamo', mensaje: 'La fecha de préstamo no es válida.' });
  } else if (fechaPrestamo > fechas.hoy()) {
    errores.push({ campo: 'fecha_prestamo', mensaje: 'La fecha de préstamo no puede ser futura.' });
  }

  if (!Number.isInteger(diasPrestamo) || diasPrestamo < 1 || diasPrestamo > 60) {
    errores.push({ campo: 'dias_prestamo', mensaje: 'El plazo debe estar entre 1 y 60 días.' });
  }

  return {
    errores,
    datos: { nombre, cedula, curso, libroId, fechaPrestamo, diasPrestamo,
      observaciones: String(datos.observaciones || '').trim() || null }
  };
}

/** Registra un prestamo (RF05). */
function registrar(datos) {
  const { errores, datos: limpios } = validarDatosPrestamo(datos);
  if (errores.length) {
    throw new ErrorNegocio('Los datos del préstamo no son válidos.', 422, errores);
  }

  const libro = librosRepo.obtenerPorId(limpios.libroId);
  if (!libro || !libro.activo) {
    throw new ErrorNegocio('El libro seleccionado no existe en el catálogo.', 404);
  }

  const prestadoAhora = prestamosRepo.activoDelLibro(limpios.libroId);
  if (prestadoAhora) {
    throw new ErrorNegocio(
      `El ejemplar ${libro.codigo} ya está prestado y debe devolverse antes de prestarlo otra vez.`,
      409
    );
  }

  const estudiante = estudiantesRepo.obtenerOCrear({
    cedula: limpios.cedula,
    nombre: limpios.nombre,
    curso: limpios.curso
  });

  const activos = prestamosRepo.contarActivosDelEstudiante(estudiante.id);
  if (activos >= config.maximoPrestamosActivosPorEstudiante) {
    throw new ErrorNegocio(
      `El estudiante ya tiene ${activos} préstamos activos y el máximo es ${config.maximoPrestamosActivosPorEstudiante}.`,
      409
    );
  }

  const prestamo = prestamosRepo.registrar({
    libroId: libro.id,
    estudianteId: estudiante.id,
    fechaPrestamo: limpios.fechaPrestamo,
    diasPrestamo: limpios.diasPrestamo,
    observaciones: limpios.observaciones
  });

  return {
    prestamo: decorar(prestamo),
    libro: librosRepo.obtenerPorId(libro.id),
    estudiante,
    aviso: `Préstamo registrado. El libro se debe devolver el ${fechas.formatear(prestamo.fecha_limite)}.`
  };
}

/** Registra la devolucion (RF06). */
function devolver(prestamoId, fechaDevolucion) {
  const id = Number(prestamoId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorNegocio('El préstamo indicado no es válido.');
  }

  const prestamo = prestamosRepo.obtenerPorId(id);
  if (!prestamo) {
    throw new ErrorNegocio('El préstamo no existe.', 404);
  }
  if (prestamo.estado === 'devuelto') {
    throw new ErrorNegocio('Este préstamo ya había sido devuelto.', 409);
  }

  const fecha = fechaDevolucion ? fechas.aIso(fechaDevolucion) : fechas.hoy();
  if (!fechas.esFechaValida(fecha)) {
    throw new ErrorNegocio('La fecha de devolución no es válida.');
  }
  if (fecha < prestamo.fecha_prestamo) {
    throw new ErrorNegocio('La devolución no puede ser anterior al préstamo.');
  }
  if (fecha > fechas.hoy()) {
    throw new ErrorNegocio('La fecha de devolución no puede ser futura.');
  }

  const actualizado = prestamosRepo.registrarDevolucion(id, fecha);
  return {
    prestamo: decorar(actualizado),
    libro: librosRepo.obtenerPorId(actualizado.libro_id),
    aviso: `Devolución registrada. El ejemplar ${actualizado.codigo} vuelve a estar disponible.`
  };
}

/** Renova el plazo de un prestamo activo. */
function renovar(prestamoId, diasExtra = config.diasPrestamo) {
  const id = Number(prestamoId);
  const prestamo = prestamosRepo.obtenerPorId(id);

  if (!prestamo) throw new ErrorNegocio('El préstamo no existe.', 404);
  if (prestamo.estado !== 'activo') {
    throw new ErrorNegocio('Solo se pueden renovar préstamos activos.', 409);
  }
  if (prestamo.renovaciones >= config.maximoRenovaciones) {
    throw new ErrorNegocio(
      `El préstamo ya fue renovado ${prestamo.renovaciones} veces (máximo ${config.maximoRenovaciones}).`,
      409
    );
  }

  const dias = Math.max(1, Number(diasExtra) || config.diasPrestamo);
  const base = prestamo.fecha_limite < fechas.hoy() ? fechas.hoy() : prestamo.fecha_limite;
  const actualizado = prestamosRepo.renovar(id, dias, fechas.sumarDias(base, dias));

  return {
    prestamo: decorar(actualizado),
    aviso: `Préstamo renovado hasta el ${fechas.formatear(actualizado.fecha_limite)}.`
  };
}

function listar(filtros = {}) {
  const prestamos = decorarLista(prestamosRepo.listar(filtros));
  return { prestamos, total: prestamos.length };
}

function detalle(id) {
  return decorar(prestamosRepo.obtenerPorId(Number(id)));
}

function historialEstudiante(id) {
  const datos = estudiantesRepo.historial(Number(id));
  if (!datos) return null;
  return { ...datos, prestamos: decorarLista(datos.prestamos) };
}

function buscarEstudiantes(filtros = {}) {
  return estudiantesRepo.buscar(filtros);
}

/** Prestamos atrasados agrupados por curso, para el panel de gestion. */
function atrasadosPorCurso() {
  const prestamos = decorarLista(prestamosRepo.atrasados(200));
  const agrupado = new Map();

  for (const prestamo of prestamos) {
    const clave = prestamo.estudiante_curso || 'Sin curso';
    const actual = agrupado.get(clave) || { curso: clave, total: 0, estudiantes: new Set() };
    actual.total += 1;
    actual.estudiantes.add(prestamo.estudiante_nombre);
    agrupado.set(clave, actual);
  }

  return [...agrupado.values()]
    .map(({ curso, total, estudiantes }) => ({
      curso,
      total,
      estudiantes: estudiantes.size
    }))
    .sort((a, b) => b.total - a.total);
}

module.exports = {
  ErrorNegocio,
  registrar,
  devolver,
  renovar,
  listar,
  detalle,
  historialEstudiante,
  buscarEstudiantes,
  atrasadosPorCurso,
  decorar,
  decorarLista,
  validarDatosPrestamo,
  CURSOS_VALIDOS
};