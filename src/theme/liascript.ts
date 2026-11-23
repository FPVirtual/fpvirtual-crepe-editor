// Tema del editor → CSS para el runtime de LiaScript (contenidos exportados).
//
// Los contenidos publicados (SCORM, H5P, PDF, ePub) los renderiza LiaScript,
// no el editor. Este módulo traduce un tema del editor a una hoja que el
// engine añade al exportar (`link:` en la cabecera; en ePub, dentro de su
// style.css), para que el alumnado vea el mismo aspecto que el profesorado.
//
// - Colores: LiaScript usa variables con triples «r, g, b»
//   (--color-highlight…). Se fuerzan con !important para que el color que el
//   lector elija en los ajustes del reproductor no las sustituya.
// - Fuentes: valores literales (no var()), porque muchos lectores de ePub no
//   entienden variables CSS; así una sola hoja sirve para todos los formatos.
//
// Exportación: `npm run theme:liascript` (scripts/export-liascript-theme.mjs).

import { parseHex } from './contrast'
import type { ThemeDefinition } from './themes'
import { DEFAULT_TYPOGRAPHY } from './tokens'

/** Triple «r, g, b» como lo usan las variables de LiaScript. */
const channels = (hex: string): string => parseHex(hex).join(', ')

/** Color un 25 % más oscuro (variante «dark» del acento de LiaScript). */
function darker(hex: string): string {
  return parseHex(hex)
    .map((c) => Math.round(c * 0.75))
    .join(', ')
}

/**
 * Hoja CSS de LiaScript para un tema del editor.
 *
 * @throws si el tema es oscuro: LiaScript pinta los contenidos sobre su
 *   propio fondo claro y un tema oscuro del editor no tendría contraste.
 */
export function liascriptThemeCss(theme: ThemeDefinition): string {
  if (theme.dark) throw new Error(`El tema «${theme.id}» es oscuro: no sirve para los contenidos exportados`)
  const c = theme.colors
  const type = { ...DEFAULT_TYPOGRAPHY, ...theme.typography }
  const accent = c['primary-fill'] // fondo de botones con texto blanco (AA garantizado por los tests del tema)
  const h2Border = theme.flags.h2BorderWidth
  const underline = theme.flags.linkUnderline === 'always'

  return `/* Tema «${theme.id}» del editor FP Virtual para el runtime de LiaScript.
 * Generado desde fpvirtual-crepe-editor (src/theme/liascript.ts) con
 * «npm run theme:liascript». No editar a mano. */

:root,
[class*="lia-theme-"] {
  --color-highlight: ${channels(accent)} !important;
  --color-highlight-dark: ${darker(accent)} !important;
  --color-highlight-menu: ${channels(accent)} !important;
  --color-text: ${channels(c.text)} !important;
  --color-border: ${channels(c.border)} !important;
  --global-font-family: ${type['font-body']} !important;
  --global-font-headline: ${type['font-title']} !important;
  --global-font-mono: ${type['font-code']} !important;
}

body, .lia-canvas {
  font-family: ${type['font-body']};
}

h1, h2, h3, h4, h5, h6, .lia-accordion__headline, .lia-card__subtitle {
  font-family: ${type['font-title']} !important;
  font-weight: ${type['heading-weight']} !important;
  color: ${c.heading};
}

.lia-code, code, pre, kbd, samp {
  font-family: ${type['font-code']} !important;
}

h2 {
  border-bottom: ${h2Border} solid ${c.border};
  padding-bottom: .3em;
}

a {
  color: ${c['primary-text']};
  text-decoration: ${underline ? 'underline' : 'none'};
}

a:hover {
  text-decoration: underline;
}
`
}
