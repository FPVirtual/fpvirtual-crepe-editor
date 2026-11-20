<script setup lang="ts">
// Ayuda: dos secciones navegables por ancla (#editor, #liascript) para que
// el editor pueda enlazar directamente a cada una.
import { nextTick, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'

import { branding } from '../branding'
import AppBrand from '../components/AppBrand.vue'
import ThemeSelect from '../components/ThemeSelect.vue'
import HelpEditor from './HelpEditor.vue'
import HelpLiascript from './HelpLiascript.vue'

type Section = 'editor' | 'liascript'

const SECTIONS: { id: Section; title: string }[] = [
  { id: 'editor', title: 'Cómo usar el editor' },
  { id: 'liascript', title: 'LiaScript avanzado' },
]

const current = ref<Section>('editor')

/** `#seccion` o `#seccion/apartado`: elige la sección y, ya pintada, baja al apartado. */
async function fromHash(): Promise<void> {
  const hash = decodeURIComponent(location.hash.slice(1))
  current.value = hash.split('/')[0] === 'liascript' ? 'liascript' : 'editor'
  await nextTick()
  if (hash.includes('/')) document.getElementById(hash)?.scrollIntoView()
  else scrollTo({ top: 0 })
}

const onHashChange = (): void => void fromHash()

onMounted(() => {
  void fromHash()
  addEventListener('hashchange', onHashChange)
})
onBeforeUnmount(() => removeEventListener('hashchange', onHashChange))

watchEffect(() => {
  const section = SECTIONS.find((s) => s.id === current.value)!
  document.title = `${section.title} · Ayuda · ${branding.title}`
})
</script>

<template>
  <div class="help-head">
  <header class="topbar">
    <AppBrand subtitle="Ayuda" />
    <div class="topbar__title" />
    <ThemeSelect />
  </header>

  <nav class="help-tabs" aria-label="Secciones de la ayuda">
    <a
      v-for="s in SECTIONS"
      :key="s.id"
      class="help-tabs__tab"
      :href="`#${s.id}`"
      :aria-current="current === s.id ? 'page' : undefined"
    >
      {{ s.title }}
    </a>
  </nav>
  </div>

  <main class="help">
    <HelpEditor v-if="current === 'editor'" />
    <HelpLiascript v-else />
  </main>
</template>
