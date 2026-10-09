import { teamLogoUrl } from './teamLogos'
import { tr } from '../i18n'
import type { Group } from './types'

export interface SharePlayer { user_id: string; name: string; favorite_team: string | null }
export interface ShareGame { id: string; home_team: string; away_team: string; kickoff: string; status: string; home_score: number | null; away_score: number | null }
export interface SharePick { pred_home_score: number | null; pred_away_score: number | null; pred_winner?: string | null; pred_total?: number | null }

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

// Imagen con los pronosticos de todos los jugadores que ya confirmaron
// (una columna por jugador, una fila por partido).
export async function sharePicksImage(opts: {
  group: Group
  weekLabelText: string
  games: ShareGame[]            // ya ordenados por kickoff
  players: SharePlayer[]
  picks: Record<string, Record<string, SharePick>>   // user_id -> game_id -> pick
  winnerMode: boolean
  lastGameId: string | null
}) {
  const { group, weekLabelText, games, players, picks, winnerMode, lastGameId } = opts
  const display = "'Big Shoulders Display', 'Arial Narrow', Impact, Arial, sans-serif"
  try { await Promise.all([document.fonts.load(`800 40px 'Big Shoulders Display'`), document.fonts.load(`700 12px 'Space Grotesk'`)]) } catch { /* usa respaldo */ }

  const teams = Array.from(new Set(games.flatMap((g) => [g.home_team, g.away_team]).concat(players.map((p) => p.favorite_team).filter(Boolean) as string[])))
  const [groupLogo, appLogo, logoPairs] = await Promise.all([
    group.logo_url ? loadImage(group.logo_url) : Promise.resolve(null),
    loadImage('/logo.png'),
    Promise.all(teams.map(async (t) => [t, await loadImage(teamLogoUrl(t))] as const)),
  ])
  const logos = new Map(logoPairs)

  const leftW = 132
  const colW = 84
  const pad = 28
  const headerH = 118
  const nameH = 64
  const rowH = winnerMode ? 50 : 60
  const totalRowH = winnerMode ? 46 : 0
  const footerH = 64
  const width = Math.max(560, pad * 2 + leftW + players.length * colW)
  const height = headerH + nameH + games.length * rowH + totalRowH + footerH
  const SCALE = 2.5

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * SCALE)
  canvas.height = Math.round(height * SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(SCALE, SCALE)
  ctx.imageSmoothingQuality = 'high'

  // fondo + brillo
  ctx.fillStyle = '#090D14'
  ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, width * 0.7)
  glow.addColorStop(0, 'rgba(242,183,5,0.12)')
  glow.addColorStop(1, 'rgba(242,183,5,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, headerH + 60)

  // encabezado
  const lx = pad + 30, ly = 58
  ctx.save()
  ctx.beginPath(); ctx.arc(lx, ly, 30, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = '#161D28'; ctx.fillRect(lx - 30, ly - 30, 60, 60)
  if (groupLogo) ctx.drawImage(groupLogo, lx - 30, ly - 30, 60, 60)
  else { ctx.font = '28px Arial'; ctx.textAlign = 'center'; ctx.fillText('🏈', lx, ly + 10) }
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.fillStyle = '#F5F7FA'
  ctx.font = `800 40px ${display}`
  ctx.fillText(fit(ctx, group.name.toUpperCase(), width - pad * 2 - 200), lx + 44, ly + 4)
  ctx.fillStyle = '#F2B705'
  ctx.font = `700 22px ${display}`
  ctx.fillText(`${weekLabelText}  ·  ${tr('PRONÓSTICOS')}`, lx + 44, ly + 32)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#8D96A5'
  ctx.font = `600 12px 'Space Grotesk', Arial`
  ctx.fillText(players.length === 1 ? tr('1 jugador confirmado') : tr('{n} jugadores confirmados', { n: players.length }), width - pad, ly + 4)
  ctx.textAlign = 'left'

  const top = headerH
  ctx.strokeStyle = '#252D3A'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, top); ctx.lineTo(width - pad, top); ctx.stroke()

  const gridX = pad + leftW
  // columnas de jugadores
  players.forEach((p, i) => {
    const cx = gridX + i * colW + colW / 2
    const t = p.favorite_team ? logos.get(p.favorite_team) : null
    ctx.beginPath(); ctx.arc(cx, top + 22, 14, 0, Math.PI * 2)
    ctx.fillStyle = '#161D28'; ctx.fill(); ctx.strokeStyle = '#252D3A'; ctx.stroke()
    if (t) ctx.drawImage(t, cx - 10, top + 12, 20, 20)
    else { ctx.fillStyle = '#8D96A5'; ctx.font = `700 12px ${display}`; ctx.textAlign = 'center'; ctx.fillText(p.name.charAt(0).toUpperCase(), cx, top + 26) }
    ctx.textAlign = 'center'
    ctx.fillStyle = '#F5F7FA'
    ctx.font = `700 12px 'Space Grotesk', Arial`
    ctx.fillText(fit(ctx, p.name.toUpperCase(), colW - 8), cx, top + 52)
    ctx.textAlign = 'left'
  })

  const winnerOf = (pk: SharePick): 'home' | 'away' | 'tie' | null => {
    if (winnerMode) return (pk.pred_winner as any) ?? null
    if (pk.pred_home_score == null || pk.pred_away_score == null) return null
    return pk.pred_home_score > pk.pred_away_score ? 'home' : pk.pred_away_score > pk.pred_home_score ? 'away' : 'tie'
  }
  const actualWinner = (g: ShareGame): 'home' | 'away' | 'tie' | null =>
    g.status !== 'final' || g.home_score == null || g.away_score == null ? null : g.home_score > g.away_score ? 'home' : g.away_score > g.home_score ? 'away' : 'tie'

  const bodyTop = top + nameH
  games.forEach((g, r) => {
    const y = bodyTop + r * rowH
    if (r % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(pad, y, width - pad * 2, rowH) }
    // partido (visitante @ local)
    const aw = logos.get(g.away_team), hm = logos.get(g.home_team)
    const my = y + rowH / 2
    ctx.textAlign = 'center'
    if (aw) ctx.drawImage(aw, pad + 12, my - 14, 28, 28)
    else { ctx.fillStyle = '#F5F7FA'; ctx.font = `700 11px 'Space Grotesk', Arial`; ctx.fillText(g.away_team, pad + 26, my + 4) }
    ctx.fillStyle = '#8D96A5'; ctx.font = `700 13px Arial`; ctx.fillText('@', pad + 62, my + 5)
    if (hm) ctx.drawImage(hm, pad + 84, my - 14, 28, 28)
    else { ctx.fillStyle = '#F5F7FA'; ctx.font = `700 11px 'Space Grotesk', Arial`; ctx.fillText(g.home_team, pad + 98, my + 4) }
    ctx.textAlign = 'left'
    const real = actualWinner(g)

    players.forEach((p, i) => {
      const cx = gridX + i * colW + colW / 2
      const pk = picks[p.user_id]?.[g.id]
      const w = pk ? winnerOf(pk) : null
      if (!w) { ctx.fillStyle = '#3a4352'; ctx.font = `700 16px Arial`; ctx.textAlign = 'center'; ctx.fillText('—', cx, my + 5); ctx.textAlign = 'left'; return }
      const team = w === 'home' ? g.home_team : w === 'away' ? g.away_team : null
      const bx = cx - 30, bw = 60, bh = rowH - 10, by = y + 5
      let border = '#252D3A', bg = '#111720'
      if (real) {
        if (w === real) { border = '#3D8B5F'; bg = 'rgba(61,139,95,0.14)' }
        else { border = 'rgba(228,70,43,0.5)'; bg = 'rgba(228,70,43,0.07)' }
      }
      roundRect(ctx, bx, by, bw, bh, 8); ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 1.2; ctx.stroke()
      ctx.lineWidth = 1
      const img = team ? logos.get(team) : null
      const showScore = !winnerMode && pk && pk.pred_away_score != null && pk.pred_home_score != null
      const ls = showScore ? 28 : 32
      const iy = showScore ? by + 3 : by + (bh - ls) / 2
      if (img) ctx.drawImage(img, cx - ls / 2, iy, ls, ls)
      else { ctx.fillStyle = team ? '#F5F7FA' : '#8D96A5'; ctx.font = `700 11px 'Space Grotesk', Arial`; ctx.textAlign = 'center'; ctx.fillText(team ?? tr('EMP'), cx, showScore ? by + 22 : my + 4); ctx.textAlign = 'left' }
      if (showScore) {
        ctx.fillStyle = '#F5F7FA'; ctx.font = `700 11px 'JetBrains Mono', monospace`; ctx.textAlign = 'center'
        ctx.fillText(`${pk!.pred_away_score}-${pk!.pred_home_score}`, cx, by + bh - 4)
        ctx.textAlign = 'left'
      }
    })
  })

  // desempate (modo ganador): total de puntos del ultimo partido
  let endY = bodyTop + games.length * rowH
  if (winnerMode && lastGameId) {
    ctx.fillStyle = '#F2B705'; ctx.font = `700 11px 'Space Grotesk', Arial`; ctx.letterSpacing = '1px'
    ctx.fillText(tr('TOTAL ÚLT. JUEGO'), pad + 12, endY + totalRowH / 2 + 4)
    ctx.letterSpacing = '0px'
    players.forEach((p, i) => {
      const cx = gridX + i * colW + colW / 2
      const t = picks[p.user_id]?.[lastGameId]?.pred_total
      ctx.textAlign = 'center'
      ctx.fillStyle = t != null ? '#F2B705' : '#3a4352'
      ctx.font = `800 22px ${display}`
      ctx.fillText(t != null ? String(t) : '—', cx, endY + totalRowH / 2 + 7)
      ctx.textAlign = 'left'
    })
    endY += totalRowH
  }

  ctx.strokeStyle = '#252D3A'; ctx.beginPath(); ctx.moveTo(pad, endY + 8); ctx.lineTo(width - pad, endY + 8); ctx.stroke()
  if (appLogo) {
    const h = 24, w = (appLogo.width / appLogo.height) * h
    ctx.drawImage(appLogo, width / 2 - w / 2, endY + 8 + (footerH - 8) / 2 - h / 2, w, h)
  } else {
    ctx.fillStyle = '#8D96A5'; ctx.font = '600 12px Arial'; ctx.textAlign = 'center'
    ctx.fillText(tr('QUINIELA · PREDICE. COMPITE. GANA.'), width / 2, endY + 40); ctx.textAlign = 'left'
  }

  await new Promise<void>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve()
      const file = new File([blob], `${tr('pronosticos')}-${group.name.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: tr('Pronósticos de {name}', { name: group.name }) }); return resolve() } catch { /* cae a descarga */ }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}
