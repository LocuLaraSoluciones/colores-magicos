'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import AdminClient from '@/components/AdminClient'

interface Drawing { id: string; title: string; image_url: string; created_at: string }
interface DiscoveredColor { color_hex: string; color_name: string; discovered_at: string }
interface ChildData { id: string; display_name: string; discoveredCount: number; drawingCount: number; drawings: Drawing[]; discovered: DiscoveredColor[] }

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [adminName, setAdminName] = useState('')
  const [children, setChildren] = useState<ChildData[]>([])
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

      if (!profile || profile.role !== 'admin') { router.replace('/dashboard/game'); return }

      setAdminName(profile.display_name)

      const { data: childProfiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('role', 'user')
        .order('display_name')

      const childrenData = await Promise.all(
        (childProfiles ?? []).map(async (child: { id: string; display_name: string }) => {
          const [{ count: discoveredCount }, { count: drawingCount }, { data: drawings }, { data: discovered }] =
            await Promise.all([
              supabase.from('discovered_colors').select('*', { count: 'exact', head: true }).eq('user_id', child.id),
              supabase.from('drawings').select('*', { count: 'exact', head: true }).eq('user_id', child.id),
              supabase.from('drawings').select('id, title, image_url, created_at').eq('user_id', child.id).order('created_at', { ascending: false }).limit(20),
              supabase.from('discovered_colors').select('color_hex, color_name, discovered_at').eq('user_id', child.id).order('discovered_at'),
            ])
          return { ...child, discoveredCount: discoveredCount ?? 0, drawingCount: drawingCount ?? 0, drawings: drawings ?? [], discovered: discovered ?? [] }
        })
      )

      setChildren(childrenData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>👨‍👧‍👧</div>
        <p style={{ fontFamily: 'Baloo 2, cursive', fontSize: '1.2rem', color: '#3d2b1f', fontWeight: 700 }}>Cargando el panel...</p>
      </div>
    </div>
  )

  return <AdminClient adminName={adminName} children={children} />
}
