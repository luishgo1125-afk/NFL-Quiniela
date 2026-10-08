import EmptyState from '../components/EmptyState'
import { RankAvatar, Podium, firstName } from '../components/RankParts'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { teamLogoUrl } from '../lib/teamLogos'
import { IconGlobe, IconStar, IconTarget, IconPercent, IconShare, IconHash, IconUser } from '../components/icons'
import type { User } from '@supabase/supabase-js'
import { fetchGlobalRanking, type RankMode } from '../lib/globalRank'

interface RankRow {
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

const RANK_STYLES = [
  { bg: 'rgba(242,183,5,0.10)', border: 'var(--color-light-amber)', badge: '#F2B705', text: '#0A0E13' },
  { bg: 'rgba(200,200,210,0.06)', border: '#9AA3AF', badge: '#C7CCD3', text: '#0A0E13' },
  { bg: 'rgba(180,120,60,0.08)', border: '#B47A3C', badge: '#C98A4B', text: '#0A0E13' },
]

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

async function shareGlobalRankingImage(rows: RankRow[]) {
  const rowHeight = 66
  const headerHeight = 96
  const footerHeight = 48
  const width = 720
  const height = headerHeight + rows.length * rowHeight + footerHeight

  const uniqueTeams = Array.from(new Set(rows.map((r) => r.favorite_team).filter(Boolean))) as string[]
  const [appLogoImg, teamLogoImgs] = await Promise.all([
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
  ctx.fillRect(0, 0, width, headerHeight + 20)

  ctx.fillStyle = '#ECEFF3'
  ctx.font = '700 28px Arial'
  ctx.fillText('RANKING GLOBAL', 28, 44)
  ctx.fillStyle = '#8A94A3'
  ctx.font = '400 13px Arial'
  ctx.fillText('Puntos, marcadores exactos y % de aciertos', 28, 66)

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
    ctx.fillText(String(i + 1), 26, y + rowHeight / 2 + 7)

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
    ctx.fillText(`${r.total_hits}/${r.total_played} aciertos`, 108, y + rowHeight / 2 + 20)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ECEFF3'
    ctx.font = '700 20px Arial'
    ctx.fillText(String(r.total_points), width - 220, y + rowHeight / 2 - 2)
    ctx.fillStyle = '#8A94A3'
    ctx.font = '400 10px Arial'
    ctx.fillText('pts', width - 220, y + rowHeight / 2 + 16)

    ctx.fillStyle = '#ECEFF3'
    ctx.font = '700 20px Arial'
    ctx.fillText(String(r.exact_hits), width - 120, y + rowHeight / 2 - 2)
    ctx.fillStyle = '#8A94A3'
    ctx.font = '400 10px Arial'
    ctx.fillText('exactos', width - 120, y + rowHeight / 2 + 16)

    ctx.fillStyle = '#F2B705'
    ctx.font = '700 20px Arial'
    ctx.fillText(`${Math.round(r.hit_pct)}%`, width - 30, y + rowHeight / 2 - 2)
    ctx.fillStyle = '#8A94A3'
    ctx.font = '400 10px Arial'
    ctx.fillText('aciertos', width - 30, y + rowHeight / 2 + 16)
    ctx.textAlign = 'left'
  })

  if (appLogoImg) {
    const logoH = 20
    const logoW = (appLogoImg.width / appLogoImg.height) * logoH
    ctx.drawImage(appLogoImg, width / 2 - logoW / 2, height - footerHeight / 2 - logoH / 2, logoW, logoH)
  } else {
    ctx.fillStyle = '#8A94A3'
    ctx.font = '400 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('🏈 Quiniela NFL', width / 2, height - 18)
    ctx.textAlign = 'left'
  }

  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], 'ranking-global.png', { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Ranking global' })
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

export default function GlobalRanking({ user }: { user: User }) {
  const [rows, setRows] = useState<RankRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [mode, setMode] = useState<RankMode>('score')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await fetchGlobalRanking(mode)
      setRows(data as RankRow[])
      setLoading(false)
    }
    load()
  }, [mode])

  async function handleShare() {
    if (rows.length === 0 || sharing) return
    setSharing(true)
    try {
      await shareGlobalRankingImage(rows)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="page-wrap narrow">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-display text-4xl font-800 flex items-center gap-3">
          <IconGlobe size={32} className="text-[var(--color-light-amber)]" /> RANKING GLOBAL
        </h1>
        {rows.length > 0 && (
          <button
            onClick={handleShare}
            disabled={sharing}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border border-[var(--color-light-amber)] text-[var(--color-light-amber)] hover:bg-[var(--color-light-amber)] hover:text-[var(--color-field-night)] transition disabled:opacity-50"
          >
            <IconShare size={14} /> {sharing ? 'Generando...' : 'Compartir'}
          </button>
        )}
      </div>
      <p className="text-[var(--color-text-muted)] text-sm mb-4">Cada partido cuenta una sola vez, aunque lo hayas predicho en varias ligas. Un ranking por modalidad.</p>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={() => setMode('score')}
          className={`text-xs font-semibold py-2 rounded-md border transition ${
            mode === 'score'
              ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.12)] text-[var(--color-light-amber)]'
              : 'border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)]'
          }`}
        >
          Marcador exacto
        </button>
        <button
          onClick={() => setMode('winner')}
          className={`text-xs font-semibold py-2 rounded-md border transition ${
            mode === 'winner'
              ? 'border-[var(--color-light-amber)] bg-[rgba(242,183,5,0.12)] text-[var(--color-light-amber)]'
              : 'border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)]'
          }`}
        >
          Solo ganador
        </button>
      </div>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconGlobe size={32} />}
          title="Aún sin resultados"
          text={mode === 'winner' ? 'Aún no hay resultados en ligas de solo ganador.' : 'Cuando terminen los primeros partidos, el ranking aparecerá aquí.'}
        />
      ) : (
        <>
          <Podium
            items={rows.slice(0, 3).map((r, i) => ({
              pos: (i + 1) as 1 | 2 | 3,
              name: firstName(r.display_name),
              team: r.favorite_team,
              isMe: r.user_id === user.id,
              points: r.total_points,
              line: `${r.exact_hits} exactos · ${Math.round(r.hit_pct)}%`,
            }))}
          />
          {rows.length > 3 && (
            <div className="rk-table rk-global">
              <div className="rk-head" style={{ ['--cols' as any]: '36px minmax(0,1fr) 56px 64px 72px' }}>
                <span className="rk-c">#</span>
                <span>Jugador</span>
                <span className="rk-c">Pts</span>
                <span className="rk-c"><span className="rk-lg">Exactos</span><span className="rk-sm">Ex.</span></span>
                <span className="rk-c"><span className="rk-lg">% Aciertos</span><span className="rk-sm">%</span></span>
              </div>
              {rows.slice(3).map((r, idx) => {
                const isMe = r.user_id === user.id
                return (
                  <div key={r.user_id} className={`rk-row${isMe ? ' me' : ''}`} style={{ ['--cols' as any]: '36px minmax(0,1fr) 56px 64px 72px' }}>
                    <span className="rk-pos">{idx + 4}</span>
                    <div className="rk-player">
                      <RankAvatar name={r.display_name} team={r.favorite_team} />
                      <div className="rk-who">
                        <b><span className="n">{firstName(r.display_name)}</span>{isMe && <span className="rk-tag">TÚ</span>}</b>
                        <small>{r.total_hits}/{r.total_played} · Dif +{r.point_diff}</small>
                      </div>
                    </div>
                    <span className="rk-num big">{r.total_points}</span>
                    <span className="rk-num">{r.exact_hits}</span>
                    <div className="rk-pct">
                      <span className="rk-num amber" style={{ fontSize: 15 }}>{Math.round(r.hit_pct)}%</span>
                      <i><s style={{ width: `${Math.min(100, Math.round(r.hit_pct))}%` }} /></i>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-[var(--color-text-muted)] text-center mt-6">
        El ranking se actualiza automaticamente despues de cada jornada.
      </p>
    </div>
  )
}
