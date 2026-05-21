import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ImageViewerProps {
  src: string
  alt?: string
  onClose: () => void
}

function IconMinus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconMaximize() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

const MIN_SCALE = 0.25
const MAX_SCALE = 8
const ZOOM_STEP = 0.3

export function ImageViewer({ src, alt = 'Imagen', onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const applyZoom = useCallback((delta: number) => {
    setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)))
  }, [])

  const resetView = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }, [])

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      applyZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyZoom])

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') applyZoom(ZOOM_STEP)
      if (e.key === '-') applyZoom(-ZOOM_STEP)
      if (e.key === '0') resetView()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, applyZoom, resetView])

  // Touch pinch
  const lastTouchDist = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDist.current = Math.hypot(dx, dy)
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const delta = (dist - lastTouchDist.current) * 0.01
      applyZoom(delta)
      lastTouchDist.current = dist
    }
  }
  function onTouchEnd() {
    lastTouchDist.current = null
  }

  // Mouse drag
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    setDragOrigin({ x: e.clientX - translate.x, y: e.clientY - translate.y })
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging) return
    setTranslate({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y })
  }
  function onMouseUp() {
    setIsDragging(false)
  }

  async function handleDownload() {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = blob.type.split('/')[1] || 'jpg'
      a.download = `${alt.replace(/\s+/g, '-').toLowerCase()}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(src, '_blank')
    }
  }

  const cursor = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizador: ${alt}`}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ animation: 'fadeIn 0.18s ease' }}
    >
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/92 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Top toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/8 backdrop-blur-xl border border-white/12 rounded-2xl px-2.5 py-1.5 shadow-2xl">
        <button
          onClick={() => applyZoom(-ZOOM_STEP)}
          disabled={scale <= MIN_SCALE}
          aria-label="Reducir zoom"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/12 disabled:opacity-25 transition-colors"
        >
          <IconMinus />
        </button>
        <button
          onClick={resetView}
          aria-label="Restablecer vista"
          className="px-2.5 py-0.5 text-[11px] font-mono text-white/60 hover:text-white hover:bg-white/12 rounded-lg transition-colors min-w-[3.5rem] text-center"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => applyZoom(ZOOM_STEP)}
          disabled={scale >= MAX_SCALE}
          aria-label="Aumentar zoom"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/12 disabled:opacity-25 transition-colors"
        >
          <IconPlus />
        </button>
        <div className="w-px h-4 bg-white/15 mx-1" />
        <button
          onClick={resetView}
          aria-label="Ajustar a pantalla"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/12 transition-colors"
        >
          <IconMaximize />
        </button>
        <div className="w-px h-4 bg-white/15 mx-1" />
        <button
          onClick={handleDownload}
          aria-label="Descargar imagen"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/12 transition-colors"
        >
          <IconDownload />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Cerrar visualizador"
        className="absolute top-4 right-4 z-20 w-9 h-9 flex items-center justify-center rounded-xl bg-white/8 backdrop-blur-xl border border-white/12 text-white/70 hover:text-white hover:bg-white/16 transition-colors shadow-xl"
      >
        <IconX />
      </button>

      {/* Image area */}
      <div
        ref={containerRef}
        className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          draggable={false}
          className="max-w-[90vw] max-h-[85vh] object-contain select-none rounded-lg shadow-2xl"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            opacity: loaded ? 1 : 0,
            transition: isDragging ? 'opacity 0.2s ease' : 'transform 0.15s ease, opacity 0.2s ease',
          }}
        />
      </div>

      {/* Bottom hints */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 text-white/30 text-[11px] pointer-events-none select-none">
        <span>Scroll para zoom</span>
        <span>·</span>
        <span>Arrastra para mover</span>
        <span>·</span>
        <span>ESC para cerrar</span>
      </div>
    </div>,
    document.body
  )
}
