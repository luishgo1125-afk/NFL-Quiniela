// Cliente para la API publica (no oficial) de ESPN.
// No requiere API key. Puede cambiar sin previo aviso por parte de ESPN,
// pero es ampliamente usada para obtener el calendario y marcadores de la NFL gratis.

export interface EspnGame {
  espnId: string
  week: number
  homeTeam: string
  awayTeam: string
  kickoff: string // ISO datetime
  homeScore: number | null
  awayScore: number | null
  completed: boolean
  live: boolean
  clock: string | null
}

// 1 = pretemporada, 2 = temporada regular, 3 = playoffs
export type SeasonType = 1 | 2 | 3

export async function fetchEspnWeek(year: number, week: number, seasonType: SeasonType = 2): Promise<EspnGame[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=${seasonType}&week=${week}&year=${year}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('No se pudo consultar el calendario de la NFL en este momento.')
  }
  const data = await res.json()
  const events = data.events ?? []

  return events.map((ev: any) => {
    const comp = ev.competitions?.[0]
    const competitors = comp?.competitors ?? []
    const home = competitors.find((c: any) => c.homeAway === 'home')
    const away = competitors.find((c: any) => c.homeAway === 'away')
    const state = comp?.status?.type?.state // 'pre' | 'in' | 'post'
    const completed = Boolean(comp?.status?.type?.completed)
    const live = state === 'in'
    // ESPN da marcador en vivo aunque el partido no haya terminado
    const hasScore = state === 'in' || completed

    return {
      espnId: String(ev.id),
      week,
      homeTeam: home?.team?.abbreviation ?? '???',
      awayTeam: away?.team?.abbreviation ?? '???',
      kickoff: ev.date,
      homeScore: hasScore ? Number(home?.score ?? 0) : null,
      awayScore: hasScore ? Number(away?.score ?? 0) : null,
      completed,
      live,
      clock: live ? (comp?.status?.type?.shortDetail ?? null) : null,
    } satisfies EspnGame
  })
}

// Calcula la semana actual aproximada de temporada regular NFL a partir de la fecha
// (temporada regular normalmente empieza la primera semana de septiembre, 18 semanas).
// Es solo un punto de partida razonable para el selector; el usuario puede cambiarla.
export function guessCurrentWeek(date = new Date()): { year: number; week: number } {
  // aproximacion simple: si estamos entre septiembre y febrero, calculamos semanas desde el primer jueves de septiembre
  const seasonYear = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1
  const approxStart = new Date(seasonYear, 8, 4) // 4 de septiembre aprox
  const diffWeeks = Math.floor((date.getTime() - approxStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  const week = Math.min(18, Math.max(1, diffWeeks))
  return { year: seasonYear, week }
}
