// Estado del panel de índice: títulos del documento, título activo según el
// desplazamiento y panel abierto/plegado (usePanel).

import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'

import type { LiaEditor } from './createEditor'
import type { OutlineItem } from './outline'
import { usePanel } from './usePanel'

const REFRESH_MS = 300

export function useOutline(editor: ShallowRef<LiaEditor | null>, header: Ref<HTMLElement | null>) {
  const items = shallowRef<OutlineItem[]>([])
  const active = ref(-1)
  const panel = usePanel('md-outline')
  let timer: ReturnType<typeof setTimeout> | undefined
  let frame = 0
  let resize: ResizeObserver | undefined

  const topbarHeight = (): number => header.value?.getBoundingClientRect().height ?? 0

  /** Título activo: el último cuyo comienzo ya ha pasado bajo la barra superior. */
  function track(): void {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const ed = editor.value
      if (!ed) return
      const limit = topbarHeight() + 24
      // Antes del primer título (inicio del documento) se marca el primero.
      let current = items.value.length > 0 ? 0 : -1
      items.value.forEach((item, i) => {
        const top = ed.elementAt(item.pos)?.getBoundingClientRect().top
        if (top !== undefined && top <= limit) current = i
      })
      // Al final de la página, el último título visible gana aunque no llegue arriba.
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4 && items.value.length) {
        current = items.value.length - 1
      }
      active.value = current
    })
  }

  function refresh(): void {
    clearTimeout(timer)
    items.value = editor.value?.getOutline() ?? []
    track()
  }

  /** Recalcula tras editar, con retardo para no hacerlo en cada pulsación. */
  function schedule(): void {
    clearTimeout(timer)
    timer = setTimeout(refresh, REFRESH_MS)
  }

  function select(index: number): void {
    const item = items.value[index]
    if (!item || !editor.value) return
    editor.value.revealPosition(item.pos)
    active.value = index
    panel.collapseIfNarrow() // en móvil el panel tapa el documento
  }

  watch(editor, refresh)

  onMounted(() => {
    addEventListener('scroll', track, { passive: true })
    addEventListener('resize', track, { passive: true })
    // La barra superior puede ocupar varias líneas: su altura fija la del panel.
    const setHeight = (): void =>
      document.documentElement.style.setProperty('--topbar-h', `${Math.round(topbarHeight())}px`)
    setHeight()
    if (typeof ResizeObserver === 'function' && header.value) {
      resize = new ResizeObserver(setHeight)
      resize.observe(header.value)
    }
  })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    cancelAnimationFrame(frame)
    removeEventListener('scroll', track)
    removeEventListener('resize', track)
    resize?.disconnect()
  })

  return {
    items,
    active,
    open: panel.open,
    toggle: panel.toggle,
    refresh,
    schedule,
    select,
  }
}
