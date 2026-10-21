# Biblioteca UEEA — sistema de gestión bibliográfica

Sistema web gratuito para organizar el catálogo de libros de la biblioteca
institucional, facilitar la búsqueda y consulta de ejemplares y registrar
préstamos y devoluciones de forma digital.

Costo total de implementación: **$0**. Solo se usan herramientas de código
abierto o gratuitas.

---

## 1. Requisitos

| Requisito | Detalle |
|-----------|---------|
| Node.js   | Versión **22.5 o superior** (usa el módulo nativo `node:sqlite`). Se comprueba con `node -v`. |
| Navegador | Chrome, Edge o Firefox en su versión actual. |
| Disco     | Menos de 50 MB. |
| Conexión  | Solo necesaria la primera vez para instalar las dependencias. |

No se necesita instalar un servidor de base de datos: SQLite es un archivo.

Si no tiene Node.js, descárguelo gratis de <https://nodejs.org> (opción LTS).

---

## 2. Instalación

```bash
# 1. Entrar a la carpeta del proyecto
cd Biblioteca

# 2. Instalar la única dependencia del proyecto (Express)
npm install

# 3. Crear la base de datos y cargar los datos de prueba
npm run db:reset

# 4. Iniciar el sistema
npm start
```

Abra en el navegador: **<http://localhost:3000>**

Para detener el servidor presione `Ctrl + C` en la misma ventana.

### Si el servidor no arranca

El mensaje `EADDRINUSE: address already in use :::3000` significa que hay
**otra copia del sistema abierta** que sigue usando el puerto 3000. Se
resuelve así:

```powershell
# 1. Cerrar la otra ventana del sistema que quedo abierta, o:
taskkill /F /IM node.exe

# 2. Volver a arrancar
npm run dev
```

O, si se quiere usar otro puerto:

```powershell
set PORT=3001 && npm run dev
```

### Comandos disponibles

| Comando | Para qué sirve |
|---------|----------------|
| `npm start` | Inicia el sistema. |
| `npm run dev` | Inicia el sistema y reinicia solo al guardar cambios. |
| `npm test` | Ejecuta las 109 pruebas automáticas del proyecto. |
| `npm run db:migrate` | Crea la base de datos y las tablas (no borra datos). |
| `npm run db:seed` | Carga los datos de prueba si el catálogo está vacío. |
| `npm run db:reset` | **Borra** la base de datos y la vuelve a crear con datos de prueba. |
| `npm run db:respaldo` | Guarda una copia de la base de datos en `data/respaldo/`. |
| `npm run revisar:interfaz` | Revisa la interfaz paso a paso en consola. |
| `npm run revisar:geometria` | Comprueba que los libros del carrusel no se salgan ni se solapen en varias pantallas. |

### Variables de entorno (opcionales)

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `PORT` | `3000` | Puerto del servidor. |
| `DB_PATH` | `data/biblioteca.db` | Ubicación del archivo de base de datos. |
| `ADMIN_KEY` | `ueea2026` | Contraseña privada del encargado (ver sección 3.1). |

Ejemplo en Windows PowerShell:

```powershell
$env:ADMIN_KEY = "clave-que-elija-el-encargado"
npm start
```

### 3.1. Registro de libros en pausa temporal

Mientras se recopila el inventario real, el registro, la edición y la
eliminación de libros están **ocultos en la interfaz**: la sección de
Administración muestra un aviso de «Registro en preparación» y el catálogo
vacío no ofrece botón de registro. Todo el código de administración se
conserva intacto.

- **Rehabilitar:** ponga `registroDeLibros: true` en `public/js/vistas.js`
  (`window.BibliotecaConfig`) y recargue. No hay que desarrollar nada más.
- **Volver a pausar:** devuelva el valor a `false`.

---

## 3. Navegación: la estantería es el menú

Al entrar en `http://localhost:3000` lo primero que aparece es la
**estantería circular**: un anillo de libros flotando en un vacío oscuro.
Cada libro es una sección del sistema y se abre con un clic. **No hay barra
lateral**: la estantería es el menú, y el encabezado ofrece el camino de
vuelta con el botón «Estantería».

La barra superior reúne la **búsqueda global** (que lleva al catálogo), el
estado del sistema, los avisos y el **selector de tema claro/oscuro**.

