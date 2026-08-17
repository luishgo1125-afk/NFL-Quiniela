import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import { IconClipboard, IconCalendar } from '../components/icons'
import type { User } from '@supabase/supabase-js'

interface GroupStats {
  weekLabelText: string | null
  membersCount: number
  picksDone: number
  picksTotal: number
  closesAt: string | null
  myRank: number | null
  liveCount: number
}

async function loadStats(group: Group, userId: string): Promise<GroupStats> {
  const { data: memberRows } = await supabase.from('group_members').select('user_id').eq('group_id', group.id)
  const memberIds = (memberRows ?? []).map((m: any) => m.user_id)

  const { data: games } = await supabase.from('games').select('*').eq('group_id', group.id).order('kickoff')
  const gameList = (games ?? []) as Game[]

  const nonFinal = gameList.filter((g) => g.status !== 'final').sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
  let weekGames: Game[] = []
  if (nonFinal.length > 0) {
    const cur = nonFinal[0]
    weekGames = gameList.filter((g) => g.year === cur.year && g.season_type === cur.season_type && g.week === cur.week)
  } else if (gameList.length > 0) {
    const last = gameList[gameList.length - 1]
    weekGames = gameList.filter((g) => g.year === last.year && g.season_type === last.season_type && g.week === last.week)
  }

  const weekLabelText = weekGames[0] ? weekLabel(weekGames[0].season_type, weekGames[0].week) : null
  const weekGameIds = weekGames.map((g) => g.id)

  let picksDone = 0
  if (weekGameIds.length > 0) {
    const { data: statusRows } = await supabase.rpc('group_pick_status', { p_group_id: group.id })
    picksDone = (statusRows ?? []).filter((r: any) => weekGameIds.includes(r.game_id)).length
  }
  const picksTotal = memberIds.length * weekGames.length

  const upcomingLocks = weekGames
    .filter((g) => g.status !== 'final')
    .map((g) => new Date(g.kickoff).getTime() - 30 * 60 * 1000)
    .filter((t) => t > Date.now())
  const closesAt = upcomingLocks.length > 0 ? new Date(Math.min(...upcomingLocks)).toISOString() : null

  const liveCount = weekGames.filter((g) => g.status === 'live').length

  let myRank: number | null = null
  const finalIds = gameList.filter((g) => g.status === 'final').map((g) => g.id)
  if (finalIds.length > 0 && memberIds.length > 0) {
    const { data: allPicks } = await supabase.from('picks').select('user_id, points').in('game_id', finalIds)
    const totals: Record<string, number> = {}
    ;(allPicks ?? []).forEach((p: any) => { totals[p.user_id] = (totals[p.user_id] ?? 0) + (p.points ?? 0) })
    const ranked = memberIds.map((id) => ({ id, points: totals[id] ?? 0 })).sort((a, b) => b.points - a.points)
    const idx = ranked.findIndex((r) => r.id === userId)
    if (idx >= 0) myRank = idx + 1
  }

  return { weekLabelText, membersCount: memberIds.length, picksDone, picksTotal, closesAt, myRank, liveCount }
}

export default function QuinielasList({ user, onSelect }: { user: User; onSelect: (g: Group) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [stats, setStats] = useState<Record<string, GroupStats>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('group_members').select('groups(*)').eq('user_id', user.id)
      const gs: Group[] = (data ?? []).map((row: any) => row.groups).filter(Boolean)
      setGroups(gs)
      setLoading(false)

      const entries = await Promise.all(gs.map(async (g) => [g.id, await loadStats(g, user.id)] as const))
      setStats(Object.fromEntries(entries))
    }
    load()
  }, [user.id])

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl font-800">QUINIELAS</h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-8">En las que participas ahora mismo</p>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : groups.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">
          Todavia no perteneces a ninguna quiniela. Ve a "Crear quiniela" abajo para crear una o unirte con un codigo.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const s = stats[g.id]
            const closesLabel = s?.closesAt
              ? new Date(s.closesAt).toLocaleString('es-MX', { weekday: 'long', hour: 'numeric', minute: '2-digit' })
              : null
            return (
              <button
                key={g.id}
                onClick={() => onSelect(g)}
                className="w-full text-left bg-[var(--color-field-surface)] border rounded-lg px-4 py-3 hover:border-[var(--color-light-amber)] transition"
                style={{ borderColor: (s?.liveCount ?? 0) > 0 ? '#E4462B' : 'var(--color-field-line)' }}
              >
                <div className="flex items-center gap-3">
                  {g.logo_url ? (
                    <img src={g.logo_url} alt={g.name} className="w-10 h-10 rounded-full object-cover border border-[var(--color-field-line)] shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center text-lg shrink-0">🏈</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{g.name}</span>
                      {s?.weekLabelText && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-[var(--color-light-amber)] text-[var(--color-light-amber)] shrink-0">
                          {s.weekLabelText}
                        </span>
                      )}
                      {(s?.liveCount ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold text-[var(--color-scoreboard-red)] flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-scoreboard-red)] animate-pulse" /> EN VIVO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{s?.membersCount ?? 0} miembros</p>
                  </div>
                </div>

                {s && (s.picksTotal > 0 || closesLabel || s.myRank) && (
                  <div className="mt-2.5 pt-2.5 border-t border-[var(--color-field-line)] flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    {s.picksTotal > 0 && (
                      <span className="flex items-center gap-1">
                        <IconClipboard size={12} /> {s.picksDone}/{s.picksTotal} picks realizados
                      </span>
                    )}
                    {closesLabel && (
                      <span className="flex items-center gap-1">
                        <IconCalendar size={12} /> Cierra: {closesLabel}
                      </span>
                    )}
                    {s.myRank && (
                      <span className="text-[var(--color-light-amber)] font-semibold">Tu posicion: #{s.myRank}</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
