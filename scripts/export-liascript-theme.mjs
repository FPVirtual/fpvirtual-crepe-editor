// Exporta el CSS de LiaScript de un tema del editor (por defecto «verde»).
//
// Uso: npm run theme:liascript -- [tema] [fichero de salida]
//   npm run theme:liascript                       → stdout
//   npm run theme:liascript -- verde ../moodle-liaeditor-git/engine/src/materiales_liascript/publish/themes/verde.css
//
// Carga el módulo TypeScript con el servidor de Vite (sin compilar a mano).

import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const [themeId = 'verde', out] = process.argv.slice(2)
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
try {
  const { findTheme } = await server.ssrLoadModule('/src/theme/themes.ts')
  const { liascriptThemeCss } = await server.ssrLoadModule('/src/theme/liascript.ts')
  const theme = findTheme(themeId)
  if (!theme || theme.id !== themeId) throw new Error(`Tema desconocido: ${themeId}`)
  const css = liascriptThemeCss(theme)
  if (out) {
    writeFileSync(out, css)
    console.error(`Tema «${themeId}» exportado a ${out}`)
  } else {
    process.stdout.write(css)
  }
} finally {
  await server.close()
}
