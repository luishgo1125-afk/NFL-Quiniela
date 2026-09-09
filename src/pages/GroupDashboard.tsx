import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import GameCard from '../components/GameCard'
import SpecialPicks from '../components/SpecialPicks'
import Leaderboard from '../components/Leaderboard'
import CopyPicksModal from '../components/CopyPicksModal'
import { IconClipboard, IconStar, IconBarChart, IconGear, IconCalendar, IconTrophy, IconCopy, IconWhatsapp, IconAlertTriangle } from '../components/icons'
import type { User } from '@supabase/supabase-js'

// Admin es la pantalla mas pesada (formularios, importador de ESPN, gestor de
// partidos); casi nadie la abre en cada visita, asi que se descarga aparte,
// solo cuando de verdad se toca el engrane de ajustes.
const Admin = lazy(() => import('./Admin'))

export default function GroupDashboard({
  group: initialGroup,
  user,
  onBack,
  onGroupChange,
  focusGameId,
  onFocusConsumed,
}: {
  group: Group
  user: User
  onBack: () => void
  onGroupChange?: (g: Group) => void
  focusGameId?: string | null
  onFocusConsumed?: () => void
}) {
  const [group, setGroupState] = useState(initialGroup)
  const setGroup = (g: Group) => { setGroupState(g); onGroupChange?.(g) }
  const [tab, setTab] = useState<'picks' | 'especiales' | 'tabla' | 'admin'>('picks')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [pickRefreshKey, setPickRefreshKey] = useState(0)
  const [games, setGames] = useState<Game[]>([])
  const [weekKey, setWeekKey] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [members, setMembers] = useState<{ user_id: string; display_name: string; favorite_team: string | null }[]>([])
  const [pickedBy, setPickedBy] = useState<Record<string, string[]>>({})
  const isAdmin = group.created_by === user.id

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?join=${group.invite_code}`)
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

  // si venimos de tocar una notificacion de un partido especifico, salta
  // directo a la semana de ESE partido (aunque no sea la semana "actual")
  const [highlightedGameId, setHighlightedGameId] = useState<string | null>(null)
  useEffect(() => {
    if (!focusGameId || games.length === 0) return
    const target = games.find((g) => g.id === focusGameId)
    if (target) {
      setWeekKey(`${target.year}:${target.season_type}:${target.week}`)
      setTab('picks')
      setHighlightedGameId(focusGameId)
      setTimeout(() => {
        document.getElementById(`game-${focusGameId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
      setTimeout(() => setHighlightedGameId(null), 3000)
    }
    onFocusConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGameId, games])

  const weekGames = useMemo(() => games.filter((g) => !g.deleted_at && `${g.year}:${g.season_type}:${g.week}` === weekKey), [games, weekKey])
  const selectedWeek = useMemo(() => weeks.find((w) => w.key === weekKey) ?? null, [weeks, weekKey])
  const liveNow = useMemo(() => games.filter((g) => !g.deleted_at && g.status === 'live'), [games])

  // se refresca cada 30s para que la cuenta regresiva de "cierra en" se sienta viva
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const PROGRESS_LOCK_MINUTES = 30 // mismo margen que GameCard.tsx
  const weekPicksTotal = weekGames.length
  const weekPicksDone = weekGames.filter((g) => (pickedBy[g.id] ?? []).includes(user.id)).length
  const weekPicksMissing = weekPicksTotal - weekPicksDone
  const weekPicksPct = weekPicksTotal > 0 ? Math.round((weekPicksDone / weekPicksTotal) * 100) : 0

  const nextLock = useMemo(() => {
    const upcoming = weekGames
      .map((g) => new Date(g.kickoff).getTime() - PROGRESS_LOCK_MINUTES * 60 * 1000)
      .filter((lockTime) => lockTime > nowTick)
      .sort((a, b) => a - b)
    return upcoming[0] ?? null
  }, [weekGames, nowTick])

  function formatCountdown(ms: number) {
    const totalMin = Math.max(0, Math.floor(ms / 60000))
    const days = Math.floor(totalMin / (60 * 24))
    const hours = Math.floor((totalMin % (60 * 24)) / 60)
    const mins = totalMin % 60
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

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
          {tab !== 'tabla' && (
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
              href={`https://wa.me/?text=${encodeURIComponent(`Unete a mi quiniela "${group.name}" en Quiniela NFL: ${window.location.origin}${window.location.pathname}?join=${group.invite_code}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartir por WhatsApp"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--color-field-line)] hover:border-[#25D366] text-[var(--color-text-muted)] hover:text-[#25D366] transition"
            >
              <IconWhatsapp />
            </a>
            <span className="text-[var(--color-text-muted)]">· {members.length} miembro{members.length !== 1 ? 's' : ''}</span>
          </p>
          )}
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
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex gap-2 flex-wrap">
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
            {weekKey && (
              <button
                onClick={() => setShowCopyModal(true)}
                title="Copiar predicciones de otra liga"
                className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-dashed border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] transition"
              >
                <IconCopy size={11} /> Copiar de otra liga
              </button>
            )}
          </div>

          {weekPicksTotal > 0 && (() => {
            const closingSoonBanner = nextLock != null && nextLock - nowTick < 3 * 60 * 60 * 1000
            const urgent = weekPicksMissing > 0 || closingSoonBanner
            return urgent ? (
              <div className="bg-[var(--color-field-surface)] border border-[var(--color-light-amber)]/40 rounded-lg px-4 py-3 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <IconClipboard size={14} className="text-[var(--color-text-muted)]" />
                    {weekPicksDone}/{weekPicksTotal} predicciones
                  </span>
                  <span className="text-sm font-bold font-mono-score text-[var(--color-turf-green)]">{weekPicksPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-field-line)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${weekPicksPct}%`, background: weekPicksPct === 100 ? 'var(--color-turf-green)' : 'linear-gradient(90deg, #3D8B5F, #4FAE76)' }}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  {weekPicksMissing > 0 ? (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-light-amber)]">
                      <IconAlertTriangle size={13} /> Te faltan {weekPicksMissing}
                    </p>
                  ) : (
                    <span />
                  )}
                  {nextLock && (
                    <span className="text-xs flex items-center gap-1">
                      Cierra en <span className="font-bold text-[var(--color-light-amber)] font-mono-score">{formatCountdown(nextLock - nowTick)}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-1 mb-4">
                <span className="flex items-center gap-1.5">
                  <IconClipboard size={12} className="text-[var(--color-turf-green)]" /> Todo predicho
                </span>
                {nextLock ? (
                  <span>Cierra en {formatCountdown(nextLock - nowTick)}</span>
                ) : (
                  <span>No hay predicciones abiertas esta semana</span>
                )}
              </div>
            )
          })()}

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
                <div
                  key={g.id}
                  id={`game-${g.id}`}
                  className={g.id === highlightedGameId ? 'rounded-xl ring-2 ring-[var(--color-light-amber)] transition-all' : ''}
                >
                  <GameCard key={pickRefreshKey} game={g} userId={user.id} members={members} pickedUserIds={pickedBy[g.id] ?? []} />
                </div>
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
        <Suspense fallback={<p className="text-[var(--color-text-muted)] text-sm py-8 text-center">Cargando...</p>}>
          <Admin group={group} games={games} onChange={loadGames} onGroupUpdated={setGroup} onBack={onBack} onLeftAdmin={() => setTab('picks')} />
        </Suspense>
      )}
      </div>

      {showCopyModal && weekKey && (
        <CopyPicksModal
          currentGroup={group}
          weekKey={weekKey}
          userId={user.id}
          onClose={() => setShowCopyModal(false)}
          onDone={() => { setPickRefreshKey((k) => k + 1); loadPickStatus() }}
        />
      )}
    </div>
  )
}