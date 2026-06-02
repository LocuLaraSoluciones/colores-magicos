'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { TOTAL_MIXABLE, BASE_COLORS } from '@/lib/game-data'

interface Drawing {
  id: string
  title: string
  image_url: string
  created_at: string
}

interface DiscoveredColor {
  color_hex: string
  color_name: string
  discovered_at: string
}

interface ChildData {
  id: string
  display_name: string
  discoveredCount: number
  drawingCount: number
  drawings: Drawing[]
  discovered: DiscoveredColor[]
}

interface Props {
  adminName: string
  children: ChildData[]
}

export default function AdminClient({ adminName, children }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState(0)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [resetModal, setResetModal] = useState<{ open: boolean; childId: string; childName: string }>({ open: false, childId: '', childName: '' })
  const [resetting, setResetting] = useState(false)
  const [childrenData, setChildrenData] = useState(children)

  async function handleReset() {
    setResetting(true)
    await supabase
      .from('discovered_colors')
      .delete()
      .eq('user_id', resetModal.childId)
    // Refresh local state
    setChildrenData(prev => prev.map(c =>
      c.id === resetModal.childId
        ? { ...c, discovered: [], discoveredCount: 0 }
        : c
    ))
    setResetting(false)
    setResetModal({ open: false, childId: '', childName: '' })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const child = childrenData[activeTab]

  const mixedFound = child
    ? child.discovered.filter(d => !BASE_COLORS.find(b => b.hex === d.color_hex)).length
    : 0

  const pct = Math.round((mixedFound / TOTAL_MIXABLE) * 100)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(circle at 20% 20%, #ffe0f0 0%, transparent 40%), radial-gradient(circle at 80% 80%, #d0eeff 0%, transparent 40%)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', maxWidth: 960, margin: '0 auto' }}>
        <div>
          <h1 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: 'clamp(1.3rem, 4vw, 2rem)', color: '#3d2b1f' }}>
            🎨 Panel de {adminName}
          </h1>
          <p style={{ color: '#7a5c4a', fontSize: '0.88rem', fontWeight: 600 }}>Ver el progreso de las nenas</p>
        </div>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '2px solid #d4c4a8', borderRadius: 50, padding: '7px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', color: '#7a5c4a' }}>
          Salir
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 32px' }}>

        {/* TABS */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {childrenData.map((c, i) => (
            <button key={c.id} onClick={() => setActiveTab(i)}
              style={{
                fontFamily: 'Baloo 2, cursive',
                fontWeight: 700,
                fontSize: '1.05rem',
                padding: '10px 28px',
                borderRadius: '16px 16px 0 0',
                border: '2px solid',
                borderBottom: activeTab === i ? '2px solid white' : '2px solid #d4c4a8',
                background: activeTab === i ? 'white' : '#f5ece0',
                color: activeTab === i ? '#3d2b1f' : '#7a5c4a',
                cursor: 'pointer',
                position: 'relative',
                top: activeTab === i ? 2 : 0,
                boxShadow: activeTab === i ? '0 -4px 12px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
                borderColor: activeTab === i ? '#f0e6d2' : '#d4c4a8',
              }}>
              {i === 0 ? '🌸' : '🌻'} {c.display_name}
            </button>
          ))}
        </div>

        {/* CHILD PANEL */}
        {child && (
          <div style={{ background: 'white', borderRadius: '0 16px 16px 16px', border: '2px solid #f0e6d2', boxShadow: '0 6px 0 #e2d5c3, 0 8px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderBottom: '2px solid #f0e6d2' }}>
              <StatCard emoji="🌈" value={mixedFound} label="Colores descubiertos" sub={`de ${TOTAL_MIXABLE} posibles`} border />
              <StatCard emoji="🖼️" value={child.drawingCount} label="Dibujos guardados" border />
              <StatCard emoji="🏆" value={`${pct}%`} label="Progreso total" sub="del juego completado" />
            </div>

            {/* Progress bar */}
            <div style={{ padding: '16px 24px', borderBottom: '2px solid #f0e6d2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 700, color: '#3d2b1f', fontSize: '0.95rem' }}>🧪 Progreso de mezclas</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 700, color: '#7a5c4a', fontSize: '0.88rem' }}>{mixedFound} / {TOTAL_MIXABLE}</span>
                  <button
                    onClick={() => setResetModal({ open: true, childId: child.id, childName: child.display_name })}
                    style={{ background: '#fff5f5', border: '2px solid #ffb3b3', borderRadius: 50, padding: '5px 14px', fontFamily: 'Nunito, sans-serif', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', color: '#cc4444', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    🔄 Resetear colores
                  </button>
                </div>
              </div>
              <div style={{ background: '#f0e8d6', borderRadius: 50, height: 14 }}>
                <div style={{ height: '100%', borderRadius: 50, background: 'linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f)', width: `${pct}%`, transition: 'width 0.5s' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0 }}>
              {/* DISCOVERED COLORS */}
              <div style={{ padding: 24, borderRight: '2px solid #f0e6d2' }}>
                <h3 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 700, fontSize: '1rem', color: '#3d2b1f', marginBottom: 14 }}>
                  🌈 Colores descubiertos por {child.display_name}
                </h3>
                {child.discovered.length === 0 ? (
                  <p style={{ color: '#a08060', fontSize: '0.88rem', fontStyle: 'italic' }}>Todavía no descubrió ningún color mezclado.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                    {child.discovered
                      .filter(d => !BASE_COLORS.find(b => b.hex === d.color_hex))
                      .map(d => (
                        <div key={d.color_hex} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#faf5ee', borderRadius: 12, border: '1px solid #f0e6d2' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: d.color_hex, border: d.color_hex === '#FFFFFF' ? '2px solid #ddd' : '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.12)', flexShrink: 0 }} />
                          <div>
                            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#3d2b1f' }}>{d.color_name}</p>
                            <p style={{ fontSize: '0.75rem', color: '#a08060' }}>{formatDate(d.discovered_at)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* DRAWINGS */}
              <div style={{ padding: 24 }}>
                <h3 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 700, fontSize: '1rem', color: '#3d2b1f', marginBottom: 14 }}>
                  🖼️ Dibujos de {child.display_name}
                </h3>
                {child.drawings.length === 0 ? (
                  <p style={{ color: '#a08060', fontSize: '0.88rem', fontStyle: 'italic' }}>Todavía no guardó ningún dibujo.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, maxHeight: 380, overflowY: 'auto' }}>
                    {child.drawings.map(d => (
                      <div key={d.id} onClick={() => setLightbox(d.image_url)}
                        style={{ borderRadius: 14, overflow: 'hidden', border: '2px solid #f0e6d2', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: '0 3px 0 #e2d5c3' }}
                        onMouseOver={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                        onMouseOut={e => (e.currentTarget.style.transform = 'scale(1)')}>
                        <img src={d.image_url} alt={d.title} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                        <div style={{ padding: '6px 8px', background: '#faf5ee' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.78rem', color: '#3d2b1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</p>
                          <p style={{ fontSize: '0.7rem', color: '#a08060' }}>{formatDate(d.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {children.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7a5c4a' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>👧</div>
            <p style={{ fontFamily: 'Baloo 2, cursive', fontSize: '1.2rem' }}>No hay usuarias registradas todavía.</p>
          </div>
        )}
      </div>

      {/* RESET MODAL */}
      {resetModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 32, maxWidth: 400, width: '100%', boxShadow: '0 8px 0 #e2d5c3, 0 12px 32px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: 10 }}>🔄</div>
            <h2 style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '1.4rem', color: '#3d2b1f', marginBottom: 10 }}>
              ¿Resetear colores de {resetModal.childName}?
            </h2>
            <p style={{ color: '#7a5c4a', fontSize: '0.92rem', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
              Todos los colores descubiertos se van a <strong>bloquear nuevamente</strong> para que los redescubra desde cero.
            </p>
            <p style={{ color: '#43a047', fontSize: '0.88rem', fontWeight: 700, marginBottom: 24, background: '#f0fff0', borderRadius: 10, padding: '8px 14px', border: '1px solid #c8e6c9' }}>
              ✅ Los dibujos guardados no se borran
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setResetModal({ open: false, childId: '', childName: '' })}
                style={{ background: 'transparent', border: '2px solid #d4c4a8', borderRadius: 50, padding: '10px 22px', fontFamily: 'Nunito, sans-serif', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', color: '#7a5c4a' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{ background: 'linear-gradient(135deg, #ff6b6b, #ff5252)', color: 'white', border: 'none', borderRadius: 50, padding: '10px 22px', fontFamily: 'Baloo 2, cursive', fontSize: '0.95rem', fontWeight: 700, cursor: resetting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 0 #cc2222', opacity: resetting ? 0.7 : 1 }}
              >
                {resetting ? '⏳ Reseteando...' : '🔄 Sí, resetear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20, cursor: 'pointer' }}>
          <img src={lightbox} alt="Dibujo" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'white', border: 'none', borderRadius: '50%', width: 40, height: 40, fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>✕</button>
        </div>
      )}
    </div>
  )
}

function StatCard({ emoji, value, label, sub, border }: { emoji: string; value: string | number; label: string; sub?: string; border?: boolean }) {
  return (
    <div style={{ padding: '20px 24px', borderRight: border ? '2px solid #f0e6d2' : 'none', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '2rem', color: '#3d2b1f', lineHeight: 1 }}>{value}</div>
      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#5a3e2b', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#a08060', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
