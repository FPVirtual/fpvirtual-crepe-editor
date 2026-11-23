// Fecha de la versión (commit) del material para la barra superior.

const FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** «23/11/2026, 10:42» en la hora local; `undefined` si falta o no es una fecha. */
export function formatCommitDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? undefined : FORMAT.format(date)
}