### La estantería

| Gesto | Resultado |
|-------|-----------|
| Rueda del ratón | Gira el carrusel de un libro al siguiente, sin saltarse pasos. |
| Arrastrar con el ratón o el dedo | Giro libre; al soltar, el anillo se frena con inercia y se alinea solo. |
| Flechas ← → | Gira el carrusel con el teclado. |
| `Inicio` / `Fin` | Lleva al primer o al último libro. |
| Pasar el ratón por un libro | El libro se acerca, crece y **se abre**, mostrando su icono y descripción. |
| Clic en un libro | Lo centra y abre la sección. |
| Botones `‹` `›` | Giran el carrusel (útil en tableta y teléfono). |

El diseño es **sobrio**: un antetítulo, un título y la estantería. El núcleo
central solo muestra el **nombre de la sección** que está al frente y los
puntos de progreso; el resto de adornos se quitaron. La escena **no es un
marco**: no tiene borde ni caja, solo el charco de luz del suelo, para que los
libros se vean bien.

Debajo de la estantería no hay nada más. El resumen con las cifras, las
secciones de la biblioteca, los préstamos que necesitan atención y los libros
destacados vive en su propia vista (`#/panel`).

```
                        Gestión
                          ╱
     Préstamos  ·  [ Biblioteca UEEA ]  ·  Catálogo
                          ╲
                        Panel
```

### Detalles de la experiencia

- **Profundidad:** el libro del frente es el más grande; los laterales se
  inclinan como un abanico y se ven algo más pequeños y borrosos; el libro de
  atrás queda oculto detrás del núcleo, nunca estorbando.
- **Apertura:** al pasar el ratón, la tapa gira sobre el lomo y descubre la
  página interior con el detalle de la sección. La transición dura 0,42 s y usa
  una curva suave, sin efectos bruscos.
- **Siempre alineado:** el anillo nunca deja un libro a medio colocar; tras la
  inercia se ajusta al libro más cercano.
- **Nunca fuera de pantalla:** el radio del anillo se calcula a partir del ancho
  real de los libros, de modo que en teléfonos, tabletas y computadoras ninguno
  se sale de la zona visible ni se monta sobre otro.
- **Se recuerda dónde quedó:** al volver a la estantería, el último libro
  abierto sigue al frente.
- **Accesible:** cada libro es un botón real con nombre descriptivo, navegable
  con `Tab`. Además hay una lista de enlaces equivalente (`#/panel`,
  `#/catalogo`, `#/prestamos`, `#/gestion`) que sigue funcionando si el carrusel
  no llega a cargar, y se respeta la preferencia de **reducir movimiento** del
  sistema.

### Dónde está el código

| Archivo | Responsabilidad |
|---------|-----------------|
| `public/js/navegacion.js` | **Lógica**: posiciones en el anillo, profundidad, inercia, rueda, arrastre, teclado. No sabe nada de libros ni de colores. |
| `public/js/vistas/portada.js` | **Contenido**: qué secciones existen, cómo se ve cada libro y a qué ruta lleva. |
| `public/css/estanteria.css` | **Visual**: lomo, tapas, páginas, apertura, sombras y medidas adaptables. |

Esta separación permite cambiar la apariencia sin tocar los cálculos, y
viceversa.

### Comprobar la colocación

```bash
npm run revisar:geometria
```

Muestra en consola dónde queda cada libro en escritorio, laptop, tableta y
teléfono, y avisa si alguno se saliera de la zona o se solapara mal.

---

## 4. El inicio de la biblioteca

El resumen (`#/panel`) es **sobrio y minimalista**. No hay tarjetas con
bordes, ni gráficos de barras, ni tablas, ni barras de porcentaje. Solo lo
que hace falta para saber cómo está la biblioteca:

