import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import path from 'path';
export default defineConfig(({ command }) => ({
    plugins: [
        react(),
        tailwindcss(),
        electron({
            main: {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        sourcemap: command === 'serve',
                        rollupOptions: {
                            external: ['better-sqlite3', 'electron', 'electron-updater'],
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
    // Paths relativos para file:// protocol de Electron
    base: command === 'serve' ? '/' : './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
}));
