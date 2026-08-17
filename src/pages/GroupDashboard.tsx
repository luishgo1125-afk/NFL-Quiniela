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
  const [copiedCode, setCopiedCode] = useState(false)
  const [leaveErr, setLeaveErr] = useState<string | null>(null)
  const [members, setMembers] = useState<{ user_id: string; display_name: string; favorite_team: string | null }[]>([])
  const [pickedBy, setPickedBy] = useState<Record<string, string[]>>({})
  const isAdmin = group.created_by === user.id

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.invite_code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 1500)
    } catch {
      // algunos navegadores/webviews bloquean el clipboard; sin drama, solo no pasa nada
    }
  }

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
  const liveNow = useMemo(() => games.filter((g) => g.status === 'live'), [games])

  const [weeklyWinners, setWeeklyWinners] = useState<{ names: string[]; points: number } | null>(null)

  useEffect(() => {
    async function computeWinner() {
      const finalIds = weekGames.filter((g) => g.status === 'final').map((g) => g.id)
      if (finalIds.length === 0) { setWeeklyWinners(null); return }
      const { data } = await supabase.from('picks').select('user_id, points').in('game_id', finalIds)

      const stats: Record<string, { points: number; exact: number; hits: number }> = {}
      ;(data ?? []).forEach((p: any) => {
        const cur = stats[p.user_id] ?? { points: 0, exact: 0, hits: 0 }
        cur.points += p.points ?? 0
        if ((p.points ?? 0) > 0) cur.hits++
        if (p.points === group.points_exact) cur.exact++
        stats[p.user_id] = cur
      })

      const entries = Object.entries(stats)
      if (entries.length === 0) { setWeeklyWinners(null); return }

      // desempate: 1) puntos, 2) marcadores exactos, 3) aciertos totales
      entries.sort((a, b) => b[1].points - a[1].points || b[1].exact - a[1].exact || b[1].hits - a[1].hits)
      const [topId, topStats] = entries[0]
      if (topStats.points <= 0) { setWeeklyWinners(null); return }

      // si sigue habiendo empate total incluso despues del desempate, son co-ganadores reales
      const tied = entries.filter(
        ([, s]) => s.points === topStats.points && s.exact === topStats.exact && s.hits === topStats.hits
      )
      const names = tied.map(([uid]) => members.find((m) => m.user_id === uid)?.display_name ?? 'Jugador')
      setWeeklyWinners({ names, points: topStats.points })
    }
    computeWinner()
  }, [weekGames, members, group.points_exact])

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
          <h1 className="font-display text-3xl font-800 leading-none flex items-center gap-2">
            {group.name}
            {liveNow.length > 0 && (
              <span className="text-[10px] font-semibold text-[var(--color-scoreboard-red)] flex items-center gap-1 font-mono-score">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-scoreboard-red)] animate-pulse" />
                EN VIVO
              </span>
            )}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] font-mono-score mt-1 flex items-center gap-1.5 flex-wrap">
            Codigo: #{group.invite_code}
            <button
              onClick={copyCode}
              aria-label="Copiar codigo de invitacion"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--color-field-line)] hover:border-[var(--color-light-amber)] text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] transition"
            >
              {copiedCode ? (
                <>✓ Copiado</>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Unete a mi quiniela "${group.name}" en Quiniela NFL. Codigo: ${group.invite_code}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartir por WhatsApp"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--color-field-line)] hover:border-[#25D366] text-[var(--color-text-muted)] hover:text-[#25D366] transition"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.09c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.56-1.17-2.97s.73-2.11 1-2.4c.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.14.11.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.89 1.05.94 1.94 1.23 2.22 1.37.28.14.44.11.6-.07.16-.18.68-.79.87-1.06.19-.28.37-.23.63-.14.26.09 1.66.78 1.94.92.28.14.47.21.53.33.07.12.07.68-.17 1.36z" />
              </svg>
            </a>
            <span className="text-[var(--color-text-muted)]">· {members.length} miembro{members.length !== 1 ? 's' : ''}</span>
          </p>
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

      <div key={tab} className="animate-tab-fade">
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
                {weekLabel(w.seasonType, w.week).replace(/^(PRE|PO) /, '')}
              </button>
            ))}
          </div>
          {weeklyWinners && (
            <div className="flex items-center gap-2 text-sm bg-[rgba(242,183,5,0.08)] border border-[var(--color-light-amber)]/40 rounded-lg px-3 py-2 mb-4">
              <span className="text-lg">🏆</span>
              <span>
                {weeklyWinners.names.length > 1 ? 'Empate en la jornada: ' : 'Ganador de la jornada: '}
                <strong>{weeklyWinners.names.join(' y ')}</strong>
                <span className="text-[var(--color-text-muted)]"> · {weeklyWinners.points} pts</span>
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
    </div>
  )
}
