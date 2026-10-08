import { supabase } from './supabase'

export type RankMode = 'score' | 'winner'
export interface GlobalRankRow {
  user_id: string
  display_name: string
  favorite_team: string | null
  total_points: number
  total_hits: number
  total_played: number
  exact_hits: number
  hit_pct: number
  point_diff: number
}

export async function fetchGlobalRanking(mode: RankMode): Promise<GlobalRankRow[]> {
  const { data, error } = await supabase.rpc('global_rankings_mode', { p_mode: mode })
  if (error) { console.error('global_rankings_mode', error); return [] }
  return (data ?? []) as GlobalRankRow[]
}

// El ranking donde aparece el usuario (marcador exacto primero; si no juega ahi, el de solo ganador)
export async function fetchMyGlobalRank(userId: string): Promise<{ mode: RankMode; list: GlobalRankRow[]; index: number } | null> {
  for (const mode of ['score', 'winner'] as RankMode[]) {
    const list = await fetchGlobalRanking(mode)
    const index = list.findIndex((r) => r.user_id === userId)
    if (index >= 0) return { mode, list, index }
  }
  return null
}
