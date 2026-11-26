// Ancho de las imágenes en el editor (bloque de imagen, atributo `width`).
//
// - Decoración: el bloque se pinta con su ancho (% del ancho del texto, o de
//   la columna si está en una) y centrado.
// - Barra flotante al seleccionar una imagen: deslizador 10–100 %, atajos
//   25/50/75/100 y «Original» (sin ancho: tamaño natural, como mucho el del
//   texto). 100 % = ancho del texto = ancho imprimible del PDF de contenido.
//
// Sustituye al tirador de Crepe, que cambia el alto en pantalla y no se
// guarda en el Markdown (se oculta en styles.css).

import type { EditorView } from '@milkdown/kit/prose/view'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { NodeSelection, Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'

import { t } from '../i18n'
import { MAX_WIDTH, MIN_WIDTH } from '../liascript/columns'

const IMAGE_BLOCK = 'image-block'
const PRESETS = [25, 50, 75, 100]

export const imageWidthKey = new PluginKey('lia-image-width')

/** Imagen seleccionada (posición y ancho actual), si la hay. */
function selectedImage(view: EditorView): { pos: number; width: number | null } | null {
  const { selection } = view.state
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== IMAGE_BLOCK) return null
  if (!selection.node.attrs.src) return null // bloque aún sin imagen: nada que dimensionar
  return { pos: selection.from, width: (selection.node.attrs.width as number | null) ?? null }
}

export function setImageWidth(view: EditorView, pos: number, width: number | null): void {
  const value = width === null ? null : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)))
  const tr = view.state.tr.setNodeAttribute(pos, 'width', value)
  tr.setSelection(NodeSelection.create(tr.doc, pos)) // la barra sigue abierta
  view.dispatch(tr)
}

class WidthToolbar {
  readonly #view: EditorView
  readonly #dom: HTMLElement
  readonly #range: HTMLInputElement
  readonly #value: HTMLOutputElement
  readonly #buttons = new Map<number | null, HTMLButtonElement>()

  constructor(view: EditorView) {
    this.#view = view
    this.#dom = document.createElement('div')
    this.#dom.className = 'lia-image-width'
    this.#dom.setAttribute('role', 'toolbar')
    this.#dom.setAttribute('aria-label', t('image.width.toolbar'))
    this.#dom.title = t('image.width.hint')
    this.#dom.hidden = true
    // Que pulsar en la barra no quite la selección de la imagen.
    this.#dom.addEventListener('mousedown', (e) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
    })

    const label = document.createElement('label')
    label.className = 'lia-image-width__label'
    label.textContent = t('image.width.label')
    this.#range = document.createElement('input')
    this.#range.type = 'range'
    this.#range.min = String(MIN_WIDTH)
    this.#range.max = String(MAX_WIDTH)
    this.#range.step = '5'
    this.#range.id = 'lia-image-width-range'
    label.htmlFor = this.#range.id
    this.#range.addEventListener('input', () => this.#apply(Number(this.#range.value)))
    this.#value = document.createElement('output')
    this.#value.className = 'lia-image-width__value'
    this.#value.htmlFor.add(this.#range.id)
    this.#dom.append(label, this.#range, this.#value)

    for (const preset of [...PRESETS, null]) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'lia-image-width__preset'
      button.textContent = preset === null ? t('image.width.original') : `${preset} %`
      button.title = preset === null ? t('image.width.originalHint') : t('image.width.preset', { n: preset })
      button.addEventListener('click', () => this.#apply(preset))
      this.#buttons.set(preset, button)
      this.#dom.append(button)
    }
    view.dom.parentElement?.append(this.#dom)
    this.update(view)
  }

  #apply(width: number | null): void {
    const image = selectedImage(this.#view)
    if (image) setImageWidth(this.#view, image.pos, width)
  }

  update(view: EditorView): void {
    const image = view.editable ? selectedImage(view) : null
    const dom = image ? view.nodeDOM(image.pos) : null
    const host = this.#dom.parentElement
    if (!image || !(dom instanceof HTMLElement) || !host) {
      this.#dom.hidden = true
      return
    }
    this.#dom.hidden = false
    this.#range.value = String(image.width ?? MAX_WIDTH)
    this.#value.value = image.width === null ? t('image.width.original') : `${image.width} %`
    for (const [preset, button] of this.#buttons) button.setAttribute('aria-pressed', String(preset === image.width))
    // Debajo de la imagen, alineada con su borde izquierdo.
    const box = dom.getBoundingClientRect()
    const origin = host.getBoundingClientRect()
    this.#dom.style.top = `${box.bottom - origin.top + host.scrollTop + 4}px`
    // Dentro del editor aunque la imagen esté pegada al borde derecho.
    const room = host.clientWidth - this.#dom.offsetWidth
    this.#dom.style.left = `${Math.max(0, Math.min(box.left - origin.left, room))}px`
  }

  destroy(): void {
    this.#dom.remove()
  }
}

export const imageWidthPlugin = $prose(
  () =>
    new Plugin({
      key: imageWidthKey,
      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (node.type.name === IMAGE_BLOCK && node.attrs.width) {
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: 'lia-image--sized',
                  style: `width: ${node.attrs.width as number}%`,
                }),
              )
            }
          })
          return DecorationSet.create(state.doc, decorations)
        },
      },
      view: (view) => new WidthToolbar(view),
    }),
)
