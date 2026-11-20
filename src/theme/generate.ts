// Tema (datos) → variables CSS `--md-*`. Es la única traducción de los datos
// a CSS; el mapeo `--md-*` → `--crepe-*` vive en hope.css.

import type { ThemeDefinition } from './themes'
import { COLOR_TOKENS, DEFAULT_TYPOGRAPHY, SYNTAX_TOKENS, TYPE_TOKENS } from './tokens'

export function themeVariables(theme: ThemeDefinition): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const token of COLOR_TOKENS) vars[`--md-color-${token}`] = theme.colors[token]
  for (const token of SYNTAX_TOKENS) vars[`--md-syntax-${token}`] = theme.syntax[token]
  const typography: Partial<Record<string, string>> = { ...DEFAULT_TYPOGRAPHY, ...theme.typography }
  for (const token of TYPE_TOKENS) {
    const value = typography[token]
    if (value === undefined) throw new Error(`El tema «${theme.id}» no define --md-${token}`)
    vars[`--md-${token}`] = value
  }
  const always = theme.flags.linkUnderline === 'always'
  vars['--md-link-decoration'] = always ? 'underline' : 'none'
  vars['--md-h2-border-width'] = theme.flags.h2BorderWidth
  vars['--md-focus-width'] = theme.flags.focusWidth
  return vars
}

/** Bloque CSS de un tema, activo cuando `<html data-theme="id">`. */
export function themeToCss(theme: ThemeDefinition): string {
  const body = Object.entries(themeVariables(theme))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
  return `:root[data-theme='${theme.id}'] {\n  color-scheme: ${theme.dark ? 'dark' : 'light'};\n${body}\n}\n`
}

export function themesToCss(themes: readonly ThemeDefinition[]): string {
  return themes.map(themeToCss).join('\n')
}
