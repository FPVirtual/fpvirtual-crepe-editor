// Cajas de aviso LiaScript (`@nota(…)`, `@aviso(…)`…) para la vista visual.
//
// En el Markdown son una macro en una línea; el engine las publica como
// contenedores de aviso al estilo vuepress-theme-hope (lector LiaScript de
// Pandoc, `web.lua`). Aquí se reconocen igual para que la tarjeta se vea
// como en la web publicada. No cambia el Markdown: la tarjeta sigue
// guardando el texto original.

/** Caja → tipo de contenedor hope (mismo mapeo que web.lua del engine). */
export const BOX_TYPES = {
  nota: 'info',
  consejo: 'tip',
  aviso: 'warning',
  importante: 'important',
  error: 'caution',
} as const

export type BoxName = keyof typeof BOX_TYPES

export interface Box {
  name: BoxName
  type: (typeof BOX_TYPES)[BoxName]
  /** Texto de la caja (Markdown en línea), sin comillas invertidas. */
  text: string
}

const BOX_LINE = /^@(nota|consejo|aviso|importante|error)\(([\s\S]*)\)$/

/** La caja de un bloque que es solo `@caja(…)`, o null. */
export function parseBox(source: string): Box | null {
  const m = BOX_LINE.exec(source.trim())
  if (!m) return null
  let text = m[2].trim()
  if (/^`[^`]*`$/.test(text)) text = text.slice(1, -1)
  else if (text.includes('`') || /\)\s*\S/.test(text)) return null // varios parámetros o macros dentro: tarjeta normal
  const name = m[1] as BoxName
  return { name, type: BOX_TYPES[name], text: text.trim() }
}

/**
 * Markdown en línea → nodos DOM (sin innerHTML): **negrita**, *cursiva* /
 * _cursiva_, `código` y escapes con barra invertida. Lo demás, como texto.
 */
export function renderInline(text: string): Node[] {
  const nodes: Node[] = []
  let buffer = ''
  const flush = () => {
    if (buffer) nodes.push(document.createTextNode(buffer))
    buffer = ''
  }
  const wrap = (tag: string, inner: string) => {
    flush()
    const el = document.createElement(tag)
    if (tag === 'code') el.textContent = inner
    else el.append(...renderInline(inner))
    nodes.push(el)
  }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    if (rest[0] === '\\' && rest.length > 1) {
      buffer += rest[1]
      i += 2
      continue
    }
    const code = /^`([^`]+)`/.exec(rest)
    const strong = /^(\*\*|__)(?=\S)([\s\S]*?\S)\1/.exec(rest)
    const em = /^([*_])(?=\S)([\s\S]*?\S)\1/.exec(rest)
    if (code) {
      wrap('code', code[1])
      i += code[0].length
    } else if (strong) {
      wrap('strong', strong[2])
      i += strong[0].length
    } else if (em) {
      wrap('em', em[2])
      i += em[0].length
    } else {
      buffer += rest[0]
      i++
    }
  }
  flush()
  return nodes
}
