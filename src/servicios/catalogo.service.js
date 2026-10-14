'use strict';

/**
 * Servicio del catalogo: listado, consulta detallada, busqueda inteligente
 * y recomendaciones (RF01, RF02, RF03, RF09).
 */

const librosRepo = require('../repositorios/libros.repo');
const prestamosRepo = require('../repositorios/prestamos.repo');
const texto = require('../utiles/texto');

/** Peso de cada campo dentro del puntaje de la busqueda inteligente. */
const PESOS = {
  codigo: 4,
  titulo: 3,
  autor: 2.5,
  categoria: 2,
  descripcion: 1
};

const ESTADOS = ['disponible', 'prestado', 'agotado'];

/** Estado visible de un libro a partir de sus ejemplares y prestamos. */
function calcularEstado(disponibles) {
  if (disponibles > 0) return 'disponible';
  return 'agotado';
}

/** Agrega los campos derivados que la interfaz necesita. */
function decorar(libro) {
  if (!libro) return null;
  const disponibles = Number(libro.disponibles || 0);
  return {
    ...libro,
    activos: Number(libro.activos ?? libro.cantidad ?? 0),
    disponibles,
    prestados: Number(libro.prestados || 0),
    estado: calcularEstado(disponibles)
  };
}

function decorarLista(libros) {
  return libros.map(decorar);
}

/**
 * Filtra una lista en memoria usando el puntaje de coincidencia.
 * Se usa cuando hay texto de busqueda: en lugar de exigir el texto exacto,
 * el sistema acepta palabras parecidos o relacionadas.
 */
function puntuarLibros(libros, consulta) {
  const terminos = texto.tokenizar(consulta);
  const codigo = texto.normalizar(consulta).replace(/\s+/g, '');
  if (!terminos.length && !codigo) return [];

  const expandidos = texto.expandirTerminos(terminos);

  const resultados = libros.map((libro) => {
    // Un codigo exacto siempre gana la busqueda.
    if (codigo && texto.normalizar(libro.codigo).replace(/\s+/g, '') === codigo) {
      return { libro, puntaje: 1000, motivo: 'codigo' };
    }

    let puntaje = 0;
    const coincidencias = [];

    const campos = [
      ['codigo', libro.codigo],
      ['titulo', libro.titulo],
      ['autor', libro.autor],
      ['categoria', libro.categoria],
      ['descripcion', libro.descripcion]
    ];

    for (const [campo, valor] of campos) {
      const parcial = texto.puntuarTexto(valor, terminos, expandidos);
      if (parcial > 0) {
        puntaje += parcial * PESOS[campo];
        coincidencias.push(campo);
      }
    }

    return { libro, puntaje, motivo: coincidencias[0] || null };
  });

  return resultados
    .filter((resultado) => resultado.puntaje > 0)
    .sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      // A igual puntaje se muestra primero lo que esta disponible.
      const dispA = Number(a.libro.disponibles || 0);
      const dispB = Number(b.libro.disponibles || 0);
      if (dispA !== dispB) return dispB - dispA;
      return String(a.libro.titulo).localeCompare(String(b.libro.titulo), 'es');
    });
}

/**
 * Catalogo con filtros. Si hay `q` se usa la busqueda inteligente;
 * en caso contrario se filtra directamente en la base de datos.
 */
function listar(opciones = {}) {
  const {
    q = '',
    categoriaId = null,
    estado = null,
    orden = 'titulo',
    limite = 24,
    offset = 0
  } = opciones;

  const busquedaTexto = String(q || '').trim();

  if (busquedaTexto) {
    const candidatos = librosRepo.todosParaBuscar();
    let resultados = puntuarLibros(candidatos, busquedaTexto);

    if (categoriaId) {
      resultados = resultados.filter((r) => Number(r.libro.categoria_id) === Number(categoriaId));
    }
    if (estado) {
      resultados = resultados.filter((r) => decorar(r.libro).estado === estado);
    }

    const pagina = resultados.slice(offset, offset + limite);
    return {
      libros: decorarLista(pagina.map((r) => r.libro)),
      total: resultados.length,
      consulta: busquedaTexto,
      inteligente: true,
      sugerencias: texto.expandirTerminos(texto.tokenizar(busquedaTexto)).slice(0, 5)
    };
  }

  let libros = librosRepo.listar({
    categoriaId,
    orden,
    limite: estado ? -1 : limite,
    offset: estado ? 0 : offset,
    soloActivos: true
  });

  if (estado) {
    const decorados = decorarLista(libros);
    libros = decorados.filter((libro) => libro.estado === estado);
    libros = libros.slice(offset, offset + limite);
    return { libros, total: libros.length, consulta: '', inteligente: false, sugerencias: [] };
  }

  return { libros: decorarLista(libros), total: libros.length, consulta: '', inteligente: false, sugerencias: [] };
}

