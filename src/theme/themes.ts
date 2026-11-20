// Temas como datos: cada tema asigna un valor de la PALETA a cada token
// SEMÁNTICO, y declara flags de estilo. El CSS se genera en generate.ts.

import { palette as p } from './palette'
import type { ColorToken, SyntaxToken, TypeToken } from './tokens'

export interface ThemeFlags {
  /** Subrayado de enlaces: solo al pasar el ratón (hope) o siempre. */
  linkUnderline: 'hover' | 'always'
  /** Grosor del borde inferior de los h2 (`0` lo quita). */
  h2BorderWidth: string
  /** Grosor del anillo de foco. */
  focusWidth: string
}

export interface ThemeDefinition {
  id: string
  /** Clave i18n del nombre visible. */
  label: string
  /** Activa la clase `.dark` y `color-scheme: dark`. */
  dark: boolean
  /** Nivel de contraste exigido por los tests: AA (4,5:1) o AAA (7:1). */
  contrast: 'AA' | 'AAA'
  colors: Record<ColorToken, string>
  syntax: Record<SyntaxToken, string>
  /** Sobrescribe la tipografía por defecto (DEFAULT_TYPOGRAPHY). */
  typography?: Partial<Record<TypeToken, string>>
  flags: ThemeFlags
}

/** Verde (claro): estética vuepress-theme-hope. Tema por defecto. */
export const verde: ThemeDefinition = {
  id: 'verde',
  label: 'theme.verde',
  dark: false,
  contrast: 'AA',
  colors: {
    bg: p.neutral[50],
    surface: p.white,
    'surface-muted': p.neutral[50],
    'surface-sunken': p.neutral[100],
    'logo-bg': p.white,
    hover: p.neutral[100],
    selection: p.green[100],
    text: p.neutral[800],
    'text-muted': p.neutral[500],
    heading: p.neutral[800],
    border: p.neutral[200],
    'border-strong': p.neutral[400],
    primary: p.green[500],
    'primary-text': p.green[700],
    'primary-fill': p.green[700],
    'on-primary': p.white,
    'primary-soft': p.green[50],
    focus: p.green[700],
    inverse: p.neutral[800],
    'on-inverse': p.white,
    'code-text': p.neutral[800],
    'code-bg': p.neutral[100],
    danger: p.red[700],
    'danger-soft': p.red[50],
    'danger-border': p.red[200],
    warning: p.amber[800],
    'warning-soft': p.amber[50],
    'warning-border': p.amber[200],
    success: p.green[800],
    'success-soft': p.green[50],
    'success-border': p.green[500],
    info: p.blue[700],
    'info-soft': p.blue[50],
    'info-border': p.blue[200],
    special: p.violet[600],
    'special-soft': p.violet[50],
    'special-border': p.violet[600],
  },
  syntax: { ...p.syntaxLight },
  typography: { 'shadow-1': p.shadow.light1, 'shadow-2': p.shadow.light2, backdrop: p.backdrop.light },
  flags: { linkUnderline: 'hover', h2BorderWidth: '1px', focusWidth: '2px' },
}

/** Oscuro: misma identidad verde sobre grises nocturnos. */
export const oscuro: ThemeDefinition = {
  id: 'oscuro',
  label: 'theme.oscuro',
  dark: true,
  contrast: 'AA',
  colors: {
    bg: p.night[950],
    surface: p.night[900],
    'surface-muted': p.night[850],
    'surface-sunken': p.night[800],
    'logo-bg': p.night[200],
    hover: p.night[800],
    selection: p.greenDim,
    text: p.night[300],
    'text-muted': p.night[400],
    heading: p.night[200],
    border: p.night[700],
    'border-strong': p.night[600],
    primary: p.green[500],
    'primary-text': p.green[400],
    'primary-fill': p.green[400],
    'on-primary': p.night[950],
    'primary-soft': p.greenDim,
    focus: p.green[400],
    inverse: p.night[200],
    'on-inverse': p.night[950],
    'code-text': p.night[200],
    'code-bg': p.night[800],
    danger: p.red[300],
    'danger-soft': p.red.dim,
    'danger-border': p.red[700],
    warning: p.amber[300],
    'warning-soft': p.amber.dim,
    'warning-border': p.amber[800],
    success: p.green[300],
    'success-soft': p.greenDim,
    'success-border': p.green[600],
    info: p.blue[300],
    'info-soft': p.blue.dim,
    'info-border': p.blue[700],
    special: p.violet[300],
    'special-soft': p.violet.dim,
    'special-border': p.violet[600],
  },
  syntax: { ...p.syntaxDark },
  typography: { 'shadow-1': p.shadow.dark1, 'shadow-2': p.shadow.dark2, backdrop: p.backdrop.dark },
  flags: { linkUnderline: 'hover', h2BorderWidth: '1px', focusWidth: '2px' },
}

/**
 * Contraste: para baja visión. Texto negro sobre blanco, AAA (7:1), enlaces
 * siempre subrayados, foco grueso, letra mayor y títulos más marcados.
 */
export const contraste: ThemeDefinition = {
  id: 'contraste',
  label: 'theme.contraste',
  dark: false,
  contrast: 'AAA',
  colors: {
    bg: p.white,
    surface: p.white,
    'surface-muted': p.gray[50],
    'surface-sunken': p.gray[100],
    'logo-bg': p.white,
    hover: p.gray[100],
    selection: p.amber[400],
    text: p.black,
    'text-muted': p.gray[800],
    heading: p.black,
    border: p.black,
    'border-strong': p.black,
    primary: p.green[900],
    'primary-text': p.green[950],
    'primary-fill': p.green[950],
    'on-primary': p.white,
    'primary-soft': p.green[50],
    focus: p.black,
    inverse: p.black,
    'on-inverse': p.white,
    'code-text': p.black,
    'code-bg': p.gray[100],
    danger: p.red[900],
    'danger-soft': p.red[50],
    'danger-border': p.red[900],
    warning: p.amber[900],
    'warning-soft': p.amber[50],
    'warning-border': p.amber[900],
    success: p.green[950],
    'success-soft': p.green[50],
    'success-border': p.green[950],
    info: p.blue[900],
    'info-soft': p.blue[50],
    'info-border': p.blue[900],
    special: p.violet[900],
    'special-soft': p.violet[50],
    'special-border': p.violet[900],
  },
  syntax: { ...p.syntaxContrast },
  typography: {
    'font-size-base': '18px',
    'heading-weight': '700',
    'shadow-1': p.shadow.strong,
    'shadow-2': p.shadow.strong,
    backdrop: p.backdrop.dark,
  },
  flags: { linkUnderline: 'always', h2BorderWidth: '2px', focusWidth: '3px' },
}

export const THEMES: readonly ThemeDefinition[] = [verde, oscuro, contraste]
export const DEFAULT_THEME_ID = verde.id

export function findTheme(id: string | null | undefined): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id)
}
