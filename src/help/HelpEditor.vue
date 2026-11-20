<script setup lang="ts">
// Ayuda: uso del editor visual. Adaptado de la documentación de Crepe/Milkdown
// (milkdown.dev) a la configuración de este editor: menús en español, sin IA,
// sin barra superior y sin subida de imágenes.

const SHORTCUTS: { keys: string[][]; action: string }[] = [
  { keys: [['Ctrl', 'S']], action: 'Guardar en Moodle' },
  { keys: [['Ctrl', 'Z']], action: 'Deshacer' },
  { keys: [['Ctrl', 'Mayús', 'Z'], ['Ctrl', 'Y']], action: 'Rehacer' },
  { keys: [['Ctrl', 'B']], action: 'Negrita' },
  { keys: [['Ctrl', 'I']], action: 'Cursiva' },
  { keys: [['Ctrl', 'E']], action: 'Código en línea' },
  { keys: [['Ctrl', 'Alt', 'X']], action: 'Tachado' },
  { keys: [['Ctrl', 'Alt', '0']], action: 'Convertir en párrafo' },
  { keys: [['Ctrl', 'Alt', '1…6']], action: 'Convertir en título de nivel 1 a 6' },
  { keys: [['Ctrl', 'Mayús', 'B']], action: 'Cita' },
  { keys: [['Ctrl', 'Alt', '8']], action: 'Lista con viñetas' },
  { keys: [['Ctrl', 'Alt', '7']], action: 'Lista numerada' },
  { keys: [['Ctrl', 'Alt', 'C']], action: 'Bloque de código' },
  { keys: [['Tab'], ['Mayús', 'Tab']], action: 'Aumentar o reducir la sangría de una lista · siguiente o anterior celda en tablas' },
  { keys: [['Mayús', 'Intro']], action: 'Salto de línea dentro del mismo párrafo' },
  { keys: [['Ctrl', 'Intro']], action: 'Aplicar los cambios de una tarjeta LiaScript' },
  { keys: [['Esc']], action: 'Cancelar la edición de una tarjeta LiaScript' },
]

const MARKDOWN: { type: string; result: string }[] = [
  { type: '# ', result: 'Título de nivel 1 (## para nivel 2, y así hasta ######)' },
  { type: '- ', result: 'Lista con viñetas (también * o +)' },
  { type: '1. ', result: 'Lista numerada' },
  { type: '[ ] ', result: 'Lista de tareas, dentro de una lista' },
  { type: '> ', result: 'Cita' },
  { type: '```', result: 'Bloque de código (puedes añadir el lenguaje: ```python)' },
  { type: '---', result: 'Separador horizontal' },
  { type: '**texto**', result: 'Negrita' },
  { type: '*texto*', result: 'Cursiva' },
  { type: '`texto`', result: 'Código en línea' },
  { type: '~~texto~~', result: 'Tachado' },
]
</script>