| Antes (dashboard) | Ahora (inicio) |
|-------------------|----------------|
| Tarjeta «Libros disponibles» | **Renglón de cifras**, con la cifra y su nombre |
| Tarjeta «Préstamos atrasados» | La cifra de atrasados se pinta de alerta si los hay |
| Menú de secciones en la barra lateral | **La estantería**: un libro por sección, en 3D |
| Gráfico de barras de 14 días | **Hojas de un cuaderno** con su rótulo de día (en Reportes) |
| Tabla de préstamos recientes | **Pila de libros** sobre la mesa, cada uno inclinado |
| Barra de porcentaje por categoría | **Etiquetas** con la disponibilidad de cada sección |
| Lista de libros más prestados | **Lomos en una estantería**, la altura = veces prestado |
| Lista de estudiantes activos | **Carnés** apoyados en el borde de la mesa |
| — | **Estado del sistema** y **avisos** en el encabezado |

Todo sale de `GET /api/panel`: no se calcula ni se inventa ningún dato nuevo.

El resumen muestra, en este orden: el **renglón de cifras**, las **secciones
de la biblioteca**, lo que **necesita atención** y los **libros destacados**.
Cada cifra, etiqueta y pendiente **es un enlace** que lleva a la sección
correspondiente ya filtrada (por ejemplo, la cifra de atrasados abre los
préstamos atrasados).

El detalle restante vive en sus secciones: **Usuarios** (búsqueda por nombre e
historial, sin exponer cédulas) y **Reportes** (avisos, disponibilidad,
movimientos, más prestados, actividad por día, estudiantes activos y
novedades), cuyas rutas siguen en pie aunque ya no aparezcan en el menú.

Cuando no hay información, cada bloque muestra un estado vacío sobrio en lugar
de un gráfico vacío.

### Fondo y tema «Noche Digital»

El fondo es un azul noche profundo (`#080B18`) con halos de luz cian
(`#48E5FF`) y violeta (`#9570FF`), una retícula de circuitos muy sutil y
motas de luz a la deriva. Todo está fijo, detrás del contenido y no
captura clics. Los paneles son de cristal translúcido con desenfoque
(`backdrop-filter`, con alternativa opaca si el navegador no lo soporta).

### Tema claro pastel

El botón de **sol/luna** del encabezado cambia entre el tema oscuro (el de
noche, por defecto) y el **tema claro pastel**. La preferencia se guarda en
`biblio_tema` de este navegador, así que se recuerda entre visitas.

El tema claro vive en `css/tema-claro.css`: cambia las variables de color y
las superficies que estaban escritas a mano (tarjetas, campos, tablas, modal,
insignias y la barra de desplazamiento). Las **portadas de los libros
conservan sus colores vivos**, porque ese color es el de la categoría.

La **estantería** es un escenario nocturno en los dos temas: en el claro se
dibuja un charco de luz oscura en el que los libros siguen siendo lo que más
llama la atención.

### Encabezado

Sin fila de botones. Solo la identidad, el estado del sistema (punto de luz que
late), el aviso de préstamos atrasados con su contador, el rol y el camino de
volver a la estantería.

---

## 5. Cómo se usa el sistema

### 5.1 Catálogo (público, no requiere cuenta)

- Buscar por **título, autor, categoría o código**.
- La búsqueda es inteligente: también funciona sin tildes (`geografia` →
  *Geografía*), con singular o plural (`matematica` → *Matemáticas*), con
  palabras relacionadas (`biologicas` → *Biología*) y aun con errores de
  escritura (`cienca` → *Ciencias Naturales*).
- Filtrar por **categoría**, **disponibilidad** y **orden**.
- Abrir la ficha de un libro para ver todos sus datos, quién lo tiene prestado
  y **libros similares** recomendados.
- Cada tarjeta muestra el código y si el ejemplar está **Disponible** o
  **Todos prestados**.

### 5.2 Préstamos y devoluciones (encargado)

El formulario está dividido en **tres grupos**, en el orden en que se usa:

1. **Libro** — escriba el título, el autor o el código y elija de la lista.
2. **Estudiante** — nombre completo, cédula y curso.
3. **Plazo** — días de préstamo y fecha. El sistema calcula solo la fecha límite.

Presione **Registrar préstamo**. Para devolver un libro, presione
**Devuelto** en la fila correspondiente y confirme la fecha; **Renovar**
extiende el plazo una vez, si las reglas de la institución lo permiten.

#### Los datos del estudiante se completan solos

Si el estudiante ya tiene préstamos registrados, **no hay que volver a
escribir su información**:

