import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconBell } from '../components/icons'
import type { User } from '@supabase/supabase-js'

interface Item {
  id: string
  groupName: string
  awayTeam: string
  homeTeam: string
  awayScore: number | null
  homeScore: number | null
  status: 'live' | 'final'
  kickoff: string
}

export default function Notifications({ user }: { user: User }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id)
    const groupIds = (memberships ?? []).map((m: any) => m.group_id)
    if (groupIds.length === 0) { setItems([]); setLoading(false); return }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: games } = await supabase
      .from('games')
      .select('id, group_id, home_team, away_team, home_score, away_score, status, kickoff, groups(name)')
      .in('group_id', groupIds)
      .in('status', ['live', 'final'])
      .gte('kickoff', since)
      .order('kickoff', { ascending: false })
      .limit(30)

    setItems((games ?? []).map((g: any) => ({
      id: g.id,
      groupName: g.groups?.name ?? 'Liga',
      awayTeam: g.away_team,
      homeTeam: g.home_team,
      awayScore: g.away_score,
      homeScore: g.home_score,
      status: g.status,
      kickoff: g.kickoff,
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  useEffect(() => {
    const channel = supabase
      .channel('notifications-games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl font-800">NOTIFICACIONES</h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-8">Partidos en vivo y resultados recientes de tus ligas</p>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <IconBell size={32} className="text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)] text-sm">No hay nada nuevo por ahora.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">{it.groupName}</span>
                {it.status === 'live' ? (
                  <span className="text-[10px] font-semibold text-[var(--color-scoreboard-red)] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-scoreboard-red)] animate-pulse" /> EN VIVO
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-[#3D8B5F]">FINAL</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <img src={teamLogoUrl(it.awayTeam)} alt={it.awayTeam} className="w-5 h-5 object-contain" loading="lazy" />
                <span className="font-mono-score font-semibold">{it.awayTeam} {it.awayScore ?? '-'}</span>
                <span className="text-[var(--color-text-muted)]">–</span>
                <span className="font-mono-score font-semibold">{it.homeScore ?? '-'} {it.homeTeam}</span>
                <img src={teamLogoUrl(it.homeTeam)} alt={it.homeTeam} className="w-5 h-5 object-contain" loading="lazy" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
