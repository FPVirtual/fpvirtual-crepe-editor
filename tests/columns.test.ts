// Columnas e imágenes con ancho: se editan en visual (no como bloques HTML
// protegidos) y se escriben en el formato que LiaScript pinta (columns.ts).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { editorViewCtx } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import { NodeSelection } from '@milkdown/kit/prose/state'
import { afterEach, describe, expect, it } from 'vitest'

import { createLiaEditor, type LiaEditor } from '../src/editor/createEditor'
import { COLUMN_OPEN, COLUMNS_OPEN, LIA_BLOCK, LIA_COLUMNS } from '../src/liascript'

const FIXTURE = readFileSync(join(__dirname, '..', 'fixtures', 'casos', 'columnas.md'), 'utf8')

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

function nodes(ed: LiaEditor, name: string): Node[] {
  const out: Node[] = []
  ed.crepe.editor.ctx.get(editorViewCtx).state.doc.descendants((node) => {
    if (node.type.name === name) out.push(node)
  })
  return out
}

describe('columnas', () => {
  it('se leen como columnas editables, sin tarjetas HTML', async () => {
    const ed = await open(FIXTURE)
    const groups = nodes(ed, LIA_COLUMNS)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.childCount)).toEqual([2, 2])
    // Lo único protegido es el quiz de dentro de una columna.
    const cards = nodes(ed, LIA_BLOCK)
    expect(cards.map((c) => c.attrs.kind)).toEqual(['quiz'])
    expect(groups[1].child(1).textContent).toContain('¿Cuál es la capital?')
  })

  it('imágenes: ancho como atributo del bloque; sin ancho, null', async () => {
    const ed = await open(FIXTURE)
    const widths = nodes(ed, 'image-block').map((n) => [n.attrs.caption, n.attrs.width])
    expect(widths).toEqual([
      ['Esquema del patrón', null],
      ['Imagen A', 80],
      ['Imagen B', null],
      ['Ancho 40', 40],
    ])
  })

  it('la serialización canónica escribe el mismo formato', async () => {
    const ed = await open(FIXTURE)
    const canonical = ed.getCanonicalBody()
    expect(canonical).toContain(`${COLUMNS_OPEN}\n${COLUMN_OPEN}\n\nTexto de la **izquierda**`)
    expect(canonical).toContain(`\n\n</div>\n${COLUMN_OPEN}\n\n![Esquema del patrón](img/esquema.png)\n\n</div>\n</div>`)
    expect(canonical).toContain('![Imagen A](img/a.png)<!-- style="width: 80%;" -->')
    expect(canonical).toContain('![Ancho 40](img/c.png)<!-- style="width: 40%;" -->')
    expect(canonical).toContain('[(X)] París')
  })

  it('insertar unas columnas de dos imágenes vacías y editarlas', async () => {
    const ed = await open('# T\n\nHola.\n')
    const md = `${COLUMNS_OPEN}\n${COLUMN_OPEN}\n\n![]()\n\n</div>\n${COLUMN_OPEN}\n\n![]()\n\n</div>\n</div>`
    expect(ed.insertMarkdown(md)).toBe(true)
    expect(nodes(ed, LIA_COLUMNS)).toHaveLength(1)
    expect(nodes(ed, 'image-block')).toHaveLength(2)
    expect(nodes(ed, LIA_BLOCK)).toHaveLength(0)
    expect(ed.getMarkdown()).toContain(`</div>\n${COLUMN_OPEN}\n\n![]()\n\n</div>\n</div>`)
  })

  it('una estructura incompleta se queda como HTML protegido', async () => {
    const ed = await open(`# T\n\n${COLUMNS_OPEN}\n${COLUMN_OPEN}\n\nSin cerrar.\n`)
    expect(nodes(ed, LIA_COLUMNS)).toHaveLength(0)
    expect(nodes(ed, LIA_BLOCK).length).toBeGreaterThan(0)
    expect(ed.getMarkdown()).toContain('Sin cerrar.')
  })
})

describe('borrar una imagen sola en su párrafo', () => {
  // Regresión: Crepe creaba el bloque de imagen sin posición y el preservador
  // de la fuente la recuperaba del hueco original al guardar.
  it.each([
    ['sin ancho', ''],
    ['con otra imagen con ancho detrás', '\n![Con ancho](img/ancho.png)<!-- style="width: 40%;" -->\n'],
  ])('%s: el Markdown deja de tenerla', async (_name, extra) => {
    const ed = await open(`# T\n\nUno.\n\n![Esquema del patrón](img/esquema.png)\n\nDos.\n${extra}`)
    const view = ed.crepe.editor.ctx.get(editorViewCtx)
    let pos = -1
    view.state.doc.forEach((n, p) => {
      if (n.type.name === 'image-block' && n.attrs.caption === 'Esquema del patrón') pos = p
    })
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)))
    view.dispatch(view.state.tr.deleteSelection())
    const md = ed.getMarkdown()
    expect(md).not.toContain('esquema.png')
    expect(md).toContain('Uno.\n\nDos.')
    if (extra) expect(md).toContain('<!-- style="width: 40%;" -->')
  })
})
