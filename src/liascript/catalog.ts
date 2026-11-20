// Catálogo de ejemplos LiaScript: todo lo que LiaScript ofrece y el editor
// visual no muestra. Es la fuente única de:
// - el panel lateral «LiaScript» (copiar / insertar, con imagen del resultado);
// - las plantillas del menú «/» (las marcadas con `menu`);
// - el generador de imágenes (scripts/lia-previews.mjs), que renderiza cada
//   ejemplo con el LiaScript real (liaex -f web) y lo captura en
//   public/lia-examples/<key>.webp.
//
// Los tests (tests/lia-editing.test.ts) comprueban que cada `source` se
// guarda literal y, salvo los marcados `native`, entra como tarjeta LiaScript.

export type LiaCategory = 'quiz' | 'survey' | 'animation' | 'code' | 'media' | 'format' | 'data'

export interface LiaExample {
  key: string
  category: LiaCategory
  title: string
  /** Qué hace y cómo se escribe (texto breve para el panel). */
  description: string
  /** Fuente LiaScript que se copia o inserta. */
  source: string
  /** Texto previo que solo se usa en la imagen de ejemplo (p. ej. la pregunta). */
  context?: string
  /** Aparece también en el menú «/». */
  menu?: boolean
  /** El editor lo representa con un nodo propio (no es tarjeta), p. ej. un bloque de código. */
  native?: boolean
  /** Mezcla tarjetas y contenido editable (p. ej. el interior de un desplegable). */
  mixed?: boolean
}

export const CATEGORIES: { id: LiaCategory; title: string }[] = [
  { id: 'quiz', title: 'Autoevaluación' },
  { id: 'survey', title: 'Encuestas' },
  { id: 'animation', title: 'Animación y narración' },
  { id: 'code', title: 'Código' },
  { id: 'media', title: 'Multimedia' },
  { id: 'format', title: 'Formato' },
  { id: 'data', title: 'Datos y diagramas' },
]

const STARS = '*'.repeat(64)

