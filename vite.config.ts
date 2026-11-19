import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    target: 'es2022',
    reportCompressedSize: true,
  },
  test: {
    environment: 'jsdom',
    css: false,
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    server: { deps: { inline: [/@milkdown/] } },
  },
})
