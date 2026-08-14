import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Game, Group } from '../lib/types'
import GameCard from '../components/GameCard'
import Leaderboard from '../components/Leaderboard'
import Admin from './Admin'
import type { User } from '@supabase/supabase-js'

export default function GroupDashboard({ group, user, onBack }: { group: Group; user: User; onBack: () => void }) {
  const [tab, setTab] = useState<'picks' | 'tabla' | 'admin'>('picks')
  const [games, setGames] = useState<Game[]>([])
  const [week, setWeek] = useState(1)
  const isAdmin = group.created_by === user.id

  async function loadGames() {
    const { data } = await supabase.from('games').select('*').eq('group_id', group.id).order('kickoff')
    setGames(data ?? [])
  }

  useEffect(() => { loadGames() }, [group.id])

  const weeks = useMemo(() => {
    const set = new Set(games.map((g) => g.week))
    if (set.size === 0) set.add(1)
    return Array.from(set).sort((a, b) => a - b)
  }, [games])

  const weekGames = games.filter((g) => g.week === week)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] mb-4">
        ← Mis quinielas
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-800">{group.name}</h1>
          <p className="text-xs text-[var(--color-text-muted)] font-mono-score">Codigo de invitacion: #{group.invite_code}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 rounded-md overflow-hidden border border-[var(--color-field-line)] w-fit">
        {(['picks', 'tabla'] as const).concat(isAdmin ? ['admin'] : []).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
          >
            {t === 'picks' ? 'Predicciones' : t === 'tabla' ? 'Tabla' : 'Administrar'}
          </button>
        ))}
      </div>

      {tab === 'picks' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {weeks.map((w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className={`font-mono-score text-xs px-3 py-1 rounded-full border ${week === w ? 'border-[var(--color-light-amber)] text-[var(--color-light-amber)]' : 'border-[var(--color-field-line)] text-[var(--color-text-muted)]'}`}
              >
                SEM {String(w).padStart(2, '0')}
              </button>
            ))}
          </div>
          {weekGames.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {isAdmin ? 'Todavia no capturas partidos. Ve a la pestaña Administrar.' : 'El administrador aun no captura partidos para esta semana.'}
            </p>
          ) : (
            <div className="space-y-3">
              {weekGames.map((g) => (
                <GameCard key={g.id} game={g} userId={user.id} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'tabla' && <Leaderboard groupId={group.id} />}

      {tab === 'admin' && isAdmin && (
        <Admin groupId={group.id} games={games} onChange={loadGames} />
      )}
    </div>
  )
}
