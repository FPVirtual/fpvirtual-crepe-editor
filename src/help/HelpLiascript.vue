<script setup lang="ts">
// Ayuda: funciones de LiaScript que el editor visual no muestra (se editan
// como tarjetas). Los ejemplos que coinciden con el menú «/» salen de
// LIA_TEMPLATES, así ayuda y menú no se desincronizan. La sintaxis sigue
// fixtures/real/demo-liascript.md, validada con liaex.
import { LIA_TEMPLATES } from '../liascript/templates'
import CodeSample from './CodeSample.vue'

const tpl = (key: string): string => LIA_TEMPLATES.find((t) => t.key === key)!.source

const S = {
  quizSingle: tpl('quiz-single'),
  quizMultiple: tpl('quiz-multiple'),
  quizText: tpl('quiz-text'),
  quizSolution: tpl('quiz-solution'),
  quizMatrix: tpl('quiz-matrix'),
  effect: tpl('effect'),
  effectBlock: tpl('effect-block'),
  narration: tpl('narration'),
  codeRun: tpl('code-run'),
  quizInline: 'El patrón MVC separa los datos (modelo), la presentación\n([[ controlador | (vista) | servicio ]]) y la coordinación (controlador).',
  survey: '[(1)] Nada\n[(2)] Bastante\n[(3)] Mucho',
  surveyMultiple: '[[1]] PHP\n[[2]] Python\n[[3]] JavaScript',
  surveyText: '[[___]]',
  slides: '# Unidad 3: Bases de datos\n\n## Introducción\n\nTexto de la primera sección…\n\n## Modelo relacional\n\n### Tablas y claves\n\nTexto de una subsección…',
  macroUse: '@nota(`Las macros se definen una vez en la cabecera y se usan en todo el material.`)',
  macroDef: '@nota\n<div class="nota">\n\n**Nota:** @0\n\n</div>\n@end',
  media: '!?[Vídeo de presentación](https://www.youtube.com/watch?v=XXXXXXXXXXX)\n\n?[Audio de la unidad](https://ejemplo.org/audio.mp3)',
  subSup: 'La fórmula del agua es H~2~O y la de la energía E=mc^2^.',
}
</script>

