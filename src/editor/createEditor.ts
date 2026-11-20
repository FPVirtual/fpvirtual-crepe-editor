// Fábrica del editor: Crepe recortado a lo compatible con LiaScript + nodos
// LiaScript + serialización que preserva la fuente.
//
// La misma fábrica la usan la app y la suite de round-trip, para que lo que
// se mide sea exactamente lo que se despliega.

import { Crepe } from '@milkdown/crepe'
import type { Root } from 'mdast'
import { editorViewCtx, parserCtx, remarkCtx, serializerCtx } from '@milkdown/kit/core'
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state'

import {
  extractHeaderMacros,
  joinDocument,
  liascript,
  SourcePreserver,
  splitDocument,
  type BlockSlice,
  type SplitDocument,
} from '../liascript'
import { crepeFeatureConfigs } from './crepeConfig'
import { extractOutline, type OutlineItem } from './outline'

export interface LiaEditor {
  crepe: Crepe
  doc: SplitDocument
  preserver: SourcePreserver
  /** Markdown completo a guardar (cabecera + cuerpo, preservando la fuente). */
  getMarkdown: () => string
  /** Markdown del cuerpo tal como lo serializa Milkdown (sin preservación). */
  getCanonicalBody: () => string
  /** Índice de contenidos (títulos que abren sección en LiaScript). */
  getOutline: () => OutlineItem[]
  /** Elemento DOM del nodo en `pos` (para medir o desplazar). */
  elementAt: (pos: number) => HTMLElement | null
  /** Lleva el cursor al título en `pos` y lo desplaza a la vista. */
  revealPosition: (pos: number) => void
  destroy: () => Promise<void>
}

export interface LiaEditorOptions {
  /** Se llama cuando cambia el documento (sin serializar: es barato). */
  onChange?: () => void
}

export async function createLiaEditor(
  root: HTMLElement,
  markdown: string,
  options: LiaEditorOptions = {},
): Promise<LiaEditor> {
  const doc = splitDocument(markdown)
  const readonly = doc.lms?.readonly ?? false
  const crepe = new Crepe({
    root,
    defaultValue: doc.body,
    features: {
      [Crepe.Feature.AI]: false,
      [Crepe.Feature.TopBar]: false,
    },
    // Textos en español, resaltado con tokens y grupo LiaScript en el menú «/»
    // (con las macros que define la cabecera del material).
    featureConfigs: crepeFeatureConfigs(extractHeaderMacros(doc.header)),
  })
  crepe.editor.use(liascript)
  if (options.onChange) {
    const onChange = options.onChange
    crepe.on((listener) => {
      listener.updated((_ctx, doc, prevDoc) => {
        // prevDoc es null en la carga inicial: eso no es un cambio del usuario.
        if (prevDoc && !doc.eq(prevDoc)) onChange()
      })
    })
  }
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

  const elementAt = (pos: number): HTMLElement | null => {
    const dom = ctx.get(editorViewCtx).nodeDOM(pos)
    return dom instanceof HTMLElement ? dom : null
  }

  return {
    crepe,
    doc,
    preserver,
    getMarkdown: () => joinDocument(doc, preserver.restore(currentBlocks())),
    getCanonicalBody: () => crepe.getMarkdown(),
    getOutline: () => extractOutline(ctx.get(editorViewCtx).state.doc),
    elementAt,
    revealPosition: (pos) => {
      const view = ctx.get(editorViewCtx)
      const node = view.state.doc.nodeAt(pos)
      if (!node) return
      // Cursor al final del título (o tarjeta seleccionada si es un bloque atómico).
      const selection = node.isTextblock
        ? TextSelection.create(view.state.doc, pos + node.nodeSize - 1)
        : NodeSelection.create(view.state.doc, pos)
      view.dispatch(view.state.tr.setSelection(selection))
      view.focus()
      // Desplazamiento inmediato: el suave lo interrumpe el foco del editor.
      elementAt(pos)?.scrollIntoView?.({ block: 'start' })
    },
    destroy: async () => {
      await crepe.destroy()
    },
  }
}
