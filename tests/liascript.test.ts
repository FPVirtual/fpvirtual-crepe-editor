// Tests unitarios del dialecto: cabecera/bloque LMS, clasificador, quiz y
// preservación de la fuente.

import { describe, expect, it } from 'vitest'

import { classifyBlock, joinDocument, SourcePreserver, splitDocument, summarizeQuiz } from '../src/liascript'

describe('cabecera y bloque liascript-lms', () => {
  const original = '<!--\nauthor: Ana\ntitle: UT03\n\n-->\n\n# UT03\n'
  // Inyección tal como la hace el plugin (lib.php): línea en blanco + bloque.
  const injected =
    '<!--\nauthor: Ana\ntitle: UT03\n\nliascript-lms:\n  save_endpoint: https://m/save.php\n' +
    '  file: ut03.md\n  branch: edicion/ana/ut03\n  sha: abc\n  token: t0k\n  readonly: false\n\n-->\n\n# UT03\n'

  it('extrae la configuración y deja la cabecera como estaba', () => {
    const doc = splitDocument(injected)
    expect(doc.lms).toMatchObject({ file: 'ut03.md', branch: 'edicion/ana/ut03', sha: 'abc', readonly: false })
    expect(joinDocument(doc, doc.body)).toBe(original)
  })

  it('ignora un bloque incompleto pero lo elimina', () => {
    const doc = splitDocument('<!--\nliascript-lms:\n  file: x.md\n-->\n\nTexto\n')
    expect(doc.lms).toBeUndefined()
    expect(doc.header).not.toContain('liascript-lms')
  })

  it('documento sin cabecera', () => {
    const doc = splitDocument('# Hola\n')
    expect(doc.header).toBe('')
    expect(joinDocument(doc, doc.body)).toBe('# Hola\n')
  })
})

describe('clasificador', () => {
  const p = { type: 'paragraph' }
  it.each([
    ['[( )] Madrid\n[(X)] París', 'quiz'],
    ['[[X]] PHP\n[[ ]] HTML', 'quiz'],
    ['[[4]]', 'quiz'],
    ['El MVC separa [[ a | (b) | c ]] y más.', 'quiz'],
    ['[[Sí] (No)]\n[ (X) ( ) ] fila', 'quiz'],
    ['--{{0}}--\nTexto narrado', 'effect'],
    ['Texto {1}{**destacado**}', 'effect'],
    ['@nota(Un aviso)', 'macro'],
    ['H~2~O y E=mc^2^', 'inline'],
    ['!?[vídeo](https://youtu.be/x)', 'inline'],
  ])('%s → %s', (source, kind) => {
    expect(classifyBlock(p, source)).toBe(kind)
  })

  it.each([
    'Texto normal con **negrita** y ~~tachado~~.',
    'Un correo profesor@example.org no es macro.',
    'El código `[[X]]` en un code span no es un quiz.',
  ])('prosa editable: %s', (source) => {
    expect(classifyBlock(p, source)).toBeNull()
  })

  it('código: con meta se protege, Java con anotaciones no', () => {
    expect(classifyBlock({ type: 'code', meta: '+main.js' }, '```js +main.js\nx\n```')).toBe('code-meta')
    expect(classifyBlock({ type: 'code', meta: null }, '```java\n@Override\n```')).toBeNull()
    expect(classifyBlock({ type: 'code', meta: null }, '    {{1}}')).toBe('effect')
    expect(classifyBlock({ type: 'code', meta: null }, '    [[X]] a')).toBe('quiz')
  })

  it('encabezado setext protegido (LiaScript no lo trata como sección), ATX editable', () => {
    expect(classifyBlock({ type: 'heading' }, 'Título\n------')).toBe('unknown')
    expect(classifyBlock({ type: 'heading' }, '## Título')).toBeNull()
  })

  it('enlaces por referencia y tipos no soportados se protegen', () => {
    expect(classifyBlock({ type: 'paragraph', children: [{ type: 'linkReference' }] }, '[a][b]')).toBe('inline')
    expect(classifyBlock({ type: 'definition' }, '[b]: https://x')).toBe('unknown')
    expect(classifyBlock({ type: 'html' }, '<!-- x -->')).toBe('html')
  })
})

describe('resumen de quiz', () => {
  it('opción única con pistas', () => {
    const q = summarizeQuiz('[( )] Madrid\n[(X)] París\n[[?]] Torre')
    expect(q.type).toBe('single')
    expect(q.options).toEqual([
      { text: 'Madrid', correct: false },
      { text: 'París', correct: true },
    ])
    expect(q.hints).toBe(1)
  })
})

describe('preservación de la fuente', () => {
  // Forma canónica simulada: viñetas `*` → `-`.
  const canonical = (md: string) => md.replace(/^\* /gm, '- ') + '\n'
  const original = '# T\n\n* a\n* b\n\n\nTexto *x*\n'
  const blocks = [
    { text: '# T', start: 0, end: 3 },
    { text: '* a\n* b', start: 5, end: 12 },
    { text: 'Texto *x*', start: 15, end: 24 },
  ]
  const preserver = new SourcePreserver(original, blocks, canonical)

  it('sin cambios devuelve el original byte a byte', () => {
    expect(preserver.restore(['# T\n', '- a\n- b\n', 'Texto *x*\n'])).toBe(original)
  })

  it('solo el bloque editado sale en forma canónica', () => {
    expect(preserver.restore(['# T\n', '- a\n- b\n- c\n', 'Texto *x*\n'])).toBe(
      '# T\n\n- a\n- b\n- c\n\nTexto *x*\n',
    )
  })

  it('un bloque nuevo al principio conserva el resto', () => {
    expect(preserver.restore(['Nuevo\n', '# T\n', '- a\n- b\n', 'Texto *x*\n'])).toBe(
      'Nuevo\n\n# T\n\n* a\n* b\n\n\nTexto *x*\n',
    )
  })
})
