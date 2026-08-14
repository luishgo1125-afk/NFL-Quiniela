import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Row {
  user_id: string
  display_name: string
  points: number
}

export default function Leaderboard({ groupId }: { groupId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id, profiles(display_name)')
        .eq('group_id', groupId)

      const { data: games } = await supabase.from('games').select('id').eq('group_id', groupId)
      const gameIds = (games ?? []).map((g) => g.id)

      let picks: any[] = []
      if (gameIds.length) {
        const { data } = await supabase.from('picks').select('user_id, points').in('game_id', gameIds)
        picks = data ?? []
      }

      const totals: Record<string, number> = {}
      picks.forEach((p) => {
        totals[p.user_id] = (totals[p.user_id] ?? 0) + (p.points ?? 0)
      })

      const result: Row[] = (members ?? []).map((m: any) => ({
        user_id: m.user_id,
        display_name: m.profiles?.display_name ?? 'Jugador',
        points: totals[m.user_id] ?? 0,
      }))
      result.sort((a, b) => b.points - a.points)
      setRows(result)
      setLoading(false)
    }
    load()
  }, [groupId])

  if (loading) return <p className="text-[var(--color-text-muted)] text-sm">Cargando tabla...</p>

  return (
    <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg overflow-hidden">
      {rows.map((r, i) => (
        <div
          key={r.user_id}
          className={`flex items-center justify-between px-4 py-3 ${i !== rows.length - 1 ? 'border-b border-[var(--color-field-line)]' : ''}`}
        >
          <div className="flex items-center gap-3">
            <span className={`font-mono-score text-sm w-6 ${i === 0 ? 'text-[var(--color-light-amber)]' : 'text-[var(--color-text-muted)]'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-sm font-medium">{r.display_name}</span>
          </div>
          <span className="font-mono-score text-lg font-700">{r.points}</span>
        </div>
      ))}
    </div>
  )
}
