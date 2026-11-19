// Rendimiento con un tema largo (M0: "medir, no estimar").
//
// Genera un documento de ~3000 líneas (≈ 60 páginas) concatenando los
// materiales reales con títulos únicos y mide: creación del editor (parse +
// preparación de la preservación), guardado sin cambios y guardado tras una
// edición. jsdom es más lento que un navegador: las cifras son cota superior.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { editorViewCtx } from '@milkdown/kit/core'
import { expect, it } from 'vitest'

import { createLiaEditor } from '../src/editor/createEditor'
import { splitDocument } from '../src/liascript'

const ROOT = join(__dirname, '..')

function longDocument(targetLines: number): string {
  const bodies = ['ut03-mvc', 'ut04-pdo', 'demo-liascript'].map(
    (f) => splitDocument(readFileSync(join(ROOT, 'fixtures/real', `${f}.md`), 'utf8')).body,
  )
  const parts = ['<!--\nauthor: Prueba\ntitle: Tema largo\nlanguage: es\n-->\n\n# Tema largo\n']
  let lines = 0
  for (let i = 0; lines < targetLines; i++) {
    const body = bodies[i % bodies.length].replace(/^# (.*)$/m, `## $1 (parte ${i + 1})`)
    parts.push(body)
    lines += body.split('\n').length
  }
  return parts.join('\n')
}

it('tema largo (~3000 líneas): apertura y guardado', async () => {
  const markdown = longDocument(3000)
  const root = document.createElement('div')
  document.body.append(root)

  let t = performance.now()
  const editor = await createLiaEditor(root, markdown)
  const createMs = performance.now() - t

  t = performance.now()
  const saved = editor.getMarkdown()
  const saveMs = performance.now() - t

  const view = editor.crepe.editor.ctx.get(editorViewCtx)
  view.dispatch(view.state.tr.insertText('Edición. ', 1))
  t = performance.now()
  const edited = editor.getMarkdown()
  const saveEditedMs = performance.now() - t

  const report = {
    lines: markdown.split('\n').length,
    chars: markdown.length,
    blocks: editor.preserver.blockCount,
    createMs: Math.round(createMs),
    saveUnchangedMs: Math.round(saveMs),
    saveEditedMs: Math.round(saveEditedMs),
    diffLines: edited.split('\n').filter((l, i) => l !== markdown.split('\n')[i]).length,
  }
  mkdirSync(join(ROOT, 'reports'), { recursive: true })
  writeFileSync(join(ROOT, 'reports/performance.json'), JSON.stringify(report, null, 2))
  console.log(report)

  expect(saved).toBe(markdown)
  expect(report.diffLines).toBeLessThanOrEqual(1) // solo la línea editada
  await editor.destroy()
}, 120_000)
