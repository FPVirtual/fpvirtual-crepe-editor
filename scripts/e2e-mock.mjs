// Prueba e2e del ciclo editar → guardar → conflicto → forzar → publicar en
// Chrome real, contra un backend simulado que replica las respuestas del
// plugin local_liamateriales (content.php, save.php, token.php,
// publish_api.php).
//
// Uso: npm run build && node scripts/e2e-mock.mjs
// Requiere google-chrome. Deja una captura en reports/e2e.png.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, extname } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const EDITOR_PORT = 4191
const MOCK_PORT = 4192
const CDP_PORT = 9333
const MOCK = `http://127.0.0.1:${MOCK_PORT}`
const EDITOR = `http://127.0.0.1:${EDITOR_PORT}`
const SHA0 = 'a'.repeat(40)

// Material real más imágenes relativas (docs/imagenes): una de bloque y otra en línea.
const material =
  readFileSync(join(ROOT, 'fixtures/real/ut03-mvc.md'), 'utf8') +
  '\n## Imágenes\n\n![Esquema del patrón](img/esquema.png)\n\nUna foto ![foto](./img/foto.png) en línea.\n'
// PNG de 1×1 que sirve el asset.php simulado.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const assetRequests = []
const saves = []
const publishes = []
let shaCounter = 0
const OPEN_CODE = 'c0de-de-apertura'
let openCodeUsed = false
const contentRequests = []

// --- backend simulado --------------------------------------------------------

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', EDITOR)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, status, body) {
  cors(res)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Inyección igual que lib.php: bloque justo antes de `-->`. */
function inject(markdown, token) {
  const yaml =
    'liascript-lms:\n' +
    `  save_endpoint: ${MOCK}/save.php\n` +
    `  token_refresh_endpoint: ${MOCK}/token.php\n` +
    `  asset_endpoint: ${MOCK}/asset.php\n` +
    '  file: materiales/ut03-mvc.md\n' +
    '  branch: edicion/ana/materiales-ut03-mvc\n' +
    `  sha: ${SHA0}\n` +
    '  committed_at: 2026-11-20T09:05:00\n' +
    `  token: ${token}\n` +
    '  readonly: false\n' +
    `  return_url: ${MOCK}/my/courses.php\n` +
    `  publish_endpoint: ${MOCK}/publish_api.php\n`
  const end = markdown.indexOf('-->')
  return markdown.slice(0, end) + yaml + markdown.slice(end)
}

const mock = createServer((req, res) => {
  const url = new URL(req.url, MOCK)
  if (req.method === 'OPTIONS') {
    cors(res)
    res.writeHead(200)
    res.end()
    return
  }
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (url.pathname === '/content.php') {
      // Código de apertura de un solo uso (LIA-062): POST {code} → token de edición.
      const request = body ? JSON.parse(body) : {}
      contentRequests.push({ method: req.method, url: req.url, body: request })
      if (req.method !== 'POST' || request.code !== OPEN_CODE || openCodeUsed) {
        json(res, 403, { status: 'error', message: 'token no válido' })
        return
      }
      openCodeUsed = true
      cors(res)
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(inject(material, 'tok1'))
      return
    }
    const data = body ? JSON.parse(body) : {}
    if (url.pathname === '/asset.php') {
      assetRequests.push({ method: req.method, url: req.url, body: data })
      if (req.method !== 'POST' || !data.token || !['img/esquema.png', 'img/foto.png'].includes(data.path)) {
        json(res, 404, { status: 'error' })
        return
      }
      cors(res)
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(PNG)
      return
    }
    if (url.pathname === '/save.php') {
      saves.push(data)
      if (data.content.includes('LIMITE')) {
        // Límite de uso del plugin (LIA-064).
        cors(res)
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '42' })
        res.end(JSON.stringify({ status: 'rate_limited', retry_after: 42, message: 'Demasiadas peticiones' }))
        return
      }
      if (data.content.includes('CONFLICTO') && data.original_sha !== 'c'.repeat(40)) {
        json(res, 409, {
          status: 'conflict',
          resolution_branch: 'resolucion/ana/20261119-120000-materiales-ut03-mvc',
          current_sha: 'c'.repeat(40),
          diff_url: 'https://github.com/x/compare',
        })
        return
      }
      shaCounter++
      json(res, 200, { status: 'ok', new_sha: String(shaCounter).repeat(40).slice(0, 40), token: `tok${shaCounter + 1}` })
      return
    }
    if (url.pathname === '/token.php') {
      json(res, 200, { status: 'ok', token: 'tokR' })
      return
    }
    if (url.pathname === '/publish_api.php') {
      publishes.push(data)
      json(res, 200, { status: 'published', cmid: 99, url: `${MOCK}/mod/resource/view.php?id=99` })
      return
    }
    json(res, 404, { status: 'error' })
  })
})

