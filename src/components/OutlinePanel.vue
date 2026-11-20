<script setup lang="ts">
// Panel lateral con el índice del material (títulos que abren sección).
import { computed } from 'vue'

import type { OutlineItem } from '../editor/outline'
import { t } from '../i18n'

const props = defineProps<{ items: OutlineItem[]; active: number }>()
const emit = defineEmits<{ select: [index: number]; close: [] }>()

/** Sangría relativa al nivel más alto presente (un material puede empezar en ##). */
const minLevel = computed(() => Math.min(6, ...props.items.map((i) => i.level)))
</script>

<template>
  <nav id="outline" class="outline" :aria-label="t('outline.label')" @keydown.esc="emit('close')">
    <div class="outline__head">
      <span class="outline__title">{{ t('outline.title') }}</span>
      <button class="outline__close" type="button" :aria-label="t('outline.close')" @click="emit('close')">×</button>
    </div>
    <p v-if="items.length === 0" class="outline__empty">{{ t('outline.empty') }}</p>
    <ol v-else class="outline__list">
      <li v-for="(item, i) in items" :key="`${i}-${item.pos}`">
        <button
          type="button"
          class="outline__item"
          :class="[`outline__item--l${item.level}`, { 'is-active': i === active }]"
          :style="{ paddingLeft: `${12 + (item.level - minLevel) * 14}px` }"
          :aria-current="i === active ? 'location' : undefined"
          @click="emit('select', i)"
        >
          {{ item.text || t('outline.untitled') }}
        </button>
      </li>
    </ol>
  </nav>
</template>
