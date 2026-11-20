// Tarjeta LiaScript editable (node view de `lia_block`).
//
// En reposo muestra el resumen del bloque (quiz) o su fuente, con un botón
// «Editar». En edición muestra un área de texto con la fuente literal:
// Ctrl+Intro (o «Aplicar») vuelve a parsear el texto y sustituye la tarjeta
// por lo que resulte —otra tarjeta reclasificada, varias, o prosa normal si
// ya no hay sintaxis LiaScript—; Esc (o «Cancelar») descarta.
//
// Al reparsear, el transformer remark recorta la fuente literal del texto
// escrito, así que lo que el docente teclea llega a Git tal cual.

import { parserCtx } from '@milkdown/kit/core'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'

import { t } from '../i18n'
import type { LiaKind } from './classify'
import { fillCard, liaBlockNode } from './lia-block'

const views = new WeakMap<Element, LiaCardView>()

/** Node view de la tarjeta en `pos` (si existe). */
export function cardViewAt(view: EditorView, pos: number): LiaCardView | undefined {
  const dom = view.nodeDOM(pos)
  return dom instanceof Element ? views.get(dom) : undefined
}

export class LiaCardView implements NodeView {
  readonly dom: HTMLElement
  #node: Node
  #textarea: HTMLTextAreaElement | null = null

  constructor(
    node: Node,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly parse: (markdown: string) => Node,
  ) {
    this.#node = node
    this.dom = document.createElement('div')
    views.set(this.dom, this)
    this.dom.addEventListener('dblclick', (event) => {
      if (!this.editing && this.view.editable) {
        event.preventDefault()
        this.startEdit()
      }
    })
    this.#render()
  }

  get editing(): boolean {
    return this.#textarea !== null
  }

  get value(): string {
    return this.#node.attrs.value as string
  }

  update(node: Node): boolean {
    if (node.type !== this.#node.type) return false
    this.#node = node
    if (!this.editing) this.#render()
    return true
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode')
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  /** ProseMirror no debe procesar lo que ocurre en el área de edición ni en los botones. */
  stopEvent(event: Event): boolean {
    if (this.editing) return true
    const target = event.target as Element | null
    return Boolean(target?.closest?.('.lia-card__edit'))
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    views.delete(this.dom)
  }

  startEdit(): void {
    if (this.editing || !this.view.editable) return
    const kind = this.#node.attrs.kind as LiaKind
    this.dom.replaceChildren()
    this.dom.classList.add('lia-card--editing')

    const label = document.createElement('div')
    label.className = 'lia-card__label'
    label.textContent = t('lia.edit.title', { kind: t(`lia.kind.${kind}`) })

    const textarea = document.createElement('textarea')
    textarea.className = 'lia-card__textarea'
    textarea.value = this.value
    textarea.spellcheck = false
    textarea.rows = Math.min(24, Math.max(3, this.value.split('\n').length + 1))
    textarea.setAttribute('aria-label', t('lia.edit.source'))
    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        this.cancel()
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        this.apply()
      }
    })

    const hint = document.createElement('div')
    hint.className = 'lia-card__meta'
    hint.textContent = t('lia.edit.hint')

    const actions = document.createElement('div')
    actions.className = 'lia-card__actions'
    actions.append(
      button(t('lia.edit.apply'), 'btn btn--primary', () => this.apply()),
      button(t('lia.edit.cancel'), 'btn', () => this.cancel()),
    )

    this.dom.append(label, textarea, hint, actions)
    this.#textarea = textarea
    textarea.focus()
  }

  /** Sustituye la tarjeta por el resultado de parsear el texto editado. */
  apply(text: string | undefined = this.#textarea?.value): void {
    const pos = this.getPos()
    this.#textarea = null
    this.dom.classList.remove('lia-card--editing')
    if (pos === undefined || text === undefined || text === this.value) {
      this.#render()
      this.view.focus()
      return
    }
    const { tr } = this.view.state
    const end = pos + this.#node.nodeSize
    if (text.trim() === '') tr.delete(pos, end)
    else tr.replaceWith(pos, end, this.parse(text).content)
    this.view.dispatch(tr.scrollIntoView())
    this.view.focus()
  }

  cancel(): void {
    this.#textarea = null
    this.dom.classList.remove('lia-card--editing')
    this.#render()
    this.view.focus()
  }

  #render(): void {
    const kind = this.#node.attrs.kind as LiaKind
    fillCard(this.dom, this.value, kind)
    if (this.view.editable) {
      const edit = button(t('lia.edit.button'), 'lia-card__edit', () => this.startEdit())
      edit.setAttribute('aria-label', t('lia.edit.buttonLabel', { kind: t(`lia.kind.${kind}`) }))
      this.dom.firstElementChild?.append(edit)
    }
  }
}

function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.textContent = text
  el.addEventListener('mousedown', (event) => event.preventDefault()) // no robar la selección
  el.addEventListener('click', (event) => {
    event.preventDefault()
    onClick()
  })
  return el
}

export const liaCardView = $view(liaBlockNode, (ctx) => (node, view, getPos) => {
  const parse = (markdown: string) => ctx.get(parserCtx)(markdown)
  return new LiaCardView(node, view, getPos, parse)
})
