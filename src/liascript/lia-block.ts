// Nodo atómico `lia_block`: bloque LiaScript protegido con su fuente literal.
//
// - Un transformer remark sustituye cada bloque de nivel superior que el
//   clasificador marca como LiaScript por un nodo mdast `liaBlock` cuyo valor
//   es el **recorte literal del Markdown original** (por posiciones), no una
//   re-serialización: así nada se normaliza ni se escapa.
// - En ProseMirror es un nodo de bloque atómico que se pinta como tarjeta:
//   resumen para quizzes (R4) o la fuente para el resto. Su fuente se edita
//   como texto desde la propia tarjeta (node view en card-view.ts).
// - Al serializar se emite como nodo `html` de mdast, que remark-stringify
//   escribe tal cual.

import { InitReady, remarkPluginsCtx } from '@milkdown/kit/core'
import type { RemarkPlugin } from '@milkdown/kit/transformer'
import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import { $node } from '@milkdown/kit/utils'
import type { Root, RootContent } from 'mdast'

import { t } from '../i18n'
import { classifyBlock, type LiaKind } from './classify'
import { groupColumns, imageWithWidth, type ColumnsMdast } from './columns'
import { parseBox, renderInline } from './box'
import { summarizeQuiz } from './quiz'

export const LIA_BLOCK = 'lia_block'

interface LiaBlockMdast {
  type: 'liaBlock'
  value: string
  kind: LiaKind
}

interface Item {
  node: RootContent
  start: number
  end: number
  startLine: number
  endLine: number
  kind: LiaKind | null
  starRule: boolean
}

const STAR_RULE = /^[ \t]*\*{3,}[ \t]*$/

/**
 * Transformer remark: protege los bloques LiaScript de nivel superior.
 *
 * Agrupa antes de proteger, porque LiaScript asocia elementos por
 * adyacencia y el serializador los separaría con una línea en blanco:
 * - bloques contiguos sin línea en blanco entre ellos (`--{{1}}--` + texto,
 *   código + `<script>@input</script>`, `<!-- data-… -->` + tabla) forman
 *   un grupo, protegido entero si alguno de sus miembros es LiaScript;
 * - un efecto o quiz seguido de un bloque delimitado por líneas `****`
 *   (bloque animado, solución de quiz) absorbe ese bloque completo.
 */
export function remarkLiaBlocks() {
  return (tree: Root, file: { value?: unknown }) => {
    const source = typeof file?.value === 'string' ? file.value : null
    if (!source) return // p. ej. ejecuciones sin fuente: nada que recortar
    // Maquetación del editor (columns.ts) antes de proteger: columnas e
    // imágenes con ancho se editan en visual, no como bloques HTML.
    tree.children = protect(groupColumns(tree.children.map((n) => imageWithWidth(n) ?? n)), source)
  }
}

/** Protege los bloques LiaScript de una lista (nivel superior o una columna). */
function protect(children: RootContent[], source: string): RootContent[] {
  for (const node of children) {
    if ((node.type as string) !== 'liaColumns') continue
    for (const column of (node as unknown as ColumnsMdast).children) {
      column.children = protect(column.children.map((n) => imageWithWidth(n) ?? n), source)
    }
  }
  {
    const items: Item[] = []
    for (const node of children) {
      const pos = node.position
      if (pos?.start.offset === undefined || pos.end.offset === undefined) {
        // Sin posición no se puede recortar la fuente: se deja intacto y corta grupos.
        items.push({ node, start: -1, end: -1, startLine: -10, endLine: -10, kind: null, starRule: false })
        continue
      }
      const start = lineStart(source, pos.start.offset)
      const text = source.slice(start, pos.end.offset)
      items.push({
        node,
        start,
        end: pos.end.offset,
        startLine: pos.start.line,
        endLine: pos.end.line,
        // Columnas e imagen con ancho: maquetación editable, nunca protegida.
        kind:
          (node.type as string) === 'liaColumns' || (node.type as string) === 'image-block'
            ? null
            : classifyBlock(node as { type: string; meta?: string | null }, text),
        starRule: node.type === 'thematicBreak' && STAR_RULE.test(text),
      })
    }

    const groups: Item[][] = []
    for (let i = 0; i < items.length; i++) {
      const group = [items[i]]
      // Contigüidad: el siguiente bloque empieza en la línea inmediata.
      while (
        i + 1 < items.length &&
        group.at(-1)!.start !== -1 &&
        items[i + 1].start !== -1 &&
        items[i + 1].startLine === group.at(-1)!.endLine + 1
      ) {
        group.push(items[++i])
      }
      // Bloque `****` … `****` tras un efecto o quiz.
      const lia = group.find((it) => it.kind)
      if (lia && (lia.kind === 'effect' || lia.kind === 'quiz')) {
        const stars = group.filter((it) => it.starRule).length
        // Apertura dentro del grupo (`{{1}}` + `****` contiguos) o justo después.
        const openAt = stars % 2 === 1 ? i : items[i + 1]?.starRule ? i + 1 : -1
        const close = openAt === -1 ? -1 : items.findIndex((it, k) => k > openAt && it.starRule)
        if (close !== -1) {
          group.push(...items.slice(i + 1, close + 1))
          i = close
        }
      }
      groups.push(group)
    }

    return groups.flatMap((group) => {
      const kind = group.find((it) => it.kind)?.kind
      if (!kind) return group.map((it) => it.node)
      const first = group[0]
      const last = group.at(-1)!
      const lia: LiaBlockMdast & { position: unknown } = {
        type: 'liaBlock',
        value: source.slice(first.start, last.end),
        kind,
        position: { start: first.node.position!.start, end: last.node.position!.end },
      }
      return [lia as unknown as RootContent]
    })
  }
}

