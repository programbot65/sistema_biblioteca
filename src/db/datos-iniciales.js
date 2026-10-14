'use strict';

/**
 * Datos iniciales de prueba para cargar la biblioteca.
 *
 * Mientras el encargado de biblioteca no entregue el listado real, se usan
 * estos libros (ver seccion 23 del plan: usar datos de prueba durante el
 * desarrollo y cargar los definitivos solo cuando el sistema este revisado).
 */

const CATEGORIAS = [
  { nombre: 'Literatura', descripcion: 'Novelas, cuentos y poesías' },
  { nombre: 'Ciencias Naturales', descripcion: 'Biología, química, física y ciencias de la tierra' },
  { nombre: 'Matemáticas', descripcion: 'Álgebra, geometría y cálculo' },
  { nombre: 'Ciencias Sociales', descripcion: 'Historia, geografía y ciudadanía' },
  { nombre: 'Lengua y Literatura', descripcion: 'Gramática, redacción y comunicación' },
  { nombre: 'Inglés', descripcion: 'Textos en idioma inglés' },
  { nombre: 'Informática', descripcion: 'Computación, programación y ofimática' },
  { nombre: 'Administración y Gestión', descripcion: 'Contabilidad, administración y gestión' }
];

const LIBROS = [
  // --- Literatura ---
  { codigo: 'LIT-001', titulo: 'Cien años de soledad', autor: 'Gabriel García Márquez', categoria: 'Literatura', anio: 1967, editorial: 'Editorial Labrys', cantidad: 2, descripcion: 'Novela de la familia Buendía en Macondo. Uno de los clásicos de la literatura latinoamericana.' },
  { codigo: 'LIT-002', titulo: 'El Principito', autor: 'Antoine de Saint-Exupéry', categoria: 'Literatura', anio: 1943, editorial: 'Editorial Salamandra', cantidad: 3, descripcion: 'Un viajero de otro planeta conversa con un niño sobre la amistad y lo esencial.' },
  { codigo: 'LIT-003', titulo: 'La metamorfosis', autor: 'Franz Kafka', categoria: 'Literatura', anio: 1915, editorial: 'Editorial Alba', cantidad: 1, descripcion: 'Un hombre se convierte en insecto y enfrenta el rechazo de su familia.' },
  { codigo: 'LIT-004', titulo: 'Pedro Páramo', autor: 'Juan Rulfo', categoria: 'Literatura', anio: 1955, editorial: 'Fondo de Cultura Económica', cantidad: 2, descripcion: 'Un joven vuelve a Comala para conocer a su padre y los ecos de su infancia.' },
  { codigo: 'LIT-005', titulo: 'Veinte poemas de amor', autor: 'Pablo Neruda', categoria: 'Literatura', anio: 1924, editorial: 'Editorial Seix Barral', cantidad: 1, descripcion: 'Poemario de amor del poeta chileno, premio Nobel de Literatura.' },
  { codigo: 'LIT-006', titulo: 'Harry Potter y la piedra filosofal', autor: 'J. K. Rowling', categoria: 'Literatura', anio: 1997, editorial: 'Salamandra', cantidad: 2, descripcion: 'El inicio de las aventuras del joven mago Harry Potter en Hogwarts.' },
  { codigo: 'LIT-007', titulo: 'El túnel', autor: 'Ernesto Sábato', categoria: 'Literatura', anio: 1948, editorial: 'Editorial Sudamericana', cantidad: 1, descripcion: 'Novela sobre la amistad y el resentimiento entre dos estudiantes.' },

  // --- Ciencias Naturales ---
  { codigo: 'CN-001', titulo: 'Biología 1: la vida y las ciencias', autor: 'Sylvia Mader', categoria: 'Ciencias Naturales', anio: 2020, editorial: 'McGraw Hill', cantidad: 2, descripcion: 'Introducción a la biología celular, la genética, la ecología y la evolución.' },
  { codigo: 'CN-002', titulo: 'Química general', autor: 'Raymond Chang', categoria: 'Ciencias Naturales', anio: 2019, editorial: 'McGraw Hill', cantidad: 2, descripcion: 'Principios de química general, enlaces, soluciones y estequiometría.' },
  { codigo: 'CN-003', titulo: 'Física elemental', autor: 'Halliday y Resnick', categoria: 'Ciencias Naturales', anio: 2018, editorial: 'John Wiley', cantidad: 1, descripcion: 'Introducción a la mecánica, la termodinámica, las ondas y la electricidad.' },
  { codigo: 'CN-004', titulo: 'Atlas de las ciencias naturales', autor: 'Varios autores', categoria: 'Ciencias Naturales', anio: 2017, editorial: 'Editorial Dorling Kindersley', cantidad: 1, descripcion: 'Ilustraciones y explicaciones sobre anatomía, geología y ecología.' },
  { codigo: 'CN-005', titulo: 'Ecología: la ciencia de la vida', autor: 'Eugene Odum', categoria: 'Ciencias Naturales', anio: 2016, editorial: 'McGraw Hill', cantidad: 1, descripcion: 'Principios de ecología, ecosistemas y relaciones entre seres vivos.' },

  // --- Matemáticas ---
  { codigo: 'MAT-001', titulo: 'Matemáticas 10: álgebra y geometría', autor: 'George Bennett', categoria: 'Matemáticas', anio: 2021, editorial: 'McGraw Hill', cantidad: 3, descripcion: 'Desarrollo de álgebra, funciones, geometría plana y del espacio.' },
  { codigo: 'MAT-002', titulo: 'Cálculo diferencial', autor: 'James Stewart', categoria: 'Matemáticas', anio: 2015, editorial: 'Cengage Learning', cantidad: 1, descripcion: 'Límites, derivadas y sus aplicaciones al estudio de funciones.' },
  { codigo: 'MAT-003', titulo: 'Lógica matemática', autor: 'Irving Copi', categoria: 'Matemáticas', anio: 2014, editorial: 'Pearson', cantidad: 1, descripcion: 'Proposiciones, cuantificadores, demostración y álgebra booleana.' },

  // --- Ciencias Sociales ---
  { codigo: 'CS-001', titulo: 'Historia del Ecuador', autor: 'Jorge Marcos', categoria: 'Ciencias Sociales', anio: 2012, editorial: 'Casa de la Cultura', cantidad: 2, descripcion: 'Recorrido histórico del Ecuador desde la época precolombina hasta el presente.' },
  { codigo: 'CS-002', titulo: 'Geografía general', autor: 'Tomás Kapeller', categoria: 'Ciencias Sociales', anio: 2013, editorial: 'Editorial Didáctica', cantidad: 2, descripcion: 'Estudio de la tierra, su dinámica y la distribución geográfica de las sociedades.' },
  { codigo: 'CS-003', titulo: 'Educación ciudadana', autor: 'Ministerio de Educación', categoria: 'Ciencias Sociales', anio: 2020, editorial: 'MEF', cantidad: 2, descripcion: 'Material de apoyo para la formación ciudadana de estudiantes de bachillerato.' },
  { codigo: 'CS-004', titulo: 'Constitución de la República del Ecuador', autor: 'Asamblea Nacional', categoria: 'Ciencias Sociales', anio: 2008, editorial: 'Imprenta Nacional', cantidad: 1, descripcion: 'Texto constitucional vigente en el país.' },

  // --- Lengua y Literatura ---
  { codigo: 'LEN-001', titulo: 'Gramática de la lengua española', autor: 'Rafael Lapesa', categoria: 'Lengua y Literatura', anio: 2009, editorial: 'Editorial Crítica', cantidad: 2, descripcion: 'Normas de uso del español: sintaxis, concordancia y estilo.' },
  { codigo: 'LEN-002', titulo: 'Técnicas de redacción', autor: 'Eduardo Sacks', categoria: 'Lengua y Literatura', anio: 2018, editorial: 'Editorial Kompetenz', cantidad: 2, descripcion: 'Cómo escribir textos claros: paráfrasis, resúmenes, ensayos y artículos.' },
  { codigo: 'LEN-003', titulo: 'Diccionario panhispánico de dudas', autor: 'ASALE', categoria: 'Lengua y Literatura', anio: 2001, editorial: 'Espasa', cantidad: 1, descripcion: 'Resuelve dudas de uso del español en el mundo hispanohablante.' },

  // --- Inglés ---
  { codigo: 'ING-001', titulo: 'English Grammar in Use', autor: 'Raymond Murphy', categoria: 'Inglés', anio: 2019, editorial: 'Cambridge University Press', cantidad: 2, descripcion: 'Ejercicios de gramática del inglés con explicaciones breves.' },
  { codigo: 'ING-002', titulo: 'Oxford English Dictionary', autor: 'Oxford University Press', categoria: 'Inglés', anio: 2010, editorial: 'Oxford University Press', cantidad: 1, descripcion: 'Diccionario de inglés con definiciones, ejemplos y pronunciación.' },
  { codigo: 'ING-003', titulo: 'Reading Explorer 2', autor: 'National Geographic Learning', categoria: 'Inglés', anio: 2021, editorial: 'Cengage Learning', cantidad: 2, descripcion: 'Lecturas graduadas para practicar comprensión lectora en inglés.' },

  // --- Informática ---
  { codigo: 'INF-001', titulo: 'Introducción a la programación con Python', autor: 'Eric Matthes', categoria: 'Informática', anio: 2022, editorial: 'Apress', cantidad: 2, descripcion: 'Fundamentos de programación, estructuras de control, funciones y archivos.' },
  { codigo: 'INF-002', titulo: 'Fundamentos de redes', autor: 'Andrew Tanenbaum', categoria: 'Informática', anio: 2016, editorial: 'Pearson', cantidad: 1, descripcion: 'Capas del modelo OSI, protocolos TCP/IP y funcionamiento de Internet.' },
  { codigo: 'INF-003', titulo: 'Base de datos relacionales', autor: 'Abraham Silberschatz', categoria: 'Informática', anio: 2015, editorial: 'McGraw Hill', cantidad: 1, descripcion: 'Modelo relacional, álgebra relacional y lenguaje SQL.' },

  // --- Administración y Gestión ---
  { codigo: 'ADM-001', titulo: 'Contabilidad básica', autor: 'Robert Anthony', categoria: 'Administración y Gestión', anio: 2017, editorial: 'McGraw Hill', cantidad: 2, descripcion: 'Registro de transacciones, estados financieros y partida doble.' },
  { codigo: 'ADM-002', titulo: 'Administración: teoría y práctica', autor: 'Stephen Robbins', categoria: 'Administración y Gestión', anio: 2019, editorial: 'Pearson', cantidad: 1, descripcion: 'Planeación, organización, dirección y control en las organizaciones.' },
  { codigo: 'ADM-003', titulo: 'Gestión de proyectos', autor: 'Karen Williams', categoria: 'Administración y Gestión', anio: 2020, editorial: 'Editorial Media', cantidad: 1, descripcion: 'Alcance, cronograma, presupuesto y equipos de trabajo.' }
];

