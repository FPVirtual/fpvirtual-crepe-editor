// Fábrica del editor: Crepe recortado a lo compatible con LiaScript + nodos
// LiaScript + serialización que preserva la fuente.
//
// La misma fábrica la usan la app y la suite de round-trip, para que lo que
// se mide sea exactamente lo que se despliega.

import { Crepe } from '@milkdown/crepe'
import type { Root } from 'mdast'
import { editorViewCtx, parserCtx, remarkCtx, serializerCtx } from '@milkdown/kit/core'

import {
  joinDocument,
  liascript,
  SourcePreserver,
  splitDocument,
  type BlockSlice,
  type SplitDocument,
} from '../liascript'

export interface LiaEditor {
  crepe: Crepe
  doc: SplitDocument
  preserver: SourcePreserver
  /** Markdown completo a guardar (cabecera + cuerpo, preservando la fuente). */
  getMarkdown: () => string
  /** Markdown del cuerpo tal como lo serializa Milkdown (sin preservación). */
  getCanonicalBody: () => string
  destroy: () => Promise<void>
}

export async function createLiaEditor(root: HTMLElement, markdown: string): Promise<LiaEditor> {
  const doc = splitDocument(markdown)
  const readonly = doc.lms?.readonly ?? false
  const crepe = new Crepe({
    root,
    defaultValue: doc.body,
    features: {
      [Crepe.Feature.AI]: false,
      [Crepe.Feature.TopBar]: false,
    },
  })
  crepe.editor.use(liascript)
  await crepe.create()
  crepe.setReadonly(readonly)

  const ctx = crepe.editor.ctx
  const parser = ctx.get(parserCtx)
  const serializer = ctx.get(serializerCtx)
  const remark = ctx.get(remarkCtx)

  // Bloques de nivel superior del original, a la granularidad del editor
  // (tras los transformers, incluida la agrupación de bloques LiaScript).
  const tree = remark.runSync(remark.parse(doc.body), doc.body) as Root
  const blocks: BlockSlice[] = tree.children.flatMap((node) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) return []
    let s = start
    while (s > 0 && (doc.body[s - 1] === ' ' || doc.body[s - 1] === '\t')) s--
    return [{ text: doc.body.slice(s, end), start: s, end }]
  })
  const preserver = new SourcePreserver(doc.body, blocks, (md) => serializer(parser(md)))

  /** Serialización canónica de cada nodo de nivel superior actual. */
  const currentBlocks = (): string[] => {
    const state = ctx.get(editorViewCtx).state
    const out: string[] = []
    state.doc.forEach((node) => {
      out.push(serializer(state.schema.topNodeType.create(null, node)))
    })
    return out
  }

  return {
    crepe,
    doc,
    preserver,
    getMarkdown: () => joinDocument(doc, preserver.restore(currentBlocks())),
    getCanonicalBody: () => crepe.getMarkdown(),
    destroy: async () => {
      await crepe.destroy()
    },
  }
}
