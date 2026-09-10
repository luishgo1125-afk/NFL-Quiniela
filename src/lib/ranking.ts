import { supabase } from './supabase'
import type { Group } from './types'

export interface RankableGame {
  id: string
  kickoff: string
  status: string
  year: number
  season_type: number
  week: number
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
}

export interface RankablePick {
  user_id: string
  game_id: string
  points: number | null
  pred_home_score: number
  pred_away_score: number
}

interface WeekEntry {
  year: number
  seasonType: number
  week: number
}

// Trae los partidos "que cuentan" para el ranking de esta liga: si esta en
// modo semanal, solo los de la semana indicada (o la actual si no se indica);
// si esta en modo temporada completa, todos los finalizados EXCEPTO
// pretemporada. Cualquier pantalla que calcule una posicion debe pasar por
// aqui -- es la misma logica que usa la Tabla, para que nunca se desincronicen.
export async function getRankedFinalGames(
  group: Group,
  weekKey?: string | null
): Promise<{ finalGames: RankableGame[]; allGames: RankableGame[]; currentWeekKey: string | null; activeWeekEntry: WeekEntry | null }> {
  const { data: allGamesData } = await supabase
    .from('games')
    .select('id, kickoff, status, year, season_type, week, home_team, away_team, home_score, away_score')
    .eq('group_id', group.id)
    .is('deleted_at', null)

  const allGames = (allGamesData ?? []) as RankableGame[]

  const nonFinal = allGames
    .filter((g) => g.status !== 'final')
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
  const currentRef = nonFinal[0] ?? allGames[0] ?? null
  const currentWeekKey = currentRef ? `${currentRef.year}:${currentRef.season_type}:${currentRef.week}` : null
  const effectiveWeekKey = group.scoring_mode === 'weekly' ? (weekKey ?? currentWeekKey) : null

  let activeWeekEntry: WeekEntry | null = null
  if (effectiveWeekKey) {
    const [y, st, w] = effectiveWeekKey.split(':').map(Number)
    activeWeekEntry = { year: y, seasonType: st, week: w }
  }

  const finalGames = allGames.filter(
    (g) =>
      g.status === 'final' &&
      (group.scoring_mode === 'weekly'
        ? activeWeekEntry && g.season_type === activeWeekEntry.seasonType && g.week === activeWeekEntry.week && g.year === activeWeekEntry.year
        : g.season_type !== 1) // en modo "temporada completa" la pretemporada no cuenta
  )

  return { finalGames, allGames, currentWeekKey, activeWeekEntry }
}

const MISSED_GAME_PENALTY = 20 // cada partido finalizado que no predijo suma esto a su diferencia, para el desempate

export interface Standing {
  user_id: string
  points: number
  hits: number
  exactHits: number
  pointDiff: number
  played: number
}

// Calcula puntos/exactos/diferencia para cada usuario dado un set de partidos
// finalizados y sus picks, y los ordena con el desempate oficial:
// 1) puntos, 2) marcadores exactos, 3) menor diferencia de puntos -- por
// cada partido finalizado que un jugador NO predijo, se le suman 20 a su
// diferencia (penalizacion por no participar), en vez de compararlo solo
// contra los partidos que si jugo.
export function buildStandings(userIds: string[], finalGames: RankableGame[], picks: RankablePick[], pointsExact: number): Standing[] {
  const gameById: Record<string, RankableGame> = {}
  finalGames.forEach((g) => { gameById[g.id] = g })

  const byUser: Record<string, RankablePick[]> = {}
  picks.forEach((p) => {
    byUser[p.user_id] = byUser[p.user_id] ?? []
    byUser[p.user_id].push(p)
  })

  const result: Standing[] = userIds.map((uid) => {
    const userPicks = byUser[uid] ?? []
    const pickedGameIds = new Set(userPicks.map((p) => p.game_id))
    let points = 0, hits = 0, exactHits = 0, pointDiff = 0
    userPicks.forEach((p) => {
      points += p.points ?? 0
      if ((p.points ?? 0) > 0) hits++
      if (p.points === pointsExact) exactHits++
      const g = gameById[p.game_id]
      if (g) pointDiff += Math.abs((g.home_score ?? 0) - p.pred_home_score) + Math.abs((g.away_score ?? 0) - p.pred_away_score)
    })
    const missedGames = finalGames.filter((g) => !pickedGameIds.has(g.id)).length
    pointDiff += missedGames * MISSED_GAME_PENALTY

    return { user_id: uid, points, hits, exactHits, pointDiff, played: userPicks.length }
  })

  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits
    return a.pointDiff - b.pointDiff
  })

  return result
}

// Conveniencia: trae y calcula el ranking completo de una liga de un jalon
// (usado por pantallas que solo necesitan la posicion, no todo el detalle
// que si renderiza la Tabla).
export async function getGroupStandings(group: Group, userIds: string[], weekKey?: string | null): Promise<Standing[]> {
  const { finalGames } = await getRankedFinalGames(group, weekKey)
  const finalGameIds = finalGames.map((g) => g.id)
  let picks: RankablePick[] = []
  if (finalGameIds.length > 0) {
    const { data } = await supabase
      .from('picks')
      .select('user_id, game_id, points, pred_home_score, pred_away_score')
      .in('game_id', finalGameIds)
    picks = (data ?? []) as RankablePick[]
  }
  return buildStandings(userIds, finalGames, picks, group.points_exact)
}
