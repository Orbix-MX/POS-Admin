import React from 'react'
import ReactDOM from 'react-dom/client'
import { DesktopApp } from './App'
// Reutiliza los estilos del web (alias @ → ../../web/src)
import '~/styles.css'
import { version } from '../package.json'

// __APP_VERSION__ es un global definido en web/vite.config via define — en desktop lo inyectamos aquí
;(globalThis as unknown as Record<string, unknown>).__APP_VERSION__ = version

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>,
)
