<script setup lang="ts">
// Selector de tema de colores (automático, verde, oscuro, contraste).
import { t } from '../i18n'
import { THEMES } from '../theme/themes'
import { useTheme } from '../theme/useTheme'

const { preference } = useTheme()
</script>

<template>
  <label class="visually-hidden" for="theme-select">{{ t('theme.label') }}</label>
  <select id="theme-select" v-model="preference" class="select" :title="t('theme.label')">
    <option value="auto">{{ t('theme.auto') }}</option>
    <option v-for="th in THEMES" :key="th.id" :value="th.id">{{ t(th.label) }}</option>
  </select>
</template>
