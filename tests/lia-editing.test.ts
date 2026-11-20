// Edición de bloques LiaScript: plantillas del menú «/», macros de la
// cabecera y tarjetas editables (aplicar, cancelar, convertir, borrar).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { editorViewCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { afterEach, describe, expect, it } from 'vitest'

import { insertLiaSource } from '../src/editor/crepeConfig'
import { createLiaEditor, type LiaEditor } from '../src/editor/createEditor'
import { cardViewAt, extractHeaderMacros, LIA_BLOCK, LIA_TEMPLATES, macroSource, splitDocument } from '../src/liascript'

let editor: LiaEditor | null = null

afterEach(async () => {
  await editor?.destroy()
  editor = null
  document.body.replaceChildren()
})

async function open(markdown: string): Promise<LiaEditor> {
  const root = document.createElement('div')
  document.body.append(root)
  editor = await createLiaEditor(root, markdown)
  return editor
}

function liaBlocks(ed: LiaEditor): { pos: number; value: string; kind: string }[] {
  const out: { pos: number; value: string; kind: string }[] = []
  ed.crepe.editor.ctx.get(editorViewCtx).state.doc.forEach((node, pos) => {
    if (node.type.name === LIA_BLOCK) out.push({ pos, value: node.attrs.value, kind: node.attrs.kind })
  })
  return out
}

describe('plantillas LiaScript', () => {
  it.each(LIA_TEMPLATES.map((tpl) => [tpl.key, tpl.source] as const))(
    '%s se reconoce como un único bloque LiaScript y se guarda literal',
    async (_key, source) => {
      const markdown = `# Título\n\nPregunta o contexto.\n\n${source}\n`
      const ed = await open(markdown)
      expect(liaBlocks(ed).map((b) => b.value)).toEqual([source])
      expect(ed.getMarkdown()).toBe(markdown)
    },
  )

  it('las de quiz se clasifican como quiz y las de animación como efecto', async () => {
    const kinds: Record<string, string> = {}
    for (const tpl of LIA_TEMPLATES) {
      const ed = await open(`${tpl.source}\n`)
      kinds[tpl.key] = liaBlocks(ed)[0]?.kind
      await ed.destroy()
      editor = null
    }
    for (const key of Object.keys(kinds).filter((k) => k.startsWith('quiz'))) expect(kinds[key], key).toBe('quiz')
    expect(kinds.effect).toBe('effect')
    expect(kinds['effect-block']).toBe('effect')
    expect(kinds.narration).toBe('effect')
  })
})

describe('macros de la cabecera', () => {
  it('detecta las macros de bloque y de una línea, y si usan parámetro', () => {
    const demo = readFileSync(join(process.cwd(), 'fixtures/real/demo-liascript.md'), 'utf8')
    const macros = extractHeaderMacros(splitDocument(demo).header)
    expect(macros.map((m) => m.name)).toEqual(expect.arrayContaining(['nota', 'aviso', 'error']))
    expect(macros.every((m) => m.takesParam)).toBe(true)
    expect(macroSource(macros[0])).toBe('@nota(`Texto`)')

    const header = '<!--\nauthor: X\n@saludo: Hola @0\n@firma: Equipo\n@caja\n<div>@0</div>\n@end\n-->'
    expect(extractHeaderMacros(header)).toEqual([
      { name: 'saludo', takesParam: true },
      { name: 'firma', takesParam: false },
      { name: 'caja', takesParam: true },
    ])
  })
})

describe('tarjetas editables', () => {
  const DOC = '# Título\n\nTexto previo.\n\n[(X)] a\n[( )] b\n\nTexto final.\n'

  it('aplica la fuente editada literal y deja intacto el resto', async () => {
    const ed = await open(DOC)
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    const card = cardViewAt(view, liaBlocks(ed)[0].pos)!
    card.startEdit()
    expect(card.editing).toBe(true)
    expect(card.dom.querySelector('textarea')?.value).toBe('[(X)] a\n[( )] b')

    card.apply('[( )] a\n[(X)] b\n[( )] c')
    expect(ed.getMarkdown()).toBe('# Título\n\nTexto previo.\n\n[( )] a\n[(X)] b\n[( )] c\n\nTexto final.\n')
  })

  it('cancelar no cambia nada', async () => {
    const ed = await open(DOC)
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    const card = cardViewAt(view, liaBlocks(ed)[0].pos)!
    card.startEdit()
    card.dom.querySelector('textarea')!.value = 'otra cosa'
    card.cancel()
    expect(card.editing).toBe(false)
    expect(ed.getMarkdown()).toBe(DOC)
  })

  it('si ya no hay sintaxis LiaScript, se convierte en prosa editable', async () => {
    const ed = await open(DOC)
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    cardViewAt(view, liaBlocks(ed)[0].pos)!.apply('Ahora es un párrafo con **negrita**.')
    expect(liaBlocks(ed)).toEqual([])
    expect(ed.getMarkdown()).toBe('# Título\n\nTexto previo.\n\nAhora es un párrafo con **negrita**.\n\nTexto final.\n')
  })

  it('con el texto vacío borra el bloque', async () => {
    const ed = await open(DOC)
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    cardViewAt(view, liaBlocks(ed)[0].pos)!.apply('   ')
    expect(ed.getMarkdown()).toBe('# Título\n\nTexto previo.\n\nTexto final.\n')
  })

  it('no ofrece edición en solo lectura', async () => {
    const ed = await open(DOC)
    ed.crepe.setReadonly(true)
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    const card = cardViewAt(view, liaBlocks(ed)[0].pos)!
    card.startEdit()
    expect(card.editing).toBe(false)
  })
})

describe('inserción desde el menú «/»', () => {
  it('sustituye el párrafo vacío por la tarjeta y la abre en edición', async () => {
    const ed = await open('# Título\n\nTexto.\n')
    const ctx = ed.crepe.editor.ctx
    const view = ctx.get(editorViewCtx)
    // Párrafo vacío al final con el cursor dentro (como tras escribir «/»).
    const end = view.state.doc.content.size
    const tr = view.state.tr.insert(end, view.state.schema.nodes.paragraph.create())
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, end + 1)))

    const quiz = LIA_TEMPLATES.find((t) => t.key === 'quiz-single')!
    insertLiaSource(ctx, quiz.source)

    const blocks = liaBlocks(ed)
    expect(blocks.map((b) => b.value)).toEqual([quiz.source])
    expect(cardViewAt(view, blocks[0].pos)?.editing).toBe(true)
    expect(ed.getMarkdown()).toBe(`# Título\n\nTexto.\n\n${quiz.source}\n`)
  })
})
