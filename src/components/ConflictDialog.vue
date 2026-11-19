<script setup lang="ts">
// Conflicto 409 (D5): el trabajo del usuario ya está a salvo en una rama de
// resolución; se ofrecen las tres salidas del contrato.
import { onMounted, ref } from 'vue'

import { t } from '../i18n'

defineProps<{ resolutionBranch?: string; diffUrl?: string }>()
const emit = defineEmits<{ reload: []; force: []; cancel: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)

onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="conflict-title" @cancel.prevent="emit('cancel')">
    <h2 id="conflict-title">{{ t('conflict.title') }}</h2>
    <p>
      {{ resolutionBranch ? t('conflict.body', { branch: resolutionBranch }) : t('conflict.bodyNoBranch') }}
    </p>
    <div class="dialog__actions">
      <a v-if="diffUrl" class="btn" :href="diffUrl" target="_blank" rel="noopener noreferrer">
        {{ t('conflict.diff') }}
      </a>
      <button class="btn" type="button" :title="t('conflict.reloadHint')" @click="emit('reload')">
        {{ t('conflict.reload') }}
      </button>
      <button class="btn btn--danger" type="button" :title="t('conflict.forceHint')" @click="emit('force')">
        {{ t('conflict.force') }}
      </button>
      <button class="btn btn--primary" type="button" @click="emit('cancel')">{{ t('conflict.cancel') }}</button>
    </div>
  </dialog>
</template>
