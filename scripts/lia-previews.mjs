// Imágenes del resultado de cada ejemplo del catálogo LiaScript.
//
// 1. Construye un curso con un ejemplo por sección (src/liascript/catalog.ts).
// 2. Lo exporta con el LiaScript real: `liaex -f web` (Docker).
// 3. Lo sirve en local y captura cada sección con Chrome headless (DevTools
//    Protocol), recortando solo el contenido.
// 4. Guarda public/lia-examples/<key>.webp, que el panel LiaScript muestra.
//
// Uso: npm run lia:previews   (requiere Docker, la imagen liascript/exporter
// y google-chrome). Repetir al cambiar el catálogo o al actualizar LiaScript.
// El ejemplo de vídeo necesita red para cargar el reproductor de YouTube.

import { execFileSync, spawn } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

import { LIA_EXAMPLES } from '../src/liascript/catalog.ts'

const ROOT = new URL('..', import.meta.url).pathname
const IMAGE = process.env.LIAEX_IMAGE ?? 'liascript/exporter:latest'
const WORK = join(ROOT, 'reports/lia-previews')
const OUT = join(ROOT, 'public/lia-examples')
const HTTP_PORT = 5191
const CDP_PORT = 9335
const WIDTH = 760
const MAX_HEIGHT = 640
const only = process.argv.slice(2) // claves concretas, opcional

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- 1. curso ---------------------------------------------------------------
rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK, { recursive: true })
chmodSync(WORK, 0o777)
mkdirSync(OUT, { recursive: true })

const course = [
  '<!--\ntitle: Ejemplos LiaScript\nlanguage: es\nnarrator: Spanish Female\n-->\n',
  '# Ejemplos LiaScript\n',
  ...LIA_EXAMPLES.map((e) => [`## ${e.title}`, e.context, e.source].filter(Boolean).join('\n\n') + '\n'),
].join('\n')
writeFileSync(join(WORK, 'curso.md'), course)

// --- 2. export con liaex -----------------------------------------------------
console.log('Exportando con liaex -f web…')
// Con el usuario actual: así la salida no queda a nombre de root.
const user = `${process.getuid()}:${process.getgid()}`
execFileSync('docker', ['run', '--rm', '--user', user, '-e', 'HOME=/tmp', '-v', `${WORK}:/work`, IMAGE, 'liaex', '-i', '/work/curso.md', '-f', 'web', '-o', '/work/out'], {
  stdio: 'ignore',
  timeout: 180_000,
})

// --- 3. servidor estático ----------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' }
const site = join(WORK, 'out')
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  const file = join(site, path === '/' ? 'index.html' : path)
  try {
    if (!file.startsWith(site) || !statSync(file).isFile()) throw new Error()
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  } catch {
    res.writeHead(404).end()
  }
}).listen(HTTP_PORT, '127.0.0.1')

// --- 4. capturas -------------------------------------------------------------
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--mute-audio',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${join(WORK, 'chrome-profile')}`,
  `--window-size=${WIDTH},900`, 'about:blank',
])

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const target = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json()
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
      let id = 0
      const pending = new Map()
      ws.onmessage = (m) => {
        const msg = JSON.parse(m.data)
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg)
          pending.delete(msg.id)
        }
      }
      return (method, params = {}) =>
        new Promise((resolve) => {
          pending.set(++id, resolve)
          ws.send(JSON.stringify({ id, method, params }))
        })
    } catch {
      await sleep(200)
    }
  }
  throw new Error('No se pudo conectar con Chrome')
}

let failed = 0
try {
  const send = await connect()
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text)
    return r.result.result.value
  }
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: false })

  for (const [i, example] of LIA_EXAMPLES.entries()) {
    if (only.length && !only.includes(example.key)) continue
    // Sección i+2 (la 1 es el título del curso). Carga completa en cada una:
    // LiaScript no cambia de sección si solo cambia el hash desde el script.
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.html?s=${i + 2}#${i + 2}` })
    await sleep(example.category === 'media' || example.category === 'data' ? 5000 : 3000)
    // Caja del contenido de la sección, sin su título.
    const box = await evaluate(`(() => {
      const main = document.querySelector('main.lia-slide__content')
      if (!main) return null
      main.scrollTop = 0
      const parts = [...main.children].filter((el) => el.tagName !== 'HEADER' && el.offsetParent !== null)
      if (!parts.length) return null
      const rects = parts.map((el) => el.getBoundingClientRect())
      const top = Math.min(...rects.map((r) => r.top)), bottom = Math.max(...rects.map((r) => r.bottom))
      const m = main.getBoundingClientRect()
      return { x: m.left + 8, y: top - 12, width: m.width - 16, height: bottom - top + 24 }
    })()`)
    if (!box) {
      console.log(`! ${example.key}: sin contenido`)
      failed++
      continue
    }
    const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: Math.min(box.height, MAX_HEIGHT), scale: 1 }
    const shot = await send('Page.captureScreenshot', { format: 'webp', quality: 85, clip })
    const file = join(OUT, `${example.key}.webp`)
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
    console.log(`✓ ${example.key}  ${Math.round(clip.width)}×${Math.round(clip.height)}  ${(statSync(file).size / 1024).toFixed(1)} kB`)
  }
} finally {
  chrome.kill()
  server.close()
}
process.exit(failed ? 1 : 0)
