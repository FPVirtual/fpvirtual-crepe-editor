// Aplicación del tema en el navegador: inyecta los tokens de todos los temas,
// marca el activo en <html data-theme> (+ clase `.dark`) y recuerda la
// preferencia del usuario.
//
// Preferencia inicial: `?theme=<id>` en la URL > la guardada > «auto».
// En «auto» se sigue al sistema: `prefers-contrast: more` → contraste,
// `prefers-color-scheme: dark` → oscuro, si no → verde. Y se reacciona a
// los cambios del sistema mientras siga en «auto».

import { themesToCss } from './generate'
import { DEFAULT_THEME_ID, findTheme, THEMES, type ThemeDefinition } from './themes'

export type ThemePreference = 'auto' | string

const STORAGE_KEY = 'md-theme'
const STYLE_ID = 'md-theme-tokens'
const QUERIES = {
  contrast: '(prefers-contrast: more)',
  dark: '(prefers-color-scheme: dark)',
} as const

function media(query: string): MediaQueryList | undefined {
  return typeof matchMedia === 'function' ? matchMedia(query) : undefined
}

/** Tema que corresponde a la preferencia del sistema. */
export function systemThemeId(prefersContrast: boolean, prefersDark: boolean): string {
  if (prefersContrast) return 'contraste'
  if (prefersDark) return 'oscuro'
  return DEFAULT_THEME_ID
}

export function resolveTheme(preference: ThemePreference): ThemeDefinition {
  const id =
    preference === 'auto'
      ? systemThemeId(Boolean(media(QUERIES.contrast)?.matches), Boolean(media(QUERIES.dark)?.matches))
      : preference
  return findTheme(id) ?? findTheme(DEFAULT_THEME_ID)!
}

function readStored(): ThemePreference | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(preference: ThemePreference): void {
  try {
    if (preference === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Sin almacenamiento (iframe, modo privado): la elección dura la sesión.
  }
}

function isValid(preference: string | null): preference is ThemePreference {
  return preference === 'auto' || Boolean(findTheme(preference))
}

export function injectThemeTokens(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = themesToCss(THEMES)
  doc.head.prepend(style)
}

export function applyTheme(theme: ThemeDefinition, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme.id
  root.classList.toggle('dark', theme.dark)
}

export interface ThemeController {
  readonly preference: ThemePreference
  readonly active: ThemeDefinition
  set: (preference: ThemePreference) => void
}

/** Inicializa el tema antes de montar la app (evita el parpadeo). */
export function initTheme(search: string = location.search): ThemeController {
  injectThemeTokens()

  const fromUrl = new URLSearchParams(search).get('theme')
  const stored = readStored()
  let preference: ThemePreference = isValid(fromUrl) ? fromUrl : isValid(stored) ? stored : 'auto'
  let active = resolveTheme(preference)
  applyTheme(active)

  const onSystemChange = (): void => {
    if (preference !== 'auto') return
    active = resolveTheme('auto')
    applyTheme(active)
  }
  for (const query of Object.values(QUERIES)) media(query)?.addEventListener?.('change', onSystemChange)

  return {
    get preference() {
      return preference
    },
    get active() {
      return active
    },
    set(next) {
      if (!isValid(next)) return
      preference = next
      writeStored(next)
      active = resolveTheme(next)
      applyTheme(active)
    },
  }
}
