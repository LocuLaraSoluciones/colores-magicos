'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import GameClient from '@/components/GameClient'

export default function GamePage() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<{ userId: string; displayName: string; discovered: string[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, role')
        .eq('id', user.id)
        .single()

      if (!profile) { router.replace('/login'); return }
      if (profile.role === 'admin') { router.replace('/admin'); return }

      const { data: discovered } = await supabase
        .from('discovered_colors')
        .select('color_hex')
        .eq('user_id', user.id)

      setData({
        userId: user.id,
        displayName: profile.display_name,
        discovered: (discovered ?? []).map((d: { color_hex: string }) => d.color_hex),
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎨</div>
        <p style={{ fontFamily: 'Baloo 2, cursive', fontSize: '1.2rem', color: '#3d2b1f', fontWeight: 700 }}>Cargando tu laboratorio...</p>
      </div>
    </div>
  )

  if (!data) return null

  return <GameClient userId={data.userId} displayName={data.displayName} initialDiscovered={data.discovered} />
}
