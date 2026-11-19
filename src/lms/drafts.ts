// Borrador local (snapshot) en IndexedDB (§5.7).
//
// Mientras se edita, el documento se guarda periódicamente en el navegador.
// Nunca se sube a Git automáticamente: al reabrir el mismo material sobre
// el mismo SHA, si hay un borrador distinto del contenido del servidor se
// ofrece recuperarlo o descartarlo. Si IndexedDB no está disponible (modo
// privado, iframe sin almacenamiento), todo es no-op.

const DB_NAME = 'fpvirtual-crepe-editor'
const STORE = 'drafts'

export interface Draft {
  /** `<file>@<branch>` */
  key: string
  /** SHA del servidor sobre el que se editaba. */
  sha: string
  markdown: string
  savedAt: number
}

export const draftKey = (file: string, branch: string): string => `${file}@${branch}`

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function loadDraft(key: string): Promise<Draft | null> {
  return (await run<Draft | undefined>('readonly', (s) => s.get(key))) ?? null
}

export async function saveDraft(draft: Draft): Promise<void> {
  await run('readwrite', (s) => s.put(draft))
}

export async function deleteDraft(key: string): Promise<void> {
  await run('readwrite', (s) => s.delete(key))
}
