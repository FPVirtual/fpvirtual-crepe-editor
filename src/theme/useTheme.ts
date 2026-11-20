// Puente Vue del controlador de tema: preferencia reactiva para el selector.

import { inject, ref, watch, type InjectionKey, type Ref } from 'vue'

import type { ThemeController, ThemePreference } from './runtime'

export const themeKey: InjectionKey<ThemeController> = Symbol('theme')

export function useTheme(): { preference: Ref<ThemePreference> } {
  const controller = inject(themeKey, null)
  const preference = ref<ThemePreference>(controller?.preference ?? 'auto')
  watch(preference, (next) => controller?.set(next))
  return { preference }
}
