// Contrato editor↔plugin: respuestas reales de save.php / token.php /
// publish_api.php (ver plugin local_liamateriales) contra el puente.

import { describe, expect, it } from 'vitest'

import { splitDocument, type LmsConfig } from '../src/liascript'
import { LmsBridge } from '../src/lms/bridge'
import { materialUrl, openCode, openRequest } from '../src/lms/openUrl'
import { formatCommitDate } from '../src/lms/version'

const CFG: LmsConfig = {
  save_endpoint: 'https://moodle/local/liamateriales/save.php',
  token_refresh_endpoint: 'https://moodle/local/liamateriales/token.php',
  publish_endpoint: 'https://moodle/local/liamateriales/publish_api.php',
  file: 'materiales/ut03-mvc.md',
  branch: 'edicion/ana/materiales-ut03-mvc',
  sha: 'a'.repeat(40),
  token: 'tok1',
  readonly: false,
  return_url: 'https://moodle/my/courses.php',
}

function fakeFetch(status: number, body: unknown, calls: { url: string; body: Record<string, unknown> }[] = []) {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
}

describe('LmsBridge.save', () => {
  it('200: envía el contrato y adopta SHA y token nuevos', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    const bridge = new LmsBridge(
      CFG,
      null,
      fakeFetch(200, { status: 'ok', new_sha: 'b'.repeat(40), branch: CFG.branch, token: 'tok2' }, calls),
    )
    const result = await bridge.save('# Hola\n')
    expect(result).toEqual({ status: 'saved', sha: 'b'.repeat(40) })
    expect(calls[0]).toEqual({
      url: CFG.save_endpoint,
      body: { file: CFG.file, branch: CFG.branch, original_sha: CFG.sha, content: '# Hola\n', token: 'tok1' },
    })
    expect(bridge.config.sha).toBe('b'.repeat(40))
    expect(bridge.config.token).toBe('tok2')
  })

  it('409: conflicto con rama de resolución', async () => {
    const bridge = new LmsBridge(
      CFG,
      null,
      fakeFetch(409, {
        status: 'conflict',
        resolution_branch: 'resolucion/ana/20261119-x',
        current_sha: 'c'.repeat(40),
        diff_url: 'https://github.com/x/compare/a...b',
      }),
    )
    expect(await bridge.save('x')).toEqual({
      status: 'conflict',
      resolutionBranch: 'resolucion/ana/20261119-x',
      currentSha: 'c'.repeat(40),
      diffUrl: 'https://github.com/x/compare/a...b',
    })
    expect(bridge.config.sha).toBe(CFG.sha) // sin cambios
  })

  it('forzar: reintenta con el SHA del conflicto', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    const bridge = new LmsBridge(CFG, null, fakeFetch(200, { new_sha: 'd'.repeat(40), token: 't' }, calls))
    await bridge.save('x', 'c'.repeat(40))
    expect(calls[0].body.original_sha).toBe('c'.repeat(40))
  })

  it('403 y 422 y error de red', async () => {
    expect((await new LmsBridge(CFG, null, fakeFetch(403, { status: 'error', message: 'no' })).save('x')).status).toBe(
      'auth_error',
    )
    expect(
      await new LmsBridge(CFG, null, fakeFetch(422, { status: 'invalid', errors: [{ line: 3, message: 'm' }] })).save('x'),
    ).toEqual({ status: 'invalid', errors: [{ line: 3, message: 'm' }] })
    const failing = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await new LmsBridge(CFG, null, failing).save('x')).toEqual({ status: 'error', message: 'Failed to fetch' })
  })
})

