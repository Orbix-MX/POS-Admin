import React from 'react'
import ReactDOM from 'react-dom/client'
import { DesktopApp } from './App'
// Reutiliza los estilos del web (alias @ → ../../web/src)
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>,
)