// --- editor (dist/) ----------------------------------------------------------

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }
const editorServer = createServer((req, res) => {
  const path = new URL(req.url, EDITOR).pathname
  const file = join(ROOT, 'dist', path === '/' ? 'index.html' : path)
  if (!existsSync(file)) {
    res.writeHead(404)
    res.end()
    return
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})

// --- Chrome por CDP ------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cdpConnect() {
  for (let i = 0; i < 50; i++) {
    try {
      const target = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json()
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)))
      let id = 0
      const pending = new Map()
      ws.onmessage = (m) => {
        const msg = JSON.parse(m.data)
        if (msg.method === 'Runtime.exceptionThrown') consoleLog.push('EXC ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 400))
        if (msg.method === 'Runtime.consoleAPICalled') consoleLog.push(msg.params.type + ' ' + msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300))
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg)
          pending.delete(msg.id)
        }
      }
      const send = (method, params = {}) =>
        new Promise((resolve) => {
          pending.set(++id, resolve)
          ws.send(JSON.stringify({ id, method, params }))
        })
      return { send, close: () => ws.close() }
    } catch {
      await sleep(200)
    }
  }
  throw new Error('No se pudo conectar con Chrome')
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text)
  return r.result.result.value
}

async function waitFor(cdp, expression, what, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(cdp, expression)) return
    await sleep(150)
  }
  const state = await evaluate(cdp, `document.querySelector('.topbar__status')?.textContent + ' | dialog:' + !!document.querySelector('dialog[open]') + ' | banners:' + [...document.querySelectorAll('.banner')].map(b => b.textContent.trim()).join(' / ')`)
  throw new Error(`Tiempo agotado esperando: ${what} (estado: ${state})`)
}

async function ctrlS(cdp) {
  const key = { key: 's', code: 'KeyS', windowsVirtualKeyCode: 83, modifiers: 2 }
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key })
}

async function typeAtEndOfFirstParagraph(cdp, text) {
  await evaluate(
    cdp,
    `(() => {
      const p = document.querySelector('.ProseMirror p')
      const range = document.createRange()
      range.selectNodeContents(p)
      range.collapse(false)
      const sel = getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      document.querySelector('.ProseMirror').focus()
      return true
    })()`,
  )
  await cdp.send('Input.insertText', { text })
}

const checks = []
const consoleLog = []
function check(name, ok, detail = '') {
  checks.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// --- escenario -----------------------------------------------------------------

// Perfil nuevo en cada ejecución (IndexedDB de borradores vacío).
rmSync(join(ROOT, 'reports/chrome-profile'), { recursive: true, force: true })
mock.listen(MOCK_PORT)
editorServer.listen(EDITOR_PORT)
const chrome = spawn('google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=' + join(ROOT, 'reports/chrome-profile'),
  '--window-size=1200,1600',
  'about:blank',
])

