import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    target: 'es2022',
    reportCompressedSize: true,
    // Dos páginas: el editor y la ayuda (que no carga Crepe).
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        ayuda: fileURLToPath(new URL('ayuda.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    css: false,
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    server: { deps: { inline: [/@milkdown/] } },
  },
})
