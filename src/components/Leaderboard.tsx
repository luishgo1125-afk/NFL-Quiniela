import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconGlobe, IconMedal, IconClipboardX } from './icons'
import { weekLabel, type Group } from '../lib/types'

interface RecentPick {
  gameLabel: string
  resultLabel: string
  predLabel: string
  points: number
  diff: number
  weekLabelText: string
}

interface Row {
  user_id: string
  display_name: string
  favorite_team: string | null
  points: number
  hits: number
  played: number
  exactHits: number
  pointDiff: number
  streak: number
  bestStreak: number
  recentPicks: RecentPick[]
  globalRank: number | null
}

const RANK_STYLES = [
  { bg: 'rgba(242,183,5,0.12)', border: 'var(--color-light-amber)', badge: '#F2B705', text: '#0A0E13' },
  { bg: 'rgba(200,200,210,0.08)', border: '#9AA3AF', badge: '#C7CCD3', text: '#0A0E13' },
  { bg: 'rgba(180,120,60,0.10)', border: '#B47A3C', badge: '#C98A4B', text: '#0A0E13' },
]

// Carga una imagen permitiendo exportarla despues en el canvas (CORS).
// Si falla (por ejemplo el CDN no lo permite), regresa null y el dibujo
// cae de vuelta a un circulo con inicial en vez de tronar todo el share.
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function drawCircleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, r: number, pad = 0) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = '#1B2530'
  ctx.fill()
  const size = (r - pad) * 2
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  ctx.restore()
}