- Al escribir la **cédula** (o el nombre) aparecen los estudiantes ya
  conocidos; al elegir uno se rellenan nombre, cédula y curso.
- Si solo hay **un** estudiante que coincide, sus datos se completan
  automáticamente.
- Tras registrar un préstamo, los datos del estudiante **se conservan** en el
  formulario: el siguiente libro para el mismo estudiante se presta sin
  escribir nada.
- Si un curso quedó mal escrito, se **corrige** aquí y el cambio queda
  guardado: el servidor actualiza la ficha del estudiante al registrar el
  préstamo, así que no se repite el error en los siguientes.

Reglas que el sistema aplica automáticamente:

- No se puede prestar un ejemplar que ya está prestado.
- Un estudiante no puede tener más de **3 préstamos activos**.
- La devolución no puede ser anterior al préstamo ni tener fecha futura.
- Un libro prestado no se puede dar de baja del catálogo.

### 5.3 Gestión (encargado, con clave)

- Registrar libros cuando el inventario esté listo (ver sección 3.1 para
  habilitar el registro) y modificar la clave con `ADMIN_KEY`.
- Registrar libros nuevos: código, título, autor, categoría, año, cantidad de
  ejemplares y descripción.
- **Editar** la información de un libro o **darlo de baja** (la baja es lógica:
  el historial de préstamos se conserva).
- Crear categorías nuevas.

### 5.4 Secciones con datos de ejemplo

Al instalar con `npm run db:reset` el sistema queda con 31 libros de muestra,
8 categorías, 4 estudiantes y 4 préstamos (uno atrasado). Así se puede ver el
escritorio y el catálogo con información real antes de cargar el catálogo
definitivo de la institución.

---

## 6. Estructura del proyecto

```
Biblioteca/
├── package.json
├── README.md
├── data/                     Base de datos y respaldos (no se versiona)
│   └── biblioteca.db
├── scripts/
│   ├── migrar.js             Crea el esquema de la base de datos
│   ├── semilla.js            Carga los datos de prueba
│   ├── reiniciar.js          Borra y vuelve a crear la base de datos
│   ├── respaldo.js           Copia de seguridad
│   ├── revisar-interfaz.js   Revisión manual de la interfaz
│   └── revisar-geometria.js  Comprobación de la colocación del carrusel
├── src/
│   ├── config.js             Reglas del proyecto (días de préstamo, puertos)
│   ├── server.js             Servidor Express
│   ├── db/
│   │   ├── index.js          Conexión y transacciones
│   │   ├── esquema.sql       Tablas e índices
│   │   └── datos-iniciales.js Catálogo y préstamos de prueba
│   ├── repositorios/         Consultas SQL (libros, estudiantes, préstamos)
│   ├── servicios/            Reglas de negocio
│   │   ├── catalogo.service.js       búsqueda inteligente y recomendaciones
│   │   ├── prestamos.service.js      préstamos, devoluciones y validaciones
│   │   └── estadisticas.service.js   cifras del panel
│   ├── rutas/                Endpoints de la API
│   ├── middleware/           Autenticación, errores y lectura de parámetros
│   └── utiles/               Fechas y procesamiento de texto
├── public/                   Frontend (HTML, CSS y JavaScript)
│   ├── index.html
│   ├── css/
│   │   ├── estilos.css       Estilo general del sistema
│   │   ├── estanteria.css    Navegación circular de libros
│   │   ├── biblioteca.css    Las piezas del escritorio
│   │   └── tema-claro.css    El tema claro pastel
│   └── js/
│       ├── api.js            Cliente de la API
│       ├── iconos.js         Catalogo de iconos SVG
│       ├── piezas.js         Piezas visuales reutilizables
│       ├── ui.js             Utilidades de interfaz
│       ├── app.js            Enrutador de la aplicación
│       ├── vistas.js         Registro de vistas
│       ├── navegacion.js     Motor del carrusel circular (sin estilos)
│       └── vistas/
│           ├── portada.js    La estantería de libros (la pantalla de inicio)
│           ├── panel.js      El resumen de la biblioteca
│           ├── catalogo.js
│           ├── prestamos.js
│           ├── usuarios.js
│           ├── categorias.js
│           ├── reportes.js
│           └── gestion.js
└── tests/
    ├── api.test.js           35 pruebas de la API y las reglas de negocio
    ├── interfaz.test.js      25 pruebas de la interfaz en el navegador
    ├── estanteria.test.js    31 pruebas de la navegación circular
    └── escritorio.test.js    18 pruebas del rediseño del panel
```

