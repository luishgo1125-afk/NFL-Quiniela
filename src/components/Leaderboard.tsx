import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { teamLogoUrl } from '../lib/teamLogos'
import type { Group } from '../lib/types'

interface Row {
  user_id: string
  display_name: string
  favorite_team: string | null
  points: number
  hits: number
  played: number
  exactHits: number
  streak: number
}

const RANK_STYLES = [
  { bg: 'rgba(242,183,5,0.12)', border: 'var(--color-light-amber)', badge: '#F2B705', text: '#0A0E13' },
  { bg: 'rgba(200,200,210,0.08)', border: '#9AA3AF', badge: '#C7CCD3', text: '#0A0E13' },
  { bg: 'rgba(180,120,60,0.10)', border: '#B47A3C', badge: '#C98A4B', text: '#0A0E13' },
]

// Dibuja la tabla como imagen (sin logos de equipo, para evitar problemas de
// CORS con el CDN de ESPN al exportar el canvas) y la comparte o descarga.
async function shareLeaderboardImage(groupName: string, rows: Row[]) {
  const rowHeight = 64
  const headerHeight = 110
  const footerHeight = 50
  const width = 720
  const height = headerHeight + rows.length * rowHeight + footerHeight

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // fondo
  ctx.fillStyle = '#0A0E13'
  ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, width * 0.7)
  glow.addColorStop(0, 'rgba(242,183,5,0.10)')
  glow.addColorStop(1, 'rgba(242,183,5,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, headerHeight + 40)

  // encabezado
  ctx.fillStyle = '#ECEFF3'
  ctx.font = '700 30px Arial'
  ctx.fillText(groupName.toUpperCase(), 28, 46)
  ctx.fillStyle = '#8A94A3'
  ctx.font = '400 15px Arial'
  ctx.fillText('Tabla de posiciones · Quiniela NFL', 28, 72)
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

    // numero de posicion
    ctx.fillStyle = i < 3 ? rankColors[i] : '#8A94A3'
    ctx.font = '700 20px Arial'
    ctx.fillText(String(i + 1), 28, y + rowHeight / 2 + 7)

    // avatar (inicial)
    const cx = 76, cy = y + rowHeight / 2
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

    // nombre
    ctx.fillStyle = '#ECEFF3'
    ctx.font = '600 18px Arial'
    ctx.fillText(r.display_name, 108, y + rowHeight / 2)
    ctx.fillStyle = '#8A94A3'
    ctx.font = '400 13px Arial'
    ctx.fillText(`${r.hits}/${r.played} aciertos`, 108, y + rowHeight / 2 + 20)

    // puntos
    ctx.fillStyle = '#ECEFF3'
    ctx.font = '700 26px Arial'
    ctx.textAlign = 'right'
    ctx.fillText(String(r.points), width - 28, y + rowHeight / 2 + 5)
    ctx.font = '400 12px Arial'
    ctx.fillStyle = '#8A94A3'
    ctx.fillText('pts', width - 28, y + rowHeight / 2 + 22)
    ctx.textAlign = 'left'
  })

  ctx.fillStyle = '#8A94A3'
  ctx.font = '400 12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🏈 Quiniela NFL', width / 2, height - 20)
  ctx.textAlign = 'left'

  canvas.toBlob(async (blob) => {
    if (!blob) return
    const file = new File([blob], `tabla-${groupName.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Tabla de ${groupName}` })
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

export default function Leaderboard({ group }: { group: Group }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, profiles(display_name, favorite_team)')
        .eq('group_id', group.id)

      const { data: games } = await supabase
        .from('games')
        .select('id, kickoff')
        .eq('group_id', group.id)
        .eq('status', 'final')
        .order('kickoff', { ascending: false })

      const finalGameIds = (games ?? []).map((g) => g.id)
      const kickoffByGame: Record<string, string> = {}
      ;(games ?? []).forEach((g) => { kickoffByGame[g.id] = g.kickoff })

      let picks: any[] = []
      if (finalGameIds.length) {
        const { data } = await supabase.from('picks').select('user_id, game_id, points').in('game_id', finalGameIds)
        picks = data ?? []
      }

      const byUser: Record<string, any[]> = {}
      picks.forEach((p) => {
        byUser[p.user_id] = byUser[p.user_id] ?? []
        byUser[p.user_id].push(p)
      })

      const result: Row[] = (members ?? []).map((m: any) => {
        const userPicks = (byUser[m.user_id] ?? []).slice().sort(
          (a, b) => new Date(kickoffByGame[b.game_id]).getTime() - new Date(kickoffByGame[a.game_id]).getTime()
        )
        let points = 0
        let hits = 0
        let exactHits = 0
        userPicks.forEach((p) => {
          points += p.points ?? 0
          if ((p.points ?? 0) > 0) hits++
          if (p.points === group.points_exact) exactHits++
        })
        let streak = 0
        for (const p of userPicks) {
          if ((p.points ?? 0) > 0) streak++
          else break
        }
        return {
          user_id: m.user_id,
          display_name: m.profiles?.display_name ?? 'Jugador',
          favorite_team: m.profiles?.favorite_team ?? null,
          points,
          hits,
          played: userPicks.length,
          exactHits,
          streak,
        }
      })
      result.sort((a, b) => b.points - a.points || b.exactHits - a.exactHits || b.hits - a.hits)
      setRows(result)
      setLoading(false)
    }
    load()
  }, [group.id, group.points_exact])

  if (loading) return <p className="text-[var(--color-text-muted)] text-sm">Cargando tabla...</p>
  if (rows.length === 0) return <p className="text-[var(--color-text-muted)] text-sm">Todavia no hay nadie en este grupo.</p>

  const maxExact = Math.max(0, ...rows.map((r) => r.exactHits))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Desempate: 1) mas marcadores exactos, 2) mas aciertos totales.
        </p>
        <button
          onClick={() => shareLeaderboardImage(group.name, rows)}
          className="text-xs font-semibold text-[var(--color-light-amber)] hover:underline shrink-0 flex items-center gap-1"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Compartir
        </button>
      </div>
      {rows.map((r, i) => {
        const style = RANK_STYLES[i]
        return (
          <div
            key={r.user_id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border"
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
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] font-mono-score">
                {r.hits}/{r.played} aciertos
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="font-mono-score text-xl font-700 leading-none">{r.points}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">pts</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
