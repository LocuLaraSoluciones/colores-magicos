import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import GameClient from '@/components/GameClient'

export default async function GamePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')

  // Load discovered colors
  const { data: discovered } = await supabase
    .from('discovered_colors')
    .select('color_hex')
    .eq('user_id', user.id)

  const discoveredHexes = (discovered ?? []).map((d: { color_hex: string }) => d.color_hex)

  return (
    <GameClient
      userId={user.id}
      displayName={profile.display_name}
      initialDiscovered={discoveredHexes}
    />
  )
}
