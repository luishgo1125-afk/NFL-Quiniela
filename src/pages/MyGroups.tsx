import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Group } from '../lib/types'
import { IconUsers, IconCopy, IconWhatsapp, IconGear } from '../components/icons'
import type { User } from '@supabase/supabase-js'

interface Member {
  user_id: string
  display_name: string
}

export default function MyGroups({ user, onEnter }: { user: User; onEnter: (g: Group) => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [membersByGroup, setMembersByGroup] = useState<Record<string, Member[]>>({})
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('group_members').select('groups(*)').eq('user_id', user.id)
      const gs: Group[] = (data ?? []).map((row: any) => row.groups).filter(Boolean)
      setGroups(gs)
      setLoading(false)

      const entries = await Promise.all(
        gs.map(async (g) => {
          const { data: rows } = await supabase
            .from('group_members')
            .select('user_id, profiles(display_name)')
            .eq('group_id', g.id)
          const members = (rows ?? []).map((r: any) => ({ user_id: r.user_id, display_name: r.profiles?.display_name ?? 'Jugador' }))
          return [g.id, members] as const
        })
      )
      setMembersByGroup(Object.fromEntries(entries))
    }
    load()
  }, [user.id])

  async function copyCode(g: Group) {
    try {
      await navigator.clipboard.writeText(g.invite_code)
      setCopiedId(g.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      // algunos navegadores bloquean el clipboard, sin drama
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl font-800">MIS GRUPOS</h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-8">Con quien estas jugando</p>

      {loading ? (
        <p className="text-[var(--color-text-muted)] text-sm">Cargando...</p>
      ) : groups.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">Todavia no perteneces a ningun grupo.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const members = membersByGroup[g.id] ?? []
            const isAdmin = g.created_by === user.id
            return (
              <div key={g.id} className="bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  {g.logo_url ? (
                    <img src={g.logo_url} alt={g.name} className="w-11 h-11 rounded-full object-cover border border-[var(--color-field-line)] shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] flex items-center justify-center text-lg shrink-0">🏈</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{g.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <IconUsers size={11} /> {members.length} miembro{members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  {members.map((m) => m.display_name).join(' · ') || 'Sin miembros'}
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onEnter(g)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--color-light-amber)] text-[var(--color-field-night)] hover:brightness-110 transition"
                  >
                    Ver quiniela
                  </button>
                  <button
                    onClick={() => copyCode(g)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] transition flex items-center gap-1"
                  >
                    <IconCopy size={11} /> {copiedId === g.id ? 'Copiado ✓' : 'Invitar'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Unete a mi quiniela "${g.name}" en Quiniela NFL. Codigo: ${g.invite_code}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[#25D366] hover:text-[#25D366] transition flex items-center gap-1"
                  >
                    <IconWhatsapp size={11} /> WhatsApp
                  </a>
                  {isAdmin && (
                    <button
                      onClick={() => onEnter(g)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--color-field-line)] text-[var(--color-text-muted)] hover:border-[var(--color-light-amber)] hover:text-[var(--color-light-amber)] transition flex items-center gap-1"
                    >
                      <IconGear size={11} /> Administrar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
