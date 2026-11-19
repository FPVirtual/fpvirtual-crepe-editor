// URL del material a abrir, a partir de la URL del editor.
//
// Formatos admitidos:
// - `?url=<content.php…>` (contrato del editor, §4.1);
// - `?/open/file/<content.php…>` y su forma codificada `?%2Fopen%2Ffile%2F…`,
//   que es lo que genera hoy el plugin para el fork de LiveEditor. Así el
//   editor nuevo funciona cambiando solo el ajuste `liaeditor_url`.

const OPEN_PREFIX = '?/open/file/'

export function materialUrl(search: string): string | null {
  if (!search) return null
  const params = new URLSearchParams(search)
  const direct = params.get('url')
  if (direct) return direct
  const decoded = search.startsWith('?%2F') ? decodeURIComponent(search) : search
  if (decoded.startsWith(OPEN_PREFIX)) return decoded.slice(OPEN_PREFIX.length) || null
  return null
}
