'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

const PAGES = [
  { id: 'princesa',  label: 'Princesa',  emoji: '🌸' },
  { id: 'unicornio', label: 'Unicornio', emoji: '🦄' },
  { id: 'arbol',     label: 'Árbol',     emoji: '🌳' },
  { id: 'castillo',  label: 'Castillo',  emoji: '🏰' },
  { id: 'caballo',   label: 'Caballo',   emoji: '🐴' },
  { id: 'perro',     label: 'Perro',     emoji: '🐶' },
  { id: 'ninos',     label: 'Niños',     emoji: '👧' },
  { id: 'dragon',    label: 'Dragón',    emoji: '🐉' },
  { id: 'paisaje',   label: 'Paisaje',   emoji: '🏔' },
  { id: 'arcoiris',  label: 'Arcoíris',  emoji: '🌈' },
]

const QUICK_COLORS = [
  '#E53935','#FDD835','#1E88E5','#43A047',
  '#FF7043','#8E24AA','#F48FB1','#FFCA28',
  '#00838F','#212121','#FFFFFF','#9E9E9E',
  '#FF7043','#A5D6A7','#90CAF9','#CE93D8',
]

interface Props {
  userId: string
  currentPaint: string | null
  onClose: () => void
  onSave: (title: string, imageUrl: string, storagePath: string) => void
}

