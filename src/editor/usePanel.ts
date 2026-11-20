// Estado abierto/plegado de un panel lateral, recordado en el navegador.
// Sin preferencia guardada: abierto en pantallas anchas, plegado en las
// estrechas (donde el panel abierto se superpone al documento).

import { ref } from 'vue'

/** Por debajo de este ancho los paneles abiertos se superponen al documento. */
export const NARROW_QUERY = '(max-width: 999px)'

export const isNarrow = (): boolean => typeof matchMedia === 'function' && matchMedia(NARROW_QUERY).matches

export function usePanel(storageKey: string, openByDefault = true) {
  let initial = openByDefault && !isNarrow()
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'open') initial = true
    else if (stored === 'closed') initial = false
  } catch {
    // Sin almacenamiento: valor por defecto.
  }
  const open = ref(initial)

  function set(value: boolean, remember = true): void {
    open.value = value
    if (!remember) return
    try {
      localStorage.setItem(storageKey, value ? 'open' : 'closed')
    } catch {
      // Sin almacenamiento: dura la sesión.
    }
  }

  return {
    open,
    toggle: () => set(!open.value),
    /** En pantallas estrechas, plegar tras usar el panel (sin recordarlo). */
    collapseIfNarrow: () => {
      if (isNarrow()) set(false, false)
    },
  }
}
