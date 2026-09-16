import { supabase } from './supabase'
import { fetchEspnWeek } from './espn'
import type { Game } from './types'

export interface SyncResult {
  created: number
  updated: number
  failed: number
}

// Misma logica que ya usaba el formulario manual de Admin ("Sincronizar con
// la NFL"), pero como funcion reusable: cualquier pantalla que ya sepa
// year/season_type/week puede llamarla directo, sin pasar por el formulario.
export async function syncGroupWeekFromEspn(
  groupId: string,
  games: Game[],
  year: number,
  seasonType: 1 | 2 | 3,
  week: number
): Promise<SyncResult> {
  const espnGames = await fetchEspnWeek(year, week, seasonType)
  let created = 0
  let updated = 0
  let failed = 0

  for (const eg of espnGames) {
    const existing = games.find(
      (g) => g.week === week && g.season_type === seasonType && g.year === year && g.home_team === eg.homeTeam && g.away_team === eg.awayTeam
    )
    const newStatus: 'scheduled' | 'live' | 'final' = eg.completed ? 'final' : eg.live ? 'live' : 'scheduled'

    if (!existing) {
      const { data: inserted, error: insertErr } = await supabase
        .from('games')
        .insert({
          group_id: groupId,
          week,
          season_type: seasonType,
          year,
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

  return { created, updated, failed }
}
