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

/** Rutas relativas de las imágenes que usa el Markdown (`![…](ruta)` y `<img src>`). */
export function imageRefs(markdown: string): Set<string> {
  const refs = new Set<string>()
  const patterns = [/!\[(?:[^\]\\]|\\.)*\]\(\s*<?([^\s)>]+)/g, /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi]
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      if (!isExternal(match[1])) refs.add(normalizePath(match[1]))
    }
  }
  return refs
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
  /** Bytes de las imágenes vistas o subidas (para reenviar una borrada). */
  readonly #blobs = new Map<string, Blob>()
  /** Borradas de Git por un guardado (el material dejó de usarlas). */
  readonly #removed = new Set<string>()

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
      entry = fetchAsset(key).then((blob) => {
        if (!blob) return url
        this.#blobs.set(key, blob)
        return URL.createObjectURL(blob)
      })
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
    this.#blobs.set(key, image.blob)
    this.#removed.delete(key)
    this.#cache.set(key, Promise.resolve(URL.createObjectURL(image.blob)))
  }

  /**
   * Imágenes que hay que enviar con el guardado: las subidas que el Markdown
   * sigue usando y las que un guardado anterior borró de Git y vuelven a
   * usarse (deshacer después de guardar).
   */
  pendingFor(markdown: string): PendingImage[] {
    const used = [...this.#pending].filter(([path]) => referenced(markdown, path))
    const back = [...this.#removed]
      .filter((path) => referenced(markdown, path) && this.#blobs.has(path))
      .map((path) => [path, this.#blobs.get(path)!] as const)
    return [...used, ...back].map(([path, blob]) => ({ path, blob }))
  }

  /** Todas las pendientes (para el borrador local). */
  pending(): PendingImage[] {
    return [...this.#pending].map(([path, blob]) => ({ path, blob }))
  }

  /**
   * Tras guardar: las enviadas ya están en Git (siguen en caché). Las que
   * `before` usaba y `after` ya no, el engine las ha borrado de Git: se
   * recuerdan por si vuelven a usarse.
   */
  markSaved(paths: string[], before = '', after = ''): void {
    for (const path of paths) {
      const key = normalizePath(path)
      this.#pending.delete(key)
      this.#removed.delete(key)
    }
    const now = imageRefs(after)
    for (const path of imageRefs(before)) {
      if (!now.has(path)) this.#removed.add(path)
    }
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
    this.#blobs.clear()
    this.#removed.clear()
  }
}