/** Ficha completa de un libro: datos, disponibilidad, prestamo actual y similares. */
function detalle(id) {
  const libro = decorar(librosRepo.obtenerPorId(id));
  if (!libro) return null;

  const prestamoActual = libro.prestados > 0
    ? prestamosRepo.activoDelLibro(libro.id)
    : null;

  return {
    ...libro,
    prestamo_actual: prestamoActual,
    relacionados: recomendar({ libroId: id, limite: 4 }).libros
  };
}

/**
 * Recomendaciones sencillas: primero libros de la misma categoria y,
 * si no hay suficientes, libros del mismo autor o con palabras del titulo
 * en comun.
 */
function recomendar({ libroId = null, categoriaId = null, autor = null, titulo = null, limite = 6 } = {}) {
  const referencia = libroId ? librosRepo.obtenerPorId(libroId) : null;
  const catId = categoriaId ?? (referencia ? referencia.categoria_id : null);
  const autorRef = autor ?? (referencia ? referencia.autor : null);
  const tituloRef = titulo ?? (referencia ? referencia.titulo : null);

  const candidatos = librosRepo.todosParaBuscar().filter((libro) =>
    !referencia || libro.id !== referencia.id
  );

  const palabrasTitulo = tituloRef ? texto.tokenizar(tituloRef) : [];
  const autorNormalizado = autorRef ? texto.normalizar(autorRef) : '';

  const puntuados = candidatos
    .map((libro) => {
      let puntaje = 0;
      const motivos = [];

      if (catId && Number(libro.categoria_id) === Number(catId)) {
        puntaje += 10;
        motivos.push('misma categoría');
      }
      if (autorNormalizado && texto.normalizar(libro.autor) === autorNormalizado) {
        puntaje += 7;
        motivos.push('mismo autor');
      }
      if (palabrasTitulo.length) {
        const comunes = palabrasTitulo.filter((palabra) =>
          texto.normalizar(libro.titulo).includes(palabra)
        ).length;
        if (comunes > 0) {
          puntaje += comunes * 2;
          motivos.push('título relacionado');
        }
      }

      return { libro, puntaje, motivos };
    })
    .filter((resultado) => resultado.puntaje > 0)
    .sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      const dispA = Number(a.libro.disponibles || 0);
      const dispB = Number(b.libro.disponibles || 0);
      if (dispA !== dispB) return dispB - dispA;
      return String(a.libro.titulo).localeCompare(String(b.libro.titulo), 'es');
    });

  return {
    libro_referencia: referencia
      ? { id: referencia.id, titulo: referencia.titulo, autor: referencia.autor, categoria: referencia.categoria }
      : null,
    libros: conMotivo(puntuados.slice(0, limite))
  };
}

/** Agrega el motivo de la recomendacion a cada libro. */
function conMotivo(resultados) {
  return resultados.map(({ libro, motivos }) => ({
    ...decorar(libro),
    motivo_recomendacion: motivos.join(' · ')
  }));
}

function categorias() {
  return librosRepo.listarCategorias().map((categoria) => ({
    ...categoria,
    total_libros: Number(categoria.total_libros || 0)
  }));
}

module.exports = {
  listar,
  detalle,
  recomendar,
  categorias,
  decorar,
  decorarLista,
  calcularEstado,
  ESTADOS
};