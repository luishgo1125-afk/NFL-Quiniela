import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'
import { teamLogoUrl } from '../lib/teamLogos'

interface Member {
  user_id: string
  display_name: string
  favorite_team: string | null
}

export default function MembersManager({ group }: { group: Group }) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('group_members')
      .select('user_id, profiles(display_name, favorite_team)')
      .eq('group_id', group.id)
    const list: Member[] = (data ?? []).map((row: any) => ({
      user_id: row.user_id,
      display_name: row.profiles?.display_name ?? 'Jugador',
      favorite_team: row.profiles?.favorite_team ?? null,
    }))
    setMembers(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [group.id])

  async function removeMember(userId: string) {
    setError(null)
    setBusyId(userId)
    const { error: err } = await supabase.rpc('remove_member', { p_group_id: group.id, p_user_id: userId })
    setBusyId(null)
    if (err) { setError(err.message); return }
    load()
  }

  return (
    <div className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold">Miembros de la liga</h2>
      {loading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando...</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m) => {
            const isAdmin = m.user_id === group.created_by
            return (
              <div
                key={m.user_id}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)]"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0 bg-[var(--color-field-surface)] border border-[var(--color-field-line)]">
                  {m.favorite_team ? (
                    <img src={teamLogoUrl(m.favorite_team)} alt={m.favorite_team} className="w-full h-full object-contain p-1" loading="lazy" />
                  ) : (
                    <span className="text-xs font-display font-700">{m.display_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="text-sm flex-1 truncate">{m.display_name}</span>
                {isAdmin ? (
                  <span className="text-[10px] font-semibold text-[var(--color-light-amber)] shrink-0">ADMIN</span>
                ) : (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    disabled={busyId === m.user_id}
                    className="text-xs text-[var(--color-scoreboard-red)] hover:underline shrink-0 disabled:opacity-50"
                  >
                    {busyId === m.user_id ? 'Quitando...' : 'Quitar'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
    </div>
  )
}
