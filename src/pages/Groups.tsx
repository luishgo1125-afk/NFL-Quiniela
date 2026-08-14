import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'
import type { User } from '@supabase/supabase-js'

function NewGroupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'crear' | 'unirme'>('crear')
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function createGroup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.rpc('create_group', { p_name: newName })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDone()
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.rpc('join_group', { p_invite_code: joinCode.trim().toUpperCase() })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDone()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-700">Nueva quiniela</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>
        </div>

        <div className="flex gap-1 mb-4 rounded-md overflow-hidden border border-[var(--color-field-line)] w-fit">
          <button
            onClick={() => setTab('crear')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'crear' ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
          >
            Crear
          </button>
          <button
            onClick={() => setTab('unirme')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'unirme' ? 'bg-[var(--color-light-amber)] text-[var(--color-field-night)]' : 'text-[var(--color-text-muted)]'}`}
          >
            Unirme
          </button>
        </div>

        {tab === 'crear' ? (
          <form onSubmit={createGroup} className="space-y-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del grupo"
              required
              className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
            {error && <p className="text-xs text-[var(--color-scoreboard-red)]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Creando...' : 'Crear'}
            </button>
          </form>
        ) : (
          <form onSubmit={joinGroup} className="space-y-3">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Codigo de invitacion"
              required
              className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)] font-mono-score"
            />
            {error && <p className="text-xs text-[var(--color-scoreboard-red)]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full border border-[var(--color-light-amber)] text-[var(--color-light-amber)] font-semibold rounded-md py-2 text-sm hover:bg-[var(--color-light-amber)] hover:text-[var(--color-field-night)] transition disabled:opacity-50"
            >
              {busy ? 'Uniendo...' : 'Unirme'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Groups({ user, onSelect }: { user: User; onSelect: (g: Group) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-800">MIS QUINIELAS</h1>
        <button
          onClick={() => setShowModal(true)}
          aria-label="Nueva quiniela"
          className="w-10 h-10 rounded-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] text-2xl font-bold flex items-center justify-center hover:brightness-110 transition shrink-0 leading-none"
        >
          +
        </button>
      </div>
      <p className="text-[var(--color-text-muted)] text-sm mb-8">Elige un grupo</p>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : groups.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">
          Todavia no perteneces a ningun grupo. Da clic en el + para crear uno o unirte con un codigo.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              className="w-full text-left bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg px-4 py-3 hover:border-[var(--color-light-amber)] transition flex items-center gap-3"
            >
              {g.logo_url ? (
                <img src={g.logo_url} alt={g.name} className="w-9 h-9 rounded-full object-cover border border-[var(--color-field-line)] shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center text-sm shrink-0">🏈</div>
              )}
              <span className="font-medium flex-1">{g.name}</span>
              <span className="font-mono-score text-xs text-[var(--color-text-muted)]">#{g.invite_code}</span>
            </button>
          ))}
        </div>
      )}

      {showModal && (
        <NewGroupModal
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); loadGroups() }}
        />
      )}
    </div>
  )
}