/** Incluye la indentación inicial de la línea (código indentado, listas). */
function lineStart(source: string, offset: number): number {
  let i = offset
  while (i > 0 && (source[i - 1] === ' ' || source[i - 1] === '\t')) i--
  return i
}

/**
 * Registra el transformer **el primero** de la cadena remark: debe ver el
 * árbol tal como sale del parser, antes de que los transformers de Milkdown
 * lo modifiquen (p. ej. resolver y eliminar definiciones de enlaces).
 */
export const remarkLiaPlugin: MilkdownPlugin = (ctx) => async () => {
  await ctx.wait(InitReady)
  const entry = { plugin: remarkLiaBlocks, options: {} } as unknown as RemarkPlugin
  ctx.update(remarkPluginsCtx, (plugins) => [entry, ...plugins])
  return () => {
    ctx.update(remarkPluginsCtx, (plugins) => plugins.filter((p) => p !== entry))
  }
}

export const liaBlockNode = $node(LIA_BLOCK, () => ({
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,
  attrs: {
    value: { default: '' },
    kind: { default: 'unknown' },
  },
  parseDOM: [
    {
      tag: 'div[data-lia-block]',
      getAttrs: (dom) => {
        const el = dom as HTMLElement
        return { value: el.dataset.value ?? '', kind: el.dataset.kind ?? 'unknown' }
      },
    },
  ],
  toDOM: (node) => renderCard(node.attrs.value as string, node.attrs.kind as LiaKind),
  parseMarkdown: {
    match: (node) => node.type === 'liaBlock',
    runner: (state, node, type) => {
      const lia = node as unknown as LiaBlockMdast
      state.addNode(type, { value: lia.value, kind: lia.kind })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === LIA_BLOCK,
    runner: (state, node) => {
      state.addNode('html', undefined, node.attrs.value as string)
    },
  },
}))

/** Tarjeta de un bloque protegido (sin runtime LiaScript, R4). */
function renderCard(value: string, kind: LiaKind): HTMLElement {
  return fillCard(document.createElement('div'), value, kind)
}

/**
 * Rellena (o repinta) una tarjeta. La primera hija es la cabecera
 * (`.lia-card__header`), donde el node view añade el botón «Editar».
 */
export function fillCard(card: HTMLElement, value: string, kind: LiaKind): HTMLElement {
  card.replaceChildren()
  card.className = `lia-card lia-card--${kind}`
  card.dataset.liaBlock = ''
  card.dataset.kind = kind
  card.dataset.value = value
  card.contentEditable = 'false'
  card.setAttribute('role', 'group')
  card.setAttribute('aria-label', t(`lia.kind.${kind}`))

  const header = document.createElement('div')
  header.className = 'lia-card__header'
  const label = document.createElement('span')
  label.className = 'lia-card__label'
  header.append(label)
  card.append(header)

  // Caja de aviso: como en la web publicada (contenedor hope con título).
  const box = kind === 'macro' ? parseBox(value) : null
  if (box) {
    const title = t(`lia.box.${box.name}`)
    card.classList.add('lia-card--box', 'hint-container', box.type)
    card.setAttribute('aria-label', t('lia.box.label', { title }))
    label.classList.add('hint-container-title')
    label.textContent = title
    const text = document.createElement('p')
    text.className = 'lia-card__box-text'
    text.append(...renderInline(box.text))
    card.append(text)
    return card
  }

  label.textContent = t(`lia.kind.${kind}`)
  const quiz = kind === 'quiz' ? summarizeQuiz(value) : null
  if (quiz && quiz.options.length > 0) {
    // Como el quiz de la web publicada: opciones con su marcador, sin interacción.
    const list = document.createElement('ul')
    list.className = `lia-card__quiz lia-card__quiz--${quiz.type}`
    for (const option of quiz.options) {
      const item = document.createElement('li')
      item.className = option.correct ? 'is-correct' : ''
      const marker = document.createElement('span')
      marker.className = 'lia-card__marker'
      marker.setAttribute('aria-hidden', 'true')
      const text = document.createElement('span')
      text.className = 'lia-card__option'
      if (option.text) text.append(...renderInline(option.text))
      else text.textContent = t('lia.quiz.noText')
      item.append(marker, text)
      if (option.correct && quiz.type !== 'text') {
        const correct = document.createElement('span')
        correct.className = 'lia-card__correct'
        correct.textContent = t('lia.quiz.correct')
        item.append(correct)
      }
      list.append(item)
    }
    card.append(list)
    if (quiz.hints > 0) {
      const hints = document.createElement('div')
      hints.className = 'lia-card__meta'
      hints.textContent = t('lia.quiz.hints', { n: quiz.hints })
      card.append(hints)
    }
  } else {
    const pre = document.createElement('pre')
    pre.className = 'lia-card__source'
    pre.textContent = value
    card.append(pre)
  }
  return card
}
