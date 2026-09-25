import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NFL_TEAMS, weekLabel, type Game, type Group } from '../lib/types'
import { compareWeekEntries } from '../lib/ranking'
import { fetchEspnWeek, guessCurrentWeek, type SeasonType } from '../lib/espn'
import { teamLogoUrl } from '../lib/teamLogos'
import MembersManager from '../components/MembersManager'
import DangerZone from '../components/DangerZone'
import { IconTrash, IconChevronRight, IconCheck, IconPencil, IconTarget, IconTrophy, IconUsers, IconCalendar, IconBookmark } from '../components/icons'

function SettingsCard({
  icon,
  title,
  description,
  summary,
  open,
  onToggle,
  danger,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  summary?: string
  open: boolean
  onToggle: () => void
  danger?: boolean
  children?: React.ReactNode
}) {
  const accent = danger ? 'var(--color-scoreboard-red)' : 'var(--color-light-amber)'
  return (
    <div
      className="rounded-3xl border overflow-hidden transition-colors"
      style={{
        borderColor: open ? accent : 'var(--color-field-line)',
        boxShadow: open ? `0 0 0 1px ${accent}, 0 0 24px -10px ${danger ? 'rgba(228,70,43,0.5)' : 'rgba(242,183,5,0.5)'}` : 'none',
      }}
    >
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: danger ? 'rgba(228,70,43,0.12)' : 'rgba(242,183,5,0.12)', color: danger ? '#FF6B52' : accent }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold uppercase tracking-wide" style={{ color: danger ? '#FF6B52' : accent }}>{title}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{description}</p>
        </div>
        {!open && summary && (
          <span className="text-xs text-[var(--color-text-muted)] shrink-0 text-right hidden sm:block">{summary}</span>
        )}
        <IconChevronRight size={16} className={`shrink-0 transition-transform ${danger ? 'text-[var(--color-scoreboard-red)]' : 'text-[var(--color-light-amber)]'} ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && children && <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>}
    </div>
  )
}

function Stepper({ label, description, value, onChange, min = -50 }: { label: string; description: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-lg border border-[var(--color-field-line)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] transition text-lg leading-none"
        >
          −
        </button>
        <span className={`w-12 text-center font-mono-score text-sm bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-lg py-1.5 ${value < 0 ? 'text-[var(--color-scoreboard-red)]' : ''}`}>{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-lg border border-[var(--color-field-line)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] transition text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function Admin({
  group,
  games,
  onChange,
  onGroupUpdated,
  onBack,
  onLeftAdmin,
}: {
  group: Group
  games: Game[]
  onChange: () => void
  onGroupUpdated: (g: Group) => void
  onBack: () => void
  onLeftAdmin: () => void
}) {
  const groupId = group.id
  // partido cuyas predicciones se estan corrigiendo a mano (modal), null = cerrado
  const [editPicksGame, setEditPicksGame] = useState<Game | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [paymentMembers, setPaymentMembers] = useState<{ user_id: string; display_name: string; paid: boolean }[]>([])
  const [payingId, setPayingId] = useState<string | null>(null)
  // en modo "semana a semana" el pago se marca por jornada; en los otros
  // modos hay un solo pago para toda la liga (paymentWeekKey se queda null)
  const [paymentWeekKey, setPaymentWeekKey] = useState<string | null>(null)

  async function loadPaymentMembers(weekKey: string | null) {
    if (group.scoring_mode === 'weekly') {
      if (!weekKey) { setPaymentMembers([]); return }
      const [y, st, w] = weekKey.split(':').map(Number)
      const [{ data: membersData }, { data: paymentsData }] = await Promise.all([
        supabase.from('group_members').select('user_id, profiles(display_name)').eq('group_id', groupId),
        supabase.from('week_payments').select('user_id, paid').eq('group_id', groupId).eq('year', y).eq('season_type', st).eq('week', w),
      ])
      const paidMap = new Map((paymentsData ?? []).map((p: any) => [p.user_id, p.paid]))
      const list = (membersData ?? [])
        .map((m: any) => ({ user_id: m.user_id, display_name: m.profiles?.display_name ?? 'Jugador', paid: paidMap.get(m.user_id) ?? false }))
        .sort((a, b) => Number(a.paid) - Number(b.paid))
      setPaymentMembers(list)
      setMemberCount(list.length)
      return
    }
    const { data } = await supabase
      .from('group_members')
      .select('user_id, paid, profiles(display_name)')
      .eq('group_id', groupId)
      .order('paid', { ascending: true })
    const list = (data ?? []).map((m: any) => ({ user_id: m.user_id, display_name: m.profiles?.display_name ?? 'Jugador', paid: m.paid }))
    setPaymentMembers(list)
    setMemberCount(list.length)
  }

  useEffect(() => {
    loadPaymentMembers(paymentWeekKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, group.scoring_mode, paymentWeekKey])

  async function toggleMemberPaid(userId: string, current: boolean) {
    setPayingId(userId)
    let err
    if (group.scoring_mode === 'weekly' && paymentWeekKey) {
      const [y, st, w] = paymentWeekKey.split(':').map(Number)
      const res = await supabase.rpc('set_week_member_paid', {
        p_group_id: groupId,
        p_user_id: userId,
        p_year: y,
        p_season_type: st,
        p_week: w,
        p_paid: !current,
      })
      err = res.error
    } else {
      const res = await supabase.rpc('set_member_paid', { p_group_id: groupId, p_user_id: userId, p_paid: !current })
      err = res.error
    }
    setPayingId(null)
    if (!err) {
      setPaymentMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, paid: !current } : m)))
    }
  }

  const [week, setWeek] = useState(1)
  const [manualSeasonType, setManualSeasonType] = useState<SeasonType>(2)
  const [homeTeam, setHomeTeam] = useState(NFL_TEAMS[0])
  const [awayTeam, setAwayTeam] = useState(NFL_TEAMS[1])
  const [kickoff, setKickoff] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [editName, setEditName] = useState(group.name)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(group.logo_url)
  const [savingGroup, setSavingGroup] = useState(false)
  const [groupMsg, setGroupMsg] = useState<string | null>(null)
  const [groupErr, setGroupErr] = useState<string | null>(null)

  const [pointsWinner, setPointsWinner] = useState(group.points_winner ?? 1)
  const [pointsExact, setPointsExact] = useState(group.points_exact ?? 3)
  const [pointsTeamTotal, setPointsTeamTotal] = useState(group.points_team_total ?? 1)
  const [recalcFinal, setRecalcFinal] = useState(false)
  const [savingRules, setSavingRules] = useState(false)
  const [rulesMsg, setRulesMsg] = useState<string | null>(null)
  const [rulesErr, setRulesErr] = useState<string | null>(null)

  const [savingMode, setSavingMode] = useState(false)
  const [modeErr, setModeErr] = useState<string | null>(null)

  // que modo se ve seleccionado/expandido en la UI -- separado de
  // group.scoring_mode porque para "rango" el usuario necesita elegir las
  // semanas ANTES de guardar, no se activa con un solo click como los otros
  const [modeChoice, setModeChoice] = useState<'season' | 'weekly' | 'range'>(group.scoring_mode)
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
  const latestWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null
  const gamesInLatestWeek = latestWeek
    ? games.filter((g) => !g.deleted_at && g.year === latestWeek.year && g.season_type === latestWeek.seasonType && g.week === latestWeek.week).length
    : 0
  const ligaSummary = latestWeek ? `NFL ${latestWeek.year} · ${weekLabel(latestWeek.seasonType, latestWeek.week).replace('WEEK', 'Semana')}` : ''
  const partidosSummary = latestWeek ? `${gamesInLatestWeek} partidos · ${weekLabel(latestWeek.seasonType, latestWeek.week).replace('WEEK', 'Semana')}` : `${games.filter((g) => !g.deleted_at).length} partidos`

  // por default, al entrar en modo "semana a semana" se muestra la jornada
  // mas reciente (la ultima de la lista)
  useEffect(() => {
    if (group.scoring_mode === 'weekly' && !paymentWeekKey && weeks.length > 0) {
      setPaymentWeekKey(weeks[weeks.length - 1].key)
    }
  }, [group.scoring_mode, weeks, paymentWeekKey])

  const [rangeStartKey, setRangeStartKey] = useState(
    group.range_start_year && group.range_start_season_type && group.range_start_week
      ? `${group.range_start_year}:${group.range_start_season_type}:${group.range_start_week}`
      : ''
  )
  const [rangeEndKey, setRangeEndKey] = useState(
    group.range_end_year && group.range_end_season_type && group.range_end_week
      ? `${group.range_end_year}:${group.range_end_season_type}:${group.range_end_week}`
      : ''
  )
  const [savingRange, setSavingRange] = useState(false)
  const [rangeMsg, setRangeMsg] = useState<string | null>(null)

  function selectMode(mode: 'season' | 'weekly' | 'range') {
    setModeChoice(mode)
    setModeErr(null)
    if (mode === 'season' || mode === 'weekly') void changeScoringMode(mode)
  }

  async function changeScoringMode(mode: 'season' | 'weekly') {
    if (mode === group.scoring_mode || savingMode) return
    setSavingMode(true)
    setModeErr(null)
    const { data, error: err } = await supabase.rpc('set_scoring_mode', {
      p_group_id: groupId,
      p_scoring_mode: mode,
      p_range_start_year: null,
      p_range_start_season_type: null,
      p_range_start_week: null,
      p_range_end_year: null,
      p_range_end_season_type: null,
      p_range_end_week: null,
    })
    setSavingMode(false)
    if (err) { setModeErr(err.message); return }
    onGroupUpdated(data)
  }

  async function saveScoringRange() {
    if (!rangeStartKey || !rangeEndKey || savingRange) return
    const [sy, sst, sw] = rangeStartKey.split(':').map(Number)
    const [ey, est, ew] = rangeEndKey.split(':').map(Number)
    if (compareWeekEntries({ year: sy, seasonType: sst, week: sw }, { year: ey, seasonType: est, week: ew }) > 0) {
      setModeErr('La semana de inicio debe ser antes (o igual) que la semana final')
      return
    }
    setSavingRange(true)
    setModeErr(null)
    setRangeMsg(null)
    const { data, error: err } = await supabase.rpc('set_scoring_mode', {
      p_group_id: groupId,
      p_scoring_mode: 'range',
      p_range_start_year: sy,
      p_range_start_season_type: sst,
      p_range_start_week: sw,
      p_range_end_year: ey,
      p_range_end_season_type: est,
      p_range_end_week: ew,
    })
    setSavingRange(false)
    if (err) { setModeErr(err.message); return }
    onGroupUpdated(data)
    setRangeMsg('Rango guardado.')
  }

  async function saveScoringRules() {
    setSavingRules(true)
    setRulesMsg(null)
    setRulesErr(null)
    const { data, error: err } = await supabase.rpc('update_scoring_rules', {
      p_group_id: groupId,
      p_points_winner: pointsWinner,
      p_points_exact: pointsExact,
      p_points_team_total: pointsTeamTotal,
      p_recalculate_final: recalcFinal,
    })
    setSavingRules(false)
    if (err) { setRulesErr(err.message); return }
    onGroupUpdated(data)
    setRulesMsg(recalcFinal ? 'Guardado — se recalcularon tambien los partidos ya jugados.' : 'Guardado — se aplicara a los partidos que falten por jugar.')
  }

  const [betAmount, setBetAmount] = useState(group.bet_amount ?? 0)
  const [split1, setSplit1] = useState(group.prize_split_1 ?? 65)
  const [split2, setSplit2] = useState(group.prize_split_2 ?? 25)
  const [split3, setSplit3] = useState(group.prize_split_3 ?? 10)
  const [savingPrize, setSavingPrize] = useState(false)
  const [prizeMsg, setPrizeMsg] = useState<string | null>(null)
  const [prizeErr, setPrizeErr] = useState<string | null>(null)
  const splitTotal = Number(split1) + Number(split2) + Number(split3)

  async function savePrizeSettings(e: React.FormEvent) {
    e.preventDefault()
    setPrizeMsg(null)
    setPrizeErr(null)
    if (Math.round(splitTotal * 100) / 100 !== 100) {
      setPrizeErr(`Los porcentajes deben sumar 100 (ahorita suman ${splitTotal}).`)
      return
    }
    setSavingPrize(true)
    const { data, error: err } = await supabase.rpc('set_prize_settings', {
      p_group_id: groupId,
      p_bet_amount: Number(betAmount),
      p_split_1: Number(split1),
      p_split_2: Number(split2),
      p_split_3: Number(split3),
    })
    setSavingPrize(false)
    if (err) { setPrizeErr(err.message); return }
    onGroupUpdated(data)
    setPrizeMsg('Guardado.')
  }

  const guess = guessCurrentWeek()
  const [syncYear, setSyncYear] = useState(guess.year)
  const [syncWeek, setSyncWeek] = useState(guess.week)
  const [syncType, setSyncType] = useState<SeasonType>(2)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(false)
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({})
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleWeek(key: string) {
    setExpandedWeeks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function onPickLogo(file: File | null) {
    setLogoFile(file)
    if (file) setLogoPreview(URL.createObjectURL(file))
  }

  async function saveGroupInfo(e: React.FormEvent) {
    e.preventDefault()
    setSavingGroup(true)
    setGroupMsg(null)
    setGroupErr(null)
    try {
      let logoUrl = group.logo_url

      if (logoFile) {
        const ext = logoFile.name.split('.').pop() ?? 'jpg'
        const path = `${groupId}/logo.${ext}`
        const { error: upErr } = await supabase.storage
          .from('group-logos')
          .upload(path, logoFile, { upsert: true })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('group-logos').getPublicUrl(path)
        logoUrl = data.publicUrl
      }

      const { data: updated, error: updErr } = await supabase.rpc('update_group', {
        p_group_id: groupId,
        p_name: editName,
        p_logo_url: logoUrl ?? null,
      })
      if (updErr) throw updErr

      onGroupUpdated(updated)
      setLogoFile(null)
      setGroupMsg('Guardado.')
    } catch (err) {
      setGroupErr((err as any)?.message ?? 'No se pudo guardar')
    } finally {
      setSavingGroup(false)
    }
  }

  const [savingCopyToggle, setSavingCopyToggle] = useState(false)
  async function toggleCopyPicksEnabled() {
    setSavingCopyToggle(true)
    const { data, error: err } = await supabase.rpc('set_copy_picks_enabled', {
      p_group_id: groupId,
      p_enabled: !group.allow_copy_picks,
    })
    setSavingCopyToggle(false)
    if (!err) onGroupUpdated(data)
  }

  const [savingFinalizedToggle, setSavingFinalizedToggle] = useState(false)
  async function toggleFinalized() {
    setSavingFinalizedToggle(true)
    const { data, error: err } = await supabase.rpc('set_group_finalized', {
      p_group_id: groupId,
      p_finalized: !group.finalized,
    })
    setSavingFinalizedToggle(false)
    if (!err) onGroupUpdated(data)
  }

  async function syncWeekFromEspn(e?: React.FormEvent) {
    e?.preventDefault()
    setSyncing(true)
    setSyncMsg(null)
    setError(null)
    try {
      const espnGames = await fetchEspnWeek(syncYear, syncWeek, syncType)
      if (espnGames.length === 0) {
        setSyncMsg('ESPN no devolvio partidos para esa semana/temporada.')
        return
      }

      let created = 0
      let updated = 0
      let failed = 0

      for (const eg of espnGames) {
        const existing = games.find(
          (g) => g.week === syncWeek && g.season_type === syncType && g.year === syncYear && g.home_team === eg.homeTeam && g.away_team === eg.awayTeam
        )
        const newStatus: 'scheduled' | 'live' | 'final' = eg.completed ? 'final' : eg.live ? 'live' : 'scheduled'

        if (!existing) {
          const { data: inserted, error: insertErr } = await supabase
            .from('games')
            .insert({
              group_id: groupId,
              week: syncWeek,
              season_type: syncType,
              year: syncYear,
              home_team: eg.homeTeam,
              away_team: eg.awayTeam,
              kickoff: eg.kickoff,
              status: newStatus,
              home_score: eg.homeScore,
              away_score: eg.awayScore,
              game_clock: eg.clock,
            })
            .select()
            .single()

          if (insertErr) {
            failed++
            console.error('Error insertando partido:', insertErr.message)
            continue
          }
          created++
          if (eg.completed && inserted) {
            await supabase.rpc('calculate_points_for_game', { p_game_id: inserted.id })
          }
        } else if (
          existing.status !== 'final' &&
          (newStatus !== existing.status ||
            eg.homeScore !== existing.home_score ||
            eg.awayScore !== existing.away_score ||
            eg.clock !== existing.game_clock)
        ) {
          await supabase
            .from('games')
            .update({ status: newStatus, home_score: eg.homeScore, away_score: eg.awayScore, game_clock: eg.clock })
            .eq('id', existing.id)
          if (eg.completed) {
            await supabase.rpc('calculate_points_for_game', { p_game_id: existing.id })
          }
          updated++
        } else if (!eg.completed && existing.kickoff !== eg.kickoff) {
          // el horario pudo cambiar (ej. flex schedule)
          await supabase.from('games').update({ kickoff: eg.kickoff }).eq('id', existing.id)
          updated++
        }
      }

      const failedNote = failed > 0 ? ` — ⚠️ ${failed} fallaron (revisa la consola del navegador)` : ''
      setSyncMsg(`Listo: ${created} agregado(s), ${updated} actualizado(s)${failedNote} — ${new Date().toLocaleTimeString('es-MX')}`)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar con ESPN')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!autoSync) return
    const id = setInterval(() => syncWeekFromEspn(), 60000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, syncYear, syncWeek, syncType])

  async function addGame(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!kickoff) { setError('Falta la fecha/hora del partido'); return }
    const { error: err } = await supabase.from('games').insert({
      group_id: groupId,
      week,
      season_type: manualSeasonType,
      year: new Date(kickoff).getFullYear(),
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: new Date(kickoff).toISOString(),
    })
    if (err) { setError(err.message); return }
    setKickoff('')
    onChange()
  }

  async function setFinalScore(game: Game, homeScore: number, awayScore: number) {
    await supabase.from('games').update({ home_score: homeScore, away_score: awayScore, status: 'final' }).eq('id', game.id)
    await supabase.rpc('calculate_points_for_game', { p_game_id: game.id })
    onChange()
  }

  async function deleteGame(id: string) {
    if (!confirm('¿Borrar este partido? Podras recuperarlo despues desde la Papelera.')) return
    await supabase.from('games').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    onChange()
  }

  async function restoreGame(id: string) {
    await supabase.from('games').update({ deleted_at: null }).eq('id', id)
    onChange()
  }

  const gamesByWeek = useMemo(() => {
    const map = new Map<string, { key: string; year: number; seasonType: number; week: number; games: Game[] }>()
    games.filter((g) => !g.deleted_at).forEach((g) => {
      const key = `${g.year}:${g.season_type}:${g.week}`
      if (!map.has(key)) map.set(key, { key, year: g.year, seasonType: g.season_type, week: g.week, games: [] })
      map.get(key)!.games.push(g)
    })
    return Array.from(map.values()).sort((a, b) => a.year - b.year || a.seasonType - b.seasonType || a.week - b.week)
  }, [games])

  const deletedGames = useMemo(() => games.filter((g) => g.deleted_at), [games])

  async function deleteWeek(seasonType: number, week: number, year: number) {
    if (!confirm(`¿Borrar toda la ${weekLabel(seasonType, week)}? Podras recuperarla despues desde la Papelera.`)) return
    await supabase
      .from('games')
      .update({ deleted_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('season_type', seasonType)
      .eq('week', week)
      .eq('year', year)
    onChange()
  }

  async function restoreWeek(seasonType: number, week: number, year: number) {
    await supabase
      .from('games')
      .update({ deleted_at: null })
      .eq('group_id', groupId)
      .eq('season_type', seasonType)
      .eq('week', week)
      .eq('year', year)
    onChange()
  }

  return (
    <>
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">AJUSTES DE LA LIGA</h1>
      <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">Administra las reglas y configuracion de tu quiniela.</p>
    </div>
    <div className="space-y-4">
      <SettingsCard
        icon={<IconPencil size={18} />}
        title="Liga"
        description="Nombre, temporada y configuracion general"
        summary={ligaSummary}
        open={!!openSections.liga}
        onToggle={() => toggleSection('liga')}
      >
        <form onSubmit={saveGroupInfo} className="bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Nombre y foto de la liga</h2>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-field-surface)] border border-[var(--color-field-line)] flex items-center justify-center">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo de la liga" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🏈</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
              />
              <span className="block text-center text-[10px] text-[var(--color-light-amber)] mt-1">Cambiar</span>
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="flex-1 bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
          </div>
          {groupErr && <p className="text-[var(--color-scoreboard-red)] text-xs">{groupErr}</p>}
          {groupMsg && <p className="text-[var(--color-turf-green)] text-xs">{groupMsg}</p>}
          <button type="submit" disabled={savingGroup}
            className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50">
            {savingGroup ? 'Guardando...' : 'Guardar cambios de la liga'}
          </button>
        </form>

        <div className="bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-field-line)]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Copiar de otra liga</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">Permite a los jugadores copiar sus predicciones desde otra de sus ligas</p>
            </div>
            <button
              onClick={toggleCopyPicksEnabled}
              disabled={savingCopyToggle}
              aria-label="Habilitar copiar de otra liga"
              className="w-11 h-6 rounded-full relative transition shrink-0 disabled:opacity-50"
              style={{ background: group.allow_copy_picks ? '#F2B705' : 'var(--color-field-line)' }}
            >
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: group.allow_copy_picks ? '22px' : '2px' }} />
            </button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Marcar como finalizada</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">La liga se muestra como FINALIZADA en la lista de quinielas, sin importar los partidos</p>
            </div>
            <button
              onClick={toggleFinalized}
              disabled={savingFinalizedToggle}
              aria-label="Marcar liga como finalizada"
              className="w-11 h-6 rounded-full relative transition shrink-0 disabled:opacity-50"
              style={{ background: group.finalized ? 'var(--color-scoreboard-red)' : 'var(--color-field-line)' }}
            >
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: group.finalized ? '22px' : '2px' }} />
            </button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<IconTarget size={18} />}
        title="Puntuacion"
        description="Configura los puntos de cada prediccion"
        open={!!openSections.puntuacion}
        onToggle={() => toggleSection('puntuacion')}
      >
        <div className="bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-1 divide-y divide-[var(--color-field-line)]">
          <div className="pb-3">
            <Stepper label="Prediccion del ganador" description="Puntos por acertar el equipo ganador" value={pointsWinner} onChange={setPointsWinner} />
          </div>
          <div className="py-3">
            <Stepper label="Marcador exacto" description="Puntos por acertar el marcador completo" value={pointsExact} onChange={setPointsExact} />
          </div>
          <div className="pt-3">
            <Stepper label="Puntos de un equipo" description="Por acertar cuanto anota un equipo (no se suma si ya le atinaste al marcador exacto)" value={pointsTeamTotal} onChange={setPointsTeamTotal} />
          </div>
        </div>
        <label className="flex items-start gap-2.5 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-lg px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={recalcFinal}
            onChange={(e) => setRecalcFinal(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[var(--color-light-amber)] shrink-0"
          />
          <span className="text-xs">
            <span className="font-semibold block">Aplicar tambien a partidos ya jugados</span>
            <span className="text-[var(--color-text-muted)]">Si lo activas, se recalculan de una vez todos los partidos en FINAL con las reglas nuevas. Si lo dejas apagado, solo afecta a los que falten por jugar.</span>
          </span>
        </label>
        {rulesErr && <p className="text-[var(--color-scoreboard-red)] text-xs">{rulesErr}</p>}
        {rulesMsg && <p className="text-[var(--color-turf-green)] text-xs">{rulesMsg}</p>}
        <button onClick={saveScoringRules} disabled={savingRules}
          className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2.5 text-sm hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2">
          <IconBookmark size={14} /> {savingRules ? 'Guardando...' : 'Guardar cambios'}
        </button>

        <div className="h-px bg-[var(--color-field-line)]" />

        <div className="space-y-3">
            <h2 className="text-sm font-semibold">Modo de puntuacion</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => selectMode('season')}
                disabled={savingMode}
                className={`text-left rounded-md border px-3 py-2.5 transition disabled:opacity-50 ${
                  modeChoice === 'season'
                    ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.08)]'
                    : 'border-[var(--color-field-line)] hover:border-[var(--color-light-amber)]'
                }`}
              >
                <p className="text-xs font-semibold">Temporada completa</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Los puntos se acumulan durante toda la temporada</p>
              </button>
              <button
                type="button"
                onClick={() => selectMode('weekly')}
                disabled={savingMode}
                className={`text-left rounded-md border px-3 py-2.5 transition disabled:opacity-50 ${
                  modeChoice === 'weekly'
                    ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.08)]'
                    : 'border-[var(--color-field-line)] hover:border-[var(--color-light-amber)]'
                }`}
              >
                <p className="text-xs font-semibold">Semana a semana</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">La tabla se reinicia en 0 cada semana; hay un ganador por semana</p>
              </button>
              <button
                type="button"
                onClick={() => selectMode('range')}
                disabled={savingMode}
                className={`text-left rounded-md border px-3 py-2.5 transition disabled:opacity-50 ${
                  modeChoice === 'range'
                    ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.08)]'
                    : 'border-[var(--color-field-line)] hover:border-[var(--color-light-amber)]'
                }`}
              >
                <p className="text-xs font-semibold">Rango de semanas</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Tu eliges entre que semana y que semana cuentan los puntos</p>
              </button>
            </div>

            {modeChoice === 'range' && weeks.length === 0 && (
              <p className="text-[10px] text-[var(--color-text-muted)] border border-dashed border-[var(--color-field-line)] rounded-md px-3 py-2.5">
                Todavia no hay partidos en esta liga. Agrega o sincroniza partidos primero (mas abajo, en "Partidos") para poder elegir el rango de semanas.
              </p>
            )}

            {modeChoice === 'range' && weeks.length > 0 && (
              <div className="rounded-md border border-[var(--color-field-line)] px-3 py-3 space-y-2.5">
                <p className="text-[10px] text-[var(--color-text-muted)]">Solo cuentan para la tabla los partidos finalizados entre estas dos semanas (incluidas)</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-[var(--color-text-muted)]">
                    Desde
                    <select
                      value={rangeStartKey}
                      onChange={(e) => { setRangeStartKey(e.target.value); setRangeMsg(null) }}
                      className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-2 py-2 text-xs outline-none focus:border-[var(--color-light-amber)]"
                    >
                      <option value="" disabled>Elige semana</option>
                      {weeks.map((w) => (
                        <option key={w.key} value={w.key}>{weekLabel(w.seasonType, w.week)}{multiYear ? ` ${w.year}` : ''}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-[var(--color-text-muted)]">
                    Hasta
                    <select
                      value={rangeEndKey}
                      onChange={(e) => { setRangeEndKey(e.target.value); setRangeMsg(null) }}
                      className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-2 py-2 text-xs outline-none focus:border-[var(--color-light-amber)]"
                    >
                      <option value="" disabled>Elige semana</option>
                      {weeks.map((w) => (
                        <option key={w.key} value={w.key}>{weekLabel(w.seasonType, w.week)}{multiYear ? ` ${w.year}` : ''}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={saveScoringRange}
                  disabled={savingRange || !rangeStartKey || !rangeEndKey}
                  className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-xs hover:brightness-110 disabled:opacity-50"
                >
                  {savingRange ? 'Guardando...' : 'Guardar rango'}
                </button>
                {rangeMsg && <p className="text-[var(--color-turf-green)] text-xs">{rangeMsg}</p>}
              </div>
            )}

            {modeErr && <p className="text-[var(--color-scoreboard-red)] text-xs">{modeErr}</p>}
            <p className="text-[10px] text-[var(--color-text-muted)]">Cambiar esto afecta como todos los miembros ven la tabla desde ahora.</p>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<IconTrophy size={18} />}
        title="Premio"
        description="Configura el premio de la quiniela"
        summary={betAmount > 0 ? `$${betAmount.toLocaleString('es-MX')} por participante` : 'Sin premio configurado'}
        open={!!openSections.premio}
        onToggle={() => toggleSection('premio')}
      >
        <form onSubmit={savePrizeSettings} className="bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Monto por participante</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              El premio total se calcula solo: este monto x cuantos participantes haya en la liga.
            </p>
          </div>
          <label className="text-xs text-[var(--color-text-muted)] block">
            Monto (por persona)
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
          </label>

          {memberCount != null && Number(betAmount) > 0 && (
            <p className="text-xs text-[var(--color-turf-green)] font-semibold">
              Premio total ahorita: ${(Number(betAmount) * memberCount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              <span className="text-[var(--color-text-muted)] font-normal"> ({memberCount} × ${Number(betAmount).toLocaleString('es-MX')})</span>
            </p>
          )}

          <div className="h-px bg-[var(--color-field-line)]" />

          <div>
            <h2 className="text-sm font-semibold">Como se reparte entre los primeros 3</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Los porcentajes deben sumar 100.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--color-text-muted)]">
              🥇 1er lugar
              <input
                type="number" inputMode="decimal" min={0} max={100} step="0.1"
                value={split1} onChange={(e) => setSplit1(Number(e.target.value))}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              🥈 2do lugar
              <input
                type="number" inputMode="decimal" min={0} max={100} step="0.1"
                value={split2} onChange={(e) => setSplit2(Number(e.target.value))}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              🥉 3er lugar
              <input
                type="number" inputMode="decimal" min={0} max={100} step="0.1"
                value={split3} onChange={(e) => setSplit3(Number(e.target.value))}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
              />
            </label>
          </div>
          <p className={`text-xs ${splitTotal === 100 ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-scoreboard-red)] font-semibold'}`}>
            Suman {splitTotal}{splitTotal !== 100 ? ' — deben ser 100' : ''}
          </p>

          {prizeErr && <p className="text-[var(--color-scoreboard-red)] text-xs">{prizeErr}</p>}
          {prizeMsg && <p className="text-[var(--color-turf-green)] text-xs">{prizeMsg}</p>}
          <button type="submit" disabled={savingPrize}
            className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50">
            {savingPrize ? 'Guardando...' : 'Guardar premio'}
          </button>
        </form>

        {betAmount > 0 && memberCount !== null && memberCount > 0 && (
        <div className="bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Quien ya pago</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              Solo tu (el admin) puedes ver y marcar esto. {paymentMembers.filter((m) => m.paid).length}/{paymentMembers.length} pagaron
              {group.scoring_mode === 'weekly' ? ' esta jornada.' : '.'}
            </p>
          </div>

          {group.scoring_mode === 'weekly' && (
            weeks.length === 0 ? (
              <p className="text-[10px] text-[var(--color-text-muted)] border border-dashed border-[var(--color-field-line)] rounded-md px-3 py-2.5">
                Todavia no hay partidos/jornadas en esta liga.
              </p>
            ) : (
              <label className="text-xs text-[var(--color-text-muted)] block">
                Jornada
                <select
                  value={paymentWeekKey ?? ''}
                  onChange={(e) => setPaymentWeekKey(e.target.value)}
                  className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-2 py-2 text-xs outline-none focus:border-[var(--color-light-amber)]"
                >
                  {weeks.map((w) => (
                    <option key={w.key} value={w.key}>{weekLabel(w.seasonType, w.week)}{multiYear ? ` ${w.year}` : ''}</option>
                  ))}
                </select>
              </label>
            )
          )}

          {(group.scoring_mode !== 'weekly' || paymentWeekKey) && (
          <div className="space-y-1.5">
            {paymentMembers.map((m) => (
              <button
                key={m.user_id}
                onClick={() => toggleMemberPaid(m.user_id, m.paid)}
                disabled={payingId === m.user_id}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md border transition disabled:opacity-50"
                style={{
                  background: m.paid ? 'rgba(61,139,95,0.08)' : 'var(--color-field-surface-raised)',
                  borderColor: m.paid ? 'var(--color-turf-green)' : 'var(--color-field-line)',
                }}
              >
                <span className="text-sm">{m.display_name}</span>
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
                  style={
                    m.paid
                      ? { background: 'rgba(61,139,95,0.15)', color: 'var(--color-turf-green)', border: '1px solid rgba(61,139,95,0.4)' }
                      : { background: 'var(--color-field-line)', color: 'var(--color-text-muted)' }
                  }
                >
                  {m.paid ? <><IconCheck size={11} /> Pago</> : 'Pendiente'}
                </span>
              </button>
            ))}
          </div>
          )}
        </div>
        )}
      </SettingsCard>

      <SettingsCard
        icon={<IconUsers size={18} />}
        title="Miembros"
        description="Gestiona participantes de la liga"
        summary={memberCount != null ? `${memberCount} miembro${memberCount !== 1 ? 's' : ''}` : undefined}
        open={!!openSections.miembros}
        onToggle={() => toggleSection('miembros')}
      >
        <MembersManager group={group} />
      </SettingsCard>

      <SettingsCard
        icon={<IconCalendar size={18} />}
        title="Partidos"
        description="Selecciona los partidos disponibles"
        summary={partidosSummary}
        open={!!openSections.partidos}
        onToggle={() => toggleSection('partidos')}
      >
        <form onSubmit={syncWeekFromEspn} className="bg-[var(--color-field-surface-raised)] border border-[var(--color-light-amber)]/40 rounded-lg p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Importar semana automaticamente</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Trae los partidos, horarios y marcadores directo del calendario oficial de la NFL.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-[var(--color-text-muted)]">
              Temporada
              <select value={syncType} onChange={(e) => setSyncType(Number(e.target.value) as SeasonType)}
                className="w-full mt-1 bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]">
                <option value={2}>Regular</option>
                <option value={1}>Pretemporada</option>
                <option value={3}>Playoffs</option>
              </select>
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              Año
              <input type="number" value={syncYear} onChange={(e) => setSyncYear(Number(e.target.value))}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]" />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              Semana
              <input type="number" min={1} max={22} value={syncWeek} onChange={(e) => setSyncWeek(Number(e.target.value))}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]" />
            </label>
          </div>
          {syncMsg && <p className="text-xs text-[var(--color-turf-green)]">{syncMsg}</p>}
          <button type="submit" disabled={syncing}
            className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50">
            {syncing ? 'Sincronizando...' : 'Sincronizar con la NFL'}
          </button>
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            Actualizar automaticamente cada minuto (incluye partidos en curso, no solo terminados) mientras tengas esta pantalla abierta
          </label>
          {autoSync && (
            <div className="flex items-center gap-2 text-[10px] text-[var(--color-turf-green)] bg-[rgba(61,139,95,0.1)] border border-[var(--color-turf-green)]/40 rounded-md px-2.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-turf-green)] animate-pulse shrink-0" />
              Auto-sync activo — sincronizando cada minuto mientras esta pantalla siga abierta
            </div>
          )}
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Puedes correr esto varias veces: agrega partidos nuevos y actualiza marcadores finales sin duplicar nada.
            Usa una API publica no oficial de ESPN, asi que ocasionalmente puede fallar.
          </p>
        </form>

        <form onSubmit={addGame} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">O agregar un partido manualmente</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--color-text-muted)]">
              Temporada
              <select value={manualSeasonType} onChange={(e) => setManualSeasonType(Number(e.target.value) as SeasonType)}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]">
                <option value={2}>Regular</option>
                <option value={1}>Pretemporada</option>
                <option value={3}>Playoffs</option>
              </select>
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              Semana
              <input type="number" min={1} value={week} onChange={(e) => setWeek(Number(e.target.value))}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]" />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              Fecha y hora
              <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]" />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              Visitante
              <select value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]">
                {NFL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">
              Local
              <select value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)}
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]">
                {NFL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
          <button type="submit" className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110">
            Agregar partido
          </button>
        </form>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Partidos capturados</h2>
          {games.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Ninguno todavia.</p>}
          {gamesByWeek.map((wk) => {
            const open = !!expandedWeeks[wk.key]
            return (
              <div key={wk.key} className="border border-[var(--color-field-line)] rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleWeek(wk.key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-[var(--color-field-surface)] hover:bg-[var(--color-field-surface-raised)] transition"
                >
                  <span className="flex items-center gap-2">
                    <span className={`text-[var(--color-text-muted)] text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                    <span className="font-mono-score text-xs text-[var(--color-light-amber)]">{weekLabel(wk.seasonType, wk.week)} · {wk.year}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">({wk.games.length} partido{wk.games.length !== 1 ? 's' : ''})</span>
                  </span>
                  <span
                    onClick={(e) => { e.stopPropagation(); deleteWeek(wk.seasonType, wk.week, wk.year) }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-scoreboard-red)] bg-[rgba(228,70,43,0.1)] border border-[var(--color-scoreboard-red)]/40 rounded-md px-2 py-1 hover:bg-[rgba(228,70,43,0.2)] transition"
                  >
                    <IconTrash size={11} /> Borrar semana
                  </span>
                </button>
                {open && (
                  <div className="p-3 space-y-2 bg-[var(--color-page-bg)]/60">
                    {wk.games.map((g) => (
                      <AdminGameRow key={g.id} game={g} onFinal={setFinalScore} onDelete={deleteGame} onEditPicks={setEditPicksGame} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {deletedGames.length > 0 && (
          <div className="border border-[var(--color-field-line)] rounded-lg overflow-hidden">
            <div className="px-3 py-2.5 bg-[var(--color-field-surface)]">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                🗑️ Papelera
                <span className="text-[10px] text-[var(--color-text-muted)] font-normal">
                  ({deletedGames.length} partido{deletedGames.length !== 1 ? 's' : ''} borrado{deletedGames.length !== 1 ? 's' : ''})
                </span>
              </h2>
            </div>
            <div className="p-3 space-y-2 bg-[var(--color-page-bg)]/60">
              {(() => {
                const map = new Map<string, { key: string; year: number; seasonType: number; week: number; games: Game[] }>()
                deletedGames.forEach((g) => {
                  const key = `${g.year}:${g.season_type}:${g.week}`
                  if (!map.has(key)) map.set(key, { key, year: g.year, seasonType: g.season_type, week: g.week, games: [] })
                  map.get(key)!.games.push(g)
                })
                return Array.from(map.values()).map((wk) => (
                  <div key={wk.key} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono-score text-xs text-[var(--color-text-muted)]">
                        {weekLabel(wk.seasonType, wk.week)} · {wk.year} ({wk.games.length})
                      </span>
                      <button
                        onClick={() => restoreWeek(wk.seasonType, wk.week, wk.year)}
                        className="text-xs font-semibold text-[var(--color-turf-green)] hover:underline"
                      >
                        Restaurar semana completa
                      </button>
                    </div>
                    <div className="space-y-1">
                      {wk.games.map((g) => (
                        <div key={g.id} className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-2 py-1">
                          <span>{g.away_team} @ {g.home_team}</span>
                          <button onClick={() => restoreGame(g.id)} className="text-[var(--color-turf-green)] hover:underline">
                            Restaurar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        icon={<IconTrash size={18} />}
        title="Zona de peligro"
        description="Acciones irreversibles para esta liga"
        open={true}
        onToggle={() => {}}
        danger
      >
        <button
          type="button"
          onClick={() => toggleSection('peligro')}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border border-[var(--color-scoreboard-red)]/40 bg-[rgba(228,70,43,0.06)] hover:bg-[rgba(228,70,43,0.12)] transition text-left"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Eliminar liga</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Esta accion no se puede deshacer</p>
          </div>
          <IconChevronRight size={16} className={`shrink-0 text-[var(--color-scoreboard-red)] transition-transform ${openSections.peligro ? 'rotate-90' : ''}`} />
        </button>
        {openSections.peligro && (
          <DangerZone group={group} onGroupUpdated={onGroupUpdated} onLeftAdmin={onLeftAdmin} onDeleted={onBack} />
        )}
      </SettingsCard>
    </div>

    {editPicksGame && (
      <EditGamePicksModal
        game={editPicksGame}
        groupId={groupId}
        onClose={() => setEditPicksGame(null)}
      />
    )}
    </>
  )
}

function AdminGameRow({ game, onFinal, onDelete, onEditPicks }: { game: Game; onFinal: (g: Game, h: number, a: number) => void; onDelete: (id: string) => void; onEditPicks: (g: Game) => void }) {
  const [home, setHome] = useState(game.home_score?.toString() ?? '')
  const [away, setAway] = useState(game.away_score?.toString() ?? '')

  return (
    <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-sm flex items-center gap-2">
        <span className="font-mono-score text-xs text-[var(--color-text-muted)] mr-1">{weekLabel(game.season_type, game.week)}</span>
        <img src={teamLogoUrl(game.away_team)} alt={game.away_team} className="w-5 h-5 object-contain" loading="lazy" />
        {game.away_team} @ {game.home_team}
        <img src={teamLogoUrl(game.home_team)} alt={game.home_team} className="w-5 h-5 object-contain" loading="lazy" />
        {game.status === 'final' && <span className="ml-2 text-[var(--color-turf-green)] text-xs font-semibold">FINAL</span>}
        {game.status === 'live' && <span className="ml-2 text-[var(--color-scoreboard-red)] text-xs font-semibold">EN VIVO</span>}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={away} onChange={(e) => setAway(e.target.value)}
          className="w-12 text-center font-mono-score text-sm bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md py-1 outline-none focus:border-[var(--color-light-amber)]" />
        <span className="text-[var(--color-text-muted)]">–</span>
        <input type="number" inputMode="numeric" pattern="[0-9]*" min={0} value={home} onChange={(e) => setHome(e.target.value)}
          className="w-12 text-center font-mono-score text-sm bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md py-1 outline-none focus:border-[var(--color-light-amber)]" />
        <button
          onClick={() => home !== '' && away !== '' && onFinal(game, Number(home), Number(away))}
          className="text-xs font-semibold bg-[var(--color-turf-green)] text-white rounded-md px-3 py-1.5 hover:brightness-110"
        >
          Finalizar
        </button>
        {game.status === 'final' && (
          <button
            onClick={() => onEditPicks(game)}
            title="Corregir la prediccion de un jugador"
            className="flex items-center gap-1 text-xs font-semibold text-[var(--color-light-amber)] bg-[rgba(242,183,5,0.1)] border border-[var(--color-light-amber)]/40 rounded-md px-2.5 py-1.5 hover:bg-[rgba(242,183,5,0.2)] transition"
          >
            <IconPencil size={12} /> Predicciones
          </button>
        )}
        <button onClick={() => onDelete(game.id)} className="flex items-center gap-1 text-xs font-semibold text-[var(--color-scoreboard-red)] bg-[rgba(228,70,43,0.1)] border border-[var(--color-scoreboard-red)]/40 rounded-md px-2.5 py-1.5 hover:bg-[rgba(228,70,43,0.2)] transition">
          <IconTrash size={12} /> Borrar
        </button>
      </div>
    </div>
  )
}

function EditGamePicksModal({ game, groupId, onClose }: { game: Game; groupId: string; onClose: () => void }) {
  const [rows, setRows] = useState<{ user_id: string; display_name: string; home: string; away: string; points: number | null; corrected: boolean }[] | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: loadErr } = await supabase
        .from('picks')
        .select('user_id, pred_home_score, pred_away_score, points, admin_corrected_at, profiles(display_name)')
        .eq('game_id', game.id)
      if (cancelled) return
      if (loadErr) { setErr(loadErr.message); setRows([]); return }
      const list = (data ?? [])
        .map((p: any) => ({
          user_id: p.user_id,
          display_name: p.profiles?.display_name ?? 'Jugador',
          home: p.pred_home_score?.toString() ?? '',
          away: p.pred_away_score?.toString() ?? '',
          points: p.points,
          corrected: !!p.admin_corrected_at,
        }))
        .sort((a, b) => a.display_name.localeCompare(b.display_name))
      setRows(list)
    }
    load()
    return () => { cancelled = true }
  }, [game.id])

  async function saveRow(userId: string, home: string, away: string) {
    if (home === '' || away === '') return
    setSavingId(userId)
    setErr(null)
    const { error: saveErr } = await supabase.rpc('admin_set_pick', {
      p_group_id: groupId,
      p_game_id: game.id,
      p_user_id: userId,
      p_home_score: Number(home),
      p_away_score: Number(away),
    })
    setSavingId(null)
    if (saveErr) { setErr(saveErr.message); return }
    // vuelve a traer los puntos ya recalculados para ese jugador
    const { data } = await supabase.from('picks').select('points').eq('game_id', game.id).eq('user_id', userId).maybeSingle()
    setRows((prev) => (prev ?? []).map((r) => (r.user_id === userId ? { ...r, home, away, points: data?.points ?? r.points, corrected: true } : r)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-3 pb-3 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Corregir predicciones</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              {game.away_team} @ {game.home_team} · resultado real {game.away_score}-{game.home_score}
            </p>
          </div>
          <button onClick={onClose} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)]">Cerrar</button>
        </div>

        <p className="text-[10px] text-[var(--color-text-muted)]">
          Cambia el marcador que predijo un jugador y sus puntos de este partido se recalculan solos al guardar. Solo se puede corregir <strong>una vez</strong> por jugador.
        </p>

        {err && <p className="text-[var(--color-scoreboard-red)] text-xs">{err}</p>}

        {rows === null ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">Cargando...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4">Nadie predijo este partido.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between gap-2 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2">
                <span className="text-sm truncate">{r.display_name}</span>
                {r.corrected ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-score text-xs text-[var(--color-text-muted)]">{r.away}–{r.home}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">Ya se corrigio</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] w-8 text-right shrink-0">{r.points ?? '–'}pt</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*" min={0}
                      value={r.away}
                      onChange={(e) => setRows((prev) => (prev ?? []).map((row) => (row.user_id === r.user_id ? { ...row, away: e.target.value } : row)))}
                      className="w-10 text-center font-mono-score text-xs bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-md py-1 outline-none focus:border-[var(--color-light-amber)]"
                    />
                    <span className="text-[var(--color-text-muted)] text-xs">–</span>
                    <input
                      type="number" inputMode="numeric" pattern="[0-9]*" min={0}
                      value={r.home}
                      onChange={(e) => setRows((prev) => (prev ?? []).map((row) => (row.user_id === r.user_id ? { ...row, home: e.target.value } : row)))}
                      className="w-10 text-center font-mono-score text-xs bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-md py-1 outline-none focus:border-[var(--color-light-amber)]"
                    />
                    <button
                      onClick={() => saveRow(r.user_id, r.home, r.away)}
                      disabled={savingId === r.user_id}
                      className="text-[10px] font-semibold bg-[var(--color-light-amber)] text-[var(--color-field-night)] rounded-md px-2 py-1.5 hover:brightness-110 disabled:opacity-50"
                    >
                      {savingId === r.user_id ? '...' : 'Guardar'}
                    </button>
                    <span className="text-[10px] text-[var(--color-text-muted)] w-8 text-right shrink-0">{r.points ?? '–'}pt</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
