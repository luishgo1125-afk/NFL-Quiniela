import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'

interface Member {
  user_id: string
  display_name: string
}

export default function DangerZone({
  group,
  onGroupUpdated,
  onLeftAdmin,
  onDeleted,
}: {
  group: Group
  onGroupUpdated: (g: Group) => void
  onLeftAdmin: () => void
  onDeleted: () => void
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('group_members')
      .select('user_id, profiles(display_name)')
      .eq('group_id', group.id)
      .neq('user_id', group.created_by)
      .then(({ data }) => {
        const list = (data ?? []).map((row: any) => ({
          user_id: row.user_id,
          display_name: row.profiles?.display_name ?? 'Jugador',
        }))
        setMembers(list)
      })
  }, [group.id])

  async function transfer(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (!confirm('¿Seguro? Dejaras de ser el administrador de esta liga.')) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('transfer_admin', { p_group_id: group.id, p_new_admin: selected })
    setBusy(false)
    if (err) { setError(err.message); return }
    onGroupUpdated(data)
    onLeftAdmin()
  }

  async function remove() {
    if (!confirm(`¿Seguro que quieres eliminar "${group.name}"? Se borraran todos los partidos y predicciones. Esto no se puede deshacer.`)) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('delete_group', { p_group_id: group.id })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDeleted()
  }

  return (
    <div className="bg-[var(--color-field-surface)] border border-[var(--color-scoreboard-red)]/40 rounded-lg p-4 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--color-scoreboard-red)]">Zona de peligro</h2>

      {members.length > 0 && (
        <form onSubmit={transfer} className="space-y-2">
          <label className="text-xs text-[var(--color-text-muted)]">Transferir administracion a</label>
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            >
              <option value="">Elige a alguien</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
            </select>
            <button
              type="submit"
              disabled={busy || !selected}
              className="text-xs font-semibold rounded-md px-3 border border-[var(--color-light-amber)] text-[var(--color-light-amber)] hover:bg-[var(--color-light-amber)] hover:text-[var(--color-field-night)] transition disabled:opacity-50"
            >
              Transferir
            </button>
          </div>
        </form>
      )}

      <button
        onClick={remove}
        disabled={busy}
        className="w-full text-xs font-semibold rounded-md py-2 bg-[var(--color-scoreboard-red)] text-white hover:brightness-110 disabled:opacity-50"
      >
        Eliminar liga permanentemente
      </button>

      {error && <p className="text-[var(--color-scoreboard-red)] text-xs">{error}</p>}
    </div>
  )
}
