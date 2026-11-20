<script setup lang="ts">
// Contenido del panel «LiaScript»: ejemplos de todo lo que LiaScript ofrece y
// el editor visual no muestra, con imagen del resultado real (generada por
// scripts/lia-previews.mjs), y botones para insertarlos o copiarlos.
import { computed, nextTick, ref } from 'vue'

import { t } from '../i18n'
import { exampleImage, examplesByCategory, macroSource, type HeaderMacro, type LiaExample } from '../liascript'

const props = defineProps<{ macros: HeaderMacro[]; canInsert: boolean }>()
const emit = defineEmits<{ insert: [source: string] }>()

const query = ref('')
const zoomed = ref<(LiaExample & { image?: string }) | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)

/** Abre la imagen del resultado a tamaño real en un diálogo. */
async function zoom(example: LiaExample & { image?: string }): Promise<void> {
  zoomed.value = example
  await nextTick()
  dialog.value?.showModal()
}

function closeZoom(): void {
  dialog.value?.close()
}

/** Clic en el fondo oscuro (fuera del contenido) cierra el diálogo. */
function onDialogClick(event: MouseEvent): void {
  if (event.target === dialog.value) closeZoom()
}

function insertZoomed(): void {
  if (!zoomed.value) return
  emit('insert', zoomed.value.source)
  closeZoom()
}
const copied = ref('')
const missing = ref(new Set<string>())

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

interface Group {
  id: string
  title: string
  items: (LiaExample & { image?: string })[]
}

const groups = computed<Group[]>(() => {
  const macroGroup: Group[] = props.macros.length
    ? [
        {
          id: 'macros',
          title: t('lia.panel.macros'),
          items: props.macros.map((m) => ({
            key: `macro-${m.name}`,
            category: 'format' as const,
            title: `@${m.name}`,
            description: t('lia.panel.macroDescription'),
            source: macroSource(m),
          })),
        },
      ]
    : []
  const all: Group[] = [
    ...examplesByCategory().map((g) => ({ ...g, items: g.items.map((e) => ({ ...e, image: exampleImage(e.key) })) })),
    ...macroGroup,
  ]
  const q = normalize(query.value.trim())
  if (!q) return all
  return all
    .map((g) => ({
      ...g,
      items: g.items.filter((e) => normalize(`${g.title} ${e.title} ${e.description} ${e.source}`).includes(q)),
    }))
    .filter((g) => g.items.length > 0)
})

async function copy(example: LiaExample): Promise<void> {
  try {
    await navigator.clipboard.writeText(example.source)
    copied.value = example.key
    setTimeout(() => (copied.value = ''), 1500)
  } catch {
    // Sin permiso de portapapeles: el código sigue seleccionable.
  }
}

function hideImage(key: string): void {
  missing.value = new Set(missing.value).add(key)
}
</script>

<template>
  <div class="lia-panel">
    <p class="lia-panel__intro">{{ t('lia.panel.intro') }}</p>
    <label class="visually-hidden" for="lia-panel-search">{{ t('lia.panel.search') }}</label>
    <input
      id="lia-panel-search"
      v-model="query"
      class="lia-panel__search"
      type="search"
      :placeholder="t('lia.panel.search')"
      autocomplete="off"
    />
    <p v-if="groups.length === 0" class="lia-panel__empty">{{ t('lia.panel.noResults') }}</p>

    <section v-for="group in groups" :key="group.id" class="lia-panel__group">
      <h3 class="lia-panel__group-title">{{ group.title }}</h3>
      <details v-for="example in group.items" :key="example.key" class="lia-example" :open="query.trim() !== '' && group.items.length === 1">
        <summary class="lia-example__summary">{{ example.title }}</summary>
        <div class="lia-example__body">
          <p class="lia-example__description">{{ example.description }}</p>
          <figure v-if="example.image && !missing.has(example.key)" class="lia-example__preview">
            <button
              type="button"
              class="lia-example__zoom"
              :title="t('lia.panel.zoom')"
              @click="zoom(example)"
            >
              <img
                :src="example.image"
                :alt="t('lia.panel.imageAlt', { title: example.title })"
                loading="lazy"
                @error="hideImage(example.key)"
              />
              <span class="lia-example__zoom-hint" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M11 8v6M8 11h6" /></svg>
              </span>
              <span class="visually-hidden">{{ t('lia.panel.zoom') }}</span>
            </button>
            <figcaption>{{ t('lia.panel.imageCaption') }} · {{ t('lia.panel.zoomHint') }}</figcaption>
          </figure>
          <pre class="lia-example__code"><code>{{ example.source }}</code></pre>
          <div class="lia-example__actions">
            <button
              v-if="canInsert"
              type="button"
              class="btn btn--primary btn--small"
              :title="t('lia.panel.insertTitle')"
              @click="emit('insert', example.source)"
            >
              {{ t('lia.panel.insert') }}
            </button>
            <button type="button" class="btn btn--small" @click="copy(example)">
              <span aria-live="polite">{{ copied === example.key ? t('lia.panel.copied') : t('lia.panel.copy') }}</span>
            </button>
          </div>
        </div>
      </details>
    </section>

    <!-- En body: así no depende de que el panel esté visible. -->
    <Teleport to="body">
    <dialog
      ref="dialog"
      class="lia-zoom"
      :aria-label="zoomed ? t('lia.panel.imageAlt', { title: zoomed.title }) : undefined"
      @click="onDialogClick"
      @close="zoomed = null"
    >
      <template v-if="zoomed">
        <div class="lia-zoom__head">
          <h2 class="lia-zoom__title">{{ zoomed.title }}</h2>
          <button type="button" class="lia-zoom__close" :aria-label="t('lia.panel.close')" @click="closeZoom">×</button>
        </div>
        <p class="lia-zoom__caption">{{ t('lia.panel.imageCaption') }}</p>
        <img class="lia-zoom__image" :src="zoomed.image" :alt="t('lia.panel.imageAlt', { title: zoomed.title })" />
        <div class="lia-zoom__actions">
          <button v-if="canInsert" type="button" class="btn btn--primary" @click="insertZoomed">{{ t('lia.panel.insert') }}</button>
          <a class="btn" :href="zoomed.image" target="_blank" rel="noopener">{{ t('lia.panel.openTab') }}</a>
          <button type="button" class="btn" @click="closeZoom">{{ t('lia.panel.close') }}</button>
        </div>
      </template>
    </dialog>
    </Teleport>

    <p class="lia-panel__more">
      <a href="https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md" target="_blank" rel="noopener">
        {{ t('lia.panel.docs') }}
      </a>
    </p>
  </div>
</template>