<template>
  <article class="help__article">
    <h1>LiaScript avanzado</h1>
    <p class="help__lead">
      LiaScript amplía Markdown con autoevaluaciones, animaciones, narración, macros y código
      ejecutable. El editor visual no puede mostrar estas funciones tal como se verán en el curso,
      así que las presenta como <strong>tarjetas</strong> con su código. Esta página explica cómo
      escribir cada una.
    </p>

    <nav class="help__toc" aria-label="Contenido de esta sección">
      <a href="#liascript/tarjetas">Trabajar con tarjetas</a>
      <a href="#liascript/diapositivas">Diapositivas y secciones</a>
      <a href="#liascript/quizzes">Autoevaluación (quizzes)</a>
      <a href="#liascript/encuestas">Encuestas</a>
      <a href="#liascript/animaciones">Animaciones</a>
      <a href="#liascript/narracion">Narración</a>
      <a href="#liascript/macros">Macros y cajas</a>
      <a href="#liascript/codigo">Código ejecutable</a>
      <a href="#liascript/multimedia">Multimedia y otros</a>
    </nav>

    <section id="liascript/tarjetas">
      <h2>Trabajar con tarjetas</h2>
      <ol>
        <li>
          Para <strong>crear</strong> un bloque: en una línea vacía escribe <kbd>/</kbd> y elige una
          opción del grupo <strong>LiaScript</strong>. Se inserta una plantilla ya abierta para editar.
        </li>
        <li>
          Para <strong>cambiarlo</strong>: pulsa <em>Editar</em> en la tarjeta o haz doble clic sobre
          ella.
        </li>
        <li>
          Escribe el código y pulsa <em>Aplicar</em> (<kbd>Ctrl</kbd>+<kbd>Intro</kbd>). Si quitas toda
          la sintaxis LiaScript, la tarjeta se convierte en texto normal; si lo dejas vacío, se borra.
        </li>
      </ol>
      <p>
        Cada ejemplo de esta página tiene un botón <em>Copiar</em>: cópialo y pégalo dentro de una
        tarjeta en edición.
      </p>
      <p class="help__note">
        El texto de una tarjeta se guarda exactamente como lo escribes. No pegues sintaxis LiaScript en
        un párrafo normal: el editor la convertiría en texto y dejaría de funcionar.
      </p>
    </section>

    <section id="liascript/diapositivas">
      <h2>Diapositivas y secciones</h2>
      <p>
        En LiaScript <strong>cada título empieza una sección</strong>: en modo libro es un apartado del
        índice y en modo presentación, una diapositiva. Esto <strong>sí</strong> se hace en el editor
        visual: basta con usar títulos (menú «/» → Título, o escribir <code>#</code>, <code>##</code>…).
      </p>
      <ul>
        <li><code>#</code> (Título 1): el título del material. Úsalo una sola vez, al principio.</li>
        <li><code>##</code> (Título 2): cada sección o diapositiva principal.</li>
        <li><code>###</code> (Título 3) y siguientes: subsecciones, que aparecen anidadas en el índice.</li>
      </ul>
      <CodeSample :code="S.slides" label="Estructura de un material" />
      <p>
        Consejo: una diapositiva con mucho contenido se lee mal en modo presentación. Divídela con más
        títulos, o usa <a href="#liascript/animaciones">animaciones</a> para mostrarla por pasos.
      </p>
    </section>

    <section id="liascript/quizzes">
      <h2>Autoevaluación (quizzes)</h2>
      <p>
        Escribe la pregunta en un párrafo normal y, justo debajo, el quiz en una tarjeta. El alumnado
        recibe la corrección al momento.
      </p>

      <h3>Opción única</h3>
      <p>Una línea por opción. <code>(X)</code> marca la correcta y <code>( )</code> las demás.</p>
      <CodeSample :code="S.quizSingle" />

      <h3>Opción múltiple</h3>
      <p>Con corchetes dobles: <code>[[X]]</code> en todas las correctas y <code>[[ ]]</code> en las incorrectas.</p>
      <CodeSample :code="S.quizMultiple" />

      <h3>Respuesta corta</h3>
      <p>La respuesta esperada entre corchetes dobles. El alumnado la escribe en un campo de texto.</p>
      <CodeSample :code="S.quizText" />

      <h3>Selección dentro del texto</h3>
      <p>Opciones separadas por <code>|</code>; la correcta va entre paréntesis.</p>
      <CodeSample :code="S.quizInline" />

      <h3>Matriz (verdadero/falso)</h3>
      <p>
        La primera línea nombra las columnas. Cada fila es una afirmación: marca con
        <code>(X)</code> la columna correcta y con <code>( )</code> las demás.
      </p>
      <CodeSample :code="S.quizMatrix" />

      <h3>Pistas y solución</h3>
      <p>
        Cada <code>[[?]]</code> añade una pista que el alumnado puede pedir. El bloque entre dos líneas
        de asteriscos es la solución, que se muestra al resolver o rendirse.
      </p>
      <CodeSample :code="S.quizSolution" />
    </section>

    <section id="liascript/encuestas">
      <h2>Encuestas</h2>
      <p>
        Igual que los quizzes, pero con números en lugar de <code>X</code>: no hay respuesta correcta y
        sirven para recoger opiniones.
      </p>
      <CodeSample :code="S.survey" label="Una respuesta" />
      <CodeSample :code="S.surveyMultiple" label="Varias respuestas" />
      <CodeSample :code="S.surveyText" label="Texto libre" />
    </section>

    <section id="liascript/animaciones">
      <h2>Animaciones (paso a paso)</h2>
      <p>
        En modo presentación, el contenido puede aparecer por pasos. <code v-pre>{{1}}</code> en la
        línea anterior a un párrafo hace que aparezca en el paso 1, <code v-pre>{{2}}</code> en el
        paso 2, etc. Con <code v-pre>{{1-2}}</code> se muestra solo durante los pasos 1 y 2.
      </p>
      <CodeSample :code="S.effect" label="Un párrafo" />
      <p>Para animar varios elementos juntos (párrafos, listas, imágenes), enciérralos entre dos líneas de asteriscos:</p>
      <CodeSample :code="S.effectBlock" label="Un bloque completo" />
    </section>

    <section id="liascript/narracion">
      <h2>Narración (texto a voz)</h2>
      <p>
        El texto bajo <code v-pre>--{{n}}--</code> no se ve en la diapositiva: lo lee en voz alta el
        narrador en el paso <code>n</code> (<code v-pre>--{{0}}--</code> se lee al entrar en la
        sección). La voz se elige en la cabecera del material (<code>narrator: Spanish Female</code>).
      </p>
      <CodeSample :code="S.narration" />
    </section>

    <section id="liascript/macros">
      <h2>Macros y cajas</h2>
      <p>
        Una macro es un fragmento reutilizable definido en la <strong>cabecera</strong> del material,
        como las cajas de nota, aviso o error. Se usa escribiendo <code>@nombre</code> y, si recibe
        texto, entre paréntesis y comillas invertidas (así el texto puede contener comas):
      </p>
      <CodeSample :code="S.macroUse" />
      <p>
        Las macros que define tu material aparecen en el menú «/», en el grupo LiaScript, como
        «Macro de la cabecera: @nombre».
      </p>
      <p class="help__note">
        La cabecera (autor, versión, idioma, voz del narrador, macros e <code>import:</code> de
        plantillas) no se edita desde el editor visual: se conserva intacta al guardar. Una macro se
        define así, con <code>@0</code> en el lugar del texto que recibe:
      </p>
      <CodeSample :code="S.macroDef" label="Definición en la cabecera (solo referencia)" />
    </section>

    <section id="liascript/codigo">
      <h2>Código ejecutable</h2>
      <p>
        Un bloque de código seguido, en la línea siguiente, de <code>&lt;script&gt;@input&lt;/script&gt;</code>
        se convierte en un editor que el alumnado puede modificar y ejecutar en el navegador. Otros
        lenguajes (Python, SQL…) necesitan importar una plantilla en la cabecera.
      </p>
      <CodeSample :code="S.codeRun" />
    </section>

    <section id="liascript/multimedia">
      <h2>Multimedia y otros</h2>
      <p>Vídeo (<code>!?[…]</code>) y audio (<code>?[…]</code>):</p>
      <CodeSample :code="S.media" />
      <p>Subíndices y superíndices:</p>
      <CodeSample :code="S.subSup" />
      <p class="help__note">
        Un párrafo con estas marcas también se muestra como tarjeta. Las imágenes normales
        (<code>![pie](url)</code>) sí se insertan en el editor visual (menú «/» → Imagen).
      </p>
      <p>
        Para todo lo demás, consulta la
        <a href="https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md" target="_blank" rel="noopener">documentación oficial de LiaScript</a>.
      </p>
    </section>
  </article>
</template>
