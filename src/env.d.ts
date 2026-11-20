/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND_TITLE?: string
  readonly VITE_BRAND_LOGO?: string
  readonly VITE_BRAND_LOGO_DARK?: string
  readonly VITE_BRAND_LOGO_ALT?: string
  readonly VITE_BRAND_LINK?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
