// Imágenes del material en el editor (roadmap docs/imagenes del plugin).
//
// El Markdown guarda rutas relativas al material (`img/esquema.png`), igual
// que en Git. Para verlas, el editor pide los bytes a Moodle con
// `POST asset.php {token, path}` (el token nunca en una URL) y las muestra
// como `blob:`: Crepe llama a `display` (su `proxyDomURL`) con la ruta del
// Markdown y pinta la URL que devuelve.

/** Pide los bytes de una imagen del material (`null` si no existe o falla). */
export type FetchAsset = (path: string) => Promise<Blob | null>

/** ¿La URL es absoluta o ya se puede mostrar tal cual (http, data:, blob:…)? */
export function isExternal(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('/')
}

/** Ruta relativa normalizada como clave (sin `./`, consulta ni fragmento). */
export function normalizePath(url: string): string {
  return url.split('#')[0].split('?')[0].replace(/^(\.\/)+/, '')
}

export class ImageStore {
  readonly #fetchAsset: FetchAsset | null
  readonly #cache = new Map<string, Promise<string>>()

  constructor(fetchAsset: FetchAsset | null) {
    this.#fetchAsset = fetchAsset
  }

  /** URL para pintar una imagen del Markdown. */
  display(url: string): string | Promise<string> {
    if (!url || isExternal(url) || !this.#fetchAsset) return url
    const key = normalizePath(url)
    let entry = this.#cache.get(key)
    if (!entry) {
      const fetchAsset = this.#fetchAsset
      entry = fetchAsset(key).then((blob) => (blob ? URL.createObjectURL(blob) : url))
      this.#cache.set(key, entry)
      // Un fallo no se cachea: se reintentará al volver a pintar.
      void entry.then((shown) => {
        if (shown === url) this.#cache.delete(key)
      })
    }
    return entry
  }

  /** Libera las URL `blob:` (al cambiar de material). */
  dispose(): void {
    for (const entry of this.#cache.values()) {
      void entry.then((shown) => {
        if (shown.startsWith('blob:')) URL.revokeObjectURL(shown)
      })
    }
    this.#cache.clear()
  }
}
