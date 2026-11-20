<script setup lang="ts">
// M1: abre el material desde Moodle, lo edita con Crepe (bloques LiaScript
// protegidos) y lo guarda/publica contra el plugin (contrato §4).
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue'

import { branding } from './branding'
import AppBrand from './components/AppBrand.vue'
import ConflictDialog from './components/ConflictDialog.vue'
import ThemeSelect from './components/ThemeSelect.vue'
import { createLiaEditor, type LiaEditor } from './editor/createEditor'
import { t } from './i18n'
import type { LmsConfig } from './liascript'
import { LmsBridge, type PublishFormat } from './lms/bridge'
import { deleteDraft, draftKey, loadDraft, saveDraft, type Draft } from './lms/drafts'
import { materialUrl } from './lms/openUrl'

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'unchanged' | 'error' | 'invalid' | 'auth'

const TOKEN_REFRESH_MS = 5 * 60 * 1000
const DRAFT_DEBOUNCE_MS = 3000
const CHANGE_DEBOUNCE_MS = 300

const root = ref<HTMLElement | null>(null)
const editor = shallowRef<LiaEditor | null>(null)
const status = ref<'loading' | 'ready' | 'nourl' | 'error'>('loading')
const errorMessage = ref('')

let bridge: LmsBridge | null = null
/** Copia reactiva de la configuración del puente (SHA y token cambian al guardar). */
const lms = ref<LmsConfig | null>(null)

const saveState = ref<SaveState>('idle')
const saveMessage = ref('')
const invalidErrors = ref<{ line?: number; message: string }[]>([])
const lastSaved = ref('')
const conflict = ref<{ resolutionBranch?: string; diffUrl?: string; currentSha?: string } | null>(null)

const publishFormat = ref<PublishFormat>('h5p')
const publishing = ref(false)
const publishMessage = ref('')
const publishUrl = ref<string | undefined>()

const draftOffer = ref<{ draft: Draft; stale: boolean } | null>(null)
watchEffect(() => {
  document.title = lms.value?.file ? `${lms.value.file} · ${branding.title}` : branding.title
})

const debug = new URLSearchParams(location.search).has('debug')
const debugOutput = ref('')

let refreshTimer: ReturnType<typeof setInterval> | undefined
let draftTimer: ReturnType<typeof setTimeout> | undefined
let changeTimer: ReturnType<typeof setTimeout> | undefined

const canSave = computed(() => Boolean(lms.value && !lms.value.readonly && lms.value.token))
const canPublish = computed(() => canSave.value && Boolean(lms.value?.publish_endpoint))
const dirty = computed(() => saveState.value === 'dirty')
const busy = computed(() => saveState.value === 'saving' || publishing.value)

const statusText = computed(() => {
  switch (saveState.value) {
    case 'dirty':
      return t('save.dirty')
    case 'saving':
      return t('save.saving')
    case 'saved':
      return t('save.saved')
    case 'unchanged':
      return t('save.unchanged')
    case 'error':
      return t('save.error', { message: saveMessage.value })
    default:
      return t('save.idle')
  }
})

function syncLms(): void {
  lms.value = bridge ? { ...bridge.config } : null
}

// --- carga ---------------------------------------------------------------

async function fetchMarkdown(url: string): Promise<string> {
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(json.message ?? `HTTP ${response.status}`)
  }
  return response.text()
}

async function mountEditor(markdown: string): Promise<LiaEditor> {
  await editor.value?.destroy()
  root.value!.innerHTML = ''
  const instance = await createLiaEditor(root.value!, markdown, { onChange })
  editor.value = instance
  return instance
}

async function openFromServer(url: string): Promise<void> {
  const markdown = await fetchMarkdown(url)
  status.value = 'ready'
  await Promise.resolve()
  const instance = await mountEditor(markdown)
  const cfg = instance.doc.lms
  bridge = cfg ? new LmsBridge(cfg, url) : null
  syncLms()
  lastSaved.value = instance.getMarkdown()
  saveState.value = 'idle'
  await offerDraft()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  try {
    const params = new URLSearchParams(location.search)
    if (import.meta.env.DEV && params.has('demo')) {
      const demo = await import('../fixtures/real/demo-liascript.md?raw')
      status.value = 'ready'
      await Promise.resolve()
      lastSaved.value = (await mountEditor(demo.default)).getMarkdown()
      return
    }
    const url = materialUrl(location.search)
    if (!url) {
      status.value = 'nourl'
      return
    }
    await openFromServer(url)
    refreshTimer = setInterval(async () => {
      if (await bridge?.refreshToken()) syncLms()
    }, TOKEN_REFRESH_MS)
  } catch (error) {
    status.value = 'error'
    errorMessage.value = t('app.loadError', { message: (error as Error).message })
  }
})