La separación entre **rutas**, **servicios**, **repositorios** y **utilidades**
permite modificar una parte sin romper las demás, y facilita que el proyecto
sea ampliado por otro estudiante en el futuro.

---

## 7. Arquitectura

```
Navegador  ──HTTP/JSON──▶  Servidor Express  ──SQL──▶  SQLite
(HTML/CSS/JS)              (rutas + servicios)         (data/biblioteca.db)
```

- **Frontend:** aplicación de una sola página; La navegación usa `#/inicio`
  (la estantería) y `#/panel`, `#/catalogo`, `#/usuarios`, `#/prestamos`.
- **Backend:** valida los datos, aplica las reglas y devuelve JSON.
- **Base de datos:** cuatro tablas (`categorias`, `libros`, `estudiantes`,
  `prestamos`) con sus índices.

Todas las consultas usan **parámetros** (`?`), nunca concatenación de texto, y
los datos del usuario se insertan en la página con `textContent`, de modo que
no hay inyección de SQL ni de código en el navegador.

---

## 8. API interna

| Método | Dirección | Descripción |
|--------|-----------|-------------|
| GET | `/api/catalogo?q=&categoria=&estado=&orden=&limite=&offset=` | Catálogo y búsqueda inteligente |
| GET | `/api/catalogo/:id` | Ficha del libro con recomendados |
| GET | `/api/categorias` | Lista de categorías con su total de libros |
| GET | `/api/recomendaciones?libro=&categoria=&autor=&titulo=` | Sugerencias de libros similares |
| POST | `/api/prestamos` | Registrar préstamo |
| GET | `/api/prestamos?situacion=&codigo=&cedula=&categoria=` | Listado de préstamos |
| GET | `/api/prestamos/atrasados` | Préstamos atrasados |
| GET | `/api/prestamos/:id` | Detalle de un préstamo |
| POST | `/api/prestamos/:id/devolucion` | Registrar devolución |
| POST | `/api/prestamos/:id/renovar` | Renovar el plazo |
| GET | `/api/estudiantes?q=&cedula=` | Buscar estudiantes |
| GET | `/api/estudiantes/:id/historial` | Historial de préstamos del estudiante |
| GET | `/api/panel` | Toda la información del panel |
| GET | `/api/estadisticas/resumen` | Solo las cifras principales |
| GET | `/api/salud` | Comprueba que el servidor responde |
| POST | `/api/admin/libros` | Registrar libro *(requiere clave)* |
| PUT | `/api/admin/libros/:id` | Actualizar libro *(requiere clave)* |
| DELETE | `/api/admin/libros/:id` | Dar de baja *(requiere clave)* |
| POST | `/api/admin/categorias` | Crear categoría *(requiere clave)* |

Las rutas de administración reciben la clave en la cabecera `x-admin-clave`.

---

## 9. Requisitos funcionales y dónde se cumplen

| Código | Requerimiento | Dónde está implementado |
|--------|---------------|--------------------------|
| RF01 | Mostrar el catálogo de libros | `GET /api/catalogo`, vista `catalogo.js` |
| RF02 | Buscar por título, autor, categoría o código | `catalogo.service.js` (puntaje de coincidencias) |
| RF03 | Mostrar la disponibilidad de cada libro | Campo `disponibles` calculado en `libros.repo.js` |
| RF04 | Registrar y actualizar libros | `rutas/administracion.js`, vista `gestion.js` |
| RF05 | Registrar préstamos con los datos requeridos | `prestamos.service.js`, `POST /api/prestamos` |
| RF06 | Registrar devoluciones | `prestamos.service.js`, `POST /api/prestamos/:id/devolucion` |
| RF07 | Identificar préstamos atrasados | `utiles/fechas.js` y filtro `situacion=atrasado` |
| RF08 | Mostrar estadísticas básicas | `estadisticas.service.js`, vista `panel.js` |
| RF09 | Búsquedas y recomendaciones inteligentes | `utiles/texto.js`, `catalogo.service.js` |
| RF10 | Consultar el historial de préstamos | `GET /api/prestamos`, `GET /api/estudiantes/:id/historial` |

