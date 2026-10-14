'use strict';

/**
 * Servicio de estadisticas para el panel principal (RF08).
 * Todas las cifras se calculan en el momento a partir de la base de datos,
 * por lo que el panel nunca muestra informacion desactualizada.
 */

const db = require('../db');
const fechas = require('../utiles/fechas');
const prestamosRepo = require('../repositorios/prestamos.repo');
const estudiantesRepo = require('../repositorios/estudiantes.repo');

function contar(sql, ...parametros) {
  const fila = db.obtener(sql, ...parametros);
  if (!fila) return 0;
  return Number(Object.values(fila)[0] || 0);
}

function resumen() {
  const hoy = fechas.hoy();

  const ejemplares = contar('SELECT COUNT(*) AS total FROM libros WHERE activo = 1');
  const titulos = contar('SELECT COUNT(DISTINCT titulo || \' | \' || autor) AS total FROM libros WHERE activo = 1');
  const prestados = contar("SELECT COUNT(*) AS total FROM prestamos WHERE estado = 'activo'");
  const disponibles = Math.max(0, ejemplares - prestados);
  const atrasados = contar(
    "SELECT COUNT(*) AS total FROM prestamos WHERE estado = 'activo' AND fecha_limite < ?", hoy
  );
  const porVencer = contar(
    "SELECT COUNT(*) AS total FROM prestamos WHERE estado = 'activo' AND fecha_limite >= ? AND fecha_limite <= ?",
    hoy, fechas.sumarDias(hoy, 1)
  );
  const devueltosHoy = contar(
    "SELECT COUNT(*) AS total FROM prestamos WHERE estado = 'devuelto' AND fecha_devolucion = ?", hoy
  );
  const devueltosMes = contar(
    "SELECT COUNT(*) AS total FROM prestamos WHERE estado = 'devuelto' AND fecha_devolucion >= ?",
    `${hoy.slice(0, 7)}-01`
  );
  const estudiantes = contar('SELECT COUNT(*) AS total FROM estudiantes');

  return {
    ejemplares,
    titulos,
    disponibles,
    prestados,
    atrasados,
    por_vencer: porVencer,
    pendientes: prestados,
    devueltos_hoy: devueltosHoy,
    devueltos_mes: devueltosMes,
    estudiantes,
    porcentaje_prestados: ejemplares ? Math.round((prestados / ejemplares) * 100) : 0,
    fecha: hoy
  };
}

/** Prestamos por dia durante los ultimos `dias` dias (para el grafico). */
function prestamosPorDia(dias = 14) {
  const hoy = fechas.hoy();
  const desde = fechas.sumarDias(hoy, -(Number(dias) - 1));

  const registros = db.todas(
    `SELECT fecha_prestamo AS fecha, COUNT(*) AS total
     FROM prestamos
     WHERE fecha_prestamo >= ?
     GROUP BY fecha_prestamo`,
    desde
  );

  const indice = new Map(registros.map((registro) => [registro.fecha, Number(registro.total)]));
  const serie = [];

  for (let i = 0; i < dias; i += 1) {
    const fecha = fechas.sumarDias(desde, i);
    serie.push({ fecha, total: indice.get(fecha) || 0 });
  }

  return serie;
}

/** Libros mas prestados: ayuda al encargado a decidir compras futuras. */
function masPrestados(limite = 5) {
  return db.todas(
    `SELECT l.id, l.codigo, l.titulo, l.autor, c.nombre AS categoria,
            COUNT(p.id) AS veces_prestado
     FROM libros l
     JOIN prestamos p ON p.libro_id = l.id
     LEFT JOIN categorias c ON c.id = l.categoria_id
     WHERE l.activo = 1
     GROUP BY l.id
     ORDER BY veces_prestado DESC, l.titulo COLLATE NOCASE ASC
     LIMIT ?`,
    limite
  );
}

/** Distribucion de libros por categoria. */
function porCategoria() {
  return db.todas(
    `SELECT c.nombre AS categoria,
            COUNT(l.id) AS ejemplares,
            SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) AS disponibles
     FROM categorias c
     LEFT JOIN libros l ON l.categoria_id = c.id AND l.activo = 1
     LEFT JOIN prestamos p ON p.libro_id = l.id AND p.estado = 'activo'
     GROUP BY c.id
     ORDER BY ejemplares DESC, c.nombre COLLATE NOCASE ASC`
  );
}

/** Toda la informacion que necesita el panel principal en una sola peticion. */
function panel() {
  return {
    resumen: resumen(),
    ultimos_prestamos: prestamosRepo.ultimos(8).map((prestamo) => {
      const situacion = fechas.estadoPrestamo(prestamo.fecha_limite, prestamo.fecha_devolucion);
      return {
        id: prestamo.id,
        codigo: prestamo.codigo,
        titulo: prestamo.titulo,
        portada: prestamo.portada,
        estudiante: prestamo.estudiante_nombre,
        cedula: prestamo.cedula,
        curso: prestamo.estudiante_curso,
        fecha_prestamo: prestamo.fecha_prestamo,
        fecha_limite: prestamo.fecha_limite,
        fecha_devolucion: prestamo.fecha_devolucion,
        situacion,
        situacion_texto: fechas.etiquetaEstado(situacion)
      };
    }),
    prestamos_por_dia: prestamosPorDia(14),
    mas_prestados: masPrestados(5),
    por_categoria: porCategoria(),
    estudiantes_mas_activos: estudiantesRepo.masActivos(5)
  };
}

module.exports = {
  resumen,
  panel,
  prestamosPorDia,
  masPrestados,
  porCategoria
};