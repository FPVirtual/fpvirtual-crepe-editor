<script setup lang="ts">
// Incorporar la versión oficial (main) a la rama de edición (LIA-130), al
// estilo de Meld, con @codemirror/merge:
// - Sin conflictos: tu versión actual (izquierda) frente a cómo quedará
//   (derecha), para revisarlo antes de incorporarlo.
// - Con conflictos: a la izquierda, el material con la versión oficial en
//   cada conflicto; a la derecha, el resultado editable, que parte de tu
//   versión. Las flechas de cada diferencia toman la oficial; también se
//   puede escribir a mano. Lo que solo cambió un lado ya viene fusionado.
import { MergeView } from '@codemirror/merge'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { t } from '../i18n'
import { compose, conflictCount, type SyncStatus } from '../lms/sync'

const props = defineProps<{ sync: SyncStatus; busy: boolean; error?: string }>()
const emit = defineEmits<{ apply: [content: string | undefined]; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const host = ref<HTMLElement | null>(null)
let view: MergeView | null = null

const conflict = computed(() => props.sync.status === 'conflict')
const conflicts = computed(() => conflictCount(props.sync.segments))

const theme = EditorView.theme({
  '&': { backgroundColor: 'var(--md-color-surface)', color: 'var(--md-color-text)', fontSize: '14px' },
  '.cm-content': { fontFamily: 'var(--md-font-code)', caretColor: 'var(--md-color-text)' },
  '.cm-gutters': {
    backgroundColor: 'var(--md-color-surface-muted)',
    color: 'var(--md-color-text-muted)',
    borderRight: '1px solid var(--md-color-border)',
  },
  '&.cm-focused': { outline: '2px solid var(--md-color-primary)' },
})

function side(doc: string, editable: boolean, label: string) {
  return {
    doc,
    extensions: [
      theme,
      EditorView.lineWrapping,
      EditorState.readOnly.of(!editable),
      EditorView.editable.of(editable),
      EditorView.contentAttributes.of({ 'aria-label': label }),
      EditorState.phrases.of({ '$ unchanged lines': t('merge.unchanged') }),
    ],
  }
}

function mount(): void {
  view?.destroy()
  if (!host.value) return
  const { sync } = props
  view = conflict.value
    ? new MergeView({
        a: side(compose(sync.segments, 'theirs'), false, t('merge.official')),
        b: side(compose(sync.segments, 'ours'), true, t('merge.result')),
        parent: host.value,
        revertControls: 'a-to-b', // flecha: tomar la versión oficial
        highlightChanges: true,
        gutter: true,
        collapseUnchanged: { margin: 3, minSize: 6 },
      })
    : new MergeView({
        a: side(sync.ours, false, t('merge.yours')),
        b: side(sync.merged, false, t('merge.preview')),
        parent: host.value,
        highlightChanges: true,
        gutter: true,
        collapseUnchanged: { margin: 3, minSize: 6 },
      })
}

/** Toma una versión en todos los conflictos (rehace el resultado). */
function takeAll(sideName: 'ours' | 'theirs'): void {
  const b = view?.b
  if (!b) return
  b.dispatch({ changes: { from: 0, to: b.state.doc.length, insert: compose(props.sync.segments, sideName) } })
}

function apply(): void {
  emit('apply', conflict.value ? view?.b.state.doc.toString() : undefined)
}

onMounted(() => {
  dialog.value?.showModal()
  mount()
})
onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <dialog ref="dialog" class="dialog dialog--merge" aria-labelledby="merge-title" @cancel.prevent="emit('cancel')">
    <h2 id="merge-title">{{ t('merge.title') }}</h2>
    <p v-if="conflict">{{ t(conflicts === 1 ? 'merge.conflictOne' : 'merge.conflictMany', { n: conflicts }) }}</p>
    <p v-else>{{ t('merge.cleanBody') }}</p>

    <div class="merge__labels" aria-hidden="true">
      <span>{{ conflict ? t('merge.official') : t('merge.yours') }}</span>
      <span>{{ conflict ? t('merge.result') : t('merge.preview') }}</span>
    </div>
    <div ref="host" class="merge__view" />

    <div v-if="conflict" class="merge__bulk">
      <button class="btn btn--small" type="button" :disabled="busy" @click="takeAll('theirs')">
        {{ t('merge.takeAllOfficial') }}
      </button>
      <button class="btn btn--small" type="button" :disabled="busy" @click="takeAll('ours')">
        {{ t('merge.keepAllMine') }}
      </button>
    </div>

    <p v-if="error" class="merge__error" role="alert">{{ error }}</p>
    <div class="dialog__actions">
      <button class="btn" type="button" :disabled="busy" @click="emit('cancel')">{{ t('merge.cancel') }}</button>
      <button class="btn btn--primary" type="button" :disabled="busy" @click="apply">
        {{ busy ? t('merge.applying') : t('merge.apply') }}
      </button>
    </div>
  </dialog>
</template>
