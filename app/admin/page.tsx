import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AdminClient from '@/components/AdminClient'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Get all child users
  const { data: children } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('role', 'user')
    .order('display_name')

  // For each child, get their stats
  const childrenWithStats = await Promise.all(
    (children ?? []).map(async (child: { id: string; display_name: string }) => {
      const [{ count: discoveredCount }, { count: drawingCount }, { data: drawings }, { data: discovered }] =
        await Promise.all([
          supabase.from('discovered_colors').select('*', { count: 'exact', head: true }).eq('user_id', child.id),
          supabase.from('drawings').select('*', { count: 'exact', head: true }).eq('user_id', child.id),
          supabase.from('drawings').select('id, title, image_url, created_at').eq('user_id', child.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('discovered_colors').select('color_hex, color_name, discovered_at').eq('user_id', child.id).order('discovered_at'),
        ])
      return {
        ...child,
        discoveredCount: discoveredCount ?? 0,
        drawingCount: drawingCount ?? 0,
        drawings: drawings ?? [],
        discovered: discovered ?? [],
      }
    })
  )

  return (
    <AdminClient
      adminName={profile.display_name}
      children={childrenWithStats}
    />
  )
}