<template>
  <article class="help__article">
    <h1>Cómo usar el editor</h1>
    <p class="help__lead">
      El editor muestra el material tal como se verá, sin necesidad de escribir Markdown. Lo que
      guardas se convierte en un fichero LiaScript en Git, del que salen las versiones H5P,
      ePub, PDF y SCORM. Si sabes usar un procesador de textos, ya sabes usar casi todo.
    </p>

    <nav class="help__toc" aria-label="Contenido de esta sección">
      <a href="#editor/escribir">Escribir y dar formato</a>
      <a href="#editor/indice">El índice</a>
      <a href="#editor/menu">El menú «/»</a>
      <a href="#editor/bloques">Mover y añadir bloques</a>
      <a href="#editor/enlaces">Enlaces e imágenes</a>
      <a href="#editor/tablas">Tablas, código y fórmulas</a>
      <a href="#editor/liascript">Bloques LiaScript</a>
      <a href="#editor/guardar">Guardar y publicar</a>
      <a href="#editor/atajos">Atajos de teclado</a>
    </nav>

    <section id="editor/escribir">
      <h2>Escribir y dar formato</h2>
      <p>
        Escribe directamente en la página. Al <strong>seleccionar texto</strong> aparece una barra
        flotante con <em>Negrita</em>, <em>Cursiva</em>, <em>Tachado</em>, <em>Código en línea</em>,
        <em>Enlace</em> y <em>Fórmula en línea</em>.
      </p>
      <p>
        Si conoces Markdown, también puedes usar sus atajos mientras escribes: el editor los convierte
        al momento.
      </p>
      <table class="help__table">
        <thead>
          <tr><th scope="col">Escribe…</th><th scope="col">Obtienes</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in MARKDOWN" :key="m.type">
            <td><code>{{ m.type }}</code></td>
            <td>{{ m.result }}</td>
          </tr>
        </tbody>
      </table>
      <p class="help__note">
        Los títulos son importantes: en LiaScript <strong>cada título empieza una sección o
        diapositiva</strong>. Consulta <a href="#liascript/diapositivas">Diapositivas y secciones</a>.
      </p>
    </section>

    <section id="editor/indice">
      <h2>El índice</h2>
      <p>
        El panel de la izquierda muestra el <strong>índice del material</strong>, formado por sus
        títulos: es la misma estructura de secciones que tendrá el curso. Se actualiza mientras
        escribes y marca la sección en la que estás.
      </p>
      <ul>
        <li>Haz clic en un título para ir a él.</li>
        <li>
          El botón <strong>☰</strong> de la barra superior muestra u oculta el panel; el editor recuerda
          tu elección. En pantallas estrechas el panel se superpone al documento y se cierra al elegir
          un título.
        </li>
        <li>
          Si un título no aparece en el índice, probablemente está escrito subrayado (con
          <code>---</code> o <code>===</code> en la línea siguiente): LiaScript no lo trata como sección.
          Usa <code>#</code>.
        </li>
      </ul>
    </section>

    <section id="editor/menu">
      <h2>El menú «/»</h2>
      <p>
        En una línea vacía, escribe <kbd>/</kbd> para abrir el menú de bloques. Sigue escribiendo para
        filtrar (por ejemplo, <kbd>/tab</kbd> para «Tabla») y pulsa <kbd>Intro</kbd> o haz clic para
        insertar. <kbd>Esc</kbd> lo cierra.
      </p>
      <ul>
        <li><strong>Texto</strong>: párrafo, títulos 1 a 6, cita y separador.</li>
        <li><strong>Listas</strong>: con viñetas, numerada y de tareas.</li>
        <li><strong>Avanzado</strong>: imagen, bloque de código, tabla y fórmula (LaTeX).</li>
        <li>
          <strong>LiaScript</strong>: quizzes, animaciones, narración, código ejecutable y las macros
          que define tu material (por ejemplo <code>@nota</code>). Ver
          <a href="#liascript">LiaScript avanzado</a>.
        </li>
      </ul>
    </section>

    <section id="editor/bloques">
      <h2>Mover y añadir bloques</h2>
      <p>Al pasar el ratón por la izquierda de cualquier bloque aparecen dos controles:</p>
      <ul>
        <li><strong>+</strong> añade un bloque nuevo debajo y abre el menú «/».</li>
        <li>
        <strong>⠿</strong> (asa): arrástrala para mover el bloque, o haz clic en ella para seleccionarlo
          entero (y después copiarlo, cortarlo o borrarlo).
        </li>
      </ul>
      <p>
        Las listas se reorganizan con <kbd>Tab</kbd> y <kbd>Mayús</kbd>+<kbd>Tab</kbd>. En una lista de
        tareas, haz clic en la casilla para marcarla.
      </p>
    </section>

    <section id="editor/enlaces">
      <h2>Enlaces e imágenes</h2>
      <p>
        <strong>Enlaces</strong>: selecciona el texto, pulsa <em>Enlace</em> en la barra flotante y pega
        la dirección. Al pasar el ratón sobre un enlace puedes editarlo, copiarlo o quitarlo.
      </p>
      <p>
        <strong>Imágenes</strong>: menú «/» → <em>Imagen</em> y pega la URL de la imagen. Puedes
        añadirle un pie y ajustar su tamaño arrastrando el borde.
      </p>
      <p class="help__note">
        De momento no se pueden subir imágenes desde el ordenador: deben estar publicadas en una
        dirección web (por ejemplo, en el repositorio del material o en Moodle).
      </p>
    </section>

    <section id="editor/tablas">
      <h2>Tablas, código y fórmulas</h2>
      <ul>
        <li>
          <strong>Tablas</strong>: menú «/» → <em>Tabla</em>. Con las asas de fila y columna puedes
          añadir, borrar, mover y alinear. <kbd>Tab</kbd> pasa a la celda siguiente.
        </li>
        <li>
          <strong>Código</strong>: menú «/» → <em>Bloque de código</em>. Elige el lenguaje en el
          selector para tener resaltado de sintaxis; el botón <em>Copiar</em> copia el contenido.
        </li>
        <li>
          <strong>Fórmulas</strong>: en línea, con <em>Fórmula en línea</em> de la barra flotante (o
          escribiendo <code>$a^2+b^2$</code>); en bloque, con menú «/» → <em>Fórmula (LaTeX)</em>, que
          muestra una vista previa.
        </li>
      </ul>
    </section>

    <section id="editor/liascript">
      <h2>Bloques LiaScript (tarjetas)</h2>
      <p>
        Algunas partes del material usan sintaxis propia de LiaScript que el editor visual no sabe
        mostrar: quizzes, animaciones, narración, macros, código ejecutable… Aparecen como
        <strong>tarjetas</strong> con su código, para que nada se pierda al guardar.
      </p>
      <ul>
        <li>Para cambiar una tarjeta, pulsa <em>Editar</em> o haz doble clic sobre ella.</li>
        <li>
          Modifica el código y pulsa <em>Aplicar</em> (<kbd>Ctrl</kbd>+<kbd>Intro</kbd>), o
          <em>Cancelar</em> (<kbd>Esc</kbd>).
        </li>
        <li>Si dejas el texto vacío y aplicas, la tarjeta se borra.</li>
        <li>Para crear una nueva, usa el grupo <strong>LiaScript</strong> del menú «/».</li>
      </ul>
      <p class="help__note">
        No escribas sintaxis LiaScript (como <code>[(X)]</code> o <code v-pre>{{1}}</code>) en un párrafo
        normal: el editor la trataría como texto y dejaría de funcionar. Usa siempre una tarjeta.
      </p>
    </section>

    <section id="editor/guardar">
      <h2>Guardar y publicar</h2>
      <ul>
        <li>
          <strong>Guardar</strong> (<kbd>Ctrl</kbd>+<kbd>S</kbd>) envía el material a Moodle, que lo
          guarda en Git. El estado aparece junto al botón.
        </li>
        <li>
          Si otra persona guardó una versión mientras editabas, el editor te avisa: puedes ver las
          diferencias, recargar su versión o guardar la tuya encima. Tu trabajo queda a salvo en una
          rama aparte.
        </li>
        <li>
          Mientras editas se guarda un <strong>borrador en tu navegador</strong>. Si cierras sin
          guardar, al volver se te ofrecerá recuperarlo.
        </li>
        <li>
          <strong>Publicar</strong> genera el formato elegido (H5P, ePub o PDF) y lo añade al curso.
          Guarda antes de publicar.
        </li>
        <li>
          El selector <strong>Tema</strong> cambia los colores del editor: verde, oscuro o alto
          contraste (letra más grande y máximo contraste). En «automático» sigue la configuración de
          tu sistema.
        </li>
      </ul>
    </section>

    <section id="editor/atajos">
      <h2>Atajos de teclado</h2>
      <p>En Mac, usa <kbd>⌘</kbd> en lugar de <kbd>Ctrl</kbd> y <kbd>⌥</kbd> en lugar de <kbd>Alt</kbd>.</p>
      <table class="help__table">
        <thead>
          <tr><th scope="col">Teclas</th><th scope="col">Acción</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in SHORTCUTS" :key="s.action">
            <td class="help__keys">
              <template v-for="(combo, i) in s.keys" :key="i">
                <span v-if="i > 0"> o </span>
                <template v-for="(k, j) in combo" :key="k">
                  <span v-if="j > 0">+</span><kbd>{{ k }}</kbd>
                </template>
              </template>
            </td>
            <td>{{ s.action }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </article>
</template>
