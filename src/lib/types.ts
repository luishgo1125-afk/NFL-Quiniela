export interface Profile {
  id: string
  display_name: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
  logo_url: string | null
  points_winner: number
  points_exact: number
}

export interface GroupMember {
  group_id: string
  user_id: string
  joined_at: string
}

export interface Game {
  id: string
  group_id: string
  week: number
  home_team: string
  away_team: string
  kickoff: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'final'
  game_clock: string | null
}

export interface Pick {
  id: string
  game_id: string
  user_id: string
  pred_home_score: number
  pred_away_score: number
  points: number | null
}

export const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB',
  'TEN', 'WSH'
]
