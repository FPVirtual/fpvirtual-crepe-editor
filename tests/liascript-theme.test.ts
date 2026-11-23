// Tema del editor → CSS de LiaScript para los contenidos exportados.

import { describe, expect, it } from 'vitest'

import { contrastRatio, parseHex } from '../src/theme/contrast'
import { liascriptThemeCss } from '../src/theme/liascript'
import { contraste, oscuro, verde } from '../src/theme/themes'
import { DEFAULT_TYPOGRAPHY } from '../src/theme/tokens'

const triple = (hex: string) => parseHex(hex).join(', ')

describe('CSS de LiaScript del tema verde', () => {
  const css = liascriptThemeCss(verde)

  it('el acento de LiaScript es el de los botones del editor, forzado', () => {
    expect(css).toContain(`--color-highlight: ${triple(verde.colors['primary-fill'])} !important;`)
    expect(css).toContain(`--color-text: ${triple(verde.colors.text)} !important;`)
  })

  it('el acento admite texto blanco encima (WCAG AA), como lo usa LiaScript', () => {
    expect(contrastRatio(verde.colors['primary-fill'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('tipografía del editor con valores literales (sirve también para ePub)', () => {
    expect(css).toContain(`font-family: ${DEFAULT_TYPOGRAPHY['font-title']} !important;`)
    expect(css).toContain(`font-family: ${DEFAULT_TYPOGRAPHY['font-code']} !important;`)
    // Fuera del bloque de variables no hay var(): los lectores de ePub no las entienden.
    const rules = css.slice(css.indexOf('}') + 1)
    expect(rules).not.toMatch(/var\(/)
  })

  it('rasgos del tema: borde inferior de h2 y enlaces', () => {
    expect(css).toContain(`border-bottom: ${verde.flags.h2BorderWidth} solid ${verde.colors.border};`)
    expect(css).toContain(`color: ${verde.colors['primary-text']};`)
  })

  it('no filtra variables internas del editor', () => {
    expect(css).not.toContain('--md-')
  })
})

describe('otros temas', () => {
  it('contraste genera su CSS', () => {
    expect(liascriptThemeCss(contraste)).toContain('--color-highlight:')
  })

  it('un tema oscuro no sirve para los contenidos', () => {
    expect(() => liascriptThemeCss(oscuro)).toThrow(/oscuro/)
  })
})
