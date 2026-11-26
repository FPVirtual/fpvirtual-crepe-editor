// Incorporar la versión oficial (main) a la rama de edición (LIA-130).
//
// El plugin (sync.php → engine /edit/sync) dice si main trae cambios del
// material que la rama no tiene. Sin conflictos, el editor enseña cómo
// quedará; con conflictos, trae los trozos (comunes y en conflicto, con las
// tres versiones) y el profesor los resuelve en una vista lado a lado
// (MergeDialog.vue, @codemirror/merge).

export type SyncState = 'up_to_date' | 'clean' | 'conflict' | 'conflict_other' | 'not_applicable'

export interface MergeSegment {
  kind: 'same' | 'conflict'
  /** Texto común (ya fusionado: incluye lo que cambió solo un lado). */
  text: string
  /** Conflicto: versión de la rama (la del profesor), la de partida y la oficial. */
  ours: string
  base: string
  theirs: string
}

export interface SyncStatus {
  status: SyncState
  /** Commits de main que la rama no tiene. */
  behind: number
  headSha: string
  mainSha: string
  conflicts: string[]
  segments: MergeSegment[]
  /** Material en la rama y, si la fusión es limpia, cómo quedará. */
  ours: string
  merged: string
}

export type SyncResult = { status: 'ok'; sync: SyncStatus } | { status: 'error'; message: string }

export type MergeResult =
  | { status: 'merged'; sha: string }
  | { status: 'conflict'; message: string } // la rama o main cambiaron, o faltan conflictos
  | { status: 'auth_error'; message?: string }
  | { status: 'error'; message: string }

/** Respuesta de sync.php (status) → SyncStatus. */
export function parseSync(json: Record<string, unknown>): SyncStatus {
  const text = (v: unknown): string => (typeof v === 'string' ? v : '')
  const segments = Array.isArray(json.segments) ? json.segments : []
  return {
    status: (['up_to_date', 'clean', 'conflict', 'conflict_other', 'not_applicable'] as const).includes(
      json.status as SyncState,
    )
      ? (json.status as SyncState)
      : 'up_to_date',
    behind: typeof json.behind === 'number' ? json.behind : 0,
    headSha: text(json.head_sha),
    mainSha: text(json.main_sha),
    conflicts: Array.isArray(json.conflicts) ? json.conflicts.map(String) : [],
    segments: segments.map((s: Record<string, unknown>) => ({
      kind: s.kind === 'conflict' ? 'conflict' : 'same',
      text: text(s.text),
      ours: text(s.ours),
      base: text(s.base),
      theirs: text(s.theirs),
    })),
    ours: text(json.ours),
    merged: text(json.merged),
  }
}

/** Material con una versión en cada conflicto (lo común, igual en ambos). */
export function compose(segments: MergeSegment[], side: 'ours' | 'theirs'): string {
  return segments.map((s) => (s.kind === 'same' ? s.text : s[side])).join('')
}

/** Número de conflictos. */
export const conflictCount = (segments: MergeSegment[]): number =>
  segments.filter((s) => s.kind === 'conflict').length
