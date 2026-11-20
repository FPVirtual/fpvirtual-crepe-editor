<script setup lang="ts">
// Ejemplo de código LiaScript con botón «Copiar».
import { ref } from 'vue'

const props = defineProps<{ code: string; label?: string }>()
const copied = ref(false)

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // Sin permiso de portapapeles: el texto sigue seleccionable a mano.
  }
}
</script>

<template>
  <figure class="sample">
    <figcaption v-if="label" class="sample__label">{{ label }}</figcaption>
    <pre class="sample__code"><code>{{ code }}</code></pre>
    <button class="sample__copy" type="button" @click="copy">
      <span aria-live="polite">{{ copied ? 'Copiado' : 'Copiar' }}</span>
    </button>
  </figure>
</template>
