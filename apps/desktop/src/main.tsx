import React from 'react'
import ReactDOM from 'react-dom/client'
import { DesktopApp } from './App'
import '@/index.css'

// Vite define{} doesn't apply to @fs/ files outside the Vite root.
// Inject the global before any web/ components load.
if (typeof (globalThis as any).__APP_VERSION__ === 'undefined') {
  ;(globalThis as any).__APP_VERSION__ = 'desktop'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>,
)
