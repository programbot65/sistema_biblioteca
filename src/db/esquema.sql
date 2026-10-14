-- =====================================================================
-- Base de datos: Biblioteca UEEA
-- Motor: SQLite (módulo nativo de Node.js, sin costo de licencia)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Tabla: categorias
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL UNIQUE,
  descripcion TEXT
);

-- ---------------------------------------------------------------------
-- Tabla: libros
-- Un libro con mas de un ejemplar se registra como varias filas
-- (una por codigo / ejemplar fisico).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS libros (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo        TEXT    NOT NULL UNIQUE,          -- codigo del ejemplar
  titulo        TEXT    NOT NULL,
  autor         TEXT    NOT NULL,
  categoria_id  INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  anio          INTEGER,
  editorial     TEXT,
  descripcion   TEXT,
  portada       TEXT,                             -- ruta o URL de la imagen
  cantidad      INTEGER NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
  activo        INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_libros_titulo      ON libros (titulo);
CREATE INDEX IF NOT EXISTS idx_libros_autor       ON libros (autor);
CREATE INDEX IF NOT EXISTS idx_libros_categoria   ON libros (categoria_id);
CREATE INDEX IF NOT EXISTS idx_libros_activo      ON libros (activo);

-- ---------------------------------------------------------------------
-- Tabla: estudiantes
-- Solo se guardan los datos minimos necesarios para el prestamo.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estudiantes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cedula      TEXT    NOT NULL UNIQUE,
  nombre      TEXT    NOT NULL,
  curso       TEXT    NOT NULL,
  creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_cedula ON estudiantes (cedula);
CREATE INDEX IF NOT EXISTS idx_estudiantes_nombre ON estudiantes (nombre);

-- ---------------------------------------------------------------------
-- Tabla: prestamos
-- El estado se deriva de la fecha limite, pero se almacena para
-- facilitar los filtros y las consultas del panel.
--   activo   -> el libro esta prestado y no ha sido devuelto
--   devuelto -> se registro la devolucion
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestamos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_id         INTEGER NOT NULL REFERENCES libros(id) ON DELETE RESTRICT,
  estudiante_id    INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
  fecha_prestamo   TEXT    NOT NULL,
  fecha_limite     TEXT    NOT NULL,
  fecha_devolucion TEXT,
  estado           TEXT    NOT NULL DEFAULT 'activo'
                         CHECK (estado IN ('activo', 'devuelto')),
  renovaciones     INTEGER NOT NULL DEFAULT 0,
  observaciones    TEXT,
  registrado_en    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prestamos_estado      ON prestamos (estado);
CREATE INDEX IF NOT EXISTS idx_prestamos_libro       ON prestamos (libro_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_estudiante  ON prestamos (estudiante_id);
CREATE INDEX IF NOT EXISTS idx_prestamos_fecha_limite ON prestamos (fecha_limite);

-- Se permite historial: un libro puede prestarse y devolverse varias veces,
-- pero no puede tener dos prestamos activos al mismo tiempo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prestamo_activo_por_libro
  ON prestamos (libro_id) WHERE estado = 'activo';