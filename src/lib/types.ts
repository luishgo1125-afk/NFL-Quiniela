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
  special_picks_enabled: boolean
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
  season_type: 1 | 2 | 3
  year: number
  home_team: string
  away_team: string
  kickoff: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'live' | 'final'
  game_clock: string | null
  deleted_at: string | null
}

// 1 = pretemporada, 2 = temporada regular, 3 = playoffs
export function weekLabel(seasonType: number, week: number): string {
  if (seasonType === 1) return `PRE WEEK ${week}`
  if (seasonType === 3) {
    const rounds: Record<number, string> = { 1: 'WILD CARD', 2: 'DIVISIONAL', 3: 'CONFERENCE', 4: 'SUPER BOWL' }
    return rounds[week] ?? `PLAYOFFS ${week}`
  }
  return `WEEK ${week}`
}

export const TEAM_NAMES: Record<string, string> = {
  ARI: 'Cardinals', ATL: 'Falcons', BAL: 'Ravens', BUF: 'Bills', CAR: 'Panthers',
  CHI: 'Bears', CIN: 'Bengals', CLE: 'Browns', DAL: 'Cowboys', DEN: 'Broncos',
  DET: 'Lions', GB: 'Packers', HOU: 'Texans', IND: 'Colts', JAX: 'Jaguars',
  KC: 'Chiefs', LV: 'Raiders', LAC: 'Chargers', LAR: 'Rams', MIA: 'Dolphins',
  MIN: 'Vikings', NE: 'Patriots', NO: 'Saints', NYG: 'Giants', NYJ: 'Jets',
  PHI: 'Eagles', PIT: 'Steelers', SF: '49ers', SEA: 'Seahawks', TB: 'Buccaneers',
  TEN: 'Titans', WSH: 'Commanders',
}

export interface Pick {
  id: string
  game_id: string
  user_id: string
  pred_home_score: number
  pred_away_score: number
  points: number | null
}

export interface SpecialCategory {
  id: string
  group_id: string
  title: string
  options: string[]
  points: number
  locked: boolean
  correct_answer: string | null
}

export interface SpecialPick {
  id: string
  category_id: string
  user_id: string
  answer: string
  points: number | null
}

export const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB',
  'TEN', 'WSH'
]
