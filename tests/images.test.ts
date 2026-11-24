// Imágenes relativas del material en el editor (docs/imagenes del plugin).

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LmsConfig } from '../src/liascript'
import { splitDocument } from '../src/liascript'
import { LmsBridge } from '../src/lms/bridge'
import { ImageStore, isExternal, normalizePath } from '../src/lms/images'

const CFG: LmsConfig = {
  save_endpoint: 'https://moodle/local/liamateriales/save.php',
  asset_endpoint: 'https://moodle/local/liamateriales/asset.php',
  file: 'materiales/ut03-mvc.md',
  branch: 'b',
  sha: 'a'.repeat(40),
  token: 'tok1',
  readonly: false,
}

afterEach(() => vi.restoreAllMocks())

describe('rutas', () => {
  it.each([
    ['https://x.org/a.png', true],
    ['data:image/png;base64,AA', true],
    ['blob:https://e/1', true],
    ['//cdn/a.png', true],
    ['/abs/a.png', true],
    ['img/a.png', false],
    ['./a.png', false],
  ])('%s externa: %s', (url, expected) => {
    expect(isExternal(url)).toBe(expected)
  })

  it('normaliza la clave', () => {
    expect(normalizePath('./img/a.png?v=1#x')).toBe('img/a.png')
  })
})

describe('ImageStore', () => {
  it('las externas se pintan tal cual y las relativas como blob:, una sola petición', async () => {
    const fetchAsset = vi.fn(async () => new Blob(['png'], { type: 'image/png' }))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://editor/1')
    const store = new ImageStore(fetchAsset)
    expect(store.display('https://x.org/a.png')).toBe('https://x.org/a.png')
    expect(await store.display('./img/a.png')).toBe('blob:https://editor/1')
    expect(await store.display('img/a.png')).toBe('blob:https://editor/1')
    expect(fetchAsset).toHaveBeenCalledTimes(1)
    expect(fetchAsset).toHaveBeenCalledWith('img/a.png')
  })

  it('si falla, devuelve la ruta y reintenta la próxima vez', async () => {
    const fetchAsset = vi.fn(async () => null)
    const store = new ImageStore(fetchAsset)
    expect(await store.display('img/x.png')).toBe('img/x.png')
    await Promise.resolve()
    expect(await store.display('img/x.png')).toBe('img/x.png')
    expect(fetchAsset).toHaveBeenCalledTimes(2)
  })

  it('sin puente (demo) no pide nada', () => {
    expect(new ImageStore(null).display('img/a.png')).toBe('img/a.png')
  })
})

describe('LmsBridge.fetchAsset', () => {
  it('POST con el token en el cuerpo, nunca en la URL', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(new Uint8Array([137, 80]), { status: 200, headers: { 'Content-Type': 'image/png' } })
    }) as unknown as typeof fetch
    const blob = await new LmsBridge({ ...CFG }, null, fake).fetchAsset('img/a.png')
    expect(blob?.type).toBe('image/png')
    expect(calls[0].url).toBe(CFG.asset_endpoint)
    expect(calls[0].init.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ token: 'tok1', path: 'img/a.png' })
  })

  it('null si no es una imagen, si falla o si no hay endpoint', async () => {
    const json = (async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    const notFound = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch
    expect(await new LmsBridge({ ...CFG }, null, json).fetchAsset('a.png')).toBeNull()
    expect(await new LmsBridge({ ...CFG }, null, notFound).fetchAsset('a.png')).toBeNull()
    expect(await new LmsBridge({ ...CFG, asset_endpoint: undefined }, null, json).fetchAsset('a.png')).toBeNull()
  })
})

describe('bloque liascript-lms', () => {
  it('lee asset_endpoint', () => {
    const md = `<!--\nliascript-lms:\n  save_endpoint: s\n  asset_endpoint: https://m/asset.php\n  file: f.md\n  branch: b\n  sha: ${'a'.repeat(40)}\n  token: t\n-->\n\n# T\n`
    expect(splitDocument(md).lms?.asset_endpoint).toBe('https://m/asset.php')
  })
})