onBeforeUnmount(() => {
  clearInterval(refreshTimer)
  clearTimeout(draftTimer)
  clearTimeout(changeTimer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  void editor.value?.destroy()
})

// --- cambios, borrador local ------------------------------------------------

/**
 * El documento ProseMirror cambió. No basta para marcarlo como modificado:
 * algunos plugins de Milkdown tocan atributos que no llegan al Markdown
 * (p. ej. al recuperar el foco). Se compara el Markdown, con un pequeño
 * retardo para no serializar en cada pulsación.
 */
function onChange(): void {
  clearTimeout(changeTimer)
  changeTimer = setTimeout(checkDirty, CHANGE_DEBOUNCE_MS)
}

function checkDirty(): void {
  if (!editor.value || saveState.value === 'saving') return
  const markdown = editor.value.getMarkdown()
  if (markdown === lastSaved.value) {
    if (saveState.value === 'dirty') saveState.value = 'idle'
    return
  }
  if (saveState.value !== 'dirty') publishMessage.value = ''
  saveState.value = 'dirty'
  clearTimeout(draftTimer)
  draftTimer = setTimeout(() => void storeDraft(markdown), DRAFT_DEBOUNCE_MS)
}

async function storeDraft(markdown: string): Promise<void> {
  const cfg = lms.value
  if (!cfg || !canSave.value || saveState.value !== 'dirty') return
  await saveDraft({ key: draftKey(cfg.file, cfg.branch), sha: cfg.sha, markdown, savedAt: Date.now() })
}

async function offerDraft(): Promise<void> {
  const cfg = lms.value
  if (!cfg || !canSave.value) return
  const draft = await loadDraft(draftKey(cfg.file, cfg.branch))
  if (!draft || draft.markdown === lastSaved.value) return
  draftOffer.value = { draft, stale: draft.sha !== cfg.sha }
}

async function recoverDraft(): Promise<void> {
  const offer = draftOffer.value
  draftOffer.value = null
  if (!offer) return
  await mountEditor(offer.draft.markdown)
  saveState.value = 'dirty'
}

async function discardDraft(): Promise<void> {
  const cfg = lms.value
  draftOffer.value = null
  if (cfg) await deleteDraft(draftKey(cfg.file, cfg.branch))
}

// --- guardado -----------------------------------------------------------------

async function save(baseSha?: string): Promise<void> {
  const b = bridge
  const ed = editor.value
  if (!b || !ed || !canSave.value || saveState.value === 'saving') return
  const markdown = ed.getMarkdown()
  if (markdown === lastSaved.value && baseSha === undefined) {
    saveState.value = 'unchanged'
    return
  }
  saveState.value = 'saving'
  invalidErrors.value = []
  const result = await b.save(markdown, baseSha)
  syncLms()
  switch (result.status) {
    case 'saved':
      lastSaved.value = markdown
      saveState.value = 'saved'
      await deleteDraft(draftKey(b.config.file, b.config.branch))
      break
    case 'conflict':
      saveState.value = 'dirty'
      conflict.value = result
      break
    case 'invalid':
      saveState.value = 'invalid'
      invalidErrors.value = result.errors
      break
    case 'auth_error':
      saveState.value = 'auth'
      break
    default:
      saveState.value = 'error'
      saveMessage.value = result.message
  }
}

async function forceSave(): Promise<void> {
  const sha = conflict.value?.currentSha
  conflict.value = null
  await save(sha)
}

async function reloadServerVersion(): Promise<void> {
  const url = bridge?.reloadUrl()
  conflict.value = null
  if (!url) return
  try {
    const cfg = lms.value
    if (cfg) await deleteDraft(draftKey(cfg.file, cfg.branch))
    await openFromServer(url)
  } catch (error) {
    saveState.value = 'error'
    saveMessage.value = (error as Error).message
  }
}

// --- publicación ----------------------------------------------------------------

async function publish(): Promise<void> {
  const b = bridge
  if (!b || busy.value) return
  publishUrl.value = undefined
  if (dirty.value) {
    publishMessage.value = t('publish.saveFirst')
    return
  }
  publishing.value = true
  publishMessage.value = t('publish.running')
  const result = await b.publish(publishFormat.value)
  publishing.value = false
  if (result.status === 'published') {
    publishMessage.value = t('publish.done')
    publishUrl.value = result.url
  } else if (result.status === 'auth_error') {
    publishMessage.value = result.message ? t('publish.error', { message: result.message }) : ''
    if (!result.message) saveState.value = 'auth'
  } else {
    publishMessage.value = t('publish.error', { message: result.message })
  }
}

// --- teclado y salida ------------------------------------------------------------

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (dirty.value || (canSave.value && editor.value && editor.value.getMarkdown() !== lastSaved.value)) {
    event.preventDefault()
    event.returnValue = t('app.unsavedWarning')
  }
}

