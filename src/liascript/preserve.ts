// Serialización que preserva la fuente (requisito de idempotencia, §6).
//
// remark-stringify normaliza la prosa (viñetas, énfasis, tablas, escapes):
// re-serializar un documento sin cambios ensuciaría Git con diffs
// cosméticos. Para evitarlo:
//
// 1. Al cargar, cada bloque de nivel superior del original se asocia a su
//    forma canónica (lo que el editor emite para ese bloque aislado).
// 2. Al guardar, cada nodo de nivel superior del documento se serializa por
//    separado; si su forma canónica coincide con la de un bloque original
//    (emparejamiento monótono), se emite el texto ORIGINAL de ese bloque, con
//    su separación original si el anterior también lo era.
//
// Solo los bloques editados (o nuevos) se escriben en forma canónica.

export interface BlockSlice {
  text: string
  start: number
  end: number
}

interface OriginalBlock extends BlockSlice {
  key: string
}

/** Clave de comparación: forma canónica sin saltos de línea finales. */
export const blockKey = (markdown: string): string => markdown.replace(/\n+$/, '')

/** Forma canónica de un bloque; si el editor no puede procesarlo aislado, una clave que nunca coincide. */
function safeKey(canonicalOf: (markdown: string) => string, text: string, index: number): string {
  try {
    return blockKey(canonicalOf(text))
  } catch {
    return `\u0000sin-forma-canonica-${index}`
  }
}

export class SourcePreserver {
  readonly #original: string
  readonly #blocks: OriginalBlock[]

  /**
   * @param original cuerpo Markdown original
   * @param blocks bloques de nivel superior del original (con posiciones)
   * @param canonicalOf forma canónica de un fragmento Markdown aislado
   */
  constructor(original: string, blocks: BlockSlice[], canonicalOf: (markdown: string) => string) {
    this.#original = original
    this.#blocks = blocks.map((b, i) => ({ ...b, key: safeKey(canonicalOf, b.text, i) }))
  }

  get blockCount(): number {
    return this.#blocks.length
  }

  /**
   * Markdown a guardar.
   *
   * @param current serialización canónica de cada nodo de nivel superior actual
   */
  restore(current: string[]): string {
    const blocks = this.#blocks
    const out: string[] = []
    let cursor = 0 // siguiente bloque original candidato
    let prev = -2 // índice original del bloque emitido anterior (-1 = ninguno)

    // Nodos vacíos (p. ej. el párrafo final que añade el plugin `trailing`) no cuentan.
    const nonEmpty = current.map(blockKey).filter((key) => key.trim() !== '')
    nonEmpty.forEach((key, k) => {
      let match = -1
      for (let j = cursor; j < blocks.length; j++) {
        if (blocks[j].key === key) {
          match = j
          break
        }
      }
      if (k === 0) {
        out.push(match === 0 ? this.#original.slice(0, blocks[0].start) : '')
      } else {
        out.push(match !== -1 && match === prev + 1 ? this.#gapBefore(match) : '\n\n')
      }
      if (match !== -1) {
        out.push(blocks[match].text)
        cursor = match + 1
        prev = match
      } else {
        out.push(key)
        prev = -2
      }
    })

    const last = blocks.at(-1)
    out.push(last && prev === blocks.length - 1 ? this.#original.slice(last.end) : '\n')
    return out.join('')
  }

  #gapBefore(index: number): string {
    return this.#original.slice(this.#blocks[index - 1].end, this.#blocks[index].start)
  }
}
