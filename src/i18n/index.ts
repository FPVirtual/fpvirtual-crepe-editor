import { es } from './es'

const messages = es

/** Traduce una clave con interpolación `{nombre}`; devuelve la clave si falta. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const template = messages[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}