function toggleDebug(): void {
  debugOutput.value = debugOutput.value ? '' : (editor.value?.getMarkdown() ?? '')
}
</script>

<template>
  <header class="topbar">
    <AppBrand />

    <div class="topbar__title">
      <span v-if="lms">{{ lms.file }}</span>
      <span v-if="lms" class="topbar__branch">{{ lms.branch }} · {{ lms.sha.slice(0, 8) }}</span>
    </div>

    <span v-if="lms?.readonly" class="badge">{{ t('app.readonly') }}</span>

    <template v-if="canSave">
      <span class="topbar__status" role="status" aria-live="polite">{{ statusText }}</span>
      <button class="btn btn--primary" type="button" :disabled="busy" :title="t('save.shortcut')" @click="save()">
        {{ t('save.button') }}
      </button>
    </template>

    <template v-if="canPublish">
      <label class="visually-hidden" for="publish-format">{{ t('publish.format') }}</label>
      <select id="publish-format" v-model="publishFormat" class="select" :disabled="busy">
        <option value="h5p">{{ t('publish.h5p') }}</option>
        <option value="epub">{{ t('publish.epub') }}</option>
        <option value="pdf">{{ t('publish.pdf') }}</option>
      </select>
      <button class="btn" type="button" :disabled="busy" @click="publish">{{ t('publish.button') }}</button>
    </template>

    <ThemeSelect />
    <a class="btn" href="./ayuda.html#editor" target="_blank" rel="noopener" :title="t('help.buttonTitle')">
      {{ t('help.button') }}
    </a>

    <a v-if="lms?.return_url" class="btn" :href="lms.return_url">{{ t('app.backToMoodle') }}</a>
    <button v-if="debug && editor" class="btn" type="button" @click="toggleDebug">
      {{ debugOutput ? t('app.debug.hide') : t('app.debug.show') }}
    </button>
  </header>

  <div v-if="draftOffer" class="banner" role="alert">
    <template v-if="!draftOffer.stale">
      {{ t('draft.found', { date: new Date(draftOffer.draft.savedAt).toLocaleString() }) }}
      <button class="btn btn--primary" type="button" @click="recoverDraft">{{ t('draft.recover') }}</button>
    </template>
    <template v-else>
      {{ t('draft.staleSha', { date: new Date(draftOffer.draft.savedAt).toLocaleString() }) }}
    </template>
    <button class="btn" type="button" @click="discardDraft">{{ t('draft.discard') }}</button>
  </div>

  <div v-if="saveState === 'auth'" class="banner banner--error" role="alert">
    {{ t('save.auth') }}
    <a v-if="lms?.return_url" class="btn" :href="lms.return_url">{{ t('app.backToMoodle') }}</a>
  </div>

  <div v-if="saveState === 'invalid'" class="banner banner--error" role="alert">
    {{ t('save.invalid') }}
    <ul>
      <li v-for="(e, i) in invalidErrors" :key="i">
        {{ e.line ? t('save.invalidLine', { line: e.line, message: e.message }) : e.message }}
      </li>
    </ul>
  </div>

  <div v-if="publishMessage" class="banner" role="status">
    {{ publishMessage }}
    <a v-if="publishUrl" class="btn" :href="publishUrl" target="_blank" rel="noopener noreferrer">
      {{ t('publish.open') }}
    </a>
  </div>

  <p v-if="status === 'loading'" class="message">{{ t('app.loading') }}</p>
  <p v-else-if="status === 'nourl'" class="message">{{ t('app.noUrl') }}</p>
  <p v-else-if="status === 'error'" class="message" role="alert">{{ errorMessage }}</p>

  <main v-show="status === 'ready'" ref="root" class="editor" />

  <section v-if="debugOutput" class="debug">
    <p>{{ debugOutput === lastSaved ? t('app.debug.unchanged') : t('app.debug.changed') }}</p>
    <pre>{{ debugOutput }}</pre>
  </section>

  <ConflictDialog
    v-if="conflict"
    :resolution-branch="conflict.resolutionBranch"
    :diff-url="conflict.diffUrl"
    @reload="reloadServerVersion"
    @force="forceSave"
    @cancel="conflict = null"
  />
</template>
