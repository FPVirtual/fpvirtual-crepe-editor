// Equivalencia de render con el parser real de LiaScript (liaex, Docker).
//
// Compara la "huella" de `liaex -f fullJson` (títulos de sección y, por
// sección, tipos de quiz, nº de encuestas y de tareas) entre cada fixture
// original y su versión serializada entera por Milkdown (peor caso: todos
// los bloques editados), generada por `npm test` en reports/canonical/.
//
// Uso: npm test && npm run liaex:check   (requiere Docker y la imagen
// liascript/exporter; ~1 s por documento). Usa red: liaex descarga los
// templates de `import:` en cada ejecución (LIAEX_NETWORK=none para aislar).

import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const IMAGE = process.env.LIAEX_IMAGE ?? 'liascript/exporter:latest'
const NETWORK = process.env.LIAEX_NETWORK ?? 'bridge'
const canonicalDir = join(ROOT, 'reports/canonical')
// Directorio de trabajo dentro del repo: el demonio Docker debe poder montarlo
// (un TMPDIR privado del usuario puede no ser visible para él).
const work = join(ROOT, 'reports/liaex-work')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
chmodSync(work, 0o777)

function fingerprint(file) {
  const base = file.replace(/\.md$/, '')
  const started = Date.now()
  execFileSync('docker', [
    'run', '--rm', '--network', NETWORK, '-v', `${work}:/work`, IMAGE,
    'liaex', '-i', `/work/${file}`, '-f', 'fullJson', '-o', `/work/${base}`,
  ], { stdio: 'ignore', timeout: 120_000 })
  const data = JSON.parse(readFileSync(join(work, `${base}.json`), 'utf8'))
  const sections = data.lia.sections.map((s, i) => ({
    title: s.title.map((c) => c.Chars ?? '').join(''),
    quiz: (data.quiz[i] ?? []).map((q) => Object.keys(q.state)[0]),
    survey: (data.survey[i] ?? []).length,
    task: (data.task[i] ?? []).length,
  }))
  // Los imports se resuelven en paralelo: el orden de macros/recursos/onload
  // no es determinista entre ejecuciones, así que se normaliza.
  const d = data.lia.definition
  const definition = {
    author: d.author,
    email: d.email,
    version: d.version,
    language: d.language,
    narrator: d.narrator,
    macros: Object.keys(d.macro ?? {}).sort(),
    resources: (d.resources ?? []).map((r) => JSON.stringify(r)).sort(),
  }
  return { ms: Date.now() - started, sections, definition }
}

const results = []
for (const name of readdirSync(canonicalDir).filter((f) => f.endsWith('.md'))) {
  const originalPath = join(ROOT, name.replaceAll('__', '/'))
  copyFileSync(originalPath, join(work, `orig-${name}`))
  copyFileSync(join(canonicalDir, name), join(work, `canon-${name}`))
  let a
  let b
  try {
    a = fingerprint(`orig-${name}`)
    b = fingerprint(`canon-${name}`)
  } catch (error) {
    results.push({ fixture: name.replaceAll('__', '/'), equivalent: false, error: String(error.message).split('\n')[0] })
    console.log(`! ${name.replaceAll('__', '/')}  liaex falló: ${String(error.message).split('\n')[0]}`)
    continue
  }
  const same = JSON.stringify([a.sections, a.definition]) === JSON.stringify([b.sections, b.definition])
  results.push({ fixture: name.replaceAll('__', '/'), equivalent: same, ms: [a.ms, b.ms], original: a.sections, canonical: same ? undefined : b.sections })
  console.log(`${same ? '✓' : '✗'} ${name.replaceAll('__', '/')}  (${a.ms} ms / ${b.ms} ms)`)
}
writeFileSync(join(ROOT, 'reports/liaex.json'), JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.equivalent).length
console.log(`\n${results.length - failed}/${results.length} equivalentes según liaex`)
process.exit(failed ? 1 : 0)
