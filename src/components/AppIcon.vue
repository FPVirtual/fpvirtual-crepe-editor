<script setup lang="ts">
// Iconos del editor: SVG en línea (24×24, trazo con currentColor), sin
// dependencias. Decorativos (aria-hidden): el nombre accesible lo pone el
// botón que los contiene.
import { computed } from 'vue'

export type IconName = 'auto' | 'sun' | 'moon' | 'contrast'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })

// Cada icono: trazados (stroke) y, opcionalmente, rellenos.
const ICONS: Record<IconName, { paths: string[]; fills?: string[] }> = {
  // Automático: pantalla (sigue la preferencia del sistema).
  auto: { paths: ['M4 5h16v11H4z', 'M9 20h6', 'M12 16v4'] },
  // Claro (verde): sol.
  sun: {
    paths: [
      'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
      'M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4',
      'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4',
    ],
  },
  // Oscuro: luna.
  moon: { paths: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'] },
  // Alto contraste: círculo medio relleno.
  contrast: { paths: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z'], fills: ['M12 3a9 9 0 0 1 0 18z'] },
}

const icon = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    class="icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in icon.paths" :key="`p${i}`" :d="d" />
    <path v-for="(d, i) in icon.fills ?? []" :key="`f${i}`" :d="d" fill="currentColor" stroke="none" />
  </svg>
</template>
