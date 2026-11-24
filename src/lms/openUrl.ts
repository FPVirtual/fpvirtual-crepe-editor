// Material a abrir, a partir de la URL del editor.
//
// Formato actual (LIA-062): `#open=<código>&src=<content.php>`. El código de
// apertura (60 s, un solo uso) va en el fragmento, que no se envía a ningún
// servidor; el editor lo borra de la barra de direcciones y lo canjea con
// `POST content.php {code}`, que devuelve el material con el token de
// edición. Ninguna URL lleva un token válido.
//
// Formatos antiguos (token en la URL), mientras el plugin los mantenga con
// su ajuste `legacy_open_url`:
// - `?url=<content.php…>` (contrato del editor, §4.1);
// - `?/open/file/<content.php…>` y su forma codificada `?%2Fopen%2Ffile%2F…`
//   (fork de LiveEditor).

const OPEN_PREFIX = '?/open/file/'

/** Petición con la que se obtiene el material: GET a `url` o POST de `body`. */
export interface OpenRequest {
  url: string
  body?: Record<string, string>
}

export function materialUrl(search: string): string | null {
  if (!search) return null
  const params = new URLSearchParams(search)
  const direct = params.get('url')
  if (direct) return direct
  const decoded = search.startsWith('?%2F') ? decodeURIComponent(search) : search
  if (decoded.startsWith(OPEN_PREFIX)) return decoded.slice(OPEN_PREFIX.length) || null
  return null
}

/** Código de apertura del fragmento (`#open=…&src=…`), o null. */
export function openCode(hash: string): OpenRequest | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const code = params.get('open')
  const src = params.get('src')
  if (!code || !src) return null
  try {
    const url = new URL(src)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return { url: url.toString(), body: { code } }
  } catch {
    return null
  }
}

/** Petición de apertura: el código del fragmento o, si no hay, el formato antiguo. */
export function openRequest(search: string, hash: string): OpenRequest | null {
  const fromHash = openCode(hash)
  if (fromHash) return fromHash
  const url = materialUrl(search)
  return url ? { url } : null
}