---

## 10. Pruebas

```bash
npm test
```

Se ejecutan **109 pruebas** de forma automática:

- **35 de la API:** catálogo, búsqueda por cada campo, búsqueda inteligente con
  errores de escritura, validaciones del formulario, cálculo de la fecha límite,
  límites de préstamo, devolución, renovación, detección de atrasos, historial,
  estadísticas, recomendaciones y protección con clave.
- **25 de la interfaz:** la página carga la estantería como inicio, sus libros
  son las secciones del sistema, no hay barra lateral, los datos de un
  estudiante conocido se completan solos, el formulario avisa donde está el
  error, la navegación entre secciones, el buscador, la ficha con
  recomendaciones, el registro de un préstamo completo desde el formulario, el
  registro de una devolución, el acceso del encargado y la ausencia de errores
  de JavaScript.
- **31 de la estantería:** la matemática del anillo, la profundidad de cada
  posición, la rueda con acumulación, el arrastre con inercia, el teclado, la
  apertura al elegir un libro, la limpieza del motor al salir de la sección y
  la garantía de que las cuatro rutas siguen funcionando.
- **18 del escritorio:** que ya no queden tarjetas, gráficos ni tablas; que
  cada cifra, libro, lomo, compartimento, hoja y carné corresponda a un dato
  real de la API; que la altura de los lomos y de las hojas sea proporcional a
  la información; y que cada objeto lleve a la sección correcta.


Las pruebas usan una base de datos temporal, por lo que **no tocan** la base de
datos real del sistema.

Comprobaciones manuales recomendadas (sección 18 del plan):

1. Registrar un libro y verificar que aparece en el catálogo.
2. Buscar por título, autor, categoría y código.
3. Prestar un libro y ver que pasa a «Todos prestados».
4. Registrar la devolución y ver que vuelve a «Disponible».
5. Revisar que los atrasados aparecen en el filtro correspondiente.
6. Probar la estantería en un teléfono y en una tableta.

---

## 11. Seguridad y privacidad

- El catálogo es público: **no se necesita cuenta** para consultar.
- Solo las operaciones que modifican información exigen la clave del encargado.
- La clave se compara en tiempo constante para no filtrar información por el
  tiempo de respuesta.
- Se guardan **solo los datos mínimos** del estudiante: nombre, cédula y curso.
  No se registran notas, teléfonos ni direcciones.
- Las cabeceras `X-Content-Type-Options`, `X-Frame-Options` y
  `Referrer-Policy` están activadas.
- Los errores del servidor no muestran detalles internos al usuario.

Recomendación: definir `ADMIN_KEY` con una clave propia antes de usar el
sistema con estudiantes reales.

---

## 12. Mantenimiento

**Respaldo de la base de datos** (una vez por semana, por ejemplo):

```bash
npm run db:respaldo
```

Los archivos se guardan en `data/respaldo/` con la fecha y hora en el nombre.

**Cargar el catálogo real:**

1. Definir en `src/db/datos-iniciales.js` el listado definitivo de libros.
2. Ejecutar `npm run db:seed` (o registrarlos uno por uno desde **Gestión**,
   que es lo más seguro para no perder los datos ya registrados).

---

## 13. Limitaciones conocidas

- El sistema está pensado para el uso interno de una biblioteca escolar; con
  cientos de libros y pocos préstamos al día responde con rapidez.
- No incluye control de usuarios con roles ni contraseñas individuales: el
  acceso del encargado es con una clave compartida, según el alcance del
  proyecto.
- No hay pagos, compras ni publicación en Internet; corre en el computador de
  la biblioteca o en una red local.

---

## 14. Glosario

| Término | Significado |
|---------|-------------|
| Ejemplar | Cada copia física de un libro; se identifica con su código. |
| Préstamo activo | Libro prestado que todavía no ha sido devuelto. |
| Atrasado | Préstamo activo cuya fecha límite ya pasó. |
| Fecha límite | Último día en que se debe devolver el libro. |
| Estantería | Pantalla de inicio con los libros que representan las secciones. |
