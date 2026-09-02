import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconBell } from '../components/icons'
import type { User } from '@supabase/supabase-js'

interface NotificationItem {
  id: string
  title: string
  body: string
  url: string | null
  read_at: string | null
  created_at: string
}

interface GameItem {
  id: string
  groupName: string
  awayTeam: string
  homeTeam: string
  awayScore: number | null
  homeScore: number | null
  status: 'live' | 'final'
  kickoff: string
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export default function Notifications({ user }: { user: User }) {
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [games, setGames] = useState<GameItem[]>([])
  const [loading, setLoading] = useState(true)

  async function loadNotifs() {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, url, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)
    setNotifs(data ?? [])
  }

  async function loadGames() {
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', user.id)
    const groupIds = (memberships ?? []).map((m: any) => m.group_id)
    if (groupIds.length === 0) { setGames([]); return }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('games')
      .select('id, group_id, home_team, away_team, home_score, away_score, status, kickoff, groups(name)')
      .in('group_id', groupIds)
      .in('status', ['live', 'final'])
      .is('deleted_at', null)
      .gte('kickoff', since)
      .order('kickoff', { ascending: false })
      .limit(20)

    setGames((data ?? []).map((g: any) => ({
      id: g.id,
      groupName: g.groups?.name ?? 'Liga',
      awayTeam: g.away_team,
      homeTeam: g.home_team,
      awayScore: g.away_score,
      homeScore: g.home_score,
      status: g.status,
      kickoff: g.kickoff,
    })))
  }

  useEffect(() => {
    Promise.all([loadNotifs(), loadGames()]).finally(() => setLoading(false))
  }, [user.id])

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => loadGames())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => loadNotifs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function markRead(n: NotificationItem) {
    if (n.read_at) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl font-800">NOTIFICACIONES</h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-8">Tus avisos y la actividad reciente de tus ligas</p>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : (
        <>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">TUS NOTIFICACIONES</h2>
          {notifs.length === 0 ? (
            <div className="text-center py-8 mb-6 border border-dashed border-[var(--color-field-line)] rounded-lg">
              <IconBell size={28} className="text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-[var(--color-text-muted)] text-sm">Todavia no tienes avisos.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-8">
              {notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n)}
                  className="w-full text-left bg-[var(--color-field-surface)] border rounded-lg px-4 py-3 transition"
                  style={{ borderColor: n.read_at ? 'var(--color-field-line)' : 'var(--color-light-amber)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-light-amber)] shrink-0" />}
                        {n.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 font-mono-score">{timeAgo(n.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">ACTIVIDAD RECIENTE</h2>
          {games.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Nada en vivo o finalizado en las ultimas 24h.</p>
          ) : (
            <div className="space-y-2">
              {games.map((it) => (
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
        </>
      )}
    </div>
  )
}
