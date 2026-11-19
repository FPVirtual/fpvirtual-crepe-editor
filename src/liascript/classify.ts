// Clasificación de bloques Markdown según contengan sintaxis propia de LiaScript.
//
// Regla de seguridad (fallback del roadmap): cualquier bloque de nivel
// superior que contenga algo que CommonMark/GFM no representa fielmente se
// convierte en un bloque atómico que conserva su fuente literal. Ante la
// duda, se protege: un falso positivo solo hace un bloque no editable en
// visual; un falso negativo puede reescribir sintaxis LiaScript en Git.

/** Tipo de bloque protegido; determina cómo se muestra la tarjeta. */
export type LiaKind =
  | 'quiz' // [[X]], [( )], [[texto]], [[?]] pista…
  | 'effect' // {{n}}, --{{n}}-- narración, *** {{n}} ***
  | 'macro' // @macro, @macro(params), @LIA.…, @input
  | 'html' // bloque HTML / comentario (<!-- data-… -->, <script>…)
  | 'code-meta' // bloque de código con flags/nombre de fichero (```js +main.js)
  | 'inline' // marcas inline LiaScript (~sub~, ^sup^, !?[vídeo]…) o enlaces por referencia
  | 'unknown' // tipo mdast no soportado por el editor (definiciones…)

/** Tipos mdast de nivel superior que el editor sabe editar. */
const EDITABLE_TYPES = new Set([
  'heading',
  'paragraph',
  'list',
  'blockquote',
  'code',
  'table',
  'thematicBreak',
  'math',
  'footnoteDefinition',
])

const QUIZ_LINE = /^[ \t]*(?:\[\[.*?\]\]|\[\(.?\)\]|\[\[ ?[xX ]?\]\])/m
const QUIZ_INLINE = /\[\[[^\]\n]*\|[^\]\n]*\]\]/ // [[a|(b)|c]] selección inline
// Matriz: cabecera `[[Sí] (No)]` y filas `[ (X) ( ) ]` / `[ [X] [ ] ]`.
const QUIZ_MATRIX = /^[ \t]*\[(?:[ \t]*[[(][^\])\n]*[\])])+[ \t]*\]/m
const EFFECT = /\{\{\d+(?:-\d+)?\}\}|--\{\{\d+\}\}--|\{\d+(?:-\d+)?\}\{/
const MACRO = /(?:^|[\s(>*_])@[A-Za-z_][\w.-]*/m
const HTML_START = /^[ \t]*</
const INLINE_LIA = [
  /(?<![~\\])~(?!~)[^~\s][^~\n]*?~(?!~)/, // subíndice ~x~ (remark-gfm lo leería como tachado)
  /(?<![\\^])\^(?!\^)[^^\s][^^\n]*?\^/, // superíndice ^x^
  /[!?]\?\[/, // !?[vídeo](…) y ??[oembed](…)
  /(?<![!\]])\?\[[^\]]*\]\(/, // ?[audio](…)
  /<!--/, // comentarios de estilo/animación inline
]

export interface BlockLike {
  type: string
  meta?: string | null
  children?: BlockLike[]
}

/** Tipos mdast inline que el editor no representa (dependen de definiciones). */
const UNSUPPORTED_INLINE = new Set(['linkReference', 'imageReference'])

function containsType(node: BlockLike, types: Set<string>): boolean {
  if (types.has(node.type)) return true
  return node.children?.some((child) => containsType(child, types)) ?? false
}

/**
 * Decide si un bloque de nivel superior debe protegerse.
 *
 * @param node nodo mdast (solo se usan `type` y, para código, `meta`)
 * @param source fuente literal del bloque
 * @returns el tipo de bloque protegido, o `null` si es prosa editable
 */
export function classifyBlock(node: BlockLike, source: string): LiaKind | null {
  if (node.type === 'html' || HTML_START.test(source)) return 'html'
  if (!EDITABLE_TYPES.has(node.type)) return 'unknown'

  if (node.type === 'code') {
    if (node.meta) return 'code-meta'
    // Los quizzes indentados con 4 espacios llegan como código indentado.
    const unindented = source.replace(/^( {4}|\t)/gm, '')
    if (!source.trimStart().startsWith('```') && !source.trimStart().startsWith('~~~')) {
      if (QUIZ_LINE.test(unindented) || QUIZ_MATRIX.test(unindented)) return 'quiz'
      if (EFFECT.test(unindented)) return 'effect'
    }
    return null // el contenido de un bloque de código es literal: no se escanea
  }
  if (node.type === 'math') return null
  // LiaScript solo abre sección con encabezados ATX (`# …`); un setext es
  // texto para LiaScript, pero Milkdown lo reescribiría como `## …` (sección nueva).
  if (node.type === 'heading' && !/^[ \t]*#/.test(source)) return 'unknown'
  if (containsType(node, UNSUPPORTED_INLINE)) return 'inline'

  const text = stripCodeSpans(source)
  if (QUIZ_LINE.test(text) || QUIZ_INLINE.test(text) || QUIZ_MATRIX.test(text)) return 'quiz'
  if (EFFECT.test(text)) return 'effect'
  if (MACRO.test(text)) return 'macro'
  if (INLINE_LIA.some((re) => re.test(text))) return 'inline'
  return null
}

/** Quita los `code spans` para no clasificar por su contenido literal. */
function stripCodeSpans(text: string): string {
  return text.replace(/(`+)[\s\S]*?\1/g, '')
}
