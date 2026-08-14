import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { teamLogoUrl } from '../lib/teamLogos'

interface Row {
  user_id: string
  display_name: string
  favorite_team: string | null
  points: number
  hits: number
  played: number
}

const RANK_STYLES = [
  { bg: 'rgba(242,183,5,0.12)', border: 'var(--color-light-amber)', badge: '#F2B705', text: '#0A0E13' },
  { bg: 'rgba(200,200,210,0.08)', border: '#9AA3AF', badge: '#C7CCD3', text: '#0A0E13' },
  { bg: 'rgba(180,120,60,0.10)', border: '#B47A3C', badge: '#C98A4B', text: '#0A0E13' },
]

export default function Leaderboard({ groupId }: { groupId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, profiles(display_name, favorite_team)')
        .eq('group_id', groupId)

      const { data: games } = await supabase.from('games').select('id, status').eq('group_id', groupId)
      const finalGameIds = (games ?? []).filter((g) => g.status === 'final').map((g) => g.id)

      let picks: any[] = []
      if (finalGameIds.length) {
        const { data } = await supabase.from('picks').select('user_id, points').in('game_id', finalGameIds)
        picks = data ?? []
      }

      const totals: Record<string, { points: number; hits: number; played: number }> = {}
      picks.forEach((p) => {
        const cur = totals[p.user_id] ?? { points: 0, hits: 0, played: 0 }
        cur.points += p.points ?? 0
        cur.played += 1
        if ((p.points ?? 0) > 0) cur.hits += 1
        totals[p.user_id] = cur
      })

      const result: Row[] = (members ?? []).map((m: any) => ({
        user_id: m.user_id,
        display_name: m.profiles?.display_name ?? 'Jugador',
        favorite_team: m.profiles?.favorite_team ?? null,
        points: totals[m.user_id]?.points ?? 0,
        hits: totals[m.user_id]?.hits ?? 0,
        played: totals[m.user_id]?.played ?? 0,
      }))
      result.sort((a, b) => b.points - a.points)
      setRows(result)
      setLoading(false)
    }
    load()
  }, [groupId])

  if (loading) return <p className="text-[var(--color-text-muted)] text-sm">Cargando tabla...</p>
  if (rows.length === 0) return <p className="text-[var(--color-text-muted)] text-sm">Todavia no hay nadie en este grupo.</p>

  return (
    <div className="space-y-2">
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
              <div className="text-sm font-medium truncate">{r.display_name}</div>
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
