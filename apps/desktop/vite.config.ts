import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import path from 'path'
import { readFileSync, renameSync } from 'fs'
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

const appVersion = JSON.stringify(pkg.version)
import fs from 'fs'

export default defineConfig(({ command }) => ({
  plugins: [
    {
      name: 'inject-app-version',
      transform(code) {
        if (!code.includes('__APP_VERSION__')) return
        return code.replace(/__APP_VERSION__/g, appVersion)
      },
    },
    {
      name: 'rename-preload-cjs',
      enforce: 'post',
      closeBundle() {
        const from = path.resolve(__dirname, 'dist-electron/preload.mjs')
        const to = path.resolve(__dirname, 'dist-electron/preload.cjs')
        try { renameSync(from, to) } catch (e) { console.warn('[rename-preload-cjs]', e) }
      },
    },
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            sourcemap: command === 'serve',
            rollupOptions: {
              external: ['node-sqlite3-wasm', 'electron', 'electron-updater'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            sourcemap: command === 'serve',
            rollupOptions: {
              output: { format: 'es' },
              external: ['electron'],
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      // Reutiliza todo el código del web sin duplicar
      '@': path.resolve(__dirname, '../../web/src'),
      '~': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('desktop'),
  },
  // Paths relativos para file:// protocol de Electron
  base: command === 'serve' ? '/' : './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
}))
