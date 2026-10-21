'use strict';

/**
 * Servicio de la Biblioteca digital.
 *
 * Reutiliza la busqueda inteligente del catalogo (mismo motor de busqueda,
 * mismos filtros) y le anade la informacion que necesita el lector:
 *
 *   - si el libro tiene un PDF disponible para leer,
 *   - quien lo tiene prestado, desde cuando y hasta cuando.
 *
 * El estado del libro no se guarda en ningun sitio: se deduce siempre de los
 * prestamos activos, de modo que al registrar o devolver un prestamo la
 * seccion queda al dia sin tocar nada mas.
 */

const fs = require('node:fs');
const path = require('node:path');

const config = require('../config');
const catalogo = require('./catalogo.service');
const prestamos = require('./prestamos.service');
const prestamosRepo = require('../repositorios/prestamos.repo');
const librosRepo = require('../repositorios/libros.repo');

/** Extension y firma minima de un PDF valido. */
const FIRMA_PDF = '%PDF-';
const TAMANO_MAXIMO = 40 * 1024 * 1024; // 40 MB

/** Devuelve la ruta de la carpeta donde se guardan los PDF. */
function carpetaPdf() {
  return path.join(path.dirname(config.rutas.db), 'pdfs');
}

/** Ruta publica de un archivo: se guarda relativa a la carpeta de datos. */
function rutaRelativa(archivo) {
  return path.relative(path.dirname(config.rutas.db), archivo).split(path.sep).join('/');
}

/** Ruta absoluta en disco a partir de la ruta guardada. */
function rutaAbsoluta(relativa) {
  if (!relativa) return null;
  return path.resolve(path.dirname(config.rutas.db), relativa);
}

/**
 * Cuenta las paginas de un PDF mirando sus objetos de pagina.
 * Es una lectura aproximada: sirve para informar al lector, no para
 * modificar el documento.
 */
function contarPaginas(buffer) {
  if (!buffer || !buffer.length) return 0;

  const texto = buffer.toString('latin1');
  const paginas = texto.match(/\/Type\s*\/Page(?![s])/g);
  if (paginas && paginas.length) return paginas.length;

  const conteo = texto.match(/\/Count\s+(\d+)/);
  return conteo ? Number(conteo[1]) || 0 : 0;
}

/**
 * Comprueba que el archivo recibido sea un PDF de verdad.
 * @returns {string|null} El motivo del rechazo o null si todo esta bien.
 */
function revisarPdf(buffer) {
  if (!buffer || !buffer.length) {
    return 'El archivo está vacío.';
  }
  if (buffer.length > TAMANO_MAXIMO) {
    return 'El archivo supera el máximo de 40 MB.';
  }
  if (buffer.toString('latin1', 0, 5) !== FIRMA_PDF) {
    return 'El archivo no es un PDF válido.';
  }
  return null;
}

/**
 * Guarda el PDF de un libro en disco y deja anotada su ruta.
 * Si el libro ya tenia un archivo, el anterior se borra.
 */
function guardarArchivo(libroId, buffer) {
  const libro = librosRepo.obtenerPorId(libroId);
  if (!libro) return { error: 'El libro no existe.', estado: 404 };

  const problema = revisarPdf(buffer);
  if (problema) return { error: problema, estado: 422 };

  const carpeta = carpetaPdf();
  fs.mkdirSync(carpeta, { recursive: true });

  const nombre = `libro-${libro.id}.pdf`;
  const destino = path.join(carpeta, nombre);

  // Si ya habia un archivo con otro nombre, se retira.
  if (libro.archivo_pdf) {
    const anterior = rutaAbsoluta(libro.archivo_pdf);
    if (anterior && fs.existsSync(anterior)) {
      try { fs.unlinkSync(anterior); } catch (error) { /* no se pudo borrar */ }
    }
  }

  fs.writeFileSync(destino, buffer);
  librosRepo.guardarArchivo(libro.id, rutaRelativa(destino));

  return {
    libro: librosRepo.obtenerPorId(libro.id),
    paginas: contarPaginas(buffer),
    mensaje: `Se adjuntó el archivo PDF de "${libro.titulo}".`
  };
}

/** Quita el PDF de un libro (el historial de prestamos no se toca). */
function quitarArchivo(libroId) {
  const libro = librosRepo.obtenerPorId(libroId);
  if (!libro) return { error: 'El libro no existe.', estado: 404 };

  if (libro.archivo_pdf) {
    const archivo = rutaAbsoluta(libro.archivo_pdf);
    if (archivo && fs.existsSync(archivo)) {
      try { fs.unlinkSync(archivo); } catch (error) { /* no se pudo borrar */ }
    }
  }

  librosRepo.guardarArchivo(libro.id, null);
  return { libro: librosRepo.obtenerPorId(libro.id), mensaje: 'Se retiró el archivo PDF del libro.' };
}

/** Lee el PDF de un libro y devuelve su contenido y sus datos. */
function leerArchivo(libroId) {
  const libro = librosRepo.obtenerPorId(libroId);
  if (!libro) return { error: 'El libro no existe.', estado: 404 };
  if (!libro.archivo_pdf) {
    return { error: 'Este libro no tiene un archivo digital disponible.', estado: 404 };
  }

  const archivo = rutaAbsoluta(libro.archivo_pdf);
  if (!archivo || !fs.existsSync(archivo)) {
    return { error: 'El archivo digital de este libro no está disponible.', estado: 404 };
  }

  const buffer = fs.readFileSync(archivo);
  return {
    libro,
    buffer,
    paginas: contarPaginas(buffer),
    nombre: `${libro.titulo}.pdf`
  };
}

/**
 * Listado de la biblioteca digital: los libros del catalogo con la
 * informacion del prestamo actual y si tienen PDF para leer.
 */
function listar(opciones = {}) {
  const resultado = catalogo.listar(opciones);
  const activos = prestamos.decorarLista(prestamosRepo.activosConEstudiante());
  const porLibro = new Map(activos.map((prestamo) => [prestamo.libro_id, prestamo]));

  const libros = resultado.libros.map((libro) => {
    const prestamo = porLibro.get(libro.id) || null;
    return {
      ...libro,
      tiene_archivo: Boolean(libro.archivo_pdf),
      prestamo_actual: prestamo
        ? {
            id: prestamo.id,
            estudiante: {
              nombre: prestamo.estudiante_nombre,
              cedula: prestamo.cedula,
              curso: prestamo.estudiante_curso
            },
            fecha_prestamo: prestamo.fecha_prestamo,
            fecha_limite: prestamo.fecha_limite,
            situacion: prestamo.situacion,
            situacion_texto: prestamo.situacion_texto,
            dias_restantes: prestamo.dias_restantes,
            dias_retraso: prestamo.dias_retraso,
            renovaciones: prestamo.renovaciones
          }
        : null
    };
  });

  // Los prestamos activos de toda la biblioteca, no solo los de esta pagina:
  // son los libros que el estudiante tiene en su poder.
  const prestamosActivos = activos.map((prestamo) => {
    const libro = librosRepo.obtenerPorId(prestamo.libro_id);
    return {
      ...prestamo,
      titulo: libro ? libro.titulo : prestamo.titulo,
      portada: libro ? libro.portada : null,
      categoria: libro ? libro.categoria : null,
      tiene_archivo: Boolean(libro && libro.archivo_pdf)
    };
  });

  return { ...resultado, libros, prestamos_activos: prestamosActivos };
}

module.exports = {
  listar,
  guardarArchivo,
  quitarArchivo,
  leerArchivo,
  contarPaginas,
  revisarPdf,
  carpetaPdf,
  TAMANO_MAXIMO
};