describe('LmsBridge: token, publicación y recarga', () => {
  it('renueva el token', async () => {
    const bridge = new LmsBridge(CFG, null, fakeFetch(200, { status: 'ok', token: 'tok9', expires: 1 }))
    expect(await bridge.refreshToken()).toBe(true)
    expect(bridge.config.token).toBe('tok9')
  })

  it('publica con el SHA actual y devuelve la URL del curso', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = []
    const bridge = new LmsBridge(CFG, null, fakeFetch(200, { status: 'published', cmid: 7, url: 'https://moodle/course/view.php?id=2' }, calls))
    expect(await bridge.publish('epub')).toEqual({ status: 'published', cmid: 7, url: 'https://moodle/course/view.php?id=2', avisos: [] })
    expect(calls[0].body).toEqual({ file: CFG.file, sha: CFG.sha, format: 'epub', token: 'tok1' })
  })

  it('publica la web y devuelve los avisos del lector LiaScript', async () => {
    const bridge = new LmsBridge(CFG, null, fakeFetch(200, { status: 'published', cmid: 8, url: 'u', avisos: ['12 · sintaxis · @mermaid'] }))
    expect(await bridge.publish('web')).toEqual({ status: 'published', cmid: 8, url: 'u', avisos: ['12 · sintaxis · @mermaid'] })
  })

  it('readonly: no guarda ni publica', () => {
    const bridge = new LmsBridge({ ...CFG, readonly: true })
    expect(bridge.canSave()).toBe(false)
    expect(bridge.canPublish()).toBe(false)
  })

  it('recarga con POST del token vigente, sin token en la URL (código de apertura)', async () => {
    const source = { url: 'https://moodle/local/liamateriales/content.php', body: { code: 'c0de' } }
    const bridge = new LmsBridge(CFG, source, fakeFetch(200, { new_sha: 'e'.repeat(40), token: 'tok2' }))
    await bridge.save('x')
    expect(bridge.reloadRequest()).toEqual({ url: source.url, body: { token: 'tok2' } })
  })

  it('formato antiguo: la URL de recarga lleva el token vigente', async () => {
    const source = { url: 'https://moodle/local/liamateriales/content.php?file=materiales%2Fut03-mvc.md&branch=b&token=tok1' }
    const bridge = new LmsBridge(CFG, source, fakeFetch(200, { new_sha: 'e'.repeat(40), token: 'tok2' }))
    await bridge.save('x')
    const request = bridge.reloadRequest()!
    expect(request.body).toBeUndefined()
    expect(new URL(request.url).searchParams.get('token')).toBe('tok2')
  })
})

describe('URL de apertura', () => {
  const content = 'http://m/local/liamateriales/content.php?file=materiales/x.md&branch=b&token=t'
  it.each([
    [`?url=${encodeURIComponent(content)}`, content],
    [`?/open/file/${content}`, content],
    [`?${encodeURIComponent(`/open/file/${content}`)}`, content],
    ['', null],
    ['?debug', null],
  ])('%s', (search, expected) => {
    expect(materialUrl(search)).toBe(expected)
  })
})

describe('código de apertura en el fragmento (LIA-062)', () => {
  const src = 'https://moodle.example/local/liamateriales/content.php'
  it('canjea el código con POST a content.php', () => {
    expect(openRequest('', `#open=abc123&src=${encodeURIComponent(src)}`)).toEqual({ url: src, body: { code: 'abc123' } })
  })
  it('tiene prioridad sobre el formato antiguo', () => {
    expect(openRequest(`?url=${encodeURIComponent('http://otro/c.php')}`, `#open=x&src=${encodeURIComponent(src)}`)?.body).toEqual({ code: 'x' })
  })
  it('rechaza orígenes que no son http(s) y fragmentos incompletos', () => {
    expect(openCode(`#open=x&src=${encodeURIComponent('javascript:alert(1)')}`)).toBeNull()
    expect(openCode('#open=x')).toBeNull()
    expect(openCode('#src=' + encodeURIComponent(src))).toBeNull()
    expect(openRequest('', '')).toBeNull()
  })
  it('sin fragmento, el formato antiguo', () => {
    expect(openRequest(`?url=${encodeURIComponent(src)}`, '')).toEqual({ url: src })
  })
})

describe('fecha de la versión', () => {
  it('lee committed_at del bloque liascript-lms (opcional)', () => {
    const block = (extra: string) =>
      `<!--\ntitle: X\n\nliascript-lms:\n  save_endpoint: https://m/save.php\n  file: a.md\n  branch: b\n  sha: ${'a'.repeat(40)}\n  token: t\n${extra}-->\n\n# A\n`
    expect(splitDocument(block('  committed_at: 2026-11-23T10:42:00+01:00\n')).lms?.committed_at).toBe('2026-11-23T10:42:00+01:00')
    expect(splitDocument(block('')).lms?.committed_at).toBeUndefined()
  })

  it('formatea fecha y hora en español y descarta valores no válidos', () => {
    expect(formatCommitDate('2026-11-23T10:42:00')).toBe('23/11/2026, 10:42')
    expect(formatCommitDate(undefined)).toBeUndefined()
    expect(formatCommitDate('ayer')).toBeUndefined()
  })

  it('tras guardar usa la fecha del servidor o, si no la da, la actual', async () => {
    const withDate = new LmsBridge({ ...CFG }, { url: 'https://m/content.php' }, fakeFetch(200, { status: 'ok', new_sha: 'b'.repeat(40), committed_at: '2026-11-23T11:00:00Z' }))
    await withDate.save('# A\n')
    expect(withDate.config.committed_at).toBe('2026-11-23T11:00:00Z')

    const before = Date.now()
    const without = new LmsBridge({ ...CFG }, { url: 'https://m/content.php' }, fakeFetch(200, { status: 'ok', new_sha: 'c'.repeat(40) }))
    await without.save('# A\n')
    expect(Date.parse(without.config.committed_at!)).toBeGreaterThanOrEqual(before - 1000)
  })
})
