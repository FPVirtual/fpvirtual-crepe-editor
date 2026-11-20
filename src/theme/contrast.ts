// Contraste WCAG 2.x (sin dependencias). Solo admite colores #rgb / #rrggbb,
// que son los que usan los tokens de color de texto y fondo.

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function parseHex(color: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) throw new Error(`Color no admitido para contraste: ${color}`)
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

export function luminance(color: string): number {
  const [r, g, b] = parseHex(color).map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
