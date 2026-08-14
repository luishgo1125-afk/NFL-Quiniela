import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'
import type { User } from '@supabase/supabase-js'

export default function Groups({ user, onSelect }: { user: User; onSelect: (g: Group) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function loadGroups() {
    setLoading(true)
    const { data } = await supabase
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', user.id)
    const gs = (data ?? []).map((row: any) => row.groups).filter(Boolean)
    setGroups(gs)
    setLoading(false)
  }

  useEffect(() => { loadGroups() }, [])

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { data, error: err } = await supabase.rpc('create_group', { p_name: newName })
    if (err) { setError(err.message); return }
    setNewName('')
    loadGroups()
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { data, error: err } = await supabase.rpc('join_group', { p_invite_code: joinCode.trim().toUpperCase() })
    if (err) { setError(err.message); return }
    setJoinCode('')
    loadGroups()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl font-800 mb-1">MIS QUINIELAS</h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-8">Elige un grupo o crea uno nuevo</p>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : groups.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm mb-8">Todavia no perteneces a ningun grupo.</p>
      ) : (
        <div className="space-y-2 mb-10">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              className="w-full text-left bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg px-4 py-3 hover:border-[var(--color-light-amber)] transition flex items-center justify-between"
            >
              <span className="font-medium">{g.name}</span>
              <span className="font-mono-score text-xs text-[var(--color-text-muted)]">#{g.invite_code}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[var(--color-scoreboard-red)] text-xs mb-4">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <form onSubmit={createGroup} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Crear grupo</h2>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre del grupo"
            required
            className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)] mb-3"
          />
          <button type="submit" className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110">
            Crear
          </button>
        </form>

        <form onSubmit={joinGroup} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Unirme con codigo</h2>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Codigo de invitacion"
            required
            className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)] mb-3 font-mono-score"
          />
          <button type="submit" className="w-full border border-[var(--color-light-amber)] text-[var(--color-light-amber)] font-semibold rounded-md py-2 text-sm hover:bg-[var(--color-light-amber)] hover:text-[var(--color-field-night)] transition">
            Unirme
          </button>
        </form>
      </div>
    </div>
  )
}