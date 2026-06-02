'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { BASE_COLORS, RECIPES, TOTAL_MIXABLE, findRecipe } from '@/lib/game-data'

interface Props {
  userId: string
  displayName: string
  initialDiscovered: string[]
}

const BRUSH_SIZES = [8, 14, 22, 34]

export default function GameClient({ userId, displayName, initialDiscovered }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Game state
  const [discovered, setDiscovered] = useState<Set<string>>(new Set(initialDiscovered))
  const [selectedBase, setSelectedBase] = useState<string | null>(null)
  const [slots, setSlots] = useState<[string | null, string | null]>([null, null])
  const [resultColor, setResultColor] = useState<string | null>(null)
  const [mixMessage, setMixMessage] = useState('')
  const [currentPaint, setCurrentPaint] = useState<string | null>(null)
  const [brushSize, setBrushSize] = useState(14)
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [toast, setToast] = useState<{ msg: string; show: boolean; celebrate: boolean }>({ msg: '', show: false, celebrate: false })
  const [saving, setSaving] = useState(false)
  const [drawingTitle, setDrawingTitle] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Drawing state
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, rect.width, rect.height)
  }, [])

  function showToast(msg: string, celebrate = false) {
    setToast({ msg, show: true, celebrate })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2800)
  }

  // ---- MIX LOGIC ----
  function fillSlot(idx: 0 | 1) {
    if (!selectedBase) { showToast('👆 Primero tocá un color'); return }
    setSlots(prev => {
      const next: [string | null, string | null] = [...prev] as [string | null, string | null]
      next[idx] = selectedBase
      return next
    })
  }

  function clearMix() {
    setSlots([null, null])
    setResultColor(null)
    setMixMessage('')
  }

  async function mixColors() {
    if (!slots[0] || !slots[1]) { showToast('🫗 Llenás las dos ranuras?'); return }
    const recipe = findRecipe(slots[0], slots[1])
    if (!recipe) {
      setResultColor(blendHex(slots[0], slots[1]))
      setMixMessage('🤔 Esa mezcla no tiene nombre especial...')
      showToast('🤔 ¡Seguí explorando!')
      return
    }
    setResultColor(recipe.result)
    const isNew = !discovered.has(recipe.result)
    if (isNew) {
      const next = new Set(discovered)
      next.add(recipe.result)
      setDiscovered(next)
      setMixMessage(`✅ ¡${recipe.name}! Usalo para pintar 🎨`)
      showToast(`${recipe.emoji} ¡Descubriste ${recipe.name}!`, true)
      // Save to Supabase
      await supabase.from('discovered_colors').upsert({
        user_id: userId,
        color_hex: recipe.result,
        color_name: recipe.name,
      })
    } else {
      setMixMessage(`${recipe.emoji} ${recipe.name} — ¡ya lo tenés!`)
      showToast(`${recipe.emoji} ${recipe.name}`)
    }
  }

  function blendHex(h1: string, h2: string) {
    const r1 = parseInt(h1.slice(1,3),16), g1 = parseInt(h1.slice(3,5),16), b1 = parseInt(h1.slice(5,7),16)
    const r2 = parseInt(h2.slice(1,3),16), g2 = parseInt(h2.slice(3,5),16), b2 = parseInt(h2.slice(5,7),16)
    const r = Math.round((r1+r2)/2), g = Math.round((g1+g2)/2), b = Math.round((b1+b2)/2)
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  }

  // ---- CANVAS DRAWING ----
  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (tool === 'brush' && !currentPaint) { showToast('🎨 Elegí un color primero!'); return }
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    isDrawing.current = true
    lastPos.current = pos
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2)
    ctx.fillStyle = tool === 'eraser' ? 'white' : currentPaint!
    ctx.fill()
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = tool === 'eraser' ? 'white' : currentPaint!
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  function stopDraw() { isDrawing.current = false }

  function clearCanvas() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // ---- SAVE DRAWING ----
  async function saveDrawing() {
    const canvas = canvasRef.current!
    setSaving(true)
    try {
      const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'))
      const filename = `${userId}/${Date.now()}.png`
      const { data: upload, error: uploadErr } = await supabase.storage
        .from('drawings')
        .upload(filename, blob, { contentType: 'image/png', upsert: false })

      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage.from('drawings').getPublicUrl(filename)

      await supabase.from('drawings').insert({
        user_id: userId,
        title: drawingTitle.trim() || 'Mi dibujo',
        image_url: publicUrl,
        storage_path: filename,
      })

      showToast('💾 ¡Dibujo guardado!', true)
      setShowSaveModal(false)
      setDrawingTitle('')
    } catch (err) {
      showToast('❌ Error al guardar, intentá de nuevo')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const mixedFound = [...discovered].filter(h => !BASE_COLORS.find(b => b.hex === h)).length

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(circle at 20% 20%, #ffe0f0 0%, transparent 40%), radial-gradient(circle at 80% 80%, #d0eeff 0%, transparent 40%)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: 'clamp(1.2rem, 4vw, 1.8rem)', color: '#3d2b1f' }}>
          🎨 Hola, {displayName}!
        </h1>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '2px solid #d4c4a8', borderRadius: '50px', padding: '6px 14px', fontFamily: 'Nunito, sans-serif', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', color: '#7a5c4a' }}>
          Salir
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, maxWidth: 900, margin: '10px auto', padding: '0 12px 20px' }}>

        {/* MIXING LAB */}
        <div style={card}>
          <div style={sectionTitle}>🧪 Mezclar colores</div>
          <p style={{ fontSize: '0.82rem', color: '#7a5c4a', fontWeight: 600, marginBottom: 10 }}>
            Tocá un color y luego una ranura
          </p>
          {/* Base colors */}
          <p style={{ fontSize: '0.75rem', color: '#a08060', fontWeight: 700, marginBottom: 6 }}>Colores base</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
            {BASE_COLORS.map(c => (
              <button key={c.hex} onClick={() => setSelectedBase(c.hex)}
                style={{
                  ...colorCircle,
                  background: c.hex,
                  border: selectedBase === c.hex ? '3px solid #3d2b1f' : c.hex === '#FFFFFF' ? '3px solid #ddd' : '3px solid white',
                  transform: selectedBase === c.hex ? 'scale(1.15) translateY(-3px)' : undefined,
                  boxShadow: selectedBase === c.hex ? '0 0 0 3px white, 0 0 0 5px #3d2b1f, 0 4px 8px rgba(0,0,0,0.15)' : '0 3px 0 rgba(0,0,0,0.12)',
                }}
                title={c.name}
              />
            ))}
          </div>
          {/* Discovered mixed colors - also usable for mixing */}
          {RECIPES.filter(r => discovered.has(r.result)).length > 0 && (
            <>
              <p style={{ fontSize: '0.75rem', color: '#a08060', fontWeight: 700, marginBottom: 6 }}>Colores descubiertos</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14, maxHeight: 120, overflowY: 'auto' }}>
                {RECIPES.filter(r => discovered.has(r.result)).map(r => (
                  <button key={r.result} onClick={() => setSelectedBase(r.result)}
                    title={r.name}
                    style={{
                      ...colorCircle,
                      background: r.result,
                      border: selectedBase === r.result ? '3px solid #3d2b1f' : '3px solid white',
                      transform: selectedBase === r.result ? 'scale(1.15) translateY(-3px)' : undefined,
                      boxShadow: selectedBase === r.result ? '0 0 0 3px white, 0 0 0 5px #3d2b1f, 0 4px 8px rgba(0,0,0,0.15)' : '0 3px 0 rgba(0,0,0,0.12)',
                    }}
                  />
                ))}
              </div>
            </>
          )}
          {/* Mix zone */}
          <div style={{ background: '#faf5ee', borderRadius: 16, padding: 14, border: '2px dashed #d4c4a8', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {([0, 1] as const).map(idx => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div onClick={() => fillSlot(idx)} style={{
                    ...mixSlot,
                    background: slots[idx] ?? 'white',
                    border: slots[idx] ? (slots[idx] === '#FFFFFF' ? '2px solid #ddd' : '2px solid rgba(0,0,0,0.12)') : '2px dashed #c4b08a',
                    cursor: 'pointer',
                  }} />
                  {idx === 0 && <span style={{ fontSize: '1.4rem', color: '#c4b08a', fontWeight: 900 }}>+</span>}
                </div>
              ))}
              <span style={{ fontSize: '1.2rem', color: '#c4b08a', fontWeight: 900 }}>=</span>
              <div style={{
                ...resultCircle,
                background: resultColor ?? 'white',
                border: resultColor ? '2px solid rgba(0,0,0,0.12)' : '2px dashed #c4b08a',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={mixColors} style={mixBtn}>✨ ¡Mezclar!</button>
              <button onClick={clearMix} style={clearBtn}>🗑 Limpiar</button>
            </div>
            {mixMessage && <p style={{ marginTop: 8, fontSize: '0.9rem', fontWeight: 700, color: '#5a3e2b' }}>{mixMessage}</p>}
          </div>
        </div>

        {/* DISCOVERED - COLOR WHEEL */}
        <div style={card}>
          <div style={sectionTitle}>🌈 Mis colores</div>
          <div style={{ background: '#f0e8d6', borderRadius: 50, height: 10, marginBottom: 4 }}>
            <div style={{ height: '100%', borderRadius: 50, background: 'linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f)', width: `${Math.round((mixedFound / TOTAL_MIXABLE) * 100)}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: '#7a5c4a', fontWeight: 700, textAlign: 'right', marginBottom: 10 }}>
            {mixedFound} / {TOTAL_MIXABLE} descubiertos
          </p>
          <ColorWheel
            discovered={discovered}
            currentPaint={currentPaint}
            onSelect={(hex) => { setCurrentPaint(hex); setTool('brush') }}
          />
        </div>

        {/* CANVAS */}
        <div style={{ ...card, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={sectionTitle}>🖌 Pintar</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Active color */}
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: currentPaint ?? '#ccc', border: '3px solid white', boxShadow: '0 0 0 2px #d4c4a8, 0 3px 8px rgba(0,0,0,0.15)' }} />
              {/* Brush sizes */}
              {BRUSH_SIZES.map(s => (
                <div key={s} onClick={() => { setBrushSize(s); setTool('brush') }}
                  style={{ width: Math.min(s, 28), height: Math.min(s, 28), borderRadius: '50%', background: '#5a3e2b', cursor: 'pointer', flexShrink: 0, boxShadow: brushSize === s ? '0 0 0 3px white, 0 0 0 5px #3d2b1f' : '0 2px 0 rgba(0,0,0,0.2)', transition: 'transform 0.1s' }} />
              ))}
              <button onClick={() => setTool('brush')} style={{ ...toolBtn, background: tool === 'brush' ? '#5a3e2b' : '#faf5ee', color: tool === 'brush' ? 'white' : '#5a3e2b', borderColor: tool === 'brush' ? '#5a3e2b' : '#d4c4a8' }}>🖌 Pincel</button>
              <button onClick={() => setTool('eraser')} style={{ ...toolBtn, background: tool === 'eraser' ? '#5a3e2b' : '#faf5ee', color: tool === 'eraser' ? 'white' : '#5a3e2b', borderColor: tool === 'eraser' ? '#5a3e2b' : '#d4c4a8' }}>🧹 Borrar</button>
              <button onClick={clearCanvas} style={{ ...toolBtn, color: '#cc4444', borderColor: '#ffb3b3' }}>🗑 Nuevo</button>
              <button onClick={() => setShowSaveModal(true)} style={{ ...toolBtn, background: 'linear-gradient(135deg, #ff6b6b, #ff8e53)', color: 'white', border: 'none', boxShadow: '0 3px 0 #cc4444' }}>💾 Guardar</button>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 260, borderRadius: 16, border: '2px solid #e8dcc8', background: 'white', cursor: tool === 'eraser' ? 'cell' : 'crosshair', display: 'block', touchAction: 'none' }}
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

      {/* TOAST */}
      <div style={{
        position: 'fixed', top: 24, left: '50%', transform: `translateX(-50%) translateY(${toast.show ? '0' : '-90px'})`,
        background: 'linear-gradient(135deg, #3d2b1f, #5a3e2b)', color: 'white', padding: '13px 26px',
        borderRadius: 50, fontFamily: 'Baloo 2, cursive', fontSize: '1rem', fontWeight: 700,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1000, transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {toast.celebrate ? `⭐ ${toast.msg} ⭐` : toast.msg}
      </div>

      {/* SAVE MODAL */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 28, maxWidth: 360, width: '100%', boxShadow: '0 8px 0 #e2d5c3, 0 12px 32px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💾</div>
            <h2 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '1.4rem', color: '#3d2b1f', marginBottom: 16 }}>¿Cómo se llama tu dibujo?</h2>
            <input
              type="text"
              placeholder="Mi dibujo lindo..."
              value={drawingTitle}
              onChange={e => setDrawingTitle(e.target.value)}
              maxLength={40}
              style={{ padding: '10px 14px', borderRadius: 12, border: '2px solid #e0d4c0', fontFamily: 'Nunito, sans-serif', fontSize: '1rem', background: '#faf5ee', color: '#3d2b1f', width: '100%', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ ...clearBtn, padding: '10px 20px' }}>Cancelar</button>
              <button onClick={saveDrawing} disabled={saving} style={{ ...mixBtn, opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Guardando...' : '✅ ¡Guardar!'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- STYLES ----
const card: React.CSSProperties = { background: 'white', borderRadius: 24, padding: 18, boxShadow: '0 6px 0 #e2d5c3, 0 8px 20px rgba(0,0,0,0.08)', border: '2px solid #f0e6d2' }
const sectionTitle: React.CSSProperties = { fontFamily: 'Baloo 2, cursive', fontSize: '1.1rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }
const colorCircle: React.CSSProperties = { aspectRatio: '1', borderRadius: '50%', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', outline: 'none' }
const mixSlot: React.CSSProperties = { width: 52, height: 52, borderRadius: '50%', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }
const resultCircle: React.CSSProperties = { width: 64, height: 64, borderRadius: '50%', transition: 'all 0.3s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)' }
const mixBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #ff6b6b, #ff8e53)', color: 'white', border: 'none', borderRadius: 50, padding: '9px 22px', fontFamily: 'Baloo 2, cursive', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 0 #cc4444' }
const clearBtn: React.CSSProperties = { background: 'transparent', border: '2px solid #d4c4a8', borderRadius: 50, padding: '6px 14px', fontFamily: 'Nunito, sans-serif', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', color: '#7a5c4a' }
const paletteItem: React.CSSProperties = { aspectRatio: '1', borderRadius: 12, position: 'relative', cursor: 'pointer', overflow: 'hidden', transition: 'transform 0.15s, box-shadow 0.15s' }
const paletteLabel: React.CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: '0.6rem', fontWeight: 700, textAlign: 'center', padding: '2px 1px', lineHeight: 1.2 }
const toolBtn: React.CSSProperties = { background: '#faf5ee', border: '2px solid #d4c4a8', borderRadius: 10, padding: '5px 10px', fontFamily: 'Nunito, sans-serif', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', color: '#5a3e2b' }

// ========== COLOR WHEEL COMPONENT ==========
interface WheelProps {
  discovered: Set<string>
  currentPaint: string | null
  onSelect: (hex: string) => void
}

function ColorWheel({ discovered, currentPaint, onSelect }: WheelProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const size = 280
  const cx = size / 2
  const cy = size / 2
  const outerR = 128
  const innerR = 54
  const total = RECIPES.length // 15 slices

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180)
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function slicePath(i: number, rInner: number, rOuter: number, expand = 0) {
    const sliceAngle = 360 / total
    const startAngle = i * sliceAngle
    const endAngle = startAngle + sliceAngle
    const r1 = rInner - expand
    const r2 = rOuter + expand
    const p1 = polarToXY(startAngle, r1)
    const p2 = polarToXY(startAngle, r2)
    const p3 = polarToXY(endAngle, r2)
    const p4 = polarToXY(endAngle, r1)
    const largeArc = sliceAngle > 180 ? 1 : 0
    return [
      `M ${p1.x} ${p1.y}`,
      `L ${p2.x} ${p2.y}`,
      `A ${r2} ${r2} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
      `L ${p4.x} ${p4.y}`,
      `A ${r1} ${r1} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
      'Z'
    ].join(' ')
  }

  function labelPos(i: number) {
    const sliceAngle = 360 / total
    const midAngle = i * sliceAngle + sliceAngle / 2
    const r = (innerR + outerR) / 2
    return polarToXY(midAngle, r)
  }

  // Base color positions for center ring (5 evenly spaced)
  function baseSlicePath(i: number, expand = 0) {
    const sliceAngle = 360 / 5
    const startAngle = i * sliceAngle
    const endAngle = startAngle + sliceAngle
    const r1 = 10 - expand
    const r2 = innerR - 4 + expand
    const p1 = polarToXY(startAngle, r1)
    const p2 = polarToXY(startAngle, r2)
    const p3 = polarToXY(endAngle, r2)
    const p4 = polarToXY(endAngle, r1)
    const largeArc = sliceAngle > 180 ? 1 : 0
    return [
      `M ${p1.x} ${p1.y}`,
      `L ${p2.x} ${p2.y}`,
      `A ${r2} ${r2} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
      `L ${p4.x} ${p4.y}`,
      `A ${r1} ${r1} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
      'Z'
    ].join(' ')
  }

  const hoveredData = hovered
    ? (RECIPES.find(r => r.result === hovered) ?? BASE_COLORS.find(b => b.hex === hovered))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ overflow: 'visible' }}>
          {/* Outer ring - 15 recipe colors */}
          {RECIPES.map((r, i) => {
            const isDisc = discovered.has(r.result)
            const isHov = hovered === r.result
            const isSel = currentPaint === r.result
            const expand = isHov ? 6 : isSel ? 4 : 0
            return (
              <g key={r.result}
                onClick={() => isDisc && onSelect(r.result)}
                onMouseEnter={() => setHovered(r.result)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: isDisc ? 'pointer' : 'default' }}
              >
                <path
                  d={slicePath(i, innerR, outerR, expand)}
                  fill={isDisc ? r.result : '#e8ddd0'}
                  stroke="#2a1a0e"
                  strokeWidth={isHov || isSel ? 2.5 : 1.5}
                  style={{ transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)', filter: isSel ? 'brightness(1.1)' : undefined }}
                />
                {!isDisc && (
                  <text
                    x={labelPos(i).x}
                    y={labelPos(i).y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="13"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >🔒</text>
                )}
                {isSel && isDisc && (
                  <circle
                    cx={labelPos(i).x}
                    cy={labelPos(i).y}
                    r="6"
                    fill="white"
                    opacity="0.7"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
              </g>
            )
          })}

          {/* Inner ring - 5 base colors */}
          {BASE_COLORS.map((c, i) => {
            const isHov = hovered === c.hex
            const isSel = currentPaint === c.hex
            const expand = isHov ? 4 : isSel ? 3 : 0
            return (
              <g key={c.hex}
                onClick={() => onSelect(c.hex)}
                onMouseEnter={() => setHovered(c.hex)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={baseSlicePath(i, expand)}
                  fill={c.hex}
                  stroke="#2a1a0e"
                  strokeWidth={isHov || isSel ? 2 : 1.2}
                  style={{
                    transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                    filter: c.hex === '#FFFFFF' ? undefined : isSel ? 'brightness(1.1)' : undefined
                  }}
                />
              </g>
            )
          })}

          {/* Center dot */}
          <circle cx={cx} cy={cy} r={9} fill="#3d2b1f" stroke="#2a1a0e" strokeWidth={1} />
        </svg>
      </div>

      {/* Hover label */}
      <div style={{
        minHeight: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'opacity 0.2s',
        opacity: hoveredData ? 1 : 0,
      }}>
        {hoveredData && (
          <>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'hex' in hoveredData ? hoveredData.hex : ('result' in hoveredData ? hoveredData.result : '#ccc'),
              border: '2px solid #3d2b1f',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'Baloo 2, cursive',
              fontWeight: 700,
              fontSize: '1rem',
              color: '#3d2b1f',
              background: '#fdf6e3',
              padding: '3px 12px',
              borderRadius: 50,
              border: '2px solid #e0d4c0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}>
              {'name' in hoveredData ? hoveredData.name : ''}
              {!discovered.has('result' in hoveredData ? hoveredData.result : hoveredData.hex) ? ' 🔒' : ''}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
