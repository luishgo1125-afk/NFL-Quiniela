import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import type { Game, Group } from '../lib/types'
import { weekLabel } from '../lib/types'
import GameCard from '../components/GameCard'
import Leaderboard from '../components/Leaderboard'
import LeagueHeader from '../components/LeagueHeader'
import CopyPicksModal from '../components/CopyPicksModal'
import { buildStandings, getEligibleUserIds, standingsOptionsFor, getLastGameIds } from '../lib/ranking'
import { syncGroupWeekFromEspn } from '../lib/syncGames'
import { sharePicksImage } from '../lib/sharePicks'
import { IconClipboard, IconBarChart, IconGear, IconCalendar, IconTrophy, IconCopy, IconWhatsapp, IconAlertTriangle, IconRefresh, IconCoin, IconLock, IconShare } from '../components/icons'
import { tr, localeTag } from '../i18n'
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
  const [tab, setTab] = useState<'picks' | 'tabla' | 'admin'>('picks')
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [pickRefreshKey, setPickRefreshKey] = useState(0)
  const [syncingWeek, setSyncingWeek] = useState(false)
  const [syncWeekMsg, setSyncWeekMsg] = useState<string | null>(null)

  async function handleSyncCurrentWeek() {
    if (!weekKey || syncingWeek) return
    setSyncingWeek(true)
    setSyncWeekMsg(null)
    try {
      const [y, st, w] = weekKey.split(':').map(Number)
      const result = await syncGroupWeekFromEspn(group.id, games, y, st as 1 | 2 | 3, w)
      await loadGames()
      setSyncWeekMsg(tr('{created} agregado(s), {updated} actualizado(s)', { created: result.created, updated: result.updated }))
    } catch (err) {
      setSyncWeekMsg(err instanceof Error ? err.message : tr('No se pudo sincronizar'))
    } finally {
      setSyncingWeek(false)
      setTimeout(() => setSyncWeekMsg(null), 4000)
    }
  }
  const [games, setGames] = useState<Game[]>([])
  const [weekKey, setWeekKey] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [boardCount, setBoardCount] = useState<number | null>(null)
  const [members, setMembers] = useState<{ user_id: string; display_name: string; favorite_team: string | null }[]>([])
  const [pickedBy, setPickedBy] = useState<Record<string, string[]>>({})
  const isAdmin = group.created_by === user.id
  // se incrementa cuando llega un cambio en tiempo real de pagos (desde
  // otro dispositivo/pestaña), para forzar que se vuelva a consultar "cuanto debo"
  const [paymentRefreshTick, setPaymentRefreshTick] = useState(0)

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
      display_name: row.profiles?.display_name ?? tr('Jugador'),
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
          alert(tr('Ya no perteneces a esta liga.'))
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'week_payments', filter: `group_id=eq.${group.id}` },
        () => setPaymentRefreshTick((t) => t + 1)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${group.id}` },
        () => setPaymentRefreshTick((t) => t + 1)
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

  // en modo "semana a semana", a partir de la 2da semana hay que confirmar
  // participacion (compromiso de pago) antes de poder predecir esa semana
  const isFirstWeek = weeks.length > 0 && weekKey === weeks[0].key
  const needsConfirmation = group.scoring_mode === 'weekly' && weekKey !== null && !isFirstWeek
  const [confirmedUserIds, setConfirmedUserIds] = useState<Set<string> | null>(null)
  const [confirming, setConfirming] = useState(false)
  const weekConfirmed = !needsConfirmation ? true : confirmedUserIds === null ? null : confirmedUserIds.has(user.id)

  useEffect(() => {
    if (!needsConfirmation || !weekKey) { setConfirmedUserIds(null); return }
    setConfirmedUserIds(null)
    const [y, st, w] = weekKey.split(':').map(Number)
    supabase
      .from('week_confirmations')
      .select('user_id')
      .eq('group_id', group.id)
      .eq('year', y)
      .eq('season_type', st)
      .eq('week', w)
      .then(({ data }) => {
        setConfirmedUserIds(new Set((data ?? []).map((c: any) => c.user_id)))
      })
  }, [needsConfirmation, weekKey, group.id])

  async function confirmParticipation() {
    if (!weekKey || confirming) return
    setConfirming(true)
    const [y, st, w] = weekKey.split(':').map(Number)
    const { error: err } = await supabase
      .from('week_confirmations')
      .insert({ group_id: group.id, user_id: user.id, year: y, season_type: st, week: w })
    setConfirming(false)
    if (!err) {
      setConfirmedUserIds((prev) => new Set([...(prev ?? []), user.id]))
    } else {
      console.error('Error al confirmar participacion:', err)
    }
  }

  const visibleMembers = needsConfirmation && confirmedUserIds ? members.filter((m) => confirmedUserIds.has(m.user_id)) : members

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


  // ---- modo "Confirmar predicciones" ----
  const confirmMode = !!group.confirm_picks
  const [pickConfirmedBy, setPickConfirmedBy] = useState<Set<string>>(new Set())
  const [confirmingPicks, setConfirmingPicks] = useState(false)
  const [sharingPicks, setSharingPicks] = useState(false)
  const [confirmPicksErr, setConfirmPicksErr] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState<boolean | null>(null) // null = automatico (abierto si falta confirmar, cerrado si ya confirmo)

  useEffect(() => {
    if (!confirmMode || !weekKey) { setPickConfirmedBy(new Set()); return }
    const [y, st, w] = weekKey.split(':').map(Number)
    let cancelled = false
    supabase
      .from('pick_confirmations')
      .select('user_id')
      .eq('group_id', group.id).eq('year', y).eq('season_type', st).eq('week', w)
      .then(({ data }) => { if (!cancelled) setPickConfirmedBy(new Set((data ?? []).map((c: any) => c.user_id))) })
    return () => { cancelled = true }
  }, [confirmMode, weekKey, group.id, tab])

  const myPicksConfirmed = confirmMode && pickConfirmedBy.has(user.id)
  const allConfirmed = confirmMode && members.length > 0 && members.every((m) => pickConfirmedBy.has(m.user_id))
  const openMissing = weekGames.filter((g) => new Date(g.kickoff).getTime() > nowTick && !(pickedBy[g.id] ?? []).includes(user.id)).length
  const openGames = weekGames.filter((g) => new Date(g.kickoff).getTime() > nowTick).length

  const confirmPanelOpen = confirmOpen ?? !myPicksConfirmed

  async function confirmMyPicks() {
    if (!weekKey || confirmingPicks) return
    if (!window.confirm(tr('Al confirmar ya NO podras cambiar ninguna prediccion de esta semana. ¿Confirmar?'))) return
    setConfirmingPicks(true); setConfirmPicksErr(null)
    const [y, st, w] = weekKey.split(':').map(Number)
    const { error: err } = await supabase.rpc('confirm_week_picks', { p_group_id: group.id, p_year: y, p_season_type: st, p_week: w })
    setConfirmingPicks(false)
    if (err) { setConfirmPicksErr(err.message); return }
    setPickConfirmedBy((prev) => new Set([...prev, user.id]))
  }

  async function shareWeekPicks() {
    if (sharingPicks || !selectedWeek || !allConfirmed) return
    setSharingPicks(true)
    try {
      const ids = weekGames.map((g) => g.id)
      const { data } = await supabase
        .from('picks')
        .select('user_id, game_id, pred_home_score, pred_away_score, pred_winner, pred_total')
        .in('game_id', ids)
      const picks: Record<string, Record<string, any>> = {}
      ;(data ?? []).forEach((p: any) => { (picks[p.user_id] ??= {})[p.game_id] = p })
      const sorted = [...weekGames].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
      const players = members
        .filter((m) => pickConfirmedBy.has(m.user_id))
        .map((m) => ({ user_id: m.user_id, name: (m.display_name ?? tr('Jugador')).trim().split(/\s+/)[0], favorite_team: m.favorite_team }))
      await sharePicksImage({
        group,
        weekLabelText: weekLabel(selectedWeek.seasonType, selectedWeek.week),
        games: sorted as any,
        players,
        picks,
        winnerMode: group.pick_mode === 'winner',
        lastGameId: sorted.length ? sorted[sorted.length - 1].id : null,
      })
    } finally {
      setSharingPicks(false)
    }
  }

  // ultimo partido (por kickoff) de cada semana: en modo "solo ganador" ahi se pide el total de puntos
  const lastGameIds = useMemo(() => getLastGameIds(games.filter((g) => !g.deleted_at) as any), [games])

  const [weeklyWinners, setWeeklyWinners] = useState<{ names: string[]; points: number } | null>(null)

  useEffect(() => {
    async function computeWinner() {
      if (weekGames.length === 0) { setWeeklyWinners(null); return }
      // solo mostramos ganador/empate de la jornada cuando TODOS los juegos
      // de la semana ya terminaron; si aun hay pendientes, no hay resultado final
      const allFinal = weekGames.every((g) => g.status === 'final')
      if (!allFinal) { setWeeklyWinners(null); return }

      const finalIds = weekGames.map((g) => g.id)
      const { data } = await supabase.from('picks').select('user_id, game_id, points, pred_home_score, pred_away_score, pred_total').in('game_id', finalIds)

      // quien no confirmo su participacion a tiempo esta semana no cuenta
      // para nada de esto -- ni gana, ni se le penaliza, simplemente no aplica
      const activeWeekEntry = weekKey
        ? (([y, st, w]) => ({ year: y, seasonType: st, week: w }))(weekKey.split(':').map(Number) as [number, number, number])
        : null
      const eligibleUserIds = await getEligibleUserIds(group, members.map((m) => m.user_id), games, activeWeekEntry)

      // misma funcion que usa la Tabla y "Tu posicion" -- mismo desempate,
      // incluida la penalizacion de +20 por cada partido no predicho
      const standings = buildStandings(eligibleUserIds, weekGames, data ?? [], group.points_exact, standingsOptionsFor(group, games as any))
      if (standings.length === 0) { setWeeklyWinners(null); return }

      const top = standings[0]
      if (top.points <= 0) { setWeeklyWinners(null); return }

      // si sigue habiendo empate total incluso despues del desempate, son co-ganadores reales
      const tied = standings.filter((s) => s.points === top.points && s.exactHits === top.exactHits && s.pointDiff === top.pointDiff)
      const names = tied.map((s) => members.find((m) => m.user_id === s.user_id)?.display_name ?? tr('Jugador'))
      setWeeklyWinners({ names, points: top.points })
    }
    computeWinner()
  }, [weekGames, members, group, weekKey, games])

  // "tienes pago pendiente" -- solo lo ve el propio usuario, nunca a los
  // demas miembros. En modo semanal se suma TODO lo que deba desde la
  // primera jornada hasta la que tiene abierta ahora (si entra a jugar la
  // semana 5 y no pago la 3 ni la 4, le aparece el total acumulado).
  // En los demas modos es el pago unico de toda la liga.
  const [myPaymentDue, setMyPaymentDue] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loadMyPaymentStatus() {
      if (tab !== 'picks') return // solo hace falta tenerlo al dia cuando se ve esta pestaña
      if (group.bet_amount <= 0) { setMyPaymentDue(0); return }

      if (group.scoring_mode === 'weekly') {
        if (!weekKey) { setMyPaymentDue(0); return }
        const currentIdx = weeks.findIndex((w) => w.key === weekKey)
        if (currentIdx === -1) { setMyPaymentDue(0); return }
        const weeksSoFar = weeks.slice(0, currentIdx + 1) // desde la 1a jornada hasta la actual, incluida
        const pastWeeks = weeksSoFar.slice(0, -1)
        const currentWeekEntry = weeksSoFar[weeksSoFar.length - 1] ?? null

        const gameIds = games.filter((g) => !g.deleted_at).map((g) => g.id)
        const gameWeekMap = new Map(games.map((g) => [g.id, `${g.year}:${g.season_type}:${g.week}`]))

        const [{ data: paymentsData }, { data: picksData }] = await Promise.all([
          supabase.from('week_payments').select('year, season_type, week, paid').eq('group_id', group.id).eq('user_id', user.id),
          gameIds.length > 0
            ? supabase.from('picks').select('game_id').eq('user_id', user.id).in('game_id', gameIds)
            : Promise.resolve({ data: [] as { game_id: string }[] }),
        ])

        const paidSet = new Set((paymentsData ?? []).filter((p: any) => p.paid).map((p: any) => `${p.year}:${p.season_type}:${p.week}`))
        // semanas donde de verdad predijo algo -- si nunca metio ni una sola
        // prediccion esa jornada, no se le cuenta como deuda pasada
        const participatedWeeks = new Set((picksData ?? []).map((p: any) => gameWeekMap.get(p.game_id)).filter(Boolean) as string[])

        // en jornadas pasadas, solo cuenta si de verdad jugo esa semana; la
        // jornada actual siempre cuenta (es el recordatorio de "vas a jugar
        // esta semana, no se te olvide pagar"), aunque aun no haya predicho nada ahi
        const unpaidPast = pastWeeks.filter((w) => participatedWeeks.has(w.key) && !paidSet.has(w.key))
        const currentOwed = currentWeekEntry && !paidSet.has(currentWeekEntry.key) ? [currentWeekEntry] : []
        const unpaidCount = unpaidPast.length + currentOwed.length
        if (!cancelled) setMyPaymentDue(unpaidCount * group.bet_amount)
        return
      }

      const { data } = await supabase
        .from('group_members')
        .select('paid')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled) setMyPaymentDue(data?.paid ? 0 : group.bet_amount)
    }
    loadMyPaymentStatus()
    return () => { cancelled = true }
  }, [group.id, group.bet_amount, group.scoring_mode, user.id, weekKey, weeks, games, tab, paymentRefreshTick])

  // el boton de "Actualizar" vive visualmente en el header de arriba (junto
  // al logo), pero su logica se queda aqui -- solo se muestra en la pestaña
  // de Predicciones, y solo para el admin
  const headerSlot = typeof document !== 'undefined' ? document.getElementById('header-right-slot') : null
  const syncButtonPortal =
    headerSlot && isAdmin && tab === 'picks' && weekKey
      ? createPortal(
          <button
            onClick={handleSyncCurrentWeek}
            disabled={syncingWeek}
            title={tr('Actualizar partidos de esta semana desde la NFL')}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-[var(--color-light-amber)]/50 text-[var(--color-light-amber)] hover:bg-[rgba(242,183,5,0.1)] transition disabled:opacity-50"
          >
            <IconRefresh size={11} className={syncingWeek ? 'animate-spin' : ''} />
            {syncingWeek ? tr('Actualizando...') : tr('Actualizar')}
          </button>,
          headerSlot
        )
      : null

  return (
    <div className="page-wrap">
      {syncButtonPortal}
      <LeagueHeader
        group={group}
        tab={tab}
        onTabChange={setTab}
        weeks={weeks}
        weekKey={weekKey}
        onSelectWeek={setWeekKey}
        multiYear={multiYear}
        selectedWeek={selectedWeek}
        liveCount={liveNow.length}
        memberCount={members.length}
        copiedCode={copiedCode}
        onCopyCode={copyCode}
        isAdmin={isAdmin}
        onOpenAdmin={() => setTab('admin')}
        prize={group.bet_amount > 0 ? group.bet_amount * (needsConfirmation ? (confirmedUserIds ? confirmedUserIds.size : 0) : members.length) : 0}
      />

      {tab === 'admin' && (
        <button onClick={() => setTab('picks')} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] mb-4 flex items-center gap-1">
          ← {tr('Volver a predicciones')}
        </button>
      )}


      <div key={tab} className="animate-tab-fade">
        {tab === 'picks' && (
        <>
          <div className="mb-4">
            {weekKey && group.allow_copy_picks && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setShowCopyModal(true)}
                  title={tr('Copiar predicciones de otra liga')}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-dashed border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] transition"
                >
                  <IconCopy size={11} /> {tr('Copiar de otra liga')}
                </button>
              </div>
            )}
          </div>
          {syncWeekMsg && (
            <p className="text-[10px] text-[var(--color-turf-green)] text-right -mt-2 mb-3">{syncWeekMsg}</p>
          )}

          {weekPicksTotal > 0 && (() => {
            const closingSoonBanner = nextLock != null && nextLock - nowTick < 3 * 60 * 60 * 1000
            const urgent = weekPicksMissing > 0 || closingSoonBanner
            return urgent ? (
              <div className="bg-[var(--color-field-surface)] border border-[var(--color-light-amber)]/40 rounded-lg px-4 py-3 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    <IconClipboard size={14} className="text-[var(--color-text-muted)]" />
                    {tr('{done}/{total} predicciones', { done: weekPicksDone, total: weekPicksTotal })}
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
                      <IconAlertTriangle size={13} /> {tr('Te faltan {n}', { n: weekPicksMissing })}
                    </p>
                  ) : (
                    <span />
                  )}
                  {nextLock && (
                    <span className="text-xs flex items-center gap-1">
                      {tr('Cierra en {time}', { time: '' })}<span className="font-bold text-[var(--color-light-amber)] font-mono-score">{formatCountdown(nextLock - nowTick)}</span>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-1 mb-4">
                <span className="flex items-center gap-1.5">
                  <IconClipboard size={12} className="text-[var(--color-turf-green)]" /> {tr('Todo predicho')}
                </span>
                {nextLock ? (
                  <span>{tr('Cierra en {time}', { time: formatCountdown(nextLock - nowTick) })}</span>
                ) : (
                  <span>{tr('No hay predicciones abiertas esta semana')}</span>
                )}
              </div>
            )
          })()}

          {confirmMode && weekGames.length > 0 && (
            <div className={`rounded-lg border mb-4 ${myPicksConfirmed ? 'border-[var(--color-turf-green)]/40 bg-[rgba(61,139,95,0.07)]' : 'border-[var(--color-field-line)] bg-[var(--color-field-surface)]'}`}>
              <button
                type="button"
                onClick={() => setConfirmOpen(!confirmPanelOpen)}
                aria-expanded={confirmPanelOpen}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex-1 min-w-0 text-sm font-semibold flex items-center gap-1.5">
                  {myPicksConfirmed ? <><IconLock size={14} className="text-[var(--color-turf-green)] shrink-0" /> {tr('Predicciones confirmadas')}</> : tr('Confirma tus predicciones')}
                </span>
                <span className="text-[11px] font-mono-score text-[var(--color-text-muted)] shrink-0">{pickConfirmedBy.size}/{members.length}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-text-muted)] transition-transform" style={{ transform: confirmPanelOpen ? 'rotate(180deg)' : 'none' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {confirmPanelOpen && (
                <div className="px-4 pb-3 -mt-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="flex-1 min-w-[180px] text-[11px] text-[var(--color-text-muted)]">
                      {myPicksConfirmed
                        ? (allConfirmed ? tr('Ya no se pueden cambiar. Todos confirmaron: ya puedes compartir los pronosticos.') : tr('Ya no se pueden cambiar. Los pronosticos se revelan cuando todos hayan confirmado.'))
                        : openGames === 0
                        ? tr('Ya no hay partidos abiertos esta semana.')
                        : openMissing > 0
                        ? (openMissing === 1 ? tr('Llena el partido que te falta para poder confirmar.') : tr('Llena los {n} partidos que te faltan para poder confirmar.', { n: openMissing }))
                        : tr('Al confirmar ya no podras cambiar ninguna prediccion de la semana.')}
                    </p>
                    {!myPicksConfirmed && openGames > 0 && (
                      <button
                        onClick={confirmMyPicks}
                        disabled={openMissing > 0 || confirmingPicks}
                        className="home-btn amber sm disabled:opacity-40"
                        style={{ cursor: openMissing > 0 ? 'not-allowed' : 'pointer' }}
                      >
                        {confirmingPicks ? tr('Confirmando...') : tr('Confirmar')}
                      </button>
                    )}
                    {allConfirmed && (
                      <button onClick={shareWeekPicks} disabled={sharingPicks} className="home-btn ghost sm disabled:opacity-50">
                        <IconShare size={13} /> {sharingPicks ? tr('Generando...') : tr('Compartir pronosticos')}
                      </button>
                    )}
                  </div>
                  {confirmPicksErr && <p className="text-[11px] text-[var(--color-scoreboard-red)] mt-2">{confirmPicksErr}</p>}
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-2">{tr('{done}/{total} jugadores han confirmado', { done: pickConfirmedBy.size, total: members.length })}</p>
                </div>
              )}
            </div>
          )}

          {myPaymentDue > 0 && (
            <div className="flex items-center gap-3 bg-[rgba(228,70,43,0.08)] border border-[var(--color-scoreboard-red)]/40 rounded-lg px-3 py-2.5 mb-4">
              <div className="w-8 h-8 rounded-full bg-[rgba(228,70,43,0.15)] flex items-center justify-center shrink-0 text-[var(--color-scoreboard-red)]">
                <IconCoin size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-scoreboard-red)]">
                  {tr('Tienes pago pendiente')}
                </p>
                <p className="text-sm font-semibold truncate">
                  {tr('Debes {amount}', { amount: '$' + myPaymentDue.toLocaleString(localeTag()) })}
                  {group.scoring_mode === 'weekly' && myPaymentDue > group.bet_amount ? (
                    <span className="font-normal text-[var(--color-text-muted)]"> · {tr('{n} jornadas sin pagar', { n: Math.round(myPaymentDue / group.bet_amount) })}</span>
                  ) : null}
                </p>
              </div>
            </div>
          )}

          {weeklyWinners && (
            <div className="flex items-center gap-3 bg-[rgba(242,183,5,0.08)] border border-[var(--color-light-amber)]/40 rounded-lg px-3 py-2.5 mb-4">
              <div className="w-8 h-8 rounded-full bg-[rgba(242,183,5,0.15)] flex items-center justify-center shrink-0 text-[var(--color-light-amber)]">
                <IconTrophy size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-light-amber)]">
                  {weeklyWinners.names.length > 1 ? tr('Empate en la jornada') : tr('Ganador de la jornada')}
                </p>
                <p className="text-sm font-semibold truncate">
                  {weeklyWinners.names.join(tr(' y '))}
                  <span className="font-normal text-[var(--color-text-muted)]"> · {tr('{n} pts', { n: weeklyWinners.points })}</span>
                </p>
              </div>
            </div>
          )}

          {needsConfirmation && weekConfirmed === false && (
            <div className="flex items-center justify-between gap-3 bg-[rgba(242,183,5,0.08)] border border-[var(--color-light-amber)] rounded-lg px-4 py-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-[var(--color-light-amber)]">{tr('Confirma tu participacion de esta semana')}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  {group.bet_amount > 0
                    ? tr('Los puntos se reinician cada semana en esta liga. Confirma que vas a pagar tu apuesta (${amount}) para poder predecir.', { amount: group.bet_amount.toLocaleString(localeTag()) })
                    : tr('Los puntos se reinician cada semana en esta liga. Confirma que vas a pagar tu apuesta para poder predecir.')}
                </p>
              </div>
              <button
                onClick={confirmParticipation}
                disabled={confirming}
                className="shrink-0 bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md px-4 py-2 text-xs hover:brightness-110 disabled:opacity-50"
              >
                {confirming ? tr('Confirmando...') : tr('Confirmar')}
              </button>
            </div>
          )}
          {weekGames.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {isAdmin ? tr('Todavia no capturas partidos. Ve a la pestaña Administrar.') : tr('El administrador aun no captura partidos para esta semana.')}
            </p>
          ) : (
            <div className="games-grid">
              {weekGames.map((g) => (
                <div
                  key={g.id}
                  id={`game-${g.id}`}
                  className={g.id === highlightedGameId ? 'rounded-xl ring-2 ring-[var(--color-light-amber)] transition-all' : ''}
                >
                  <GameCard
                    key={pickRefreshKey}
                    game={g}
                    userId={user.id}
                    members={visibleMembers}
                    pickedUserIds={pickedBy[g.id] ?? []}
                    forceLocked={needsConfirmation && weekConfirmed === false}
                    forceLockedReason={tr('Confirma tu participacion arriba para poder predecir')}
                    confirmLocked={myPicksConfirmed}
                    pointsWinner={group.points_winner}
                    pointsExact={group.pick_mode === 'winner' ? undefined : group.points_exact}
                    pickMode={group.pick_mode ?? 'score'}
                    requiresTotal={group.pick_mode === 'winner' && lastGameIds.has(g.id)}
                  />
                </div>
              ))}

              <div className="flex items-center gap-3 bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-[rgba(242,183,5,0.15)] flex items-center justify-center shrink-0 text-[var(--color-light-amber)]">
                  <IconTrophy size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{tr('¡Que empiecen los picks!')}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{tr('Haz tus predicciones y compite con tu grupo.')}</p>
                </div>
                <button
                  onClick={() => setTab('tabla')}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--color-light-amber)] text-[var(--color-light-amber)] hover:bg-[var(--color-light-amber)] hover:text-[var(--color-field-night)] transition"
                >
                  <IconBarChart size={12} /> {tr('Ver tabla')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'tabla' && <Leaderboard group={group} weekKey={weekKey} onRowsCount={setBoardCount} />}

      {tab === 'admin' && isAdmin && (
        <Suspense fallback={<p className="text-[var(--color-text-muted)] text-sm py-8 text-center">{tr('Cargando...')}</p>}>
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