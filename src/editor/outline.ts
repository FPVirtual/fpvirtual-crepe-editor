// Índice de contenidos del documento en edición.
//
// En LiaScript cada título ATX (`# …`) abre una sección o diapositiva, así
// que el índice refleja la estructura del curso:
// - títulos normales del editor (nodos `heading`);
// - títulos protegidos como tarjeta porque llevan sintaxis LiaScript
//   (`## Sección <!-- style="…" -->`, `## H~2~O`): siguen abriendo sección.
// Los títulos setext (subrayados) NO abren sección en LiaScript y se omiten.

import type { Node } from '@milkdown/kit/prose/model'

import { LIA_BLOCK } from '../liascript'

export interface OutlineItem {
  level: number
  text: string
  /** Posición del nodo en el documento ProseMirror. */
  pos: number
}

const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/
/** Tarjetas cuya primera línea puede ser un título (no código ni HTML). */
const HEADING_KINDS = new Set(['inline', 'unknown', 'effect', 'macro'])

/** Texto visible de un título escrito en LiaScript: sin comentarios ni marcas inline. */
export function cleanHeadingText(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{\d+(?:-\d+)?\}\}/g, '')
    .replace(/(\*\*|__|~~|[*_~^`])/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractOutline(doc: Node): OutlineItem[] {
  const items: OutlineItem[] = []
  doc.forEach((node, pos) => {
    if (node.type.name === 'heading') {
      items.push({ level: node.attrs.level as number, text: node.textContent.trim(), pos })
    } else if (node.type.name === LIA_BLOCK && HEADING_KINDS.has(node.attrs.kind as string)) {
      const first = (node.attrs.value as string).split('\n', 1)[0]
      const match = ATX.exec(first)
      if (match) items.push({ level: match[1].length, text: cleanHeadingText(match[2]), pos })
    }
  })
  return items
}
