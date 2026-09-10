import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NFL_TEAMS, weekLabel, type Game, type Group } from '../lib/types'
import { fetchEspnWeek, guessCurrentWeek, type SeasonType } from '../lib/espn'
import { teamLogoUrl } from '../lib/teamLogos'
import MembersManager from '../components/MembersManager'
import AdminSpecialPicks from '../components/AdminSpecialPicks'
import DangerZone from '../components/DangerZone'
import { IconTrash, IconChevronRight, IconCheck } from '../components/icons'

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-1"
    >
      <IconChevronRight size={14} className={`text-[var(--color-light-amber)] shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--color-light-amber)] shrink-0">{title}</h1>
      <div className="flex-1 h-px bg-[var(--color-field-line)]" />
    </button>
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
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [paymentMembers, setPaymentMembers] = useState<{ user_id: string; display_name: string; paid: boolean }[]>([])
  const [payingId, setPayingId] = useState<string | null>(null)

  async function loadPaymentMembers() {
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
    loadPaymentMembers()
  }, [groupId])

  async function toggleMemberPaid(userId: string, current: boolean) {
    setPayingId(userId)
    const { error: err } = await supabase.rpc('set_member_paid', { p_group_id: groupId, p_user_id: userId, p_paid: !current })
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
  const [savingRules, setSavingRules] = useState(false)
  const [rulesMsg, setRulesMsg] = useState<string | null>(null)
  const [rulesErr, setRulesErr] = useState<string | null>(null)

  const [savingMode, setSavingMode] = useState(false)
  const [modeErr, setModeErr] = useState<string | null>(null)

  async function changeScoringMode(mode: 'season' | 'weekly') {
    if (mode === group.scoring_mode || savingMode) return
    setSavingMode(true)
    setModeErr(null)
    const { data, error: err } = await supabase.rpc('set_scoring_mode', {
      p_group_id: groupId,
      p_scoring_mode: mode,
    })
    setSavingMode(false)
    if (err) { setModeErr(err.message); return }
    onGroupUpdated(data)
  }

  async function saveScoringRules(e: React.FormEvent) {
    e.preventDefault()
    setSavingRules(true)
    setRulesMsg(null)
    setRulesErr(null)
    const { data, error: err } = await supabase.rpc('update_scoring_rules', {
      p_group_id: groupId,
      p_points_winner: pointsWinner,
      p_points_exact: pointsExact,
    })
    setSavingRules(false)
    if (err) { setRulesErr(err.message); return }
    onGroupUpdated(data)
    setRulesMsg('Guardado — se recalcularon los partidos ya finalizados.')
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ liga: true })

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
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeader title="Liga" open={!!openSections.liga} onToggle={() => toggleSection('liga')} />
        {openSections.liga && (
        <form onSubmit={saveGroupInfo} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Nombre y foto de la liga</h2>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center">
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
              className="flex-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
          </div>
          {groupErr && <p className="text-[var(--color-scoreboard-red)] text-xs">{groupErr}</p>}
          {groupMsg && <p className="text-[var(--color-turf-green)] text-xs">{groupMsg}</p>}
          <button type="submit" disabled={savingGroup}
            className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50">
            {savingGroup ? 'Guardando...' : 'Guardar cambios de la liga'}
          </button>
        </form>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Puntuación" open={!!openSections.puntuacion} onToggle={() => toggleSection('puntuacion')} />
        {openSections.puntuacion && (
        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-5">
          <form onSubmit={saveScoringRules} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Criterios de puntos</h2>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                Al guardar, se recalculan automaticamente los puntos de todos los partidos ya finalizados con las nuevas reglas.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-[var(--color-text-muted)]">
                Acertar al equipo ganador
                <input
                  type="number"
                  min={0}
                  value={pointsWinner}
                  onChange={(e) => setPointsWinner(Number(e.target.value))}
                  className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                />
              </label>
              <label className="text-xs text-[var(--color-text-muted)]">
                Acertar el marcador exacto
                <input
                  type="number"
                  min={0}
                  value={pointsExact}
                  onChange={(e) => setPointsExact(Number(e.target.value))}
                  className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
                />
              </label>
            </div>
            {rulesErr && <p className="text-[var(--color-scoreboard-red)] text-xs">{rulesErr}</p>}
            {rulesMsg && <p className="text-[var(--color-turf-green)] text-xs">{rulesMsg}</p>}
            <button type="submit" disabled={savingRules}
              className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50">
              {savingRules ? 'Guardando...' : 'Guardar criterios'}
            </button>
          </form>

          <div className="h-px bg-[var(--color-field-line)]" />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Modo de puntuacion</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => changeScoringMode('season')}
                disabled={savingMode}
                className={`text-left rounded-md border px-3 py-2.5 transition disabled:opacity-50 ${
                  group.scoring_mode === 'season'
                    ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.08)]'
                    : 'border-[var(--color-field-line)] hover:border-[var(--color-light-amber)]'
                }`}
              >
                <p className="text-xs font-semibold">Temporada completa</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Los puntos se acumulan durante toda la temporada</p>
              </button>
              <button
                type="button"
                onClick={() => changeScoringMode('weekly')}
                disabled={savingMode}
                className={`text-left rounded-md border px-3 py-2.5 transition disabled:opacity-50 ${
                  group.scoring_mode === 'weekly'
                    ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.08)]'
                    : 'border-[var(--color-field-line)] hover:border-[var(--color-light-amber)]'
                }`}
              >
                <p className="text-xs font-semibold">Semana a semana</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">La tabla se reinicia en 0 cada semana; hay un ganador por semana</p>
              </button>
            </div>
            {modeErr && <p className="text-[var(--color-scoreboard-red)] text-xs">{modeErr}</p>}
            <p className="text-[10px] text-[var(--color-text-muted)]">Cambiar esto afecta como todos los miembros ven la tabla desde ahora.</p>
          </div>

          <div className="h-px bg-[var(--color-field-line)]" />

          <AdminSpecialPicks group={group} onGroupUpdated={onGroupUpdated} />
        </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Premio" open={!!openSections.premio} onToggle={() => toggleSection('premio')} />
        {openSections.premio && (
        <form onSubmit={savePrizeSettings} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-4">
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
        )}

        {openSections.premio && betAmount > 0 && paymentMembers.length > 0 && (
        <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Quien ya pago</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              Solo tu (el admin) puedes ver y marcar esto. {paymentMembers.filter((m) => m.paid).length}/{paymentMembers.length} pagaron.
            </p>
          </div>
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
        </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Miembros" open={!!openSections.miembros} onToggle={() => toggleSection('miembros')} />
        {openSections.miembros && <MembersManager group={group} />}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Partidos" open={!!openSections.partidos} onToggle={() => toggleSection('partidos')} />
        {openSections.partidos && (
        <>
        <form onSubmit={syncWeekFromEspn} className="bg-[var(--color-field-surface)] border border-[var(--color-light-amber)]/40 rounded-lg p-4 space-y-3">
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
                className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]">
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
                      <AdminGameRow key={g.id} game={g} onFinal={setFinalScore} onDelete={deleteGame} />
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
        </>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Peligro" open={!!openSections.peligro} onToggle={() => toggleSection('peligro')} />
        {openSections.peligro && (
          <DangerZone group={group} onGroupUpdated={onGroupUpdated} onLeftAdmin={onLeftAdmin} onDeleted={onBack} />
        )}
      </section>
    </div>
  )
}

function AdminGameRow({ game, onFinal, onDelete }: { game: Game; onFinal: (g: Game, h: number, a: number) => void; onDelete: (id: string) => void }) {
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
        <button onClick={() => onDelete(game.id)} className="flex items-center gap-1 text-xs font-semibold text-[var(--color-scoreboard-red)] bg-[rgba(228,70,43,0.1)] border border-[var(--color-scoreboard-red)]/40 rounded-md px-2.5 py-1.5 hover:bg-[rgba(228,70,43,0.2)] transition">
          <IconTrash size={12} /> Borrar
        </button>
      </div>
    </div>
  )
}
