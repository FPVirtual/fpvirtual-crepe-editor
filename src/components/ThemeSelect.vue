<script setup lang="ts">
// Tema de colores con iconos (automático, verde, oscuro, alto contraste):
// grupo de opciones accesible (radiogroup); flechas para moverse.
import { t } from '../i18n'
import { THEMES } from '../theme/themes'
import type { ThemePreference } from '../theme/runtime'
import { useTheme } from '../theme/useTheme'
import AppIcon, { type IconName } from './AppIcon.vue'

const { preference } = useTheme()

const ICON: Record<string, IconName> = { auto: 'auto', verde: 'sun', oscuro: 'moon', contraste: 'contrast' }

const options: { id: ThemePreference; label: string; icon: IconName }[] = [
  { id: 'auto', label: t('theme.auto'), icon: 'auto' },
  ...THEMES.map((th) => ({ id: th.id as ThemePreference, label: t(th.label), icon: ICON[th.id] ?? 'sun' })),
]

function move(event: KeyboardEvent, step: number): void {
  const index = options.findIndex((o) => o.id === preference.value)
  const next = options[(index + step + options.length) % options.length]
  preference.value = next.id
  const group = (event.currentTarget as HTMLElement).parentElement
  group?.querySelector<HTMLElement>(`[data-theme-option="${next.id}"]`)?.focus()
}
</script>

<template>
  <div class="icon-group" role="radiogroup" :aria-label="t('theme.label')">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      class="icon-btn"
      role="radio"
      :data-theme-option="option.id"
      :aria-checked="preference === option.id"
      :aria-label="option.label"
      :title="option.label"
      :tabindex="preference === option.id ? 0 : -1"
      @click="preference = option.id"
      @keydown.right.prevent="move($event, 1)"
      @keydown.down.prevent="move($event, 1)"
      @keydown.left.prevent="move($event, -1)"
      @keydown.up.prevent="move($event, -1)"
    >
      <AppIcon :name="option.icon" />
    </button>
  </div>
</template>
