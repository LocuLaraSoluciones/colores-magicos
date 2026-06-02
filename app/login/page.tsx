'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(circle at 20% 20%, #ffe0f0 0%, transparent 40%), radial-gradient(circle at 80% 80%, #d0eeff 0%, transparent 40%)',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '28px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 8px 0 #e2d5c3, 0 12px 32px rgba(0,0,0,0.1)',
        border: '2px solid #f0e6d2',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>🎨</div>
        <h1 style={{
          fontFamily: 'Baloo 2, cursive',
          fontWeight: 800,
          fontSize: '1.8rem',
          color: '#3d2b1f',
          marginBottom: '4px',
        }}>
          Colores Mágicos
        </h1>
        <p style={{ color: '#7a5c4a', fontSize: '0.9rem', marginBottom: '28px', fontWeight: 600 }}>
          ¡Iniciá sesión para jugar!
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '2px solid #e0d4c0',
              fontFamily: 'Nunito, sans-serif',
              fontSize: '1rem',
              outline: 'none',
              background: '#faf5ee',
              color: '#3d2b1f',
              width: '100%',
            }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '2px solid #e0d4c0',
              fontFamily: 'Nunito, sans-serif',
              fontSize: '1rem',
              outline: 'none',
              background: '#faf5ee',
              color: '#3d2b1f',
              width: '100%',
            }}
          />

          {error && (
            <p style={{ color: '#e53935', fontSize: '0.88rem', fontWeight: 700 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #ff6b6b, #ff8e53)',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              padding: '13px',
              fontFamily: 'Baloo 2, cursive',
              fontSize: '1.05rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 0 #cc4444',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            {loading ? '⏳ Entrando...' : '🚀 ¡Entrar!'}
          </button>
        </form>
      </div>
    </div>
  )
}