/**
 * Estudiantes de prueba con sus préstamos.
 * Las fechas se calculan a partir de hoy: `diasAtraso` es la cantidad de
 * días desde el préstamo (positivo) y `diasPrestamo` el plazo acordado.
 */
const PRESTAMOS_PRUEBA = [
  {
    codigo: 'LIT-002',
    nombre: 'Ana Lucía Mero',
    cedula: '1712345678',
    curso: '4to de Bachillerato',
    diasAtraso: 20,
    diasPrestamo: 7
  },
  {
    codigo: 'MAT-001',
    nombre: 'Carlos Pérez',
    cedula: '1712345679',
    curso: '4to de Bachillerato',
    diasAtraso: 3,
    diasPrestamo: 7
  },
  {
    codigo: 'INF-001',
    nombre: 'María Fernanda Ríos',
    cedula: '2009876543',
    curso: '3ro de Técnico',
    diasAtraso: 1,
    diasPrestamo: 7
  },
  {
    codigo: 'CS-001',
    nombre: 'Diego Zamora',
    cedula: '1311122233',
    curso: '5to de Bachillerato',
    diasAtraso: 30,
    diasPrestamo: 7,
    devueltoHace: 20
  },
  {
    codigo: 'LEN-001',
    nombre: 'Ana Lucía Mero',
    cedula: '1712345678',
    curso: '4to de Bachillerato',
    diasAtraso: 5,
    diasPrestamo: 7
  }
];

module.exports = { CATEGORIAS, LIBROS, PRESTAMOS_PRUEBA };