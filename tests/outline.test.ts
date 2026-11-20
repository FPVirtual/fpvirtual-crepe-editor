// Índice de contenidos: qué títulos entran (los que abren sección en
// LiaScript), actualización al editar y navegación.

import { editorViewCtx } from '@milkdown/kit/core'
import { NodeSelection } from '@milkdown/kit/prose/state'
import { afterEach, describe, expect, it } from 'vitest'

import { createLiaEditor, type LiaEditor } from '../src/editor/createEditor'
import { cleanHeadingText } from '../src/editor/outline'

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

const outline = (ed: LiaEditor) => ed.getOutline().map(({ level, text }) => [level, text])

const DOC = `# Unidad 3

Intro.

## Primera sección

Texto.

### Subsección **importante**

## Sección con estilo <!-- style="color: red" -->

Párrafo con subíndice H~2~O.

Setext (no abre sección en LiaScript)
-------------------------------------

\`\`\`python
# un comentario no es un título
print(1)
\`\`\`
`

describe('índice de contenidos', () => {
  it('incluye los títulos ATX (también los protegidos) y omite setext y código', async () => {
    const ed = await open(DOC)
    expect(outline(ed)).toEqual([
      [1, 'Unidad 3'],
      [2, 'Primera sección'],
      [3, 'Subsección importante'],
      [2, 'Sección con estilo'],
    ])
  })

  it('se actualiza al editar el documento', async () => {
    const ed = await open('# Uno\n\nTexto.\n')
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    const { schema } = view.state
    const h2 = schema.nodes.heading.create({ level: 2 }, schema.text('Dos'))
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, h2))
    expect(outline(ed)).toEqual([
      [1, 'Uno'],
      [2, 'Dos'],
    ])
  })

  it('ir a un título pone el cursor en él; a una tarjeta, la selecciona', async () => {
    const ed = await open('# Uno\n\nTexto.\n\n## Dos <!-- style="x" -->\n\n## Tres\n')
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    const [, dos, tres] = ed.getOutline()

    ed.revealPosition(tres.pos)
    expect(view.state.selection.$from.parent.textContent).toBe('Tres')

    ed.revealPosition(dos.pos)
    expect(view.state.selection).toBeInstanceOf(NodeSelection)
    expect((view.state.selection as NodeSelection).node.attrs.value).toBe('## Dos <!-- style="x" -->')
  })

  it('limpia el texto de los títulos escritos en LiaScript', () => {
    expect(cleanHeadingText('Sección <!-- data-x="1" --> final')).toBe('Sección final')
    expect(cleanHeadingText('**Negrita** y [enlace](http://x)')).toBe('Negrita y enlace')
    expect(cleanHeadingText('H~2~O y E=mc^2^')).toBe('H2O y E=mc2')
  })
})