export default function ColoringPage({ userId, currentPaint, onClose, onSave }: Props) {
  const paintCanvasRef = useRef<HTMLCanvasElement>(null)  // user strokes (transparent bg)
  const [selectedPage, setSelectedPage] = useState(PAGES[0])
  const [activeColor, setActiveColor] = useState(currentPaint ?? '#E53935')
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [brushSize, setBrushSize] = useState(18)
  const [saving, setSaving] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const supabase = createClient()

  useEffect(() => { if (currentPaint) setActiveColor(currentPaint) }, [currentPaint])

  // Clear paint canvas when switching pages
  useEffect(() => {
    const canvas = paintCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [selectedPage])

  // Init paint canvas size once
  useEffect(() => {
    const canvas = paintCanvasRef.current
    if (!canvas) return
    canvas.width = 400
    canvas.height = 500
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = paintCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = 400 / rect.width
    const scaleY = 500 / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = paintCanvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    isDrawing.current = true
    lastPos.current = pos
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = activeColor
    }
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = paintCanvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = activeColor
    }
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    lastPos.current = pos
  }

  function stopDraw() { isDrawing.current = false }

  function clearPaint() {
    const canvas = paintCanvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 400, 500)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Compose: white bg + SVG image + paint strokes
      const offscreen = document.createElement('canvas')
      offscreen.width = 400
      offscreen.height = 500
      const ctx = offscreen.getContext('2d')!

      // White background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 400, 500)

      // Paint strokes (below outline)
      ctx.drawImage(paintCanvasRef.current!, 0, 0)

      // SVG outline on top
      await new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => { ctx.drawImage(img, 0, 0, 400, 500); resolve() }
        img.onerror = () => resolve()
        img.src = `/coloring/${selectedPage.id}.svg`
      })

      const blob = await new Promise<Blob>(res => offscreen.toBlob(b => res(b!), 'image/png'))
      const filename = `${userId}/${Date.now()}_colorear.png`
      const { error } = await supabase.storage.from('drawings').upload(filename, blob, { contentType: 'image/png' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('drawings').getPublicUrl(filename)
      await supabase.from('drawings').insert({
        user_id: userId,
        title: saveTitle.trim() || `${selectedPage.label} coloreado`,
        image_url: publicUrl,
        storage_path: filename,
      })
      onSave(saveTitle || selectedPage.label, publicUrl, filename)
      setShowSaveModal(false)
      setSaveTitle('')
    } catch {
      alert('Error al guardar, intentá de nuevo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 12 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 860, maxHeight: '96vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: 'white', borderBottom: '2px solid #f0e6d2', flexShrink: 0 }}>
          <h2 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '1.15rem', color: '#3d2b1f', margin: 0 }}>
            🎨 Colorear — {selectedPage.emoji} {selectedPage.label}
          </h2>
          <button onClick={onClose} style={{ background: '#faf5ee', border: '2px solid #d4c4a8', borderRadius: '50%', width: 34, height: 34, fontSize: '1rem', cursor: 'pointer', color: '#5a3e2b', fontWeight: 700 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left - page list */}
          <div style={{ width: 96, background: 'white', borderRight: '2px solid #f0e6d2', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 4px', flexShrink: 0 }}>
            {PAGES.map(p => (
              <button key={p.id} onClick={() => setSelectedPage(p)}
                style={{ background: selectedPage.id === p.id ? '#fdf0e0' : 'transparent', border: selectedPage.id === p.id ? '2px solid #d4a870' : '2px solid transparent', borderRadius: 12, padding: '7px 3px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem' }}>{p.emoji}</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#5a3e2b', lineHeight: 1.2 }}>{p.label}</div>
              </button>
            ))}
          </div>

          {/* Center - canvas stack */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0e8d6', overflow: 'hidden', position: 'relative' }}>
            {/* Container that holds both layers */}
            <div style={{ position: 'relative', lineHeight: 0 }}>
              {/* Layer 1: SVG image (background, non-interactive) */}
              <img
                src={`/coloring/${selectedPage.id}.svg`}
                alt={selectedPage.label}
                style={{ display: 'block', width: '100%', maxWidth: 380, maxHeight: 'calc(96vh - 120px)', pointerEvents: 'none', userSelect: 'none' }}
                draggable={false}
              />
              {/* Layer 2: paint canvas (transparent, on top) */}
              <canvas
                ref={paintCanvasRef}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  cursor: tool === 'eraser' ? 'cell' : 'crosshair',
                  touchAction: 'none',
                }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
          </div>

          {/* Right - tools */}
          <div style={{ width: 108, background: 'white', borderLeft: '2px solid #f0e6d2', padding: '10px 7px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flexShrink: 0 }}>

            {/* Active color swatch */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 4 }}>Color</div>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: activeColor, border: activeColor === '#FFFFFF' ? '3px solid #ccc' : '3px solid white', boxShadow: '0 0 0 2px #d4c4a8', margin: '0 auto' }} />
            </div>

            {/* Color palette */}
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 5, textAlign: 'center' }}>Paleta</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, justifyItems: 'center' }}>
                {QUICK_COLORS.map(c => (
                  <div key={c} onClick={() => { setActiveColor(c); setTool('brush') }}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: activeColor === c ? '2.5px solid #3d2b1f' : c === '#FFFFFF' ? '2px solid #ccc' : '2px solid white', cursor: 'pointer', boxShadow: activeColor === c ? '0 0 0 2px white, 0 0 0 4px #3d2b1f' : '0 2px 3px rgba(0,0,0,0.15)' }} />
                ))}
              </div>
            </div>

            {/* Tool buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 2, textAlign: 'center' }}>Herramienta</div>
              {[
                { id: 'brush', label: '🖌 Pincel' },
                { id: 'eraser', label: '🧹 Borrar' },
              ].map(t => (
                <button key={t.id} onClick={() => setTool(t.id as 'brush' | 'eraser')}
                  style={{ background: tool === t.id ? '#5a3e2b' : '#faf5ee', color: tool === t.id ? 'white' : '#5a3e2b', border: '2px solid', borderColor: tool === t.id ? '#5a3e2b' : '#d4c4a8', borderRadius: 10, padding: '7px 3px', fontFamily: 'Nunito, sans-serif', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Brush size */}
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 5, textAlign: 'center' }}>Tamaño</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
                {[8, 16, 26, 38].map(s => (
                  <div key={s} onClick={() => setBrushSize(s)}
                    style={{ width: Math.min(s * 0.7, 26), height: Math.min(s * 0.7, 26), borderRadius: '50%', background: '#5a3e2b', cursor: 'pointer', flexShrink: 0, boxShadow: brushSize === s ? '0 0 0 2px white, 0 0 0 4px #3d2b1f' : '0 2px 0 rgba(0,0,0,0.2)' }} />
                ))}
              </div>
            </div>

            {/* Reset */}
            <button onClick={clearPaint}
              style={{ background: '#fff5f5', border: '2px solid #ffb3b3', borderRadius: 10, padding: '7px 3px', fontFamily: 'Nunito, sans-serif', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#cc4444' }}>
              🗑 Limpiar
            </button>

            {/* Save */}
            <button onClick={() => setShowSaveModal(true)}
              style={{ background: 'linear-gradient(135deg, #ff6b6b, #ff8e53)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 3px', fontFamily: 'Baloo 2, cursive', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 0 #cc4444' }}>
              💾 Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Save modal */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 28, maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 8px 0 #e2d5c3' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💾</div>
            <h3 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '1.3rem', color: '#3d2b1f', marginBottom: 14 }}>¿Cómo se llama tu dibujo?</h3>
            <input type="text" placeholder={`${selectedPage.label} coloreado`} value={saveTitle} onChange={e => setSaveTitle(e.target.value)} maxLength={40}
              style={{ padding: '10px 14px', borderRadius: 12, border: '2px solid #e0d4c0', fontFamily: 'Nunito, sans-serif', fontSize: '1rem', background: '#faf5ee', color: '#3d2b1f', width: '100%', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ background: 'transparent', border: '2px solid #d4c4a8', borderRadius: 50, padding: '9px 18px', fontFamily: 'Nunito, sans-serif', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', color: '#7a5c4a' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #ff6b6b, #ff8e53)', color: 'white', border: 'none', borderRadius: 50, padding: '9px 20px', fontFamily: 'Baloo 2, cursive', fontSize: '0.95rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 3px 0 #cc4444', opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Guardando...' : '✅ ¡Guardar!'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
