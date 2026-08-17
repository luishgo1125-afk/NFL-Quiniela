import { useState } from 'react'
import { supabase } from '../lib/supabase'

export const SUPER_ADMIN_ID = '74e0edbd-0c42-41fc-a001-238fbfd1a19f'

export default function NewGroupModal({ canCreate, onClose, onDone }: { canCreate: boolean; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<'crear' | 'unirme'>(canCreate ? 'crear' : 'unirme')
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

        {canCreate && (
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
        )}

        {canCreate && tab === 'crear' ? (
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
