import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { NFL_TEAMS, type Game } from '../lib/types'
import { fetchEspnWeek, guessCurrentWeek, type SeasonType } from '../lib/espn'

export default function Admin({ groupId, games, onChange }: { groupId: string; games: Game[]; onChange: () => void }) {
  const [week, setWeek] = useState(1)
  const [homeTeam, setHomeTeam] = useState(NFL_TEAMS[0])
  const [awayTeam, setAwayTeam] = useState(NFL_TEAMS[1])
  const [kickoff, setKickoff] = useState('')
  const [error, setError] = useState<string | null>(null)

  const guess = guessCurrentWeek()
  const [syncYear, setSyncYear] = useState(guess.year)
  const [syncWeek, setSyncWeek] = useState(guess.week)
  const [syncType, setSyncType] = useState<SeasonType>(2)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  async function syncWeekFromEspn(e: React.FormEvent) {
    e.preventDefault()
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

      for (const eg of espnGames) {
        const existing = games.find(
          (g) => g.week === syncWeek && g.home_team === eg.homeTeam && g.away_team === eg.awayTeam
        )

        if (!existing) {
          const { data: inserted } = await supabase
            .from('games')
            .insert({
              group_id: groupId,
              week: syncWeek,
              home_team: eg.homeTeam,
              away_team: eg.awayTeam,
              kickoff: eg.kickoff,
              status: eg.completed ? 'final' : 'scheduled',
              home_score: eg.homeScore,
              away_score: eg.awayScore,
            })
            .select()
            .single()
          created++
          if (eg.completed && inserted) {
            await supabase.rpc('calculate_points_for_game', { p_game_id: inserted.id })
          }
        } else if (eg.completed && existing.status !== 'final') {
          await supabase
            .from('games')
            .update({ status: 'final', home_score: eg.homeScore, away_score: eg.awayScore })
            .eq('id', existing.id)
          await supabase.rpc('calculate_points_for_game', { p_game_id: existing.id })
          updated++
        } else if (!eg.completed && existing.kickoff !== eg.kickoff) {
          // el horario pudo cambiar (ej. flex schedule)
          await supabase.from('games').update({ kickoff: eg.kickoff }).eq('id', existing.id)
          updated++
        }
      }

      setSyncMsg(`Listo: ${created} partido(s) agregado(s), ${updated} actualizado(s).`)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo sincronizar con ESPN')
    } finally {
      setSyncing(false)
    }
  }

  async function addGame(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!kickoff) { setError('Falta la fecha/hora del partido'); return }
    const { error: err } = await supabase.from('games').insert({
      group_id: groupId,
      week,
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
    await supabase.from('games').delete().eq('id', id)
    onChange()
  }

  return (
    <div className="space-y-6">
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
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Puedes correr esto varias veces: agrega partidos nuevos y actualiza marcadores finales sin duplicar nada.
          Usa una API publica no oficial de ESPN, asi que ocasionalmente puede fallar.
        </p>
      </form>

      <form onSubmit={addGame} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">O agregar un partido manualmente</h2>
        <div className="grid grid-cols-2 gap-3">
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

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Partidos capturados</h2>
        {games.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Ninguno todavia.</p>}
        {games.map((g) => (
          <AdminGameRow key={g.id} game={g} onFinal={setFinalScore} onDelete={deleteGame} />
        ))}
      </div>
    </div>
  )
}

function AdminGameRow({ game, onFinal, onDelete }: { game: Game; onFinal: (g: Game, h: number, a: number) => void; onDelete: (id: string) => void }) {
  const [home, setHome] = useState(game.home_score?.toString() ?? '')
  const [away, setAway] = useState(game.away_score?.toString() ?? '')

  return (
    <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="text-sm">
        <span className="font-mono-score text-xs text-[var(--color-text-muted)] mr-2">SEM {game.week}</span>
        {game.away_team} @ {game.home_team}
        {game.status === 'final' && <span className="ml-2 text-[var(--color-turf-green)] text-xs font-semibold">FINAL</span>}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={0} value={away} onChange={(e) => setAway(e.target.value)}
          className="w-12 text-center font-mono-score text-sm bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md py-1 outline-none focus:border-[var(--color-light-amber)]" />
        <span className="text-[var(--color-text-muted)]">–</span>
        <input type="number" min={0} value={home} onChange={(e) => setHome(e.target.value)}
          className="w-12 text-center font-mono-score text-sm bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md py-1 outline-none focus:border-[var(--color-light-amber)]" />
        <button
          onClick={() => home !== '' && away !== '' && onFinal(game, Number(home), Number(away))}
          className="text-xs font-semibold bg-[var(--color-turf-green)] text-white rounded-md px-3 py-1.5 hover:brightness-110"
        >
          Finalizar
        </button>
        <button onClick={() => onDelete(game.id)} className="text-xs text-[var(--color-scoreboard-red)] hover:underline">
          Borrar
        </button>
      </div>
    </div>
  )
}
