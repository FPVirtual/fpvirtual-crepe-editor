// Columnas e imágenes con ancho (maquetación que LiaScript sí pinta).
//
// LiaScript no tiene clases de columnas, pero aplica el estilo de un <div> al
// Markdown que contiene (con líneas en blanco) y el de un comentario tras una
// imagen. El editor escribe siempre este formato, comprobado con liaex:
//
//   <div class="lia-columnas" style="display: flex; flex-wrap: wrap; gap: 1.5em;">
//   <div class="lia-columna" style="flex: 1 1 14em; min-width: 0;">
//
//   (bloques Markdown de la primera columna)
//
//   </div>
//   <div class="lia-columna" style="flex: 1 1 14em; min-width: 0;">
//
//   (bloques de la segunda)
//
//   </div>
//   </div>
//
//   ![texto alternativo](img/x.png)<!-- style="width: 40%;" -->
//
// En el editor: nodos `lia_columns` > `lia_column` (bloques editables) y el
// atributo `width` del bloque de imagen. Si las marcas no forman una
// estructura completa, no se toca nada: quedan como bloques HTML protegidos.

import type { RootContent } from 'mdast'

export const COLUMNS_OPEN = '<div class="lia-columnas" style="display: flex; flex-wrap: wrap; gap: 1.5em;">'
export const COLUMN_OPEN = '<div class="lia-columna" style="flex: 1 1 14em; min-width: 0;">'
export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 3

/** Ancho mínimo y máximo de una imagen (% del ancho del texto: 100 % = ancho imprimible del PDF). */
export const MIN_WIDTH = 10
export const MAX_WIDTH = 100

type Tag = 'columns' | 'column' | 'close'

const TAG = /<div\b[^>]*\bclass\s*=\s*"(lia-columnas|lia-columna)"[^>]*>|<\/div\s*>/gy

/** Etiquetas de un nodo HTML hecho SOLO de marcas de columnas (si no, null). */
function markers(value: string): Tag[] | null {
  const tags: Tag[] = []
  const text = value.trim()
  let pos = 0
  while (pos < text.length) {
    const ws = /\s*/y
    ws.lastIndex = pos
    ws.exec(text)
    pos = ws.lastIndex
    if (pos >= text.length) break
    TAG.lastIndex = pos
    const m = TAG.exec(text)
    if (!m) return null
    tags.push(m[1] === 'lia-columnas' ? 'columns' : m[1] === 'lia-columna' ? 'column' : 'close')
    pos = TAG.lastIndex
  }
  return tags.length ? tags : null
}

export interface ColumnsMdast {
  type: 'liaColumns'
  children: ColumnMdast[]
  position?: unknown
}

export interface ColumnMdast {
  type: 'liaColumn'
  children: RootContent[]
}

/**
 * Agrupa las secuencias `<div lia-columnas>` … `</div>` de una lista de
 * bloques en nodos `liaColumns`. Las estructuras incompletas se dejan igual.
 */
export function groupColumns(children: RootContent[]): RootContent[] {
  const out: RootContent[] = []
  let i = 0
  while (i < children.length) {
    const grouped = tryGroup(children, i)
    if (grouped) {
      out.push(grouped.node as unknown as RootContent)
      i = grouped.next
    } else {
      out.push(children[i++])
    }
  }
  return out
}

function tryGroup(children: RootContent[], start: number): { node: ColumnsMdast; next: number } | null {
  const first = children[start]
  const firstTags = first.type === 'html' ? markers(first.value) : null
  if (!firstTags || firstTags[0] !== 'columns') return null

  const columns: ColumnMdast[] = []
  let current: ColumnMdast | null = null
  let depth = 0 // 0 fuera; 1 dentro del grupo; 2 dentro de una columna
  for (let i = start; i < children.length; i++) {
    const node = children[i]
    const tags = node.type === 'html' ? markers(node.value) : null
    if (!tags) {
      if (depth !== 2 || !current) return null // contenido fuera de una columna
      current.children.push(node)
      continue
    }
    for (let k = 0; k < tags.length; k++) {
      const tag = tags[k]
      if (tag === 'columns') {
        if (depth !== 0) return null
        depth = 1
      } else if (tag === 'column') {
        if (depth !== 1) return null
        current = { type: 'liaColumn', children: [] }
        columns.push(current)
        depth = 2
      } else if (depth === 2) {
        depth = 1
        current = null
      } else if (depth === 1) {
        if (columns.length < MIN_COLUMNS || columns.length > MAX_COLUMNS) return null
        if (k !== tags.length - 1) return null // nada detrás del cierre del grupo
        const last = children[i]
        return {
          node: {
            type: 'liaColumns',
            children: columns,
            position: { start: first.position?.start, end: last.position?.end },
          },
          next: i + 1,
        }
      } else {
        return null
      }
    }
  }
  return null // sin cierre
}

const WIDTH_COMMENT = /^<!--\s*style\s*=\s*"\s*width\s*:\s*(\d{1,3})\s*%\s*;?\s*"\s*-->$/

/**
 * Párrafo con solo una imagen (y, opcionalmente, su comentario de ancho
 * `<!-- style="width: N%" -->`) → bloque de imagen.
 *
 * Crepe hace la misma conversión, pero crea el nodo SIN posición: el
 * preservador de la fuente no lo veía como bloque y, al borrar la imagen, la
 * recuperaba del hueco original entre sus vecinos (nunca se borraba). Aquí se
 * conserva la posición del párrafo.
 */
export function imageWithWidth(node: RootContent): RootContent | null {
  if (node.type !== 'paragraph' || node.children.length === 0 || node.children.length > 2) return null
  const [image, html] = node.children
  if (image.type !== 'image') return null
  let width: number | undefined
  if (html) {
    if (html.type !== 'html') return null
    const m = WIDTH_COMMENT.exec(html.value.trim())
    if (!m) return null
    width = Number(m[1])
    if (width < MIN_WIDTH || width > MAX_WIDTH) return null
  }
  return {
    type: 'image-block',
    url: image.url,
    alt: image.alt,
    title: image.title,
    ...(width === undefined ? {} : { liaWidth: width }),
    position: node.position,
  } as unknown as RootContent
}

/** Comentario LiaScript con el ancho de una imagen. */
export const widthComment = (width: number): string => `<!-- style="width: ${width}%;" -->`
