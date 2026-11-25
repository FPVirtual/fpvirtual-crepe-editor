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

/** Imagen subida que aún no está en Git (viaja con el próximo guardado). */
export interface PendingImage {
  path: string
  blob: Blob
}

/** ¿El Markdown referencia la ruta (`](img/x.png` o `](./img/x.png`)? */
export function referenced(markdown: string, path: string): boolean {
  return markdown.includes(`](${path}`) || markdown.includes(`](./${path}`)
}

/**
 * Imágenes del Markdown sin texto alternativo (`![](ruta)`), fuera del código.
 * Un bloque de imagen aún vacío (`![]()`) no cuenta. Solo avisa: no impide guardar (roadmap de imágenes, fase 3).
 */
export function missingAlt(markdown: string): number {
  const prose = markdown
    .replace(/^(\s*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[ \t]*$/gm, '')
    .replace(/`[^`\n]*`/g, '')
  return (prose.match(/(^|[^\\])!\[\s*\]\(\s*[^\s)]/g) ?? []).length
}

export class ImageStore {
  readonly #fetchAsset: FetchAsset | null
  readonly #cache = new Map<string, Promise<string>>()
  readonly #pending = new Map<string, Blob>()

  constructor(fetchAsset: FetchAsset | null) {
    this.#fetchAsset = fetchAsset
  }

  /** URL para pintar una imagen del Markdown. */
  display(url: string): string | Promise<string> {
    if (!url || isExternal(url)) return url
    const key = normalizePath(url)
    let entry = this.#cache.get(key)
    if (!entry) {
      if (!this.#fetchAsset) return url
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

  /** Añade una imagen subida: se ve ya y viajará con el próximo guardado. */
  addPending(image: PendingImage): void {
    const key = normalizePath(image.path)
    this.#pending.set(key, image.blob)
    this.#cache.set(key, Promise.resolve(URL.createObjectURL(image.blob)))
  }

  /** Imágenes pendientes que el Markdown sigue usando (las quitadas no se suben). */
  pendingFor(markdown: string): PendingImage[] {
    return [...this.#pending].filter(([path]) => referenced(markdown, path)).map(([path, blob]) => ({ path, blob }))
  }

  /** Todas las pendientes (para el borrador local). */
  pending(): PendingImage[] {
    return [...this.#pending].map(([path, blob]) => ({ path, blob }))
  }

  /** Tras guardar: ya están en Git; dejan de estar pendientes (siguen en caché). */
  markSaved(paths: string[]): void {
    for (const path of paths) this.#pending.delete(normalizePath(path))
  }

  /** Libera las URL `blob:` (al cambiar de material). */
  dispose(): void {
    for (const entry of this.#cache.values()) {
      void entry.then((shown) => {
        if (shown.startsWith('blob:')) URL.revokeObjectURL(shown)
      })
    }
    this.#cache.clear()
    this.#pending.clear()
  }
}
