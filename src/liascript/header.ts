// Cabecera LiaScript y bloque `liascript-lms` (contrato §4.1).
//
// Un documento LiaScript empieza (opcionalmente) por un comentario HTML con
// la configuración del curso: autor, título, idioma, imports de templates,
// definiciones de macros… Ese comentario NUNCA entra en el documento
// ProseMirror (P2 del roadmap): se separa antes del parse y se vuelve a
// anteponer, literal, al serializar.
//
// Dentro de él, la plataforma inyecta al servir el documento un bloque
// `liascript-lms` con los endpoints de guardado, el SHA y el token. Ese bloque
// se extrae y se elimina: nunca se edita ni se devuelve (el backend lo
// reinyecta en cada apertura).

export interface LmsConfig {
  /** POST `{file, branch, original_sha, content, token}`. */
  save_endpoint: string
  /** POST `{file, sha, format, token}` (publicación en un clic). */
  publish_endpoint?: string
  /** POST `{file, branch, token}` → `{token}` (renovación sin guardar). */
  token_refresh_endpoint?: string
  file: string
  branch: string
  /** SHA del que parte la sesión (optimistic locking). */
  sha: string
  token: string
  readonly: boolean
  return_url?: string
}

export interface SplitDocument {
  /** Comentario de cabecera completo (`<!-- … -->`), sin el bloque LMS; `''` si no hay. */
  header: string
  /** Texto literal entre la cabecera y el cuerpo (saltos de línea). */
  gap: string
  /** Cuerpo Markdown que se carga en el editor. */
  body: string
  /** Configuración LMS si el documento la declaraba completa. */
  lms?: LmsConfig
}

const BLOCK_KEY = 'liascript-lms'
const HEADER_RE = /^<!--[\s\S]*?-->/
const REQUIRED: (keyof LmsConfig)[] = ['save_endpoint', 'file', 'branch', 'sha', 'token']

/**
 * Separa cabecera y cuerpo, y extrae el bloque `liascript-lms`.
 *
 * Al quitar el bloque se elimina también la línea en blanco que el plugin
 * antepone al inyectarlo, para que la cabecera vuelva a Git tal como estaba.
 */
export function splitDocument(markdown: string): SplitDocument {
  const match = HEADER_RE.exec(markdown)
  if (!match) {
    return { header: '', gap: '', body: markdown }
  }
  const { header, lms, hadBlock } = extractLms(match[0])
  const rest = markdown.slice(match[0].length)
  const gap = /^\s*/.exec(rest)?.[0] ?? ''
  // Material sin cabecera: el plugin crea un comentario solo para el bloque
  // LMS; al quitarlo queda vacío y no debe volver a Git.
  if (hadBlock && /^<!--\s*-->$/.test(header)) {
    return { header: '', gap: '', body: rest.slice(gap.length), lms }
  }
  return { header, gap, body: rest.slice(gap.length), lms }
}

/** Recompone el documento completo a partir de cabecera, separación y cuerpo. */
export function joinDocument(doc: Pick<SplitDocument, 'header' | 'gap'>, body: string): string {
  if (!doc.header) return body
  return doc.header + (doc.gap || '\n\n') + body
}

function extractLms(header: string): { header: string; lms?: LmsConfig; hadBlock: boolean } {
  const lines = header.split('\n')
  const keyLine = lines.findIndex((l) => l.trimStart().startsWith(`${BLOCK_KEY}:`))
  if (keyLine === -1) return { header, hadBlock: false }

  const raw: Record<string, string> = {}
  let end = keyLine + 1
  while (end < lines.length) {
    const m = /^\s+(\w+):\s*(.*?)\s*$/.exec(lines[end])
    if (!m) break
    raw[m[1]] = m[2]
    end++
  }

  let start = keyLine
  // Línea en blanco añadida por la inyección del plugin delante del bloque.
  if (start > 0 && lines[start - 1].trim() === '' && end < lines.length && lines[end].trim() === '') {
    start--
  }
  const stripped = [...lines.slice(0, start), ...lines.slice(end)].join('\n')

  if (REQUIRED.some((k) => !raw[k])) {
    // Un bloque incompleto se descarta entero: nunca habilita a medias la integración.
    return { header: stripped, hadBlock: true }
  }
  return {
    header: stripped,
    hadBlock: true,
    lms: {
      save_endpoint: raw.save_endpoint,
      publish_endpoint: raw.publish_endpoint || undefined,
      token_refresh_endpoint: raw.token_refresh_endpoint || undefined,
      file: raw.file,
      branch: raw.branch,
      sha: raw.sha,
      token: raw.token,
      readonly: raw.readonly === 'true',
      return_url: raw.return_url || undefined,
    },
  }
}
