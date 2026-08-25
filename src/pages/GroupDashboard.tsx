import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import GameCard from '../components/GameCard'
import SpecialPicks from '../components/SpecialPicks'
import Leaderboard from '../components/Leaderboard'
import Admin from './Admin'
import { IconClipboard, IconStar, IconBarChart, IconGear, IconCalendar, IconTrophy, IconCopy, IconWhatsapp } from '../components/icons'
import type { User } from '@supabase/supabase-js'

export default function GroupDashboard({
  group: initialGroup,
  user,
  onBack,
  onGroupChange,
}: {
  group: Group
  user: User
  onBack: () => void
  onGroupChange?: (g: Group) => void
}) {
  const [group, setGroupState] = useState(initialGroup)
  const setGroup = (g: Group) => { setGroupState(g); onGroupChange?.(g) }
  const [tab, setTab] = useState<'picks' | 'especiales' | 'tabla' | 'admin'>('picks')
  const [games, setGames] = useState<Game[]>([])
  const [weekKey, setWeekKey] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
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

  // el celular corta la conexion en tiempo real cuando se bloquea la pantalla
  // o la app pasa a segundo plano; al volver a abrirla, refresca todo de una
  // vez en lugar de esperar a que llegue algo por el socket (que puede seguir
  // caido un rato)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadGames()
        loadMembers()
        loadPickStatus()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [group.id])

  useEffect(() => {
    const channel = supabase
      .channel(`games-${group.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('[realtime] cambio en games recibido:', payload)
          loadGames()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'picks' },
        () => loadPickStatus()
      )
      .subscribe((status, err) => {
        console.log('[realtime] estado del canal games:', status, err ?? '')
      })
    return () => { supabase.removeChannel(channel) }
  }, [group.id])

  const weeks = useMemo(() => {
    const map = new Map<string, { year: number; seasonType: number; week: number }>()
    games.filter((g) => !g.deleted_at).forEach((g) => {
      const key = `${g.year}:${g.season_type}:${g.week}`
      if (!map.has(key)) map.set(key, { year: g.year, seasonType: g.season_type, week: g.week })
    })
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.year - b.year || a.seasonType - b.seasonType || a.week - b.week)
  }, [games])

  const multiYear = useMemo(() => new Set(games.map((g) => g.year)).size > 1, [games])

  useEffect(() => {
    if (weekKey !== null || weeks.length === 0) return
    // la semana "actual" es la del partido mas proximo que aun no termino;
    // si toda la temporada ya se jugo, usamos la mas reciente (no la primera)
    const nonFinal = games
      .filter((g) => !g.deleted_at && g.status !== 'final')
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    const currentRef = nonFinal[0] ?? null
    const currentKey = currentRef ? `${currentRef.year}:${currentRef.season_type}:${currentRef.week}` : weeks[weeks.length - 1].key
    setWeekKey(currentKey)
  }, [weeks, weekKey, games])

  const weekGames = useMemo(() => games.filter((g) => !g.deleted_at && `${g.year}:${g.season_type}:${g.week}` === weekKey), [games, weekKey])
  const selectedWeek = useMemo(() => weeks.find((w) => w.key === weekKey) ?? null, [weeks, weekKey])
  const liveNow = useMemo(() => games.filter((g) => !g.deleted_at && g.status === 'live'), [games])

  const [weeklyWinners, setWeeklyWinners] = useState<{ names: string[]; points: number } | null>(null)

  useEffect(() => {
    async function computeWinner() {
      if (weekGames.length === 0) { setWeeklyWinners(null); return }
      // solo mostramos ganador/empate de la jornada cuando TODOS los juegos
      // de la semana ya terminaron; si aun hay pendientes, no hay resultado final
      const allFinal = weekGames.every((g) => g.status === 'final')
      if (!allFinal) { setWeeklyWinners(null); return }

      const finalIds = weekGames.map((g) => g.id)
      const gameById: Record<string, typeof weekGames[number]> = {}
      weekGames.forEach((g) => { gameById[g.id] = g })
      const { data } = await supabase.from('picks').select('user_id, game_id, points, pred_home_score, pred_away_score').in('game_id', finalIds)

      const stats: Record<string, { points: number; exact: number; diff: number }> = {}
      ;(data ?? []).forEach((p: any) => {
        const cur = stats[p.user_id] ?? { points: 0, exact: 0, diff: 0 }
        cur.points += p.points ?? 0
        if (p.points === group.points_exact) cur.exact++
        const g = gameById[p.game_id]
        if (g) {
          cur.diff += Math.abs((g.home_score ?? 0) - (p.pred_home_score ?? 0)) + Math.abs((g.away_score ?? 0) - (p.pred_away_score ?? 0))
        }
        stats[p.user_id] = cur
      })

      const entries = Object.entries(stats)
      if (entries.length === 0) { setWeeklyWinners(null); return }

      // desempate: 1) puntos totales, 2) marcadores exactos acertados, 3) menor diferencia de puntos (real vs. predicho, ambos equipos)
      entries.sort((a, b) => b[1].points - a[1].points || b[1].exact - a[1].exact || a[1].diff - b[1].diff)
      const [topId, topStats] = entries[0]
      if (topStats.points <= 0) { setWeeklyWinners(null); return }

      // si sigue habiendo empate total incluso despues del desempate, son co-ganadores reales
      const tied = entries.filter(
        ([, s]) => s.points === topStats.points && s.exact === topStats.exact && s.diff === topStats.diff
      )
      const names = tied.map(([uid]) => members.find((m) => m.user_id === uid)?.display_name ?? 'Jugador')
      setWeeklyWinners({ names, points: topStats.points })
    }
    computeWinner()
  }, [weekGames, members, group.points_exact])

  useEffect(() => {
    if (tab === 'especiales' && !group.special_picks_enabled) setTab('picks')
  }, [tab, group.special_picks_enabled])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-1">
        {group.logo_url ? (
          <img src={group.logo_url} alt={group.name} className="w-12 h-12 rounded-full object-cover border border-[var(--color-field-line)]" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center text-xl">🏈</div>
        )}
        <div className="flex-1">
          <h1 className="font-display text-3xl font-800 leading-none flex items-center gap-2 flex-wrap">
            {group.name}
            {selectedWeek && (
              <span className="text-[11px] font-mono-score font-semibold px-2 py-0.5 rounded-full border border-[var(--color-light-amber)] text-[var(--color-light-amber)] tracking-wide">
                {weekLabel(selectedWeek.seasonType, selectedWeek.week)}
              </span>
            )}
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
              {copiedCode ? <>✓ Copiado</> : <IconCopy />}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Unete a mi quiniela "${group.name}" en Quiniela NFL. Codigo: ${group.invite_code}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartir por WhatsApp"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--color-field-line)] hover:border-[#25D366] text-[var(--color-text-muted)] hover:text-[#25D366] transition"
            >
              <IconWhatsapp />
            </a>
            <span className="text-[var(--color-text-muted)]">· {members.length} miembro{members.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {group.special_picks_enabled && (
            <button
              onClick={() => setTab('especiales')}
              aria-label="Predicciones especiales"
              title="Predicciones especiales"
              className={`p-2 rounded-md border transition ${tab === 'especiales' ? 'border-[var(--color-light-amber)] text-[var(--color-light-amber)] bg-[rgba(242,183,5,0.1)]' : 'border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] hover:border-[var(--color-light-amber)]'}`}
            >
              <IconStar size={16} />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setTab('admin')}
              aria-label="Administrar liga"
              title="Administrar"
              className={`p-2 rounded-md border transition ${tab === 'admin' ? 'border-[var(--color-light-amber)] text-[var(--color-light-amber)] bg-[rgba(242,183,5,0.1)]' : 'border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] hover:border-[var(--color-light-amber)]'}`}
            >
              <IconGear size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="mb-5" />

      <div className="flex mb-6 rounded-md overflow-hidden border border-[var(--color-field-line)] w-full">
        {(['picks', 'tabla'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${tab === t ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {t === 'picks' ? <IconClipboard /> : <IconBarChart />}
            {t === 'picks' ? 'Predicciones' : 'Tabla'}
          </button>
        ))}
      </div>

      {(tab === 'especiales' || tab === 'admin') && (
        <button onClick={() => setTab('picks')} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] mb-4 flex items-center gap-1">
          ← Volver a predicciones
        </button>
      )}


      <div key={tab} className="animate-tab-fade">
        {tab === 'picks' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {weeks.map((w) => (
              <button
                key={w.key}
                onClick={() => setWeekKey(w.key)}
                className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${weekKey === w.key ? 'border-[var(--color-light-amber)] text-[var(--color-light-amber)]' : 'border-[var(--color-field-line)] text-[var(--color-text-muted)]'}`}
              >
                <IconCalendar size={11} />
                <span className="font-medium">{weekLabel(w.seasonType, w.week).replace(/\s*\d+$/, '')}</span>
                {w.seasonType !== 3 && (
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono-score shrink-0"
                    style={{ background: 'var(--color-light-amber)', color: 'var(--color-field-night)' }}
                  >
                    {w.week}
                  </span>
                )}
                {multiYear && <span className="text-[10px]">· {w.year}</span>}
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

              <div className="flex items-center gap-3 bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-[rgba(242,183,5,0.15)] flex items-center justify-center shrink-0 text-[var(--color-light-amber)]">
                  <IconTrophy size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">¡Que empiecen los picks!</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Haz tus predicciones y compite con tu grupo.</p>
                </div>
                <button
                  onClick={() => setTab('tabla')}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--color-light-amber)] text-[var(--color-light-amber)] hover:bg-[var(--color-light-amber)] hover:text-[var(--color-field-night)] transition"
                >
                  <IconBarChart size={12} /> Ver tabla
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'especiales' && <SpecialPicks group={group} userId={user.id} />}

      {tab === 'tabla' && <Leaderboard group={group} />}

      {tab === 'admin' && isAdmin && (
        <Admin group={group} games={games} onChange={loadGames} onGroupUpdated={setGroup} onBack={onBack} onLeftAdmin={() => setTab('picks')} />
      )}
      </div>
    </div>
  )
}