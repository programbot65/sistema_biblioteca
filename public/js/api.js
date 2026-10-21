'use strict';

/**
 * Cliente de la API del sistema de biblioteca.
 * Centraliza las peticiones HTTP y el manejo de errores para que las vistas
 * no tengan que repetir el mismo codigo.
 */

window.Api = (() => {
  const BASE = '/api';

  /** Error de la API: conserva el codigo HTTP y los detalles de validacion. */
  class ErrorApi extends Error {
    constructor(mensaje, estado, detalles) {
      super(mensaje);
      this.name = 'ErrorApi';
      // `super()` solo deja el texto en `message`. Sin esta linea, los avisos
      // de error se mostraban vacios en pantalla.
      this.mensaje = mensaje;
      this.estado = estado;
      this.detalles = detalles || [];
    }

    /** Devuelve el mensaje asociado a un campo del formulario. */
    errorDe(campo) {
      const detalle = this.detalles.find((item) => item.campo === campo);
      return detalle ? detalle.mensaje : '';
    }
  }

  const claveAdmin = {
    valor: sessionStorage.getItem('biblioteca_clave_admin') || '',
    guardar(clave) {
      this.valor = clave;
      sessionStorage.setItem('biblioteca_clave_admin', clave);
    },
    limpiar() {
      this.valor = '';
      sessionStorage.removeItem('biblioteca_clave_admin');
    }
  };

  async function pedir(ruta, opciones = {}) {
    const cabeceras = { ...(opciones.headers || {}) };

    if (opciones.cuerpo) {
      cabeceras['Content-Type'] = opciones.tipoContenido || 'application/json';
    }
    if (opciones.admin) cabeceras['x-admin-clave'] = claveAdmin.valor;

    let respuesta;
    try {
      respuesta = await fetch(`${BASE}${ruta}`, {
        method: opciones.metodo || 'GET',
        headers: cabeceras,
        body: opciones.cuerpo
          ? (opciones.tipoContenido ? opciones.cuerpo : JSON.stringify(opciones.cuerpo))
          : undefined
      });
    } catch (error) {
      throw new ErrorApi(
        'No se pudo conectar con el servidor. Verifique que el sistema este encendido.',
        0
      );
    }

    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (error) {
      datos = null;
    }

    if (!respuesta.ok) {
      throw new ErrorApi(
        (datos && datos.mensaje) || `Error ${respuesta.status}`,
        respuesta.status,
        datos && datos.detalles
      );
    }

    return datos;
  }

  /** Arma una cadena de consulta omitiendo los valores vacios. */
  function query(objeto) {
    const partes = Object.entries(objeto || {})
      .filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
      .map(([clave, valor]) => `${encodeURIComponent(clave)}=${encodeURIComponent(valor)}`);
    return partes.length ? `?${partes.join('&')}` : '';
  }

  return {
    ErrorApi,
    claveAdmin,

    // --- Catalogo (publico) ---
    catalogo: (filtros) => pedir(`/catalogo${query(filtros)}`),
    libro: (id) => pedir(`/catalogo/${id}`),
    categorias: () => pedir('/categorias'),
    recomendaciones: (filtros) => pedir(`/recomendaciones${query(filtros)}`),

    // --- Biblioteca digital (leer en la pagina) ---
    biblioteca: (filtros) => pedir(`/biblioteca${query(filtros)}`),
    /** Direccion del PDF de un libro: la usa el lector integrado. */
    archivoLibro: (id, opciones = {}) => {
      const descarga = opciones.descarga ? '?descarga=1' : '';
      return `${BASE}/libros/${id}/archivo${descarga}`;
    },
    subirArchivo: (id, archivo) => pedir(`/admin/libros/${id}/archivo`, {
      metodo: 'POST',
      cuerpo: archivo,
      tipoContenido: 'application/pdf',
      admin: true
    }),
    quitarArchivo: (id) => pedir(`/admin/libros/${id}/archivo`, {
      metodo: 'DELETE',
      admin: true
    }),

    // --- Prestamos ---
    prestamos: (filtros) => pedir(`/prestamos${query(filtros)}`),
    prestamo: (id) => pedir(`/prestamos/${id}`),
    registrarPrestamo: (cuerpo) => pedir('/prestamos', { metodo: 'POST', cuerpo }),
    registrarDevolucion: (id, cuerpo) =>
      pedir(`/prestamos/${id}/devolucion`, { metodo: 'POST', cuerpo: cuerpo || {} }),
    renovarPrestamo: (id, dias) =>
      pedir(`/prestamos/${id}/renovar`, { metodo: 'POST', cuerpo: { dias } }),

    // --- Estudiantes ---
    estudiantes: (filtros) => pedir(`/estudiantes${query(filtros)}`),
    historial: (id) => pedir(`/estudiantes/${id}/historial`),
    cursos: () => pedir('/estudiantes/cursos'),

    // --- Panel ---
    panel: () => pedir('/panel'),
    resumen: () => pedir('/estadisticas/resumen'),

    // --- Gestion (encargado) ---
    crearLibro: (cuerpo) => pedir('/admin/libros', { metodo: 'POST', cuerpo, admin: true }),
    actualizarLibro: (id, cuerpo) =>
      pedir(`/admin/libros/${id}`, { metodo: 'PUT', cuerpo, admin: true }),
    desactivarLibro: (id) => pedir(`/admin/libros/${id}`, { metodo: 'DELETE', admin: true }),
    reactivarLibro: (id) => pedir(`/admin/libros/${id}/reactivar`, { metodo: 'POST', admin: true }),
    crearCategoria: (cuerpo) => pedir('/admin/categorias', { metodo: 'POST', cuerpo, admin: true })
  };
})();
