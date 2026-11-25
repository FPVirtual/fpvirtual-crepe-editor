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
import { crepeFeatureConfigs, type ImageHooks } from './crepeConfig'
import { liaImageBlockSchema } from './imageBlock'
import { imageUploader, uploadWidget } from './imagePaste'
import { imageWidthPlugin } from './imageWidth'
import { uploadConfig } from '@milkdown/kit/plugin/upload'
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
  /**
   * Inserta Markdown (p. ej. un ejemplo LiaScript) tras el bloque del cursor,
   * o en su lugar si es un párrafo vacío. Devuelve false en solo lectura.
   */
  insertMarkdown: (markdown: string) => boolean
  destroy: () => Promise<void>
}

export interface LiaEditorOptions {
  /** Se llama cuando cambia el documento (sin serializar: es barato). */
  onChange?: () => void
  /** Imágenes relativas del material (docs/imagenes). */
  images?: ImageHooks
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
    featureConfigs: crepeFeatureConfigs(extractHeaderMacros(doc.header), options.images),
  })
  crepe.editor.use(liascript)
  // Bloque de imagen que conserva el texto alternativo (Crepe lo usa para la proporción).
  crepe.editor.use(liaImageBlockSchema)
  // Ancho de las imágenes: decoración y barra al seleccionarlas.
  crepe.editor.use(imageWidthPlugin)
  // Pegar y arrastrar imágenes: una a una, sin dejar el marcador colgado.
  crepe.editor.config((ctx) => {
    ctx.update(uploadConfig.key, (prev) => ({
      ...prev,
      uploader: imageUploader(options.images?.upload, options.images?.beginUpload),
      uploadWidgetFactory: uploadWidget,
    }))
  })
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
    insertMarkdown: (markdown) => {
      const view = ctx.get(editorViewCtx)
      if (!view.editable) return false
      const { state } = view
      const { selection } = state
      const content = parser(markdown).content
      // Bloque de nivel superior que contiene el cursor (o el nodo seleccionado).
      const $from = selection.$from
      const topStart = $from.depth >= 1 ? $from.before(1) : selection.from
      const topEnd = $from.depth >= 1 ? $from.after(1) : selection.to
      const top = state.doc.nodeAt(topStart)
      const replace = top?.type.name === 'paragraph' && top.content.size === 0
      const at = replace ? topStart : topEnd
      const tr = replace ? state.tr.replaceWith(topStart, topEnd, content) : state.tr.insert(topEnd, content)
      const after = Math.min(at + content.size, tr.doc.content.size)
      tr.setSelection(TextSelection.near(tr.doc.resolve(after), -1))
      view.dispatch(tr)
      view.focus()
      elementAt(at)?.scrollIntoView?.({ block: 'center' })
      return true
    },
    destroy: async () => {
      await crepe.destroy()
    },
  }
}
