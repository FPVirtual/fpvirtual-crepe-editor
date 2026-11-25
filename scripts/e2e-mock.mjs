// Prueba e2e del ciclo editar → guardar → conflicto → forzar → imágenes en
// Chrome real, contra un backend simulado que replica las respuestas del
// plugin local_liamateriales (content.php, save.php, token.php, asset.php).
// Publicar no pasa por el editor: solo enlaza a la página Publicar del plugin.
//
// Uso: npm run build && node scripts/e2e-mock.mjs
// Requiere google-chrome. Deja una captura en reports/e2e.png.

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, extname } from 'node:path'
import { tmpdir } from 'node:os'

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
  '\n## Imágenes\n\n![Esquema del patrón](img/esquema.png)\n\nUna foto ![foto](./img/foto.png) en línea.\n\n![]()\n' +
  // Maquetación: dos columnas (texto e imagen) e imagen con ancho.
  '\n## Maquetación\n\n<div class="lia-columnas" style="display: flex; flex-wrap: wrap; gap: 1.5em;">\n' +
  '<div class="lia-columna" style="flex: 1 1 14em; min-width: 0;">\n\nTexto IZQUIERDA.\n\n</div>\n' +
  '<div class="lia-columna" style="flex: 1 1 14em; min-width: 0;">\n\n![Diagrama](img/diagrama.png)\n\n</div>\n</div>\n\n' +
  '![Con ancho](img/ancho.png)<!-- style="width: 40%;" -->\n'
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
    `  publish_url: ${MOCK}/local/liamateriales/publish.php?id=2&file=materiales%2Fut03-mvc.md\n`
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
      // Conflicto simulado solo en el primer guardado con «CONFLICTO» (SHA 1111…).
      if (data.content.includes('CONFLICTO') && data.original_sha === '1'.repeat(40)) {
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
      publishes.push(data) // retirado del plugin: el editor no debe llamarlo
      json(res, 404, { status: 'error' })
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

async function capture(cdp, name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(ROOT, `reports/${name}.png`), Buffer.from(r.result.data, 'base64'))
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
    'barra con Guardar y el enlace a Publicar, sin selector de formato',
    await evaluate(cdp, `[...document.querySelectorAll('button')].some(b => b.textContent.includes('Guardar')) && !!document.querySelector('a[href*="publish.php"]') && !document.querySelector('#publish-format')`),
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

  // 4) Publicar: enlace a la página Publicar del plugin (con sesión de Moodle).
  const publishLink = await evaluate(cdp, `(() => { const a = document.querySelector('a[href*="publish.php"]'); return { href: a.href, target: a.target, rel: a.rel } })()`)
  check(
    'publicar: enlace a publish.php con curso y material, sin token, en otra pestaña',
    publishLink.href === `${MOCK}/local/liamateriales/publish.php?id=2&file=materiales%2Fut03-mvc.md` && !publishLink.href.includes('tok') && publishLink.target === '_blank' && publishLink.rel.includes('noopener'),
    publishLink.href,
  )
  await typeAtEndOfFirstParagraph(cdp, ' Antes de publicar.')
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'cambios sin guardar')
  await evaluate(cdp, `document.querySelector('a[href*="publish.php"]').click(), true`)
  check('publicar: con cambios sin guardar avisa y no abre la página', await evaluate(cdp, `document.body.textContent.includes('Guarda los cambios antes de publicar')`))
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'guardado antes de publicar')
  check('publicar: el aviso desaparece al guardar', await evaluate(cdp, `!document.body.textContent.includes('Guarda los cambios antes de publicar')`))

  // 5) Subir una imagen (fase 2): bloque de imagen vacío → fichero real de 2600 px.
  const upload = join(tmpdir(), 'Foto de prueba.png')
  execFileSync('convert', ['-size', '2600x1200', 'plasma:fractal', upload])
  const doc = await cdp.send('DOM.getDocument', { depth: -1, pierce: true })
  const input = await cdp.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '.ProseMirror input[type="file"]' })
  await cdp.send('DOM.setFileInputFiles', { nodeId: input.result.nodeId, files: [upload] })
  await waitFor(cdp, `[...document.querySelectorAll('.ProseMirror img[src^="blob:"]')].some(i => i.complete && i.naturalWidth === 1920)`, 'imagen subida y reducida')
  check('subida: se ve reducida a 1920 px', true)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'cambios sin guardar')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'guardado con imagen')
  const withImage = saves[saves.length - 1]
  const sent = withImage?.images ?? []
  check('subida: el guardado lleva la imagen', sent.length === 1 && /^img\/foto-de-prueba-[0-9a-f]{8}\.jpg$/.test(sent[0].path), sent.map((i) => i.path).join(', '))
  check('subida: JPEG recodificado (sin EXIF) y referenciado en el Markdown', sent.length === 1 && Buffer.from(sent[0].content_base64, 'base64').subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && withImage.content.includes(`](${sent[0].path})`))
  check('texto alternativo: aviso de 1 imagen sin él (no bloquea el guardado)', await evaluate(cdp, `document.querySelector('.banner--warning')?.textContent.includes('1 imagen sin texto alternativo')`))

  // 5b) Pegar (fase 3): un PNG y un SVG en el mismo pegado → entra el PNG, el SVG se rechaza con aviso.
  await evaluate(cdp, `(async () => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 30
    c.getContext('2d').fillRect(0, 0, 40, 30)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    const dt = new DataTransfer()
    dt.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'dibujo.svg', { type: 'image/svg+xml' }))
    dt.items.add(new File([blob], 'Pegada.png', { type: 'image/png' }))
    const pm = document.querySelector('.ProseMirror'); pm.focus()
    pm.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    return true
  })()`)
  await waitFor(cdp, `[...document.querySelectorAll('.ProseMirror img[src^="blob:"]')].some(i => i.complete && i.naturalWidth === 40)`, 'imagen pegada')
  check('pegar: la imagen pegada se ve y no queda el marcador', await evaluate(cdp, `!document.querySelector('.lia-uploading')`))
  check('pegar: el SVG se rechaza con aviso', await evaluate(cdp, `document.querySelector('.banner--error')?.textContent.includes('SVG no')`))
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'cambios sin guardar')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'guardado con imagen pegada')
  const pasted = saves[saves.length - 1]?.images ?? []
  check('pegar: el guardado lleva solo la imagen pegada', pasted.length === 1 && /^img\/pegada-[0-9a-f]{8}\.jpg$/.test(pasted[0].path), pasted.map((i) => i.path).join(', '))
  await typeAtEndOfFirstParagraph(cdp, ' Otra edición.')
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'cambios sin guardar')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'guardado sin imágenes')
  await sleep(300)
  check('subida: el siguiente guardado ya no la reenvía', !saves[saves.length - 1].images)

  // 5c) Tema con iconos (sin desplegable): grupo de opciones con flechas.
  check(
    'tema: cuatro iconos en un grupo de opciones, sin desplegable',
    await evaluate(cdp, `document.querySelectorAll('[role=radiogroup] [role=radio] svg').length === 4 && !document.querySelector('#theme-select, select')`),
  )
  await evaluate(cdp, `document.querySelector('[role=radio][aria-label="Tema oscuro"]').click(), true`)
  check('tema: el icono de la luna pone el tema oscuro', await evaluate(cdp, `document.documentElement.dataset.theme === 'oscuro' && document.querySelector('[role=radio][aria-label="Tema oscuro"]').getAttribute('aria-checked') === 'true'`))
  await evaluate(cdp, `document.querySelector('[role=radio][aria-checked=true]').focus(), true`)
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 })
  check('tema: con las flechas se pasa al anterior (verde)', await evaluate(cdp, `document.documentElement.dataset.theme === 'verde'`))

  // 5d) Columnas e imagen con ancho: se editan en visual, no como tarjetas HTML.
  check(
    'columnas: dos columnas editables, sin tarjeta HTML',
    await evaluate(cdp, `(() => { const c = document.querySelector('.ProseMirror .lia-columns'); return !!c && c.querySelectorAll(':scope > .lia-column').length === 2 && !c.querySelector('.lia-card') && c.textContent.includes('Texto IZQUIERDA') })()`),
  )
  const sideBySide = await evaluate(cdp, `(() => { const [a, b] = document.querySelectorAll('.ProseMirror .lia-columns > .lia-column'); const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) < 2 && rb.left > ra.right - 1 })()`)
  check('columnas: lado a lado en pantalla', sideBySide)
  const sized = `[...document.querySelectorAll('.ProseMirror .milkdown-image-block')].find(b => b.querySelector('img')?.alt === 'Con ancho' || b.textContent.includes('Con ancho') || b.querySelector('input')?.value === 'Con ancho')`
  check('ancho: la imagen se pinta al 40 %', await evaluate(cdp, `(() => { const b = ${sized}; return !!b && b.style.width === '40%' })()`))

  // 5e) Cambiar el ancho desde la barra: clic en la imagen → «50 %» → guardar.
  async function clickImage(selector) {
    const box = await evaluate(cdp, `(() => { const b = ${selector}; const img = b.querySelector('img'); img.scrollIntoView({ block: 'center' }); const r = img.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 20) } })()`)
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
    }
  }
  await clickImage(sized)
  await waitFor(cdp, `!!document.querySelector('.lia-image-width:not([hidden])')`, 'barra del ancho')
  await capture(cdp, 'e2e-ancho')
  check('ancho: la barra muestra el ancho actual', await evaluate(cdp, `document.querySelector('.lia-image-width input[type=range]').value === '40' && document.querySelector('.lia-image-width__value').textContent.includes('40')`))
  await evaluate(cdp, `[...document.querySelectorAll('.lia-image-width__preset')].find(b => b.textContent.trim() === '50 %').click(), true`)
  await waitFor(cdp, `(() => { const b = ${sized}; return b && b.style.width === '50%' })()`, 'imagen al 50 %')
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'cambios sin guardar')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'guardado con el ancho nuevo')
  const widthSave = saves[saves.length - 1]?.content ?? ''
  check(
    'ancho: se guarda como comentario LiaScript',
    widthSave.includes('![Con ancho](img/ancho.png)<!-- style="width: 50%;" -->') && !widthSave.includes('width: 40%'),
  )
  check('columnas: se guardan sin cambios', widthSave.includes('<div class="lia-columnas" style="display: flex; flex-wrap: wrap; gap: 1.5em;">\n<div class="lia-columna"'))

  // 5f) Borrar una imagen: seleccionarla y Retroceso → el Markdown ya no la usa.
  await clickImage(`[...document.querySelectorAll('.ProseMirror .milkdown-image-block')].find(b => (b.querySelector('img')?.alt ?? '') === 'Esquema del patrón' || (b.querySelector('input')?.value ?? '') === 'Esquema del patrón')`)
  await sleep(200)
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'cambios sin guardar tras borrar')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Guardado')`, 'guardado tras borrar la imagen')
  const afterDelete = saves[saves.length - 1]?.content ?? ''
  check('borrar: la imagen desaparece del Markdown y el resto sigue', !afterDelete.includes('img/esquema.png') && afterDelete.includes('img/ancho.png') && afterDelete.includes('./img/foto.png'))

  // 5g) Insertar «Dos imágenes lado a lado» desde el panel LiaScript.
  await evaluate(cdp, `(() => { const s = [...document.querySelectorAll('.lia-example')].find(d => d.querySelector('summary').textContent.includes('Dos imágenes lado a lado')); s.open = true; s.querySelector('.btn--primary').click(); return true })()`)
  await waitFor(cdp, `document.querySelectorAll('.ProseMirror .lia-columns').length === 2`, 'columnas insertadas')
  await evaluate(cdp, `[...document.querySelectorAll('.ProseMirror .lia-columns')].at(-1).scrollIntoView({ block: 'center' }), true`)
  await capture(cdp, 'e2e-columnas')
  check('insertar: dos columnas con un bloque de imagen vacío cada una', await evaluate(cdp, `[...document.querySelectorAll('.ProseMirror .lia-columns')].some(c => c.querySelectorAll('.lia-column .milkdown-image-block').length === 2)`))

  // 6) Límite de uso: 429 al guardar → aviso y el texto sigue en el editor.
  await typeAtEndOfFirstParagraph(cdp, ' LIMITE')
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('sin guardar')`, 'cambios sin guardar')
  await ctrlS(cdp)
  await waitFor(cdp, `document.querySelector('.topbar__status')?.textContent.includes('Demasiadas peticiones')`, 'aviso de 429')
  check('429: aviso «Demasiadas peticiones» con la espera', await evaluate(cdp, `document.querySelector('.topbar__status').textContent.includes('42 segundos')`))
  check('el editor nunca llama a publish_api.php', publishes.length === 0)
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
