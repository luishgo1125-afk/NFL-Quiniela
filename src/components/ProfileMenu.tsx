import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-700">{title}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ProfileModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('profiles').select('display_name').eq('id', user.id).single().then(({ data }) => {
      setName(data?.display_name ?? '')
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    setMsg(null)
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', user.id)
    setSaving(false)
    setMsg(error ? error.message : 'Guardado.')
  }

  return (
    <ModalShell title="Mis datos" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-[var(--color-text-muted)]">Correo</label>
          <p className="text-sm">{user.email}</p>
        </div>
        <div>
          <label className="text-xs text-[var(--color-text-muted)]">Nombre</label>
          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Cargando...</p>
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
            />
          )}
        </div>
        {msg && <p className="text-xs text-[var(--color-turf-green)]">{msg}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </ModalShell>
  )
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (pw.length < 6) { setErr('La contrasena debe tener al menos 6 caracteres'); return }
    if (pw !== pw2) { setErr('Las contrasenas no coinciden'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSaving(false)
    if (error) setErr(error.message)
    else setOk(true)
  }

  return (
    <ModalShell title="Cambiar contrasena" onClose={onClose}>
      {ok ? (
        <p className="text-sm text-[var(--color-turf-green)]">Contrasena actualizada.</p>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <input
            type="password"
            placeholder="Nueva contrasena"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
          />
          <input
            type="password"
            placeholder="Confirmar contrasena"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full bg-[var(--color-field-surface-raised)] border border-[var(--color-field-line)] rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--color-light-amber)]"
          />
          {err && <p className="text-xs text-[var(--color-scoreboard-red)]">{err}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--color-light-amber)] text-[var(--color-field-night)] font-semibold rounded-md py-2 text-sm hover:brightness-110 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Actualizar contrasena'}
          </button>
        </form>
      )}
    </ModalShell>
  )
}

export default function ProfileMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<'password' | 'profile' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-light-amber)] transition"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[var(--color-field-surface)] border border-[var(--color-field-line)] rounded-lg shadow-xl overflow-hidden z-40">
          <button
            onClick={() => { setModal('profile'); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-field-surface-raised)]"
          >
            Mis datos de perfil
          </button>
          <button
            onClick={() => { setModal('password'); setOpen(false) }}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-field-surface-raised)]"
          >
            Cambiar contrasena
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-scoreboard-red)] hover:bg-[var(--color-field-surface-raised)]"
          >
            Cerrar sesion
          </button>
        </div>
      )}

      {modal === 'profile' && <ProfileModal user={user} onClose={() => setModal(null)} />}
      {modal === 'password' && <PasswordModal onClose={() => setModal(null)} />}
    </div>
  )
}