export const LIA_EXAMPLES: readonly LiaExample[] = [
  // --- Autoevaluación ------------------------------------------------------
  {
    key: 'quiz-single',
    category: 'quiz',
    title: 'Opción única',
    description: 'Una línea por opción: (X) marca la correcta y ( ) las demás. Escribe la pregunta en un párrafo justo encima.',
    context: '¿Qué protocolo usa por defecto el puerto 443?',
    source: '[( )] HTTP\n[(X)] HTTPS\n[( )] FTP',
    menu: true,
  },
  {
    key: 'quiz-multiple',
    category: 'quiz',
    title: 'Opción múltiple',
    description: 'Con corchetes dobles: [[X]] en todas las correctas y [[ ]] en las incorrectas.',
    context: '¿Cuáles son lenguajes de programación?',
    source: '[[X]] Python\n[[ ]] HTML\n[[X]] Java\n[[ ]] CSS',
    menu: true,
  },
  {
    key: 'quiz-text',
    category: 'quiz',
    title: 'Respuesta corta',
    description: 'La respuesta esperada entre corchetes dobles; el alumnado la escribe en un campo de texto.',
    context: '¿Qué comando de Git crea una copia local de un repositorio remoto?',
    source: '[[git clone]]',
    menu: true,
  },
  {
    key: 'quiz-select',
    category: 'quiz',
    title: 'Selección dentro del texto',
    description: 'Un desplegable dentro de una frase: opciones separadas por | y la correcta entre paréntesis.',
    source: 'En el patrón MVC, la capa que muestra los datos al usuario es la\n[[ modelo | (vista) | controlador ]].',
  },
  {
    key: 'quiz-matrix',
    category: 'quiz',
    title: 'Matriz verdadero/falso',
    description: 'La primera línea nombra las columnas; cada fila es una afirmación con (X) en la columna correcta.',
    source:
      '[[Verdadero] (Falso)]\n' +
      '[    (X)       ( )  ]  PHP se ejecuta en el servidor.\n' +
      '[    ( )       (X)  ]  CSS es un lenguaje de programación.\n' +
      '[    (X)       ( )  ]  Git guarda el historial de cambios.',
    menu: true,
  },
  {
    key: 'quiz-solution',
    category: 'quiz',
    title: 'Con pistas y solución',
    description: 'Cada [[?]] es una pista que se puede pedir. El bloque entre líneas de asteriscos es la solución, que aparece al resolver o rendirse.',
    context: '¿Cuántos bits tiene un byte?',
    source: `[[8]]\n[[?]] Es una potencia de dos.\n[[?]] Está entre 4 y 16.\n${STARS}\nUn byte tiene **8 bits**, que permiten representar 256 valores.\n${STARS}`,
    menu: true,
  },

  // --- Encuestas -----------------------------------------------------------
  {
    key: 'survey-single',
    category: 'survey',
    title: 'Encuesta de una respuesta',
    description: 'Como un quiz, pero con números en lugar de X: no hay respuesta correcta.',
    context: '¿Te ha resultado útil esta unidad?',
    source: '[(1)] Poco\n[(2)] Bastante\n[(3)] Mucho',
  },
  {
    key: 'survey-multiple',
    category: 'survey',
    title: 'Encuesta de varias respuestas',
    description: 'Casillas numeradas: se pueden marcar varias.',
    context: '¿Qué lenguajes has usado antes?',
    source: '[[1]] PHP\n[[2]] Python\n[[3]] JavaScript\n[[4]] Ninguno',
  },
  {
    key: 'survey-text',
    category: 'survey',
    title: 'Encuesta de texto libre',
    description: 'Tres guiones bajos (o más) crean un campo de texto para opinar.',
    context: '¿Qué mejorarías de esta unidad?',
    source: '[[___]]',
  },

  // --- Animación y narración -----------------------------------------------
  {
    key: 'effect',
    category: 'animation',
    title: 'Aparecer paso a paso',
    description: 'En modo presentación, el párrafo bajo {{1}} aparece en el paso 1, bajo {{2}} en el paso 2… En modo libro se ve todo, numerado.',
    source: '{{1}}\nPrimero aparece esta idea.\n\n{{2}}\nY después esta otra.',
    menu: true,
  },
  {
    key: 'effect-block',
    category: 'animation',
    title: 'Animar un bloque completo',
    description: 'Para que aparezcan juntos varios elementos (párrafos, listas, imágenes), enciérralos entre dos líneas de asteriscos.',
    source: `{{1}}\n${STARS}\nEste bloque aparece entero en el paso 1:\n\n* con su lista\n* y todo su contenido\n${STARS}`,
    menu: true,
  },
  {
    key: 'effect-range',
    category: 'animation',
    title: 'Visible solo en unos pasos',
    description: 'Con {{1-2}} el contenido se muestra en los pasos 1 y 2 y desaparece después.',
    source: '{{1-2}}\nEste aviso solo se ve durante los pasos 1 y 2.',
  },
  {
    key: 'effect-inline',
    category: 'animation',
    title: 'Animar parte de una frase',
    description: 'Dentro de un párrafo: {1}{texto} hace aparecer solo ese fragmento en el paso 1.',
    source: 'La respuesta correcta es… {1}{**la vista**}.',
  },
  {
    key: 'narration',
    category: 'animation',
    title: 'Narración (texto a voz)',
    description: 'El texto bajo --{{n}}-- no se ve: lo lee el narrador en el paso n (--{{0}}-- al entrar en la sección). La voz se define en la cabecera (narrator).',
    source: '--{{0}}--\nBienvenidos a la unidad. En esta sección veremos el patrón MVC.',
    menu: true,
  },

  // --- Código --------------------------------------------------------------
  {
    key: 'code-run',
    category: 'code',
    title: 'Código ejecutable',
    description: 'Un bloque de código seguido de <script>@input</script> se convierte en un editor que el alumnado puede modificar y ejecutar.',
    source: '```js\nconst notas = [6.5, 8, 4.75, 9]\nconst media = notas.reduce((a, b) => a + b, 0) / notas.length\nconsole.log(`Media: ${media.toFixed(2)}`)\n```\n<script>@input</script>',
    menu: true,
  },
  {
    key: 'code-tabs',
    category: 'code',
    title: 'Código en pestañas',
    description: 'Varios bloques seguidos con nombre de fichero se muestran como pestañas; + abre la pestaña y - la deja cerrada.',
    source:
      '```html +index.html\n<h1 id="titulo">Hola</h1>\n```\n' +
      '```css -estilos.css\nh1 { color: teal; }\n```\n' +
      '```js -app.js\ndocument.getElementById("titulo").textContent = "Hola, mundo"\n```',
  },

  // --- Multimedia ----------------------------------------------------------
  {
    key: 'video',
    category: 'media',
    title: 'Vídeo',
    description: 'Como una imagen, pero con !? delante: inserta el reproductor (YouTube, Vimeo o un fichero de vídeo).',
    source: '!?[El primer vídeo de YouTube](https://www.youtube.com/watch?v=jNQXAC9IVRw)',
  },
  {
    key: 'audio',
    category: 'media',
    title: 'Audio',
    description: 'Con ? delante: inserta un reproductor de audio.',
    source: '?[Audio de la unidad](https://ejemplo.org/unidad3.mp3)',
  },

  // --- Formato -------------------------------------------------------------
  {
    key: 'sub-sup',
    category: 'format',
    title: 'Subíndices y superíndices',
    description: 'Entre virgulillas para subíndice (H~2~O) y entre acentos circunflejos para superíndice (mc^2^).',
    source: 'La fórmula del agua es H~2~O y la energía es E=mc^2^.',
  },
  {
    key: 'style',
    category: 'format',
    title: 'Estilo de un elemento',
    description: 'Un comentario <!-- style="…" --> justo antes de un elemento le aplica CSS.',
    source: '<!-- style="background: lightyellow; padding: 0.5em 1em; border-left: 4px solid orange" -->\nEste párrafo tiene un estilo propio.',
  },
  {
    key: 'details',
    category: 'format',
    title: 'Bloque desplegable',
    description: 'Contenido oculto que se despliega al pulsar, útil para soluciones o ampliaciones. Deja líneas en blanco alrededor del contenido: en el editor, el interior se edita como texto normal entre las dos etiquetas.',
    source: '<details>\n<summary>Ver la solución</summary>\n\nLa clave primaria identifica de forma única cada fila de la tabla.\n\n</details>',
    mixed: true,
  },

  // --- Datos y diagramas ---------------------------------------------------
  {
    key: 'chart',
    category: 'data',
    title: 'Tabla como gráfico',
    description: 'Un comentario con data-type antes de una tabla numérica la convierte en gráfico (barchart, linechart, piechart…); data-show lo muestra directamente en lugar de la tabla.',
    source:
      '<!-- data-type="barchart" data-show data-title="Nota media por unidad" -->\n' +
      '| Unidad | Media |\n|--------|------:|\n| UT1    |   6.5 |\n| UT2    |   7.2 |\n| UT3    |   5.8 |\n| UT4    |   8.1 |',
  },
  {
    key: 'ascii',
    category: 'data',
    title: 'Diagrama ASCII',
    description: 'Un bloque de código con lenguaje ascii se dibuja como diagrama. En el editor se ve como código.',
    source:
      '```ascii\n' +
      '+----------+   peticion   +------------+   consulta   +------+\n' +
      '| Navegador| -----------> |  Servidor  | -----------> |  BD  |\n' +
      '+----------+ <----------- +------------+ <----------- +------+\n' +
      '               respuesta                   datos\n' +
      '```',
    native: true,
  },
]

export function examplesByCategory(): { id: LiaCategory; title: string; items: LiaExample[] }[] {
  return CATEGORIES.map((c) => ({ ...c, items: LIA_EXAMPLES.filter((e) => e.category === c.id) }))
}

/** Ruta de la imagen del resultado (generada por scripts/lia-previews.mjs). */
export const exampleImage = (key: string): string => `./lia-examples/${key}.webp`
