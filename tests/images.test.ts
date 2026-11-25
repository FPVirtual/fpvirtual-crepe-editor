// Imágenes relativas del material en el editor (docs/imagenes del plugin).

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LmsConfig } from '../src/liascript'
import { splitDocument } from '../src/liascript'
import { LmsBridge } from '../src/lms/bridge'
import { ImageStore, isExternal, missingAlt, normalizePath } from '../src/lms/images'
import { imageUploader } from '../src/editor/imagePaste'
import { Schema } from '@milkdown/kit/prose/model'

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

describe('subida (fase 2)', () => {
  it('slug del nombre', async () => {
    const { slugify } = await import('../src/lms/imageUpload')
    expect(slugify('Esquema MVC (versión 2).PNG')).toBe('esquema-mvc-version-2')
    expect(slugify('ñandú.jpg')).toBe('nandu')
    expect(slugify('***.png')).toBe('imagen')
    expect(slugify('a'.repeat(60) + '.png')).toHaveLength(40)
  })

  it('tamaño máximo sin ampliar', async () => {
    const { fitSize } = await import('../src/lms/imageUpload')
    expect(fitSize(4000, 3000)).toEqual({ width: 1920, height: 1440 })
    expect(fitSize(1000, 3000)).toEqual({ width: 640, height: 1920 })
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('rechaza SVG y GIF de más de 2 MB; un GIF válido pasa tal cual con hash', async () => {
    const { prepareUpload, UploadError, MAX_BYTES } = await import('../src/lms/imageUpload')
    await expect(prepareUpload(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))).rejects.toBeInstanceOf(UploadError)
    const big = new File([new Uint8Array(MAX_BYTES + 1)], 'g.gif', { type: 'image/gif' })
    await expect(prepareUpload(big)).rejects.toMatchObject({ reason: 'size' })
    const gif = new File([new Uint8Array([71, 73, 70, 56, 57, 97])], 'Animación.gif', { type: 'image/gif' })
    const prepared = await prepareUpload(gif)
    expect(prepared.path).toMatch(/^img\/animacion-[0-9a-f]{8}\.gif$/)
    expect(prepared.blob).toBe(gif)
  })

  it('base64', async () => {
    const { toBase64 } = await import('../src/lms/imageUpload')
    expect(await toBase64(new Blob([new Uint8Array([137, 80, 78, 71])]))).toBe('iVBORw==')
  })

  it('pendientes: se ven, solo viajan las referenciadas y dejan de estarlo al guardar', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://editor/p')
    const store = new ImageStore(async () => null)
    const blob = new Blob(['x'], { type: 'image/png' })
    store.addPending({ path: 'img/a-11111111.png', blob })
    store.addPending({ path: 'img/b-22222222.png', blob })
    expect(await store.display('img/a-11111111.png')).toBe('blob:https://editor/p')
    const md = '# T\n\n![A](img/a-11111111.png)\n'
    expect(store.pendingFor(md).map((p) => p.path)).toEqual(['img/a-11111111.png'])
    expect(store.pending()).toHaveLength(2)
    store.markSaved(['img/a-11111111.png'])
    expect(store.pendingFor(md)).toEqual([])
  })

  it('el guardado envía las imágenes solo si hay', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(JSON.stringify({ status: 'ok', new_sha: 'b'.repeat(40), token: 't2' }), { status: 200 })
    }) as unknown as typeof fetch
    const bridge = new LmsBridge({ ...CFG }, null, fake)
    await bridge.save('# A\n')
    await bridge.save('# B\n', undefined, [{ path: 'img/a.png', content_base64: 'iVBORw==' }])
    expect(calls[0].body).not.toHaveProperty('images')
    expect(calls[1].body.images).toEqual([{ path: 'img/a.png', content_base64: 'iVBORw==' }])
  })
})

describe('texto alternativo (fase 3)', () => {
  it('cuenta las imágenes sin texto alternativo', () => {
    const md = [
      '![Esquema](img/a.png)',
      '![](img/b.png)',
      'Un párrafo con ![ ](img/c.png) dentro.',
      '`![](en-codigo.png)` no cuenta, ni \\![](escapada.png)',
      '```markdown',
      '![](en-bloque.png)',
      '```',
      '!?[vídeo](https://youtu.be/x) y ?[audio](a.mp3) no son imágenes',
    ].join('\n')
    expect(missingAlt(md)).toBe(2)
    expect(missingAlt('![Todo bien](img/a.png)')).toBe(0)
    expect(missingAlt('![]()')).toBe(0) // bloque de imagen aún vacío
  })
})

describe('pegar y arrastrar (fase 3)', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'text*' },
      text: {},
      'image-block': { group: 'block', attrs: { src: { default: '' } } },
    },
  })
  const list = (...files: File[]) => files as unknown as FileList
  const png = (name: string) => new File([new Uint8Array([1])], name, { type: 'image/png' })

  it('sube una a una y salta las que fallan (nunca rechaza)', async () => {
    const upload = vi.fn(async (file: File) => {
      if (file.name === 'mala.png') throw new Error('size')
      return `img/${file.name}`
    })
    const svg = new File(['<svg/>'], 'x.txt', { type: 'text/plain' })
    const nodes = (await imageUploader(upload)(list(png('a.png'), png('mala.png'), svg, png('b.png')), schema, {} as never, 0)) as never[]
    expect(nodes.map((n: { attrs: { src: string } }) => n.attrs.src)).toEqual(['img/a.png', 'img/b.png'])
    expect(upload).toHaveBeenCalledTimes(3) // el texto plano ni se intenta
  })

  it('sin subida disponible no inserta nada', async () => {
    await expect(imageUploader(undefined)(list(png('a.png')), schema, {} as never, 0)).resolves.toEqual([])
  })
})
