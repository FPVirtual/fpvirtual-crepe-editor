<script setup lang="ts">
// Logo del centro + título de la app (configurables en src/branding.ts).
import { branding } from '../branding'

defineProps<{ subtitle?: string }>()
</script>

<template>
  <component :is="branding.link ? 'a' : 'div'" class="brand" :href="branding.link">
    <template v-if="branding.logo">
      <img
        class="brand__logo"
        :class="{ 'brand__logo--light': branding.logoDark }"
        :src="branding.logo"
        :alt="branding.logoAlt"
      />
      <img v-if="branding.logoDark" class="brand__logo brand__logo--dark" :src="branding.logoDark" :alt="branding.logoAlt" />
    </template>
    <span class="brand__title">{{ branding.title }}</span>
    <span v-if="subtitle" class="brand__subtitle">{{ subtitle }}</span>
  </component>
</template>
