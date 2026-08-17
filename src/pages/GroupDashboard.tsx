import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import GameCard from '../components/GameCard'
import Leaderboard from '../components/Leaderboard'
import Admin from './Admin'
import type { User } from '@supabase/supabase-js'

export default function GroupDashboard({ group: initialGroup, user, onBack }: { group: Group; user: User; onBack: () => void }) {
  const [group, setGroup] = useState(initialGroup)
  const [tab, setTab] = useState<'picks' | 'tabla' | 'admin'>('picks')
  const [games, setGames] = useState<Game[]>([])
  const [weekKey, setWeekKey] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [leaveErr, setLeaveErr] = useState<string | null>(null)
  const [members, setMembers] = useState<{ user_id: string; display_name: string; favorite_team: string | null }[]>([])
  const [pickedBy, setPickedBy] = useState<Record<string, string[]>>({})
  const isAdmin = group.created_by === user.id

  async function leaveGroup() {
    if (!confirm(`¿Seguro que quieres salir de "${group.name}"? Perderas acceso a esta liga.`)) return
    setLeaving(true)
    setLeaveErr(null)
    const { error } = await supabase.rpc('leave_group', { p_group_id: group.id })
    setLeaving(false)
    if (error) { setLeaveErr(error.message); return }
    onBack()
  }

  async function loadGames() {
    const { data } = await supabase.from('games').select('*').eq('group_id', group.id).order('kickoff')
    setGames(data ?? [])
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('group_members')
      .select('user_id, profiles(display_name, favorite_team)')
      .eq('group_id', group.id)
    setMembers((data ?? []).map((row: any) => ({
      user_id: row.user_id,
      display_name: row.profiles?.display_name ?? 'Jugador',
      favorite_team: row.profiles?.favorite_team ?? null,
    })))
  }

  async function loadPickStatus() {
    const { data } = await supabase.rpc('group_pick_status', { p_group_id: group.id })
    const map: Record<string, string[]> = {}
    ;(data ?? []).forEach((row: any) => {
      map[row.game_id] = map[row.game_id] ?? []
      map[row.game_id].push(row.user_id)
    })
    setPickedBy(map)
  }

  useEffect(() => {
    let cancelled = false
    supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data) {
          alert('Ya no perteneces a esta liga.')
          onBack()
        }
      })
    return () => { cancelled = true }
  }, [group.id, user.id])

  useEffect(() => { loadGames(); loadMembers(); loadPickStatus() }, [group.id])

  useEffect(() => {
    const channel = supabase
      .channel(`games-${group.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `group_id=eq.${group.id}` },
        () => loadGames()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'picks' },
        () => loadPickStatus()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [group.id])

  const weeks = useMemo(() => {
    const map = new Map<string, { seasonType: number; week: number }>()
    games.forEach((g) => {
      const key = `${g.season_type}:${g.week}`
      if (!map.has(key)) map.set(key, { seasonType: g.season_type, week: g.week })
    })
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.seasonType - b.seasonType || a.week - b.week)
  }, [games])

  useEffect(() => {
    if (weekKey === null && weeks.length > 0) setWeekKey(weeks[0].key)
  }, [weeks, weekKey])

  const weekGames = useMemo(() => games.filter((g) => `${g.season_type}:${g.week}` === weekKey), [games, weekKey])

  const [weeklyWinner, setWeeklyWinner] = useState<{ name: string; points: number } | null>(null)

  useEffect(() => {
    async function computeWinner() {
      const finalIds = weekGames.filter((g) => g.status === 'final').map((g) => g.id)
      if (finalIds.length === 0) { setWeeklyWinner(null); return }
      const { data } = await supabase.from('picks').select('user_id, points').in('game_id', finalIds)
      const totals: Record<string, number> = {}
      ;(data ?? []).forEach((p: any) => { totals[p.user_id] = (totals[p.user_id] ?? 0) + (p.points ?? 0) })
      let bestId: string | null = null
      let bestPts = -1
      Object.entries(totals).forEach(([uid, pts]) => {
        if (pts > bestPts) { bestPts = pts; bestId = uid }
      })
      if (bestId && bestPts > 0) {
        const member = members.find((m) => m.user_id === bestId)
        setWeeklyWinner({ name: member?.display_name ?? 'Jugador', points: bestPts })
      } else {
        setWeeklyWinner(null)
      }
    }
    computeWinner()
  }, [weekGames, members])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] mb-4">
        ← Mis quinielas
      </button>

      <div className="flex items-center gap-3 mb-1">
        {group.logo_url ? (
          <img src={group.logo_url} alt={group.name} className="w-12 h-12 rounded-full object-cover border border-[var(--color-field-line)]" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center text-xl">🏈</div>
        )}
        <div className="flex-1">
          <h1 className="font-display text-3xl font-800 leading-none">{group.name}</h1>
          <p className="text-xs text-[var(--color-text-muted)] font-mono-score mt-1">Codigo de invitacion: #{group.invite_code}</p>
        </div>
        {!isAdmin && (
          <button
            onClick={leaveGroup}
            disabled={leaving}
            className="text-xs text-[var(--color-scoreboard-red)] hover:underline shrink-0 disabled:opacity-50"
          >
            {leaving ? 'Saliendo...' : 'Salir de la liga'}
          </button>
        )}
      </div>
      {leaveErr && <p className="text-[var(--color-scoreboard-red)] text-xs mb-4">{leaveErr}</p>}
      <div className="mb-5" />

      <div className="flex mb-6 rounded-md overflow-hidden border border-[var(--color-field-line)] w-full">
        {(['picks', 'tabla'] as const).concat(isAdmin ? ['admin'] : []).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {t === 'picks' ? 'Predicciones' : t === 'tabla' ? 'Tabla' : 'Administrar'}
          </button>
        ))}
      </div>

      {tab === 'picks' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {weeks.map((w) => (
              <button
                key={w.key}
                onClick={() => setWeekKey(w.key)}
                className={`font-mono-score text-xs px-3 py-1 rounded-full border flex items-center gap-1 ${weekKey === w.key ? 'border-[var(--color-light-amber)] text-[var(--color-light-amber)]' : 'border-[var(--color-field-line)] text-[var(--color-text-muted)]'}`}
              >
                {w.seasonType !== 2 && (
                  <span
                    className="text-[9px] px-1 rounded"
                    style={{
                      background: w.seasonType === 1 ? 'rgba(138,148,163,0.25)' : 'rgba(228,70,43,0.2)',
                      color: w.seasonType === 1 ? 'var(--color-text-muted)' : 'var(--color-scoreboard-red)',
                    }}
                  >
                    {w.seasonType === 1 ? 'PRETEMP' : 'PLAYOFFS'}
                  </span>
                )}
                {weekLabel(w.seasonType, w.week)}
              </button>
            ))}
          </div>
          {weeklyWinner && (
            <div className="flex items-center gap-2 text-sm bg-[rgba(242,183,5,0.08)] border border-[var(--color-light-amber)]/40 rounded-lg px-3 py-2 mb-4">
              <span className="text-lg">🏆</span>
              <span>
                Ganador de la jornada: <strong>{weeklyWinner.name}</strong>
                <span className="text-[var(--color-text-muted)]"> · {weeklyWinner.points} pts</span>
              </span>
            </div>
          )}
          {weekGames.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {isAdmin ? 'Todavia no capturas partidos. Ve a la pestaña Administrar.' : 'El administrador aun no captura partidos para esta semana.'}
            </p>
          ) : (
            <div className="space-y-3">
              {weekGames.map((g) => (
                <GameCard key={g.id} game={g} userId={user.id} members={members} pickedUserIds={pickedBy[g.id] ?? []} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'tabla' && <Leaderboard group={group} />}

      {tab === 'admin' && isAdmin && (
        <Admin group={group} games={games} onChange={loadGames} onGroupUpdated={setGroup} onBack={onBack} onLeftAdmin={() => setTab('picks')} />
      )}
    </div>
  )
}
