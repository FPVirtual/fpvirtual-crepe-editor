// Incorporar la versión oficial (LIA-130): contrato con sync.php y textos de la fusión.

import { describe, expect, it } from 'vitest'

import type { LmsConfig } from '../src/liascript'
import { splitDocument } from '../src/liascript'
import { LmsBridge } from '../src/lms/bridge'
import { compose, conflictCount, parseSync } from '../src/lms/sync'

const CFG: LmsConfig = {
  save_endpoint: 'https://moodle/local/liamateriales/save.php',
  sync_endpoint: 'https://moodle/local/liamateriales/sync.php',
  file: 'materiales/ut03-mvc/ut03-mvc.md',
  branch: 'edicion/ana/materiales-ut03-mvc',
  sha: 'a'.repeat(40),
  token: 'tok1',
  readonly: false,
}

type Call = { url: string; body: Record<string, unknown> }
function fakeFetch(status: number, body: unknown, calls: Call[] = []) {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
}

const SEGMENTS = [
  { kind: 'same', text: '# MVC\n\n' },
  { kind: 'conflict', ours: 'Tres, de Ana.\n', base: 'Tres.\n', theirs: 'Tres, oficial.\n' },
  { kind: 'same', text: '\nCinco, de main.\n' },
]

describe('textos de la fusión', () => {
  it('compone el material con una versión en cada conflicto', () => {
    const sync = parseSync({ status: 'conflict', segments: SEGMENTS })
    expect(compose(sync.segments, 'ours')).toBe('# MVC\n\nTres, de Ana.\n\nCinco, de main.\n')
    expect(compose(sync.segments, 'theirs')).toBe('# MVC\n\nTres, oficial.\n\nCinco, de main.\n')
    expect(conflictCount(sync.segments)).toBe(1)
  })

  it('un estado desconocido se trata como «nada que incorporar»', () => {
    expect(parseSync({ status: 'raro' }).status).toBe('up_to_date')
  })
})

describe('LmsBridge: sync.php', () => {
  it('status: token en el cuerpo y respuesta interpretada', async () => {
    const calls: Call[] = []
    const bridge = new LmsBridge(
      CFG,
      null,
      fakeFetch(200, { status: 'clean', behind: 2, head_sha: 'h'.repeat(40), main_sha: 'm'.repeat(40), ours: 'A', merged: 'B' }, calls),
    )
    const result = await bridge.syncStatus()
    expect(calls[0]).toEqual({
      url: CFG.sync_endpoint,
      body: { action: 'status', file: CFG.file, branch: CFG.branch, token: 'tok1' },
    })
    expect(result).toMatchObject({ status: 'ok', sync: { status: 'clean', behind: 2, ours: 'A', merged: 'B' } })
  })

  it('sin sync_endpoint o en solo lectura no pregunta', async () => {
    const calls: Call[] = []
    expect(await new LmsBridge({ ...CFG, sync_endpoint: undefined }, null, fakeFetch(200, {}, calls)).syncStatus()).toBeNull()
    expect(await new LmsBridge({ ...CFG, readonly: true }, null, fakeFetch(200, {}, calls)).syncStatus()).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('merge: envía los SHA y el material resuelto; adopta SHA y token nuevos', async () => {
    const calls: Call[] = []
    const bridge = new LmsBridge(CFG, null, fakeFetch(200, { status: 'ok', new_sha: 'n'.repeat(40), token: 'tok2' }, calls))
    const result = await bridge.mergeMain('h'.repeat(40), 'm'.repeat(40), 'resuelto')
    expect(calls[0].body).toEqual({
      action: 'merge',
      file: CFG.file,
      branch: CFG.branch,
      token: 'tok1',
      head_sha: 'h'.repeat(40),
      main_sha: 'm'.repeat(40),
      content: 'resuelto',
    })
    expect(result).toEqual({ status: 'merged', sha: 'n'.repeat(40) })
    expect(bridge.config.sha).toBe('n'.repeat(40))
    expect(bridge.config.token).toBe('tok2')
  })

  it('merge sin conflictos no envía contenido; 409 da el motivo', async () => {
    const calls: Call[] = []
    const bridge = new LmsBridge(CFG, null, fakeFetch(409, { status: 'conflict', message: 'la versión oficial ha vuelto a cambiar' }, calls))
    const result = await bridge.mergeMain('h'.repeat(40), 'm'.repeat(40))
    expect('content' in calls[0].body).toBe(false)
    expect(result).toEqual({ status: 'conflict', message: 'la versión oficial ha vuelto a cambiar' })
    expect(bridge.config.sha).toBe(CFG.sha)
  })
})

describe('bloque liascript-lms', () => {
  const doc = (url: string) =>
    ['<!--', 'liascript-lms:', `  save_endpoint: ${CFG.save_endpoint}`, `  sync_endpoint: ${url}`, '  file: m.md', '  branch: b',
      `  sha: ${'a'.repeat(40)}`, '  token: t', '  readonly: false', '-->', '# M'].join('\n')

  it('sync_endpoint solo del mismo Moodle', () => {
    expect(splitDocument(doc(CFG.sync_endpoint!)).lms?.sync_endpoint).toBe(CFG.sync_endpoint)
    expect(splitDocument(doc('https://otro.example/sync.php')).lms?.sync_endpoint).toBeUndefined()
  })
})
