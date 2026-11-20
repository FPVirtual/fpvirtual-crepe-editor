// Capa 2 — SEMÁNTICA: qué significa cada color, no qué valor tiene.
//
// Convención de nombres:
//   --md-color-<rol>[-<variante>]   colores (todos obligatorios en cada tema)
//   --md-syntax-<categoría>          resaltado de código
//   --md-<propiedad>                 tipografía, forma y flags
//
// Cada tema rellena TODOS los tokens de color; la tipografía tiene valores
// por defecto (estética vuepress-theme-hope) que un tema puede sobrescribir.

export const COLOR_TOKENS = [
  // Superficies
  'bg', // fondo de la página, alrededor del documento
  'surface', // fondo del documento, barra superior, diálogos
  'surface-muted', // menús, bloques de código, cabeceras de tabla
  'surface-sunken', // áreas hundidas (inputs de búsqueda, chips)
  'logo-bg', // placa tras el logo del centro (clara también en temas oscuros)
  'hover', // fondo al pasar el ratón
  'selection', // selección de texto y elementos seleccionados
  // Texto
  'text',
  'text-muted',
  'heading',
  // Bordes
  'border', // separadores decorativos (borde del h2, tablas)
  'border-strong', // bordes de controles: deben verse (3:1)
  // Acento
  'primary', // acento decorativo (marcas, bordes activos)
  'primary-text', // acento como texto: enlaces, estados activos
  'primary-fill', // fondo de botones primarios
  'on-primary', // texto sobre primary-fill
  'primary-soft', // tinte suave del acento
  'focus', // anillo de foco
  // Inverso (tooltips)
  'inverse',
  'on-inverse',
  // Código
  'code-text',
  'code-bg',
  // Estados
  'danger',
  'danger-soft',
  'danger-border',
  'warning',
  'warning-soft',
  'warning-border',
  'success',
  'success-soft',
  'success-border',
  'info',
  'info-soft',
  'info-border',
  // Bloques LiaScript protegidos (tarjetas no editables)
  'special',
  'special-soft',
  'special-border',
] as const

export const SYNTAX_TOKENS = ['keyword', 'string', 'number', 'comment', 'function', 'type', 'meta'] as const

export const TYPE_TOKENS = [
  'font-body',
  'font-title',
  'font-code',
  'font-size-base',
  'line-height',
  'heading-weight',
  'font-size-h1',
  'font-size-h2',
  'font-size-h3',
  'font-size-h4',
  'font-size-h5',
  'font-size-h6',
  'radius',
  'shadow-1',
  'shadow-2',
  'backdrop',
] as const

export type ColorToken = (typeof COLOR_TOKENS)[number]
export type SyntaxToken = (typeof SYNTAX_TOKENS)[number]
export type TypeToken = (typeof TYPE_TOKENS)[number]

/** Tipografía por defecto: la de vuepress-theme-hope. */
export const DEFAULT_TYPOGRAPHY: Omit<Record<TypeToken, string>, 'shadow-1' | 'shadow-2' | 'backdrop'> = {
  'font-body':
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  'font-title':
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  'font-code': "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', ui-monospace, monospace",
  'font-size-base': '16px',
  'line-height': '1.7',
  'heading-weight': '600',
  'font-size-h1': '2.2em',
  'font-size-h2': '1.65em',
  'font-size-h3': '1.35em',
  'font-size-h4': '1.15em',
  'font-size-h5': '1.05em',
  'font-size-h6': '1em',
  radius: '6px',
}

/**
 * Pares texto/fondo que deben cumplir contraste. `text` exige 4,5:1 (AA) o
 * 7:1 (AAA en temas de contraste); `ui` (bordes de controles, foco) 3:1.
 */
export interface ContrastPair {
  fg: ColorToken | `syntax-${SyntaxToken}`
  bg: ColorToken
  kind: 'text' | 'ui'
}

const text = (fg: ContrastPair['fg'], ...bgs: ColorToken[]): ContrastPair[] =>
  bgs.map((bg) => ({ fg, bg, kind: 'text' }))
const ui = (fg: ContrastPair['fg'], ...bgs: ColorToken[]): ContrastPair[] =>
  bgs.map((bg) => ({ fg, bg, kind: 'ui' }))

export const CONTRAST_PAIRS: ContrastPair[] = [
  ...text('text', 'bg', 'surface', 'surface-muted', 'surface-sunken', 'hover', 'selection', 'primary-soft'),
  ...text('heading', 'surface'),
  ...text('text-muted', 'bg', 'surface', 'surface-muted', 'surface-sunken'),
  ...text('primary-text', 'bg', 'surface', 'surface-muted', 'primary-soft'),
  ...text('on-primary', 'primary-fill'),
  ...text('on-inverse', 'inverse'),
  ...text('code-text', 'code-bg'),
  ...text('danger', 'surface', 'danger-soft'),
  ...text('warning', 'warning-soft'),
  ...text('success', 'success-soft'),
  ...text('info', 'info-soft'),
  ...text('special', 'special-soft'),
  ...text('text', 'danger-soft', 'warning-soft', 'success-soft', 'info-soft', 'special-soft'),
  ...SYNTAX_TOKENS.flatMap((s) => text(`syntax-${s}`, 'surface-muted')),
  ...ui('border-strong', 'surface', 'bg'),
  ...ui('focus', 'surface', 'bg'),
  ...ui('primary-fill', 'surface'),
]
