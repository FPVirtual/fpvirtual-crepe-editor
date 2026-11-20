<script setup lang="ts">
// Ayuda del editor. Las funciones avanzadas de LiaScript (quizzes,
// animaciones…) no están aquí: viven en el panel «LiaScript» del editor, donde
// se pueden insertar directamente.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { branding } from '../branding'
import AppBrand from '../components/AppBrand.vue'
import ThemeSelect from '../components/ThemeSelect.vue'
import HelpEditor from './HelpEditor.vue'

const backHint = ref(false)

/** `#editor/apartado`: baja al apartado una vez pintada la página. */
async function fromHash(): Promise<void> {
  await nextTick()
  const hash = decodeURIComponent(location.hash.slice(1))
  if (hash.includes('/')) document.getElementById(hash)?.scrollIntoView()
}

const onHashChange = (): void => void fromHash()

onMounted(() => {
  document.title = `Ayuda · ${branding.title}`
  void fromHash()
  addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => removeEventListener('hashchange', onHashChange))

/**
 * Vuelve a la pestaña del editor. La ayuda se abre desde el editor con
 * window.open, así que puede cerrarse por script; si se abrió de otra forma
 * (enlace directo, marcador), se vuelve atrás o se indica cómo volver.
 */
function backToEditor(): void {
  try {
    window.opener?.focus()
  } catch {
    // Otra ventana sin acceso: se intenta cerrar igualmente.
  }
  window.close()
  setTimeout(() => {
    if (window.closed) return
    if (history.length > 1) history.back()
    else backHint.value = true
  }, 150)
}
</script>

<template>
  <header class="topbar">
    <button class="btn btn--primary help-back" type="button" @click="backToEditor">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Volver al editor
    </button>
    <AppBrand subtitle="Ayuda" />
    <div class="topbar__title" />
    <ThemeSelect />
  </header>

  <p v-if="backHint" class="banner" role="status">
    Esta pestaña no se puede cerrar automáticamente: ciérrala (Ctrl+W) para volver al editor.
  </p>

  <main class="help">
    <HelpEditor />
  </main>
</template>