async function shareLeaderboardImage(group: Group, weekLabelText: string | null, rows: Row[]) {
  const rowHeight = 64
  const headerHeight = 132
  const footerHeight = 56
  const width = 720
  const height = headerHeight + rows.length * rowHeight + footerHeight

  const uniqueTeams = Array.from(new Set(rows.map((r) => r.favorite_team).filter(Boolean))) as string[]
  const [groupLogoImg, appLogoImg, teamLogoImgs] = await Promise.all([
    group.logo_url ? loadImage(group.logo_url) : Promise.resolve(null),
    loadImage('/logo.png'),
    Promise.all(uniqueTeams.map(async (t) => [t, await loadImage(teamLogoUrl(t))] as const)),
  ])
  const teamLogoMap = new Map(teamLogoImgs)

  const canvas = document.createElement('canvas')
  const SCALE = 3
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(SCALE, SCALE)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.fillStyle = '#0A0E13'
  ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, width * 0.7)
  glow.addColorStop(0, 'rgba(242,183,5,0.10)')
  glow.addColorStop(1, 'rgba(242,183,5,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, headerHeight + 40)

  const logoCx = 56, logoCy = 60, logoR = 30
  if (groupLogoImg) {
    drawCircleImage(ctx, groupLogoImg, logoCx, logoCy, logoR)
  } else {
    ctx.beginPath()
    ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2)
    ctx.fillStyle = '#1B2530'
    ctx.fill()
    ctx.strokeStyle = '#2A3542'
    ctx.stroke()
    ctx.font = '28px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🏈', logoCx, logoCy + 10)
    ctx.textAlign = 'left'
  }

  ctx.fillStyle = '#ECEFF3'
  ctx.font = '700 28px Arial'
  ctx.fillText(group.name.toUpperCase(), 104, 52)
  ctx.fillStyle = '#8A94A3'
  ctx.font = '400 14px Arial'
  const subtitle = weekLabelText ? `Tabla de posiciones · ${weekLabelText}` : 'Tabla de posiciones'
  ctx.fillText(subtitle, 104, 76)

  ctx.strokeStyle = '#2A3542'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, headerHeight)
  ctx.lineTo(width, headerHeight)
  ctx.stroke()

  const rankColors = ['#F2B705', '#C7CCD3', '#C98A4B']

  rows.forEach((r, i) => {
    const y = headerHeight + i * rowHeight
    if (i < 3) {
      ctx.fillStyle = i === 0 ? 'rgba(242,183,5,0.08)' : i === 1 ? 'rgba(200,200,210,0.05)' : 'rgba(180,120,60,0.06)'
      ctx.fillRect(0, y, width, rowHeight)
    }

    ctx.fillStyle = i < 3 ? rankColors[i] : '#8A94A3'
    ctx.font = '700 20px Arial'
    ctx.fillText(String(i + 1), 28, y + rowHeight / 2 + 7)

    const cx = 76, cy = y + rowHeight / 2
    const teamImg = r.favorite_team ? teamLogoMap.get(r.favorite_team) : null
    if (teamImg) {
      ctx.beginPath()
      ctx.arc(cx, cy, 18, 0, Math.PI * 2)
      ctx.strokeStyle = '#2A3542'
      ctx.stroke()
      drawCircleImage(ctx, teamImg, cx, cy, 18, 4)
    } else {
      ctx.beginPath()
      ctx.arc(cx, cy, 18, 0, Math.PI * 2)
      ctx.fillStyle = '#1B2530'
      ctx.fill()
      ctx.strokeStyle = '#2A3542'
      ctx.stroke()
      ctx.fillStyle = '#ECEFF3'
      ctx.font = '700 16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(r.display_name.charAt(0).toUpperCase(), cx, cy + 6)
      ctx.textAlign = 'left'
    }

    ctx.fillStyle = '#ECEFF3'
    ctx.font = '600 18px Arial'
    ctx.fillText(r.display_name, 108, y + rowHeight / 2)
    ctx.fillStyle = '#8A94A3'
    ctx.font = '400 13px Arial'
    ctx.fillText(`${r.hits}/${r.played} aciertos`, 108, y + rowHeight / 2 + 20)

    ctx.fillStyle = '#ECEFF3'
    ctx.font = '700 26px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(String(r.points), width - 28, y + rowHeight / 2 + 5)
    ctx.font = '400 12px Arial'
    ctx.fillStyle = '#8A94A3'
    ctx.fillText('pts', width - 28, y + rowHeight / 2 + 22)
    ctx.textAlign = 'left'
  })

  if (appLogoImg) {
    const logoH = 22
    const logoW = (appLogoImg.width / appLogoImg.height) * logoH
    ctx.drawImage(appLogoImg, width / 2 - logoW / 2, height - footerHeight / 2 - logoH / 2, logoW, logoH)
  } else {
    ctx.fillStyle = '#8A94A3'
    ctx.font = '400 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🏈 Quiniela NFL', width / 2, height - 20)
    ctx.textAlign = 'left'
  }

  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], `tabla-${group.name.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Tabla de ${group.name}` })
        return
      } catch {
        // si cancela el share nativo, cae al fallback de descarga
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

interface GlobalSummary {
  points: number
  hits: number
  played: number
  exactHits: number
  streak: number
  bestStreak: number
  maxPossible: number
}

function PlayerStatsModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const [global, setGlobal] = useState<GlobalSummary | null>(null)
  const [loadingGlobal, setLoadingGlobal] = useState(true)

  useEffect(() => {
    async function loadGlobal() {
      setLoadingGlobal(true)
      const { data } = await supabase.rpc('global_user_picks_summary', { p_user_id: row.user_id })
      const picks = (data ?? []) as { points: number; kickoff: string; points_exact: number }[]

      let points = 0, hits = 0, exactHits = 0, maxPossible = 0
      picks.forEach((p) => {
        points += p.points ?? 0
        if ((p.points ?? 0) > 0) hits++
        if (p.points === p.points_exact) exactHits++
        maxPossible += p.points_exact ?? 0
      })
      let streak = 0
      for (const p of picks) {
        if ((p.points ?? 0) > 0) streak++
        else break
      }
      let bestStreak = 0, running = 0
      picks.forEach((p) => {
        if ((p.points ?? 0) > 0) { running++; bestStreak = Math.max(bestStreak, running) } else { running = 0 }
      })

      setGlobal({ points, hits, played: picks.length, exactHits, streak, bestStreak, maxPossible })
      setLoadingGlobal(false)
    }
    loadGlobal()
  }, [row.user_id])

  const winRate = global && global.played > 0 ? Math.round((global.hits / global.played) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-xl p-6 max-h-[85vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>

        <div className="flex flex-col items-center text-center mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center font-display text-xl font-700 shrink-0 overflow-hidden mb-3"
            style={{ background: 'var(--color-field-surface-raised)', border: '2px solid var(--color-field-line)' }}
          >
            {row.favorite_team ? (
              <img src={teamLogoUrl(row.favorite_team)} alt={row.favorite_team} className="w-full h-full object-contain p-2" />
            ) : (
              row.display_name.charAt(0).toUpperCase()
            )}
          </div>
          <h3 className="font-display text-2xl font-700 leading-tight">{row.display_name}</h3>
          {row.globalRank && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mt-2"
              style={{ background: 'rgba(242,183,5,0.15)', color: 'var(--color-light-amber)', border: '1px solid rgba(242,183,5,0.4)' }}
            >
              <IconMedal size={13} /> #{row.globalRank} en el ranking global
            </span>
          )}
        </div>

        <p className="text-xs text-[var(--color-text-muted)] text-center mb-4">Estadisticas de todas sus ligas juntas</p>

        {loadingGlobal || !global ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center mb-5">Cargando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[var(--color-field-surface-raised)] rounded-lg p-4 text-center flex flex-col justify-center items-center h-full">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] tracking-wide mb-1">PUNTOS TOTALES</div>
              <div className="font-mono-score text-3xl font-extrabold">{global.points}</div>
            </div>
            <div className="bg-[var(--color-field-surface-raised)] rounded-lg p-4 text-center flex flex-col justify-center items-center h-full">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] tracking-wide mb-1">ACIERTOS</div>
              <div className="font-mono-score text-3xl font-extrabold">{winRate}%</div>
              <div className="h-1 rounded-full bg-[var(--color-field-line)] mt-2 mb-1.5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${winRate}%`, background: '#3D8B5F' }} />
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{global.hits}/{global.played} pronosticos</div>
            </div>
            <div className="bg-[var(--color-field-surface-raised)] rounded-lg p-4 text-center flex flex-col justify-center items-center h-full">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] tracking-wide mb-1">MARCADORES EXACTOS</div>
              <div className="font-mono-score text-3xl font-extrabold">{global.exactHits}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">de {global.played} registrados</div>
            </div>
            <div className="bg-[var(--color-field-surface-raised)] rounded-lg p-4 text-center flex flex-col justify-center items-center h-full">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] tracking-wide mb-1">MEJOR RACHA</div>
              <div className="text-2xl font-700 flex items-center justify-center gap-1">🔥 <span className="font-extrabold">{global.bestStreak}</span></div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">(actual: {global.streak})</div>
            </div>
          </div>
        )}

        <h4 className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Ultimas predicciones en esta liga</h4>
        {row.recentPicks.length === 0 ? (
          <div className="flex flex-col items-center text-center py-6 text-[var(--color-text-muted)]">
            <IconClipboardX size={32} className="mb-2 opacity-50" />
            <p className="text-xs">Aun no hay predicciones recientes aqui.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {row.recentPicks.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-[var(--color-field-surface-raised)] rounded-md px-3 py-2">
                <div>
                  <div className="font-medium">{p.weekLabelText} · {p.gameLabel}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] font-mono-score">Final {p.resultLabel} · Predijo {p.predLabel} · Dif +{p.diff}</div>
                </div>
                <span
                  className="font-mono-score font-700 shrink-0 ml-2"
                  style={{ color: p.points > 0 ? '#3D8B5F' : 'var(--color-text-muted)' }}
                >
                  {p.points > 0 ? `+${p.points}` : '0'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Leaderboard({ group }: { group: Group }) {
  const [rows, setRows] = useState<Row[]>([])
  const [currentWeekLabel, setCurrentWeekLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Row | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: globalRanks } = await supabase.rpc('global_rankings')
      const rankByUser: Record<string, number> = {}
      ;(globalRanks ?? []).forEach((r: any, i: number) => { rankByUser[r.user_id] = i + 1 })

      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, profiles(display_name, favorite_team)')
        .eq('group_id', group.id)

      const { data: allGames } = await supabase
        .from('games')
        .select('id, kickoff, status, year, season_type, week, home_team, away_team, home_score, away_score')
        .eq('group_id', group.id)
        .is('deleted_at', null)
        .order('kickoff', { ascending: false })

      const gameList = allGames ?? []

      const nonFinal = gameList.filter((g) => g.status !== 'final').sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
      const currentRef = nonFinal[0] ?? gameList[0] ?? null
      setCurrentWeekLabel(currentRef ? weekLabel(currentRef.season_type, currentRef.week) : null)

      const finalGames = gameList.filter((g) => g.status === 'final')
      const finalGameIds = finalGames.map((g) => g.id)
      const gameById: Record<string, (typeof finalGames)[number]> = {}
      finalGames.forEach((g) => { gameById[g.id] = g })

      let picks: any[] = []
      if (finalGameIds.length) {
        const { data } = await supabase
          .from('picks')
          .select('user_id, game_id, points, pred_home_score, pred_away_score')
          .in('game_id', finalGameIds)
        picks = data ?? []
      }

      const byUser: Record<string, any[]> = {}
      picks.forEach((p) => {
        byUser[p.user_id] = byUser[p.user_id] ?? []
        byUser[p.user_id].push(p)
      })

      const result: Row[] = (members ?? []).map((m: any) => {
        const userPicks = (byUser[m.user_id] ?? []).slice().sort(
          (a, b) => new Date(gameById[b.game_id]?.kickoff ?? 0).getTime() - new Date(gameById[a.game_id]?.kickoff ?? 0).getTime()
        )
        let points = 0
        let hits = 0
        let exactHits = 0
        let pointDiff = 0
        userPicks.forEach((p) => {
          points += p.points ?? 0
          if ((p.points ?? 0) > 0) hits++
          if (p.points === group.points_exact) exactHits++
          const g = gameById[p.game_id]
          if (g) {
            pointDiff += Math.abs((g.home_score ?? 0) - (p.pred_home_score ?? 0)) + Math.abs((g.away_score ?? 0) - (p.pred_away_score ?? 0))
          }
        })

        let streak = 0
        for (const p of userPicks) {
          if ((p.points ?? 0) > 0) streak++
          else break
        }

        let bestStreak = 0
        let running = 0
        userPicks.forEach((p) => {
          if ((p.points ?? 0) > 0) { running++; bestStreak = Math.max(bestStreak, running) } else { running = 0 }
        })

        const recentPicks: RecentPick[] = userPicks.slice(0, 8).map((p) => {
          const g = gameById[p.game_id]
          const diff = g ? Math.abs((g.home_score ?? 0) - (p.pred_home_score ?? 0)) + Math.abs((g.away_score ?? 0) - (p.pred_away_score ?? 0)) : 0
          return {
            gameLabel: g ? `${g.away_team} @ ${g.home_team}` : 'Partido',
            resultLabel: g ? `${g.away_score}-${g.home_score}` : '',
            predLabel: `${p.pred_away_score}-${p.pred_home_score}`,
            points: p.points ?? 0,
            diff,
            weekLabelText: g ? weekLabel(g.season_type, g.week) : '',
          }
        })

        return {
          user_id: m.user_id,
          display_name: m.profiles?.display_name ?? 'Jugador',
          favorite_team: m.profiles?.favorite_team ?? null,
          points,
          hits,
          played: userPicks.length,
          exactHits,
          pointDiff,
          streak,
          bestStreak,
          recentPicks,
          globalRank: rankByUser[m.user_id] ?? null,
        }
      })
      // desempate: 1) puntos, 2) marcadores exactos, 3) menor diferencia de puntos —
      // pero quien no registro ninguna prediccion (played=0) nunca debe ganarle
      // el desempate a alguien que si jugo, aunque le haya ido mal (diff=0 por defecto
      // no es lo mismo que una diferencia real de 0)
      result.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits
        if (a.played === 0 && b.played === 0) return 0
        if (a.played === 0) return 1
        if (b.played === 0) return -1
        return a.pointDiff - b.pointDiff
      })
      setRows(result)
      setLoading(false)
    }
    load()
  }, [group.id, group.points_exact])

  if (loading) return <p className="text-[var(--color-text-muted)] text-sm">Cargando tabla...</p>
  if (rows.length === 0) return <p className="text-[var(--color-text-muted)] text-sm">Todavia no hay nadie en este grupo.</p>

  const maxExact = Math.max(0, ...rows.map((r) => r.exactHits))

  async function handleShare() {
    setSharing(true)
    try {
      await shareLeaderboardImage(group, currentWeekLabel, rows)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end mb-1">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="text-xs font-semibold text-[var(--color-light-amber)] hover:underline shrink-0 flex items-center gap-1 disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {sharing ? 'Generando...' : 'Compartir'}
        </button>
      </div>
      {rows.map((r, i) => {
        const style = RANK_STYLES[i]
        return (
          <button
            key={r.user_id}
            onClick={() => setSelectedPlayer(r)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left hover:brightness-110 transition"
            style={{
              background: style?.bg ?? 'var(--color-field-surface)',
              borderColor: style?.border ?? 'var(--color-field-line)',
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-mono-score text-xs font-700 shrink-0"
              style={{
                background: style?.badge ?? 'var(--color-field-surface-raised)',
                color: style ? style.text : 'var(--color-text-muted)',
                border: style ? 'none' : '1px solid var(--color-field-line)',
              }}
            >
              {i + 1}
            </div>

            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-display text-sm font-700 shrink-0 overflow-hidden"
              style={{ background: 'var(--color-field-surface-raised)', border: '1px solid var(--color-field-line)' }}
            >
              {r.favorite_team ? (
                <img src={teamLogoUrl(r.favorite_team)} alt={r.favorite_team} className="w-full h-full object-contain p-1" loading="lazy" />
              ) : (
                r.display_name.charAt(0).toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {r.display_name}
                {r.streak >= 3 && (
                  <span className="text-[10px] font-mono-score" title={`Racha de ${r.streak}`}>🔥{r.streak}</span>
                )}
                {maxExact > 0 && r.exactHits === maxExact && (
                  <span className="text-[10px]" title="Mas marcadores exactos del grupo">🎯</span>
                )}
                {r.globalRank && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: 'rgba(242,183,5,0.12)', color: 'var(--color-light-amber)' }}
                    title="Posicion en el ranking global"
                  >
                    <IconGlobe size={9} /> #{r.globalRank}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] font-mono-score">
                {r.hits}/{r.played} Aciertos · Dif +{r.pointDiff}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="font-mono-score text-xl font-700 leading-none">{r.points}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">pts</div>
            </div>
          </button>
        )
      })}

      <p className="text-[10px] text-[var(--color-text-muted)] text-center pt-1">
        Desempate: 1) mas marcadores exactos, 2) menor diferencia de puntos (real vs. predicho, ambos equipos). Toca a alguien para ver sus stats.
      </p>

      {selectedPlayer && <PlayerStatsModal row={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </div>
  )
}