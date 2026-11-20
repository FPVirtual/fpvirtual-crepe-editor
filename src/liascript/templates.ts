// Plantillas de bloques LiaScript para el menú «/» y la ayuda.
//
// Crepe no sabe escribir sintaxis LiaScript: si se teclea en un párrafo, la
// escapa al guardar (`[(X)]` → `\[(X)]`). Por eso estos bloques se insertan
// como tarjetas LiaScript, con su fuente literal, y se editan como texto.
// La sintaxis sigue la de fixtures/real/demo-liascript.md (validada con liaex).

export interface LiaTemplate {
  /** Clave estable (menú «/», tests). */
  key: string
  /** Clave i18n del nombre visible. */
  label: string
  /** Fuente LiaScript que se inserta. */
  source: string
}

export const LIA_TEMPLATES: readonly LiaTemplate[] = [
  {
    key: 'quiz-single',
    label: 'lia.template.quizSingle',
    source: '[( )] Opción incorrecta\n[(X)] Opción correcta\n[( )] Otra opción incorrecta',
  },
  {
    key: 'quiz-multiple',
    label: 'lia.template.quizMultiple',
    source: '[[X]] Opción correcta\n[[ ]] Opción incorrecta\n[[X]] Otra opción correcta',
  },
  {
    key: 'quiz-text',
    label: 'lia.template.quizText',
    source: '[[respuesta]]',
  },
  {
    key: 'quiz-solution',
    label: 'lia.template.quizSolution',
    source:
      '[[respuesta]]\n[[?]] Pista para el alumnado.\n' +
      '****************************************************************\n' +
      'Explicación de la solución.\n' +
      '****************************************************************',
  },
  {
    key: 'quiz-matrix',
    label: 'lia.template.quizMatrix',
    source:
      '[[Verdadero] (Falso)]\n' +
      '[    (X)       ( )  ]  Primera afirmación (verdadera).\n' +
      '[    ( )       (X)  ]  Segunda afirmación (falsa).',
  },
  {
    key: 'effect',
    label: 'lia.template.effect',
    source: '{{1}}\nEste párrafo aparece en el paso 1.',
  },
  {
    key: 'effect-block',
    label: 'lia.template.effectBlock',
    source:
      '{{2}}\n' +
      '********************************************************************\n' +
      'Este bloque completo aparece en el paso 2.\n\n' +
      '* puede contener listas\n' +
      '* y varios párrafos\n' +
      '********************************************************************',
  },
  {
    key: 'narration',
    label: 'lia.template.narration',
    source: '--{{1}}--\nTexto que lee el narrador en el paso 1 (modo presentación).',
  },
  {
    key: 'code-run',
    label: 'lia.template.codeRun',
    source: '```js\nconsole.log("Hola")\n```\n<script>@input</script>',
  },
]

export interface HeaderMacro {
  name: string
  /** La macro usa el parámetro `@0` (se inserta como `@nombre(`texto`)`). */
  takesParam: boolean
}

const BLOCK_MACRO = /^@([A-Za-z_][\w.-]*)[ \t]*$/
const LINE_MACRO = /^@([A-Za-z_][\w.-]*):[ \t]*(.*)$/

/**
 * Macros definidas en la cabecera del material (`@nombre` … `@end` o
 * `@nombre: cuerpo`), para ofrecerlas en el menú «/».
 */
export function extractHeaderMacros(header: string): HeaderMacro[] {
  const lines = header.split('\n')
  const macros: HeaderMacro[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const single = LINE_MACRO.exec(line)
    if (single) {
      macros.push({ name: single[1], takesParam: /@0\b/.test(single[2]) })
      continue
    }
    const block = BLOCK_MACRO.exec(line)
    if (!block || block[1] === 'end') continue
    const end = lines.findIndex((l, k) => k > i && l.trim() === '@end')
    if (end === -1) continue
    macros.push({ name: block[1], takesParam: /@0\b/.test(lines.slice(i + 1, end).join('\n')) })
    i = end
  }
  return macros.filter((m, k) => macros.findIndex((o) => o.name === m.name) === k)
}

export function macroSource(macro: HeaderMacro): string {
  return macro.takesParam ? `@${macro.name}(\`Texto\`)` : `@${macro.name}`
}
