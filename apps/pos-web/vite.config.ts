import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const webSrc = path.resolve(__dirname, '../../web/src')

// `@` y `@web` apuntan al código del Admin Web para consumir sus servicios,
// tipos y cliente HTTP sin duplicarlos. `@` es obligatorio: los propios
// archivos de `web/src` se importan entre sí con ese alias.
// El código propio del POS vive bajo `~`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@web': webSrc,
      '@': webSrc,
      // El monorepo tiene varias copias reales de React: 19.1.0 en la raíz (la
      // que arrastran mobile y las libs hoisteadas) y 19.2.6 en `web/` y aquí.
      // Sin fijar una sola, los archivos servidos desde `web/src` y las libs de
      // la raíz cargarían otra instancia y la página muere con "Invalid hook
      // call". Estos alias apuntan todo a la copia de este paquete.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom', 'zustand', 'react-router-dom'],
  },
  server: {
    port: 5174,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
})
