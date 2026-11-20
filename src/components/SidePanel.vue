<script setup lang="ts">
// Panel lateral plegable. Abierto: cabecera con título e icono de plegar en
// la esquina superior derecha. Plegado: franja estrecha con el icono para
// desplegarlo (el control vive siempre en el propio panel).
import { isNarrow } from '../editor/usePanel'
import { t } from '../i18n'

const props = defineProps<{
  id: string
  side: 'left' | 'right'
  title: string
  open: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()

/**
 * Esc pliega el panel solo cuando está superpuesto al documento (pantallas
 * estrechas), y nunca si la tecla era para otra cosa: un diálogo, el
 * buscador o un campo de texto.
 */
function onEscape(event: KeyboardEvent): void {
  const target = event.target as Element | null
  if (!props.open || !isNarrow() || event.defaultPrevented) return
  if (target?.closest('dialog, input, textarea, select')) return
  emit('toggle')
}

/**
 * Icono «panel lateral» con una flecha en la zona de contenido que indica
 * hacia dónde se moverá el panel al pulsar (plegar o desplegar).
 */
const arrow = (): string => {
  const towardsLeft = props.side === 'left' ? props.open : !props.open
  const cx = props.side === 'left' ? 15 : 9 // centro de la zona de contenido
  return towardsLeft ? `M${cx + 1.5} 9l-3 3 3 3` : `M${cx - 1.5} 9l3 3-3 3`
}
</script>

<template>
  <aside
    :id="id"
    class="side-panel"
    :class="[`side-panel--${side}`, open ? 'is-open' : 'is-collapsed']"
    :aria-label="title"
    @keydown.esc="onEscape"
  >
    <div class="side-panel__head">
      <span v-if="open" class="side-panel__title">{{ title }}</span>
      <button
        type="button"
        class="side-panel__toggle"
        :aria-expanded="open"
        :aria-controls="`${id}-body`"
        :title="t(open ? 'panel.hide' : 'panel.show', { name: title })"
        @click="emit('toggle')"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path :d="side === 'left' ? 'M9 4v16' : 'M15 4v16'" />
          <path :d="arrow()" />
        </svg>
        <span class="visually-hidden">{{ t(open ? 'panel.hide' : 'panel.show', { name: title }) }}</span>
      </button>
    </div>
    <div v-show="open" :id="`${id}-body`" class="side-panel__body">
      <slot />
    </div>
  </aside>
</template>
