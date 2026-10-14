'use strict';

/**
 * Rutas del encargado de biblioteca.
 *
 * Todas requieren la clave de administracion: registrar o modificar libros
 * es una operacion interna de la institucion (RF04).
 */

const express = require('express');
const db = require('../db');
const librosRepo = require('../repositorios/libros.repo');
const catalogo = require('../servicios/catalogo.service');
const consulta = require('../middleware/consulta');
const { ErrorValidacion, envolver } = require('../middleware/errores');
const { requiereClaveAdmin } = require('../middleware/autenticacion');

const router = express.Router();

router.use(requiereClaveAdmin);

/** Valida los datos de un libro antes de guardarlo (RF04). */
function validarLibro(datos, { parcial = false } = {}) {
  const errores = [];
  const limpia = {};

  if (!parcial || datos.codigo !== undefined) {
    const codigo = consulta.texto(datos.codigo, 30).toUpperCase();
    if (!codigo) {
      errores.push({ campo: 'codigo', mensaje: 'El código del ejemplar es obligatorio.' });
    } else if (!/^[A-Z0-9][A-Z0-9-]{2,29}$/.test(codigo)) {
      errores.push({
        campo: 'codigo',
        mensaje: 'El código debe tener al menos 3 caracteres, sin espacios ni símbolos.'
      });
    } else {
      limpia.codigo = codigo;
    }
  }

  if (!parcial || datos.titulo !== undefined) {
    const titulo = consulta.texto(datos.titulo, 200);
    if (!titulo) {
      errores.push({ campo: 'titulo', mensaje: 'El título es obligatorio.' });
    } else if (titulo.length < 3) {
      errores.push({ campo: 'titulo', mensaje: 'El título debe tener al menos 3 caracteres.' });
    } else {
      limpia.titulo = titulo;
    }
  }

  if (!parcial || datos.autor !== undefined) {
    const autor = consulta.texto(datos.autor, 120);
    if (!autor) {
      errores.push({ campo: 'autor', mensaje: 'El autor es obligatorio.' });
    } else {
      limpia.autor = autor;
    }
  }

  if (datos.categoria_id !== undefined) {
    const categoriaId = datos.categoria_id === '' || datos.categoria_id === null
      ? null
      : Number(datos.categoria_id);

    if (categoriaId !== null) {
      const existe = db.obtener('SELECT id FROM categorias WHERE id = ?', categoriaId);
      if (!existe) {
        errores.push({ campo: 'categoria_id', mensaje: 'La categoría indicada no existe.' });
      } else {
        limpia.categoria_id = categoriaId;
      }
    } else {
      limpia.categoria_id = null;
    }
  }

  if (datos.anio !== undefined && datos.anio !== '' && datos.anio !== null) {
    const anio = Number(datos.anio);
    if (!Number.isInteger(anio) || anio < 1000 || anio > new Date().getFullYear() + 1) {
      errores.push({ campo: 'anio', mensaje: 'El año de publicación no es válido.' });
    } else {
      limpia.anio = anio;
    }
  }

  if (datos.cantidad !== undefined && datos.cantidad !== '') {
    const cantidad = Number(datos.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
      errores.push({ campo: 'cantidad', mensaje: 'La cantidad debe estar entre 1 y 99.' });
    } else {
      limpia.cantidad = cantidad;
    }
  }

  for (const campo of ['editorial', 'descripcion', 'portada']) {
    if (datos[campo] !== undefined) {
      limpia[campo] = consulta.texto(datos[campo], campo === 'descripcion' ? 1000 : 200) || null;
    }
  }

  if (datos.activo !== undefined) {
    limpia.activo = consulta.booleano(datos.activo, true) ? 1 : 0;
  }

  if (errores.length) {
    throw new ErrorValidacion('Revise los datos del libro.', 422, errores);
  }

  return limpia;
}

/** POST /api/admin/libros */
router.post('/libros', envolver((req, res) => {
  const datos = validarLibro(req.body || {});

  if (librosRepo.existeCodigo(datos.codigo)) {
    throw new ErrorValidacion(
      `Ya existe un ejemplar con el código ${datos.codigo}.`,
      409,
      [{ campo: 'codigo', mensaje: 'Este código ya está en uso.' }]
    );
  }

  res.status(201).json({
    libro: catalogo.decorar(librosRepo.crear(datos)),
    mensaje: `Libro registrado con el código ${datos.codigo}.`
  });
}));

/** PUT /api/admin/libros/:id  (actualiza informacion, RF04) */
router.put('/libros/:id', envolver((req, res) => {
  const id = Number(req.params.id);
  const existente = librosRepo.obtenerPorId(id);

  if (!existente) throw new ErrorValidacion('El libro no existe.', 404);

  const datos = validarLibro(req.body || {}, { parcial: true });

  if (datos.codigo && datos.codigo !== existente.codigo &&
      librosRepo.existeCodigo(datos.codigo, id)) {
    throw new ErrorValidacion(
      `Ya existe otro ejemplar con el código ${datos.codigo}.`,
      409,
      [{ campo: 'codigo', mensaje: 'Este código ya está en uso.' }]
    );
  }

  res.json({
    libro: catalogo.decorar(librosRepo.actualizar(id, datos)),
    mensaje: 'Información del libro actualizada.'
  });
}));

/** DELETE /api/admin/libros/:id  (baja lógica: conserva el historial) */
router.delete('/libros/:id', envolver((req, res) => {
  const id = Number(req.params.id);
  const existente = librosRepo.obtenerPorId(id);

  if (!existente) throw new ErrorValidacion('El libro no existe.', 404);

  const tieneActivo = Number(existente.prestados || 0) > 0;
  if (tieneActivo) {
    throw new ErrorValidacion(
      'No se puede dar de baja un libro que tiene un préstamo activo. Registre primero la devolución.',
      409
    );
  }

  librosRepo.desactivar(id);
  res.json({ mensaje: `El ejemplar ${existente.codigo} se dio de baja en el catálogo.` });
}));

/** POST /api/admin/libros/:id/reactivar */
router.post('/libros/:id/reactivar', envolver((req, res) => {
  const id = Number(req.params.id);
  if (!librosRepo.obtenerPorId(id)) {
    throw new ErrorValidacion('El libro no existe.', 404);
  }
  librosRepo.reactivar(id);
  res.json({
    libro: catalogo.decorar(librosRepo.obtenerPorId(id)),
    mensaje: 'El libro vuelve a estar activo en el catálogo.'
  });
}));

/** POST /api/admin/categorias */
router.post('/categorias', envolver((req, res) => {
  const nombre = consulta.texto((req.body || {}).nombre, 60);
  if (!nombre) {
    throw new ErrorValidacion('Revise los datos de la categoría.', 422, [
      { campo: 'nombre', mensaje: 'El nombre de la categoría es obligatorio.' }
    ]);
  }

  const existe = db.obtener('SELECT id FROM categorias WHERE nombre = ?', nombre);
  if (existe) {
    throw new ErrorValidacion('La categoría ya existe.', 409);
  }

  const resultado = db.ejecutar(
    'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
    nombre,
    consulta.texto((req.body || {}).descripcion, 200) || null
  );

  res.status(201).json({
    categoria_id: Number(resultado.lastInsertRowid),
    categorias: catalogo.categorias(),
    mensaje: `Categoría "${nombre}" creada.`
  });
}));

module.exports = router;