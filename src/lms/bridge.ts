// Puente con la plataforma (contrato editor↔plugin, §4 del prompt).
//
// Toda la red de la integración vive aquí: guardado con optimistic locking
// por SHA, renovación del token y publicación. La UI solo interpreta los
// resultados. El puente actualiza su configuración en cada respuesta OK
// (SHA nuevo y token renovado): el token es de un solo uso por guardado.

import type { LmsConfig } from '../liascript'

export type SaveResult =
  | { status: 'saved'; sha: string }
  | { status: 'conflict'; resolutionBranch?: string; diffUrl?: string; currentSha?: string }
  | { status: 'invalid'; errors: { line?: number; message: string }[] }
  | { status: 'auth_error'; message?: string }
  | { status: 'error'; message: string }

export type PublishFormat = 'h5p' | 'epub' | 'pdf'

export type PublishResult =
  | { status: 'published'; cmid?: number; url?: string }
  | { status: 'auth_error'; message?: string }
  | { status: 'error'; message: string }

type Fetch = typeof fetch

export class LmsBridge {
  readonly #cfg: LmsConfig
  readonly #fetch: Fetch
  readonly #sourceUrl: string | null

  /**
   * @param cfg configuración extraída del bloque `liascript-lms`
   * @param sourceUrl URL de `content.php` con la que se abrió el material
   * @param fetchImpl `fetch` inyectable (tests)
   */
  constructor(cfg: LmsConfig, sourceUrl: string | null = null, fetchImpl: Fetch = fetch.bind(globalThis)) {
    this.#cfg = { ...cfg }
    this.#sourceUrl = sourceUrl
    this.#fetch = fetchImpl
  }

  get config(): Readonly<LmsConfig> {
    return this.#cfg
  }

  canSave(): boolean {
    return !this.#cfg.readonly && Boolean(this.#cfg.token)
  }

  canPublish(): boolean {
    return Boolean(this.#cfg.publish_endpoint) && this.canSave()
  }

  /**
   * Guarda el documento completo.
   *
   * @param content Markdown completo (cabecera sin el bloque LMS + cuerpo)
   * @param baseSha SHA sobre el que se guarda; por defecto el último conocido.
   *   «Forzar mi versión» tras un 409 lo llama con el `current_sha` del conflicto.
   */
  async save(content: string, baseSha: string = this.#cfg.sha): Promise<SaveResult> {
    const response = await this.#post(this.#cfg.save_endpoint, {
      file: this.#cfg.file,
      branch: this.#cfg.branch,
      original_sha: baseSha,
      content,
      token: this.#cfg.token,
    })
    if ('error' in response) return { status: 'error', message: response.error }
    const { status, json } = response

    if (status >= 200 && status < 300 && typeof json.new_sha === 'string') {
      this.#cfg.sha = json.new_sha
      if (typeof json.token === 'string') this.#cfg.token = json.token
      return { status: 'saved', sha: json.new_sha }
    }
    if (status === 409) {
      return {
        status: 'conflict',
        resolutionBranch: str(json.resolution_branch),
        diffUrl: str(json.diff_url),
        currentSha: str(json.current_sha),
      }
    }
    if (status === 422) {
      const errors = Array.isArray(json.errors) ? json.errors : []
      return {
        status: 'invalid',
        errors: errors.map((e: Record<string, unknown>) => ({
          line: typeof e.line === 'number' ? e.line : undefined,
          message: String(e.message ?? ''),
        })),
      }
    }
    if (status === 401 || status === 403) return { status: 'auth_error', message: str(json.message) }
    return { status: 'error', message: str(json.message) ?? `HTTP ${status}` }
  }

  /** Publicación en un clic: el backend genera el artefacto y crea el módulo. */
  async publish(format: PublishFormat): Promise<PublishResult> {
    if (!this.#cfg.publish_endpoint) return { status: 'error', message: 'publish_endpoint no declarado' }
    const response = await this.#post(this.#cfg.publish_endpoint, {
      file: this.#cfg.file,
      sha: this.#cfg.sha,
      format,
      token: this.#cfg.token,
    })
    if ('error' in response) return { status: 'error', message: response.error }
    const { status, json } = response
    if (status >= 200 && status < 300) {
      return { status: 'published', cmid: typeof json.cmid === 'number' ? json.cmid : undefined, url: str(json.url) }
    }
    if (status === 401 || status === 403) return { status: 'auth_error', message: str(json.message) }
    return { status: 'error', message: str(json.message) ?? `HTTP ${status}` }
  }

  /** Renueva el token sin guardar; `false` si no hay endpoint o falla. */
  async refreshToken(): Promise<boolean> {
    if (!this.#cfg.token_refresh_endpoint || this.#cfg.readonly) return false
    const response = await this.#post(this.#cfg.token_refresh_endpoint, {
      file: this.#cfg.file,
      branch: this.#cfg.branch,
      token: this.#cfg.token,
    })
    if ('error' in response || response.status !== 200 || typeof response.json.token !== 'string') return false
    this.#cfg.token = response.json.token
    return true
  }

  /**
   * URL para recargar la versión del servidor: la de apertura con el token
   * vigente (el de la URL original queda revocado tras guardar o renovar).
   */
  reloadUrl(): string | null {
    if (!this.#sourceUrl) return null
    const url = new URL(this.#sourceUrl)
    url.searchParams.set('token', this.#cfg.token)
    return url.toString()
  }

  async #post(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; json: Record<string, unknown> } | { error: string }> {
    try {
      const response = await this.#fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
      })
      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>
      return { status: response.status, json }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}
