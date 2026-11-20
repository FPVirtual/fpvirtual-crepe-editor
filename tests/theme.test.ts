// Sistema de temas: contraste WCAG, prohibición de colores literales en
// componentes, coherencia tokens ↔ CSS y aplicación en tiempo de ejecución.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { contrastRatio } from '../src/theme/contrast'
import { themesToCss, themeVariables } from '../src/theme/generate'
import { applyTheme, initTheme, systemThemeId } from '../src/theme/runtime'
import { contraste, findTheme, oscuro, THEMES, verde, type ThemeDefinition } from '../src/theme/themes'
import { COLOR_TOKENS, CONTRAST_PAIRS, SYNTAX_TOKENS, type ContrastPair } from '../src/theme/tokens'

const SRC = join(process.cwd(), 'src')
const PALETTE = join(SRC, 'theme', 'palette.ts')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function colorOf(theme: ThemeDefinition, token: ContrastPair['fg']): string {
  return token.startsWith('syntax-')
    ? theme.syntax[token.slice('syntax-'.length) as (typeof SYNTAX_TOKENS)[number]]
    : theme.colors[token as (typeof COLOR_TOKENS)[number]]
}

function minimum(theme: ThemeDefinition, kind: ContrastPair['kind']): number {
  if (kind === 'ui') return theme.contrast === 'AAA' ? 4.5 : 3
  return theme.contrast === 'AAA' ? 7 : 4.5
}

describe('temas', () => {
  it('incluye verde (por defecto), oscuro y contraste', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['verde', 'oscuro', 'contraste'])
    expect(oscuro.dark).toBe(true)
    expect(verde.dark || contraste.dark).toBe(false)
  })

  it.each(THEMES.map((t) => [t.id, t] as const))('%s define todos los tokens', (_id, theme) => {
    for (const token of COLOR_TOKENS) expect(theme.colors[token], token).toMatch(/^#[0-9a-f]{6}$/i)
    for (const token of SYNTAX_TOKENS) expect(theme.syntax[token], token).toMatch(/^#[0-9a-f]{6}$/i)
    expect(() => themeVariables(theme)).not.toThrow()
  })
})

describe('contraste WCAG', () => {
  for (const theme of THEMES) {
    it(`${theme.id} cumple ${theme.contrast} en todos los pares`, () => {
      const failures = CONTRAST_PAIRS.flatMap((pair) => {
        const ratio = contrastRatio(colorOf(theme, pair.fg), colorOf(theme, pair.bg))
        const min = minimum(theme, pair.kind)
        return ratio < min ? [`${pair.fg} / ${pair.bg}: ${ratio.toFixed(2)} < ${min}`] : []
      })
      expect(failures).toEqual([])
    })
  }

  it('calcula ratios conocidos', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#3eaf7c', '#ffffff')).toBeLessThan(4.5) // el verde hope no vale para texto
  })
})

describe('capas de tokens', () => {
  const files = walk(SRC).filter((f) => /\.(css|vue|ts)$/.test(f) && f !== PALETTE)

  it('ningún componente usa colores literales (solo src/theme/palette.ts)', () => {
    const hex = /(?<![\w&-])#[0-9a-f]{3,8}\b/gi
    const fn = /\b(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab)\(/gi
    const named = /:\s*[^;{}]*\b(?:white|black|red|green|blue|gray|grey)\b/gi
    const offences = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')
      const found = [...(text.match(hex) ?? []), ...(text.match(fn) ?? [])]
      if (file.endsWith('.css')) found.push(...(text.match(named) ?? []))
      return found.map((m) => `${relative(process.cwd(), file)}: ${m.trim()}`)
    })
    expect(offences).toEqual([])
  })

  it('todo var(--md-*) usado en CSS y componentes existe en los temas', () => {
    const defined = new Set(Object.keys(themeVariables(verde)))
    const used = new Set(
      files.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/var\((--md-[\w-]+)\)/g)].map((m) => m[1])),
    )
    expect([...used].filter((name) => !defined.has(name))).toEqual([])
  })

  it('todos los temas generan el mismo conjunto de variables', () => {
    const keys = (t: ThemeDefinition) => Object.keys(themeVariables(t)).sort()
    for (const theme of THEMES) expect(keys(theme)).toEqual(keys(verde))
  })

  it('genera un bloque por tema con su color-scheme', () => {
    const css = themesToCss(THEMES)
    expect(css).toContain(":root[data-theme='verde'] {\n  color-scheme: light;")
    expect(css).toContain(":root[data-theme='oscuro'] {\n  color-scheme: dark;")
    expect(css).toContain('--md-color-primary-text: #2a7d57;')
    expect(css).toContain('--md-link-decoration: none;')
  })
})

describe('aplicación del tema', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.classList.remove('dark')
    document.getElementById('md-theme-tokens')?.remove()
  })

  it('sigue al sistema en «auto»', () => {
    expect(systemThemeId(false, false)).toBe('verde')
    expect(systemThemeId(false, true)).toBe('oscuro')
    expect(systemThemeId(true, true)).toBe('contraste')
  })

  it('marca el tema en <html> y conmuta .dark', () => {
    applyTheme(oscuro)
    expect(document.documentElement.dataset.theme).toBe('oscuro')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyTheme(verde)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('inyecta los tokens una vez, respeta ?theme= y recuerda la elección', () => {
    const theme = initTheme('?theme=contraste')
    expect(document.querySelectorAll('#md-theme-tokens')).toHaveLength(1)
    expect(theme.active.id).toBe('contraste')

    theme.set('oscuro')
    expect(localStorage.getItem('md-theme')).toBe('oscuro')
    expect(initTheme('').active.id).toBe('oscuro')
    expect(document.querySelectorAll('#md-theme-tokens')).toHaveLength(1)

    theme.set('auto')
    expect(localStorage.getItem('md-theme')).toBeNull()
    theme.set('inexistente')
    expect(theme.preference).toBe('auto')
    expect(findTheme('inexistente')).toBeUndefined()
  })
})
