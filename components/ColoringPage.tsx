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

interface Props {
  userId: string
  currentPaint: string | null
  onClose: () => void
  onSave: (title: string, imageUrl: string, storagePath: string) => void
}

export default function ColoringPage({ userId, currentPaint, onClose, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedPage, setSelectedPage] = useState(PAGES[0])
  const [activeColor, setActiveColor] = useState(currentPaint ?? '#E53935')
  const [tool, setTool] = useState<'fill' | 'brush' | 'eraser'>('fill')
  const [brushSize, setBrushSize] = useState(12)
  const [saving, setSaving] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const supabase = createClient()

  // When parent paint color changes, update activeColor
  useEffect(() => {
    if (currentPaint) setActiveColor(currentPaint)
  }, [currentPaint])

  // Load SVG into canvas when page changes
  useEffect(() => {
    loadPage(selectedPage.id)
  }, [selectedPage])

  function loadPage(id: string) {
    setLoading(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = 400, H = 500
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, W, H)

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, H)
      setLoading(false)
    }
    img.onerror = () => setLoading(false)
    img.src = `/coloring/${id}.svg`
  }

  // ---- FLOOD FILL ----
  function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1,3), 16)
    const g = parseInt(hex.slice(3,5), 16)
    const b = parseInt(hex.slice(5,7), 16)
    return [r, g, b]
  }

  function floodFill(startX: number, startY: number, fillColor: string) {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = Math.floor(canvas.width)
    const H = Math.floor(canvas.height)
    const imageData = ctx.getImageData(0, 0, W, H)
    const data = imageData.data

    const px = Math.floor(startX * dpr)
    const py = Math.floor(startY * dpr)
    const idx = (py * W + px) * 4
    const targetR = data[idx], targetG = data[idx+1], targetB = data[idx+2]

    // Don't fill if clicking on a dark outline
    if (targetR < 80 && targetG < 80 && targetB < 80) return

    const [fillR, fillG, fillB] = hexToRgb(fillColor)
    if (targetR === fillR && targetG === fillG && targetB === fillB) return

    const tolerance = 40
    function matchColor(i: number) {
      return Math.abs(data[i] - targetR) < tolerance &&
             Math.abs(data[i+1] - targetG) < tolerance &&
             Math.abs(data[i+2] - targetB) < tolerance
    }

    const stack: number[] = [px + py * W]
    const visited = new Uint8Array(W * H)
    visited[px + py * W] = 1

    while (stack.length > 0) {
      const pos = stack.pop()!
      const x = pos % W
      const y = Math.floor(pos / W)
      const i = pos * 4

      data[i] = fillR
      data[i+1] = fillG
      data[i+2] = fillB
      data[i+3] = 255

      const neighbors = [
        x > 0 ? pos - 1 : -1,
        x < W-1 ? pos + 1 : -1,
        y > 0 ? pos - W : -1,
        y < H/dpr-1 ? pos + W : -1,
      ]
      for (const n of neighbors) {
        if (n >= 0 && !visited[n] && matchColor(n * 4)) {
          visited[n] = 1
          stack.push(n)
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }

  // ---- BRUSH DRAWING ----
  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function handleStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const pos = getPos(e)
    if (tool === 'fill') {
      floodFill(pos.x, pos.y, activeColor)
      return
    }
    isDrawing.current = true
    lastPos.current = pos
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize/2, 0, Math.PI*2)
    ctx.fillStyle = tool === 'eraser' ? 'white' : activeColor
    ctx.fill()
  }

  function handleMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current || tool === 'fill') return
    e.preventDefault()
    const pos = getPos(e)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = tool === 'eraser' ? 'white' : activeColor
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  function handleEnd() { isDrawing.current = false }

  async function handleSave() {
    const canvas = canvasRef.current!
    setSaving(true)
    try {
      const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'))
      const filename = `${userId}/${Date.now()}_colorear.png`
      const { error: uploadErr } = await supabase.storage.from('drawings').upload(filename, blob, { contentType: 'image/png' })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('drawings').getPublicUrl(filename)
      await supabase.from('drawings').insert({ user_id: userId, title: saveTitle.trim() || `${selectedPage.label} coloreado`, image_url: publicUrl, storage_path: filename })
      onSave(saveTitle || selectedPage.label, publicUrl, filename)
      setShowSaveModal(false)
      setSaveTitle('')
    } catch {
      alert('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const QUICK_COLORS = ['#E53935','#FDD835','#1E88E5','#43A047','#FF7043','#8E24AA','#F48FB1','#FFCA28','#00838F','#212121','#FFFFFF','#9E9E9E']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 12 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 820, maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.35)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'white', borderBottom: '2px solid #f0e6d2' }}>
          <h2 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '1.2rem', color: '#3d2b1f', margin: 0 }}>
            🎨 Colorear — {selectedPage.emoji} {selectedPage.label}
          </h2>
          <button onClick={onClose} style={{ background: '#faf5ee', border: '2px solid #d4c4a8', borderRadius: '50%', width: 34, height: 34, fontSize: '1rem', cursor: 'pointer', color: '#5a3e2b', fontWeight: 700 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>

          {/* Left sidebar - page selector */}
          <div style={{ width: 100, background: 'white', borderRight: '2px solid #f0e6d2', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 4px' }}>
            {PAGES.map(p => (
              <button key={p.id} onClick={() => setSelectedPage(p)}
                style={{ background: selectedPage.id === p.id ? '#fdf0e0' : 'transparent', border: selectedPage.id === p.id ? '2px solid #d4a870' : '2px solid transparent', borderRadius: 12, padding: '8px 4px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '1.5rem' }}>{p.emoji}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#5a3e2b', lineHeight: 1.2 }}>{p.label}</div>
              </button>
            ))}
          </div>

          {/* Canvas area */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5ece0', position: 'relative', overflow: 'hidden' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5ece0', zIndex: 2 }}>
                <div style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 700, color: '#7a5c4a' }}>🎨 Cargando...</div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={{ width: 400, height: 500, maxWidth: '100%', maxHeight: '100%', borderRadius: 12, border: '2px solid #e8dcc8', background: 'white', cursor: tool === 'fill' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'crosshair', display: 'block', touchAction: 'none', objectFit: 'contain' }}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          </div>

          {/* Right sidebar - tools */}
          <div style={{ width: 110, background: 'white', borderLeft: '2px solid #f0e6d2', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

            {/* Active color */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 4 }}>Color</div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: activeColor, border: activeColor === '#FFFFFF' ? '3px solid #ccc' : '3px solid white', boxShadow: '0 0 0 2px #d4c4a8, 0 3px 8px rgba(0,0,0,0.15)', margin: '0 auto' }} />
            </div>

            {/* Quick palette */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 4, textAlign: 'center' }}>Paleta</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {QUICK_COLORS.map(c => (
                  <div key={c} onClick={() => { setActiveColor(c); setTool('fill') }}
                    style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: activeColor === c ? '2px solid #3d2b1f' : c === '#FFFFFF' ? '2px solid #ccc' : '2px solid white', cursor: 'pointer', boxShadow: activeColor === c ? '0 0 0 2px white, 0 0 0 4px #3d2b1f' : '0 2px 0 rgba(0,0,0,0.15)' }} />
                ))}
              </div>
            </div>

            {/* Tools */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 4, textAlign: 'center' }}>Herramientas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { id: 'fill', label: '🪣 Balde', title: 'Rellenar sección' },
                  { id: 'brush', label: '🖌 Pincel', title: 'Pincel libre' },
                  { id: 'eraser', label: '🧹 Borrar', title: 'Borrador' },
                ].map(t => (
                  <button key={t.id} onClick={() => setTool(t.id as typeof tool)} title={t.title}
                    style={{ background: tool === t.id ? '#5a3e2b' : '#faf5ee', color: tool === t.id ? 'white' : '#5a3e2b', border: '2px solid', borderColor: tool === t.id ? '#5a3e2b' : '#d4c4a8', borderRadius: 10, padding: '6px 4px', fontFamily: 'Nunito, sans-serif', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brush size (only for brush/eraser) */}
            {tool !== 'fill' && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7a5c4a', marginBottom: 4, textAlign: 'center' }}>Tamaño</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {[6, 12, 20, 30].map(s => (
                    <div key={s} onClick={() => setBrushSize(s)}
                      style={{ width: Math.min(s, 24), height: Math.min(s, 24), borderRadius: '50%', background: '#5a3e2b', cursor: 'pointer', boxShadow: brushSize === s ? '0 0 0 2px white, 0 0 0 4px #3d2b1f' : '0 2px 0 rgba(0,0,0,0.2)' }} />
                  ))}
                </div>
              </div>
            )}

            {/* Reset page */}
            <button onClick={() => loadPage(selectedPage.id)}
              style={{ background: '#fff5f5', border: '2px solid #ffb3b3', borderRadius: 10, padding: '7px 4px', fontFamily: 'Nunito, sans-serif', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#cc4444' }}>
              🗑 Reiniciar
            </button>

            {/* Save */}
            <button onClick={() => setShowSaveModal(true)}
              style={{ background: 'linear-gradient(135deg, #ff6b6b, #ff8e53)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 4px', fontFamily: 'Baloo 2, cursive', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 0 #cc4444' }}>
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
            <h3 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '1.3rem', color: '#3d2b1f', marginBottom: 14 }}>
              ¿Cómo se llama tu dibujo?
            </h3>
            <input type="text" placeholder={`${selectedPage.label} coloreado`} value={saveTitle} onChange={e => setSaveTitle(e.target.value)} maxLength={40}
              style={{ padding: '10px 14px', borderRadius: 12, border: '2px solid #e0d4c0', fontFamily: 'Nunito, sans-serif', fontSize: '1rem', background: '#faf5ee', color: '#3d2b1f', width: '100%', marginBottom: 14 }}
            />
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