let exitCode = 1
try {
  const cdp = await cdpConnect()
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  // Formato del plugin (LIA-062): código de apertura en el fragmento.
  const src = encodeURIComponent(`${MOCK}/content.php`)
  await cdp.send('Page.navigate', { url: `${EDITOR}/#open=${OPEN_CODE}&src=${src}` })

  await waitFor(cdp, `!!document.querySelector('.ProseMirror .lia-card')`, 'editor cargado con tarjetas LiaScript')
  check('abre el material canjeando el código de apertura', contentRequests.length === 1 && contentRequests[0].method === 'POST')
  check('ninguna URL de content.php lleva token', contentRequests.every((r) => !r.url.includes('token')))
  check('el código desaparece de la barra de direcciones', (await evaluate(cdp, 'location.hash')) === '')
  check(
    'barra con Guardar y Publicar',
    await evaluate(cdp, `[...document.querySelectorAll('button')].some(b => b.textContent.includes('Guardar')) && !!document.querySelector('#publish-format')`),
  )
  const versionText = await evaluate(cdp, `document.querySelector('.topbar__branch').textContent.replace(/\\s+/g, ' ').trim()`)
  check('barra: rama y fecha de la versión, sin SHA', versionText.includes('20/11/2026, 09:05') && !versionText.includes(SHA0.slice(0, 8)), versionText)

  // Imágenes relativas: se piden por POST con el token y se pintan como blob:.
  await waitFor(cdp, `document.querySelectorAll('.ProseMirror img[src^="blob:"]').length >= 2`, 'imágenes relativas cargadas')
  check('imágenes: bloque y en línea pintadas como blob:', await evaluate(cdp, `[...document.querySelectorAll('.ProseMirror img[src^="blob:"]')].every(i => i.complete && i.naturalWidth === 1)`))
  check('imágenes: POST con el token en el cuerpo, ninguna URL con token', assetRequests.length >= 2 && assetRequests.every((r) => r.method === 'POST' && r.body.token === 'tok1' && !r.url.includes('token')))
  check('imágenes: una petición por imagen', new Set(assetRequests.map((r) => r.body.path)).size === assetRequests.length, assetRequests.map((r) => r.body.path).join(', '))

  // 1) Guardar sin cambios: no hay petición.
  await ctrlS(cdp)
  await sleep(300)
  check('Ctrl+S sin cambios no envía nada', saves.length === 0)

  // 2) Editar y guardar.
  await typeAtEndOfFirstParagraph(cdp, ' Texto añadido en la prueba e2e.')
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'estado «cambios sin guardar»')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'estado «guardado»')
  const first = saves[0]
  check('guardado: contrato {file, branch, original_sha, content, token}', first?.original_sha === SHA0 && first.token === 'tok1' && first.file === 'materiales/ut03-mvc.md')
  check('guardado: contenido sin el bloque liascript-lms', first && !first.content.includes('liascript-lms'))
  check('guardado: cabecera original intacta', first?.content.startsWith(material.slice(0, material.indexOf('-->') + 3)))
  const changed = first ? first.content.split('\n').filter((l, i) => l !== material.split('\n')[i]).length : -1
  const diffLines = first ? first.content.split('\n').filter((l, i) => l !== material.split('\n')[i]) : []
  check('guardado: solo cambia la línea editada', changed === 1, `${changed} línea(s): ${JSON.stringify(diffLines).slice(0, 400)}`)

  // 3) Conflicto y forzar.
  await typeAtEndOfFirstParagraph(cdp, ' CONFLICTO')
  await ctrlS(cdp)
  await waitFor(cdp, `!!document.querySelector('dialog[open]')`, 'diálogo de conflicto')
  check('409: diálogo con la rama de resolución', await evaluate(cdp, `document.querySelector('dialog[open]').textContent.includes('resolucion/ana/')`))
  check('409: el segundo guardado usó el SHA y el token renovados', saves[1]?.original_sha === '1'.repeat(40) && saves[1]?.token === 'tok2')
  await evaluate(cdp, `[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent.includes('Forzar')).click(), true`)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'guardado forzado')
  check('forzar: reintento con original_sha = current_sha', saves[2]?.original_sha === 'c'.repeat(40))
  await sleep(800)
  check('tras guardar, cerrar el diálogo no deja el material como modificado', await evaluate(cdp, `document.querySelector('.topbar__status').textContent.includes('Guardado')`))

  // 4) Publicar.
  await evaluate(cdp, `(() => { const s = document.querySelector('#publish-format'); s.value = 'epub'; s.dispatchEvent(new Event('change')); return true })()`)
  await evaluate(cdp, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Publicar').click(), true`)
  await waitFor(cdp, `document.body.textContent.includes('Publicado en el curso')`, 'publicación')
  check('publicar: {file, sha, format, token} con el SHA guardado', publishes[0]?.format === 'epub' && publishes[0]?.sha === '2'.repeat(40) && publishes[0]?.token === 'tok3')
  check('publicar: enlace al módulo', await evaluate(cdp, `!!document.querySelector('a[href*="mod/resource/view.php"]')`))

  // 5) Límite de uso: 429 al guardar → aviso y el texto sigue en el editor.
  await typeAtEndOfFirstParagraph(cdp, ' LIMITE')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Demasiadas peticiones')`, 'aviso de 429')
  check('429: aviso «Demasiadas peticiones» con la espera', await evaluate(cdp, `document.querySelector('.topbar__status').textContent.includes('42 segundos')`))
  check('429: no se pierde el trabajo', await evaluate(cdp, `document.querySelector('.ProseMirror').textContent.includes('LIMITE')`))

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(join(ROOT, 'reports'), { recursive: true })
  writeFileSync(join(ROOT, 'reports/e2e.png'), Buffer.from(shot.result.data, 'base64'))
  cdp.close()
  exitCode = checks.every((c) => c.ok) ? 0 : 1
} catch (error) {
  console.error('✗', error.message)
  console.error('  guardados recibidos:', saves.map((s) => s.original_sha.slice(0, 4)))
  console.error('  consola:', consoleLog.slice(-10))
} finally {
  chrome.kill()
  mock.close()
  editorServer.close()
}
console.log(`\n${checks.filter((c) => c.ok).length}/${checks.length} comprobaciones`)
process.exit(exitCode)
