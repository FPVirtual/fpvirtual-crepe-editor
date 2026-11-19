<script setup lang="ts">
// PoC (M0): abre el material, lo muestra en Crepe con los bloques LiaScript
// protegidos y deja ver el Markdown que se guardaría. El guardado real
// (LmsBridge, 409/422/401) es M1.
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import { createLiaEditor, type LiaEditor } from './editor/createEditor'
import { t } from './i18n'
import { materialUrl } from './lms/openUrl'

const root = ref<HTMLElement | null>(null)
const editor = shallowRef<LiaEditor | null>(null)
const status = ref<'loading' | 'ready' | 'nourl' | 'error'>('loading')
const errorMessage = ref('')
const original = ref('')
const output = ref('')
const showDebug = ref(false)

async function loadMarkdown(): Promise<string | null> {
  const params = new URLSearchParams(location.search)
  if (import.meta.env.DEV && params.has('demo')) {
    const demo = await import('../fixtures/real/demo-liascript.md?raw')
    return demo.default
  }
  const url = materialUrl(location.search)
  if (!url) return null
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

onMounted(async () => {
  try {
    const markdown = await loadMarkdown()
    if (markdown === null) {
      status.value = 'nourl'
      return
    }
    original.value = markdown
    status.value = 'ready'
    await Promise.resolve()
    editor.value = await createLiaEditor(root.value!, markdown)
  } catch (error) {
    status.value = 'error'
    errorMessage.value = t('app.loadError', { message: (error as Error).message })
  }
})

onBeforeUnmount(() => {
  void editor.value?.destroy()
})

function toggleDebug(): void {
  showDebug.value = !showDebug.value
  if (showDebug.value && editor.value) output.value = editor.value.getMarkdown()
}
</script>

<template>
  <header class="topbar">
    <span class="topbar__title">{{ editor?.doc.lms?.file ?? t('app.title') }}</span>
    <span v-if="editor?.doc.lms?.readonly" class="badge">{{ t('app.readonly') }}</span>
    <button v-if="editor" class="btn" type="button" @click="toggleDebug">
      {{ showDebug ? t('app.debug.hide') : t('app.debug.show') }}
    </button>
  </header>

  <p v-if="status === 'loading'" class="message">{{ t('app.loading') }}</p>
  <p v-else-if="status === 'nourl'" class="message">{{ t('app.noUrl') }}</p>
  <p v-else-if="status === 'error'" class="message" role="alert">{{ errorMessage }}</p>

  <main v-show="status === 'ready'" ref="root" class="editor" />

  <section v-if="showDebug" class="debug" aria-live="polite">
    <p>{{ output === original ? t('app.debug.unchanged') : t('app.debug.changed') }}</p>
    <pre>{{ output }}</pre>
  </section>
</template>
