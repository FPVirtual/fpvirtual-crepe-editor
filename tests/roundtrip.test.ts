// Suite de round-trip (M0, §6): la red de seguridad de la fidelidad.
//
// Para cada fixture `.md` mide, con la MISMA fábrica de editor que la app:
// - exact: guardar sin editar devuelve el documento byte a byte (idempotencia).
// - semantic: la serialización canónica de Milkdown (sin preservación) tiene
//   el mismo mdast que el original (sin diff semántico).
// - liaVerbatim: todo bloque LiaScript protegido aparece literal en la salida.
// - localEdit: tras insertar un párrafo, el resto de bloques sigue literal.
// - protectedRatio: fracción del cuerpo que queda como bloque no editable.
// Escribe reports/roundtrip.json para el informe.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { editorViewCtx, remarkCtx } from '@milkdown/kit/core'
import { afterAll, describe, expect, it } from 'vitest'

import { createLiaEditor } from '../src/editor/createEditor'
import { joinDocument, LIA_BLOCK } from '../src/liascript'

const ROOT = join(__dirname, '..')
const FIXTURE_DIRS = ['fixtures/real', 'fixtures/casos', 'fixtures/external'].map((d) => join(ROOT, d))

function listFixtures(): string[] {
  return FIXTURE_DIRS.flatMap((dir) => {
    try {
      return readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => join(dir, f))
    } catch {
      return []
    }
  })
}

interface Result {
  fixture: string
  exact: boolean
  semantic: boolean
  liaVerbatim: boolean
  localEdit: boolean
  blocks: number
  protectedRatio: number
  liaBlocks: Record<string, number>
  liaPreview: string[]
  canonicalDiffLines: number
  semanticDiff?: string
}

const results: Result[] = []

function stripPositions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPositions)
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) {
      if (k === 'position') continue
      out[k] = stripPositions(v)
    }
    return out
  }
  return node
}

function diffLineCount(a: string, b: string): number {
  const la = a.split('\n')
  const lb = b.split('\n')
  let n = 0
  for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) n++
  return n
}

function firstDiff(a: string, b: string): string {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `@${i}: «${a.slice(i, i + 60)}» vs «${b.slice(i, i + 60)}»`
  }
  return ''
}

describe('round-trip LiaScript', () => {
  for (const file of listFixtures()) {
    const name = relative(ROOT, file)
    it(name, async () => {
      const original = readFileSync(file, 'utf8')
      const root = document.createElement('div')
      document.body.append(root)
      const editor = await createLiaEditor(root, original)
      const ctx = editor.crepe.editor.ctx
      const remark = ctx.get(remarkCtx)

      // Bloques protegidos y su proporción.
      const doc = ctx.get(editorViewCtx).state.doc
      const liaValues: string[] = []
      const liaBlocks: Record<string, number> = {}
      doc.forEach((node) => {
        if (node.type.name === LIA_BLOCK) {
          liaValues.push(node.attrs.value as string)
          const kind = node.attrs.kind as string
          liaBlocks[kind] = (liaBlocks[kind] ?? 0) + 1
        }
      })
      const protectedChars = liaValues.reduce((s, v) => s + v.length, 0)

      const saved = editor.getMarkdown()
      const canonical = editor.getCanonicalBody()
      // Peor caso para la comprobación con liaex: todo el cuerpo re-serializado.
      mkdirSync(join(ROOT, 'reports/canonical'), { recursive: true })
      writeFileSync(join(ROOT, 'reports/canonical', name.replaceAll('/', '__')), joinDocument(editor.doc, canonical))
      const semanticA = JSON.stringify(stripPositions(remark.parse(editor.doc.body)))
      const semanticB = JSON.stringify(stripPositions(remark.parse(canonical)))

      // Edición local: insertar un párrafo al principio del cuerpo.
      const view = ctx.get(editorViewCtx)
      const para = view.state.schema.nodes.paragraph.create(null, view.state.schema.text('Párrafo nuevo.'))
      view.dispatch(view.state.tr.insert(0, para))
      const edited = editor.getMarkdown()
      const originalBlocks = remark
        .parse(editor.doc.body)
        .children.map((n) => editor.doc.body.slice(n.position!.start.offset, n.position!.end.offset))
      const localEdit =
        edited.includes('Párrafo nuevo.') && originalBlocks.every((b) => edited.includes(b))

      const result: Result = {
        fixture: name,
        exact: saved === original,
        semantic: semanticA === semanticB,
        liaVerbatim: liaValues.every((v) => saved.includes(v) && edited.includes(v)),
        localEdit,
        blocks: editor.preserver.blockCount,
        protectedRatio: editor.doc.body.length ? protectedChars / editor.doc.body.length : 0,
        liaBlocks,
        liaPreview: liaValues.map((v) => v.split('\n')[0].slice(0, 50)),
        canonicalDiffLines: diffLineCount(editor.doc.body, canonical),
      }
      if (!result.semantic) result.semanticDiff = firstDiff(semanticA, semanticB)
      if (!result.exact) result.semanticDiff = `${result.semanticDiff ?? ''} exact: ${firstDiff(original, saved)}`
      results.push(result)
      await editor.destroy()
      root.remove()

      // Garantías duras: nada de LiaScript se pierde y guardar sin editar es idempotente.
      expect(result.liaVerbatim, 'bloques LiaScript literales').toBe(true)
      expect(result.exact, 'idempotencia exacta').toBe(true)
    })
  }
})

afterAll(() => {
  mkdirSync(join(ROOT, 'reports'), { recursive: true })
  writeFileSync(join(ROOT, 'reports/roundtrip.json'), JSON.stringify(results, null, 2))
})
