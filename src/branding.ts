// Marca del editor: logo del centro y título de la aplicación.
//
// Para personalizarla hay dos vías, sin tocar componentes:
//   1. Editar los valores por defecto de este fichero.
//   2. Definir variables al compilar (p. ej. en `.env.local`):
//        VITE_BRAND_TITLE      título de la aplicación
//        VITE_BRAND_LOGO       URL o ruta del logo (relativa a public/, o absoluta)
//        VITE_BRAND_LOGO_DARK  logo alternativo para temas oscuros (opcional)
//        VITE_BRAND_LOGO_ALT   texto alternativo del logo
//        VITE_BRAND_LINK       enlace al pulsar el logo (opcional)
//
// Sin logo oscuro propio, en los temas oscuros el logo se muestra sobre una
// placa clara (token --md-color-logo-bg) para que siga siendo legible.

export interface Branding {
  title: string
  logo?: string
  logoDark?: string
  logoAlt: string
  link?: string
}

const env = import.meta.env
const value = (v: string | undefined): string | undefined => (v && v.trim() ? v.trim() : undefined)

export const branding: Branding = {
  title: value(env.VITE_BRAND_TITLE) ?? 'Editor Materiales v2',
  logo: value(env.VITE_BRAND_LOGO) ?? './branding/logo.png',
  logoDark: value(env.VITE_BRAND_LOGO_DARK),
  logoAlt: value(env.VITE_BRAND_LOGO_ALT) ?? 'FP Virtual Aragón',
  link: value(env.VITE_BRAND_LINK),
}
